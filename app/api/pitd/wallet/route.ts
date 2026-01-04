import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config"
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user"

// --- Helpers ---------------------------------------------------------------

function jsonErr(status: number, message: string, extra?: any) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(extra ? { extra } : {}),
    },
    { status },
  )
}

function wantsDbg(req: NextRequest) {
  return req.nextUrl.searchParams.get("dbg") === "1"
}

function makeDbgSnapshot(input: any) {
  // Keep this compact; Pi Browser has no console.
  return {
    ts: new Date().toISOString(),
    ...input,
  }
}

function randomAddress(): string {
  // Internal (off-chain) wallet address. Keep a stable prefix so UI can always display it.
  // Format: PITD_XXXXXXXXXXXXXXXXXXXXXXXX (24 chars after underscore)
  const s = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join("")
  return `PITD_${s.toUpperCase()}`
}

async function resolveUserId(req: NextRequest) {
  // 1) Prefer Supabase Auth token (email/username login)
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : ""

  if (token) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user?.id) {
      return { kind: "supabase" as const, ok: false, reason: error?.message || "Invalid Supabase token" }
    }
    return { kind: "supabase" as const, ok: true, userId: data.user.id }
  }

  // 2) Fallback: Pi login path (no Supabase token in header)
  // Account page sends these headers.
  const piUserId = req.headers.get("x-pi-user-id")?.trim() || ""
  const piUsername = req.headers.get("x-pi-username")?.trim() || ""
  if (!piUserId) {
    return { kind: "none" as const, ok: false, reason: "Missing auth" }
  }

  // Basic verification (server-side) to reduce spoofing:
  // Ensure this Pi user exists in DB and username matches (if provided).
  const admin = getSupabaseAdminClient()

  const { data: piRow, error: piErr } = await admin
    .from("pi_users")
    .select("id, pi_username, pi_uid")
    .eq("id", piUserId)
    .maybeSingle()

  if (piErr || !piRow?.id) {
    return { kind: "pi" as const, ok: false, reason: "Pi user not found" }
  }
  if (piUsername && piRow.pi_username && piUsername !== piRow.pi_username) {
    return { kind: "pi" as const, ok: false, reason: "Pi username mismatch" }
  }

  return { kind: "pi" as const, ok: true, userId: piUserId, piUsername: (piRow as any)?.pi_username ?? piUsername ?? null, piUid: (piRow as any)?.pi_uid ?? null }
}

// --- Route -----------------------------------------------------------------

export const dynamic = "force-dynamic"

/**
 * GET /api/pitd/wallet
 * Server-custodial PITD wallet endpoint.
 * Uses Supabase SERVICE ROLE on the server to bypass RLS and ensure wallet exists.
 */
export async function GET(req: NextRequest) {
  const dbg = wantsDbg(req)
  const dbgBase: any = dbg
    ? makeDbgSnapshot({
        route: "/api/pitd/wallet",
        hasAuth: Boolean(req.headers.get("authorization")),
        xPiUserId: req.headers.get("x-pi-user-id") || null,
        xPiUsername: req.headers.get("x-pi-username") || null,
      })
    : undefined

  try {
    const resolved = await resolveUserId(req)
    if (!resolved.ok) {
      return jsonErr(401, resolved.reason, dbg ? { dbg: dbgBase, kind: resolved.kind } : undefined)
    }

    const userId = resolved.userId
    const admin = getSupabaseAdminClient()

    // PITD data is keyed by the master user id in public.users.
    // For Pi login, ensure a corresponding public.users row exists and always use masterUserId.
    const master = await resolveMasterUserId(admin, userId)
    const masterUserId = master.userId

    // 1) Try read wallet
    // Backward-compatibility: older deployments may have stored pitd_wallets.user_id
    // as the raw Pi user id instead of the masterUserId. We try master first,
    // then fallback to the raw userId. This preserves existing balances/history.
    const candidateUserIds = Array.from(new Set([masterUserId, userId].filter(Boolean)))
    const { data: existing, error: readErr } = await admin
      .from("pitd_wallets")
      .select("id, user_id, balance, locked_balance, total_spent, address, created_at, updated_at")
      .in("user_id", candidateUserIds)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (readErr) {
      return jsonErr(500, "Failed to load PITD wallet", dbg ? { dbg: dbgBase, readErr } : undefined)
    }

    if (existing?.id) {
      // Backfill address for legacy rows that were created before we started
      // generating/storing PITD addresses.
      // Some older code accidentally stored placeholder values like '-' / '—' / 'N/A'
      // into the address column. Treat those as invalid too.
      const addrStr = existing.address == null ? "" : String(existing.address).trim()
      const addrInvalid =
        addrStr === "" ||
        addrStr === "-" ||
        addrStr === "—" ||
        addrStr.toLowerCase() === "n/a" ||
        // If it doesn't look like our PITD address format, treat as invalid.
        !addrStr.startsWith("PITD_")

      if (addrInvalid) {
        const newAddr = `PITD_${crypto.randomUUID().replace(/-/g, "")}`
        const { data: patched, error: patchErr } = await admin
          .from("pitd_wallets")
          .update({ address: newAddr })
          .eq("id", existing.id)
          .select("id,user_id,balance,locked_balance,total_spent,address")
          .maybeSingle()

        if (!patchErr && patched?.id) {
          return NextResponse.json(
            {
              ok: true,
              wallet: patched,
              ...(dbg
                ? {
                    dbg: {
                      ...dbgBase,
                      backfilled_address: true,
                      backfill_new_address: newAddr,
                    },
                  }
                : {}),
            },
            { status: 200 },
          )
        }

        // If patch failed, surface it in dbg so Pi Browser can screenshot the reason.
        if (dbg) {
          (dbgBase as any).backfilled_address = false
          (dbgBase as any).backfill_attempted = true
          (dbgBase as any).backfill_new_address = newAddr
          (dbgBase as any).backfill_error = patchErr?.message || patchErr || "unknown"
        }
      }

      return NextResponse.json(
        {
          ok: true,
          wallet: existing,
          ...(dbg ? { dbg: dbgBase } : {}),
        },
        { status: 200 },
      )
    }

    // 1.5) Legacy wallet recovery: if no wallet exists for [masterUserId/userId],
    // try to find an older wallet that belonged to a different users.id for the same Pi account,
    // then re-home it to masterUserId to preserve balances & history.
    if (!existing?.id && resolved.kind === "pi") {
      const piUsername = (resolved as any).piUsername as string | null | undefined;
      const piUid = (resolved as any).piUid as string | null | undefined;
      if (piUsername || piUid) {
        const { data: altUsers, error: altUsersErr } = await admin
          .from("users")
          .select("id, pi_uid, pi_username")
          .or([
            piUid ? `pi_uid.eq.${piUid}` : null,
            piUsername ? `pi_username.eq.${piUsername}` : null,
          ].filter(Boolean).join(","))
          .neq("id", masterUserId);

        if (!altUsersErr && altUsers && altUsers.length) {
          const altUserIds = altUsers.map((u) => u.id).filter((id) => id && id !== userId);
          if (altUserIds.length) {
            const { data: altWallets, error: altWalletsErr } = await admin
              .from("pitd_wallets")
              .select("id, user_id, balance, locked_balance, total_spent, address, created_at, updated_at")
              .in("user_id", altUserIds)
              .order("updated_at", { ascending: false, nullsFirst: false })
              .order("created_at", { ascending: false, nullsFirst: false });

            if (!altWalletsErr && altWallets && altWallets.length) {
              // Prefer a wallet with any activity (non-zero fields).
              const pick = altWallets.slice().sort((a: any, b: any) => {
                const score = (w: any) => {
                  const bal = Number(w?.balance ?? 0);
                  const locked = Number(w?.locked_balance ?? 0);
                  const spent = Number(w?.total_spent ?? 0);
                  return (bal + locked) * 1000000 + spent;
                };
                return score(b) - score(a);
              })[0];

              if (pick?.id) {
                const { data: moved, error: movedErr } = await admin
                  .from("pitd_wallets")
                  .update({ user_id: masterUserId })
                  .eq("id", pick.id)
                  .select("id, user_id, balance, locked_balance, total_spent, address")
                  .maybeSingle();

                if (!movedErr && moved?.id) {
                  const recovered = moved;
                  // Ensure recovered wallet has a displayable address.
                  let finalWallet: any = { ...recovered }
                  const addrStr = String(finalWallet?.address ?? "").trim()
                  const addrInvalid = addrStr === "" || addrStr === "-" || addrStr === "—" || !addrStr.startsWith("PITD_")
                  if (addrInvalid) {
                    const newAddr = `PITD_${crypto.randomUUID().replace(/-/g, "")}`
                    const { data: patched2, error: patchErr2 } = await admin
                      .from("pitd_wallets")
                      .update({ address: newAddr })
                      .eq("id", finalWallet.id)
                      .select("id,user_id,balance,locked_balance,total_spent,address")
                      .maybeSingle()
                    if (!patchErr2 && patched2?.id) {
                      finalWallet = patched2
                      if (dbg) {
                        ;(dbgBase as any).backfilled_address = true
                        ;(dbgBase as any).backfill_new_address = newAddr
                      }
                    } else if (dbg) {
                      ;(dbgBase as any).backfilled_address = false
                      ;(dbgBase as any).backfill_attempted = true
                      ;(dbgBase as any).backfill_new_address = newAddr
                      ;(dbgBase as any).backfill_error = patchErr2?.message || patchErr2 || "unknown"
                    }
                  }

                  const balance = Number(finalWallet.balance ?? 0)
                  const locked = Number(finalWallet.locked_balance ?? 0)
                  const totalSpent = Number(finalWallet.total_spent ?? 0)
                  const totalBalance = balance + locked

                  return NextResponse.json(
                    {
                      ok: true,
                      wallet: {
                        ...finalWallet,
                        balance,
                        locked_balance: locked,
                        total_spent: totalSpent,
                        total_balance: totalBalance,
                      },
                      ...(dbg
                        ? {
                            dbg: {
                              ...dbgBase,
                              legacy_recovered_from_user_id: pick.user_id,
                              legacy_wallet_id: pick.id,
                            },
                          }
                        : {}),
                    },
                    { status: 200 },
                  )
                }
              }
            }
          }
        }
      }

      // Return existing wallet (after optional address backfill).
      const balance = Number(existing.balance ?? 0)
      const locked = Number(existing.locked_balance ?? 0)
      const totalSpent = Number(existing.total_spent ?? 0)
      const totalBalance = balance + locked

      return NextResponse.json(
        {
          ok: true,
          wallet: {
            ...existing,
            balance,
            locked_balance: locked,
            total_spent: totalSpent,
            total_balance: totalBalance,
          },
          ...(dbg ? { dbg: dbgBase } : {}),
        },
        { status: 200 },
      )
    }

    // 2) Create wallet if missing
    const address = randomAddress()
    const { data: created, error: createErr } = await admin
      .from("pitd_wallets")
      .insert({
        user_id: masterUserId,
        balance: 0,
        locked_balance: 0,
        total_spent: 0,
        address,
      })
      .select("id, user_id, balance, locked_balance, total_spent, address, created_at, updated_at")
      .single()

    if (createErr) {
      return jsonErr(500, "Failed to create PITD wallet", dbg ? { dbg: dbgBase, createErr } : undefined)
    }

    return NextResponse.json(
      {
        ok: true,
        wallet: created,
        ...(dbg ? { dbg: dbgBase } : {}),
      },
      { status: 200 },
    )
  } catch (e: any) {
    const extra = dbg
      ? {
          dbg: dbgBase,
          error: String(e?.message || e),
          stack: String(e?.stack || ""),
        }
      : undefined
    return jsonErr(500, "Unhandled error", extra)
  }
}
