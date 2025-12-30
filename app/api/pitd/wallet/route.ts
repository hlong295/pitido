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
  // PITD + 20 chars = 24 chars
  // Use URL-safe base36 and uppercase for readability.
  const s = Array.from({ length: 20 }, () => Math.floor(Math.random() * 36).toString(36)).join("")
  return `PITD${s.toUpperCase()}`
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
    .select("id, pi_username")
    .eq("id", piUserId)
    .maybeSingle()

  if (piErr || !piRow?.id) {
    return { kind: "pi" as const, ok: false, reason: "Pi user not found" }
  }
  if (piUsername && piRow.pi_username && piUsername !== piRow.pi_username) {
    return { kind: "pi" as const, ok: false, reason: "Pi username mismatch" }
  }

  return { kind: "pi" as const, ok: true, userId: piUserId }
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
      return NextResponse.json(
        {
          ok: true,
          wallet: existing,
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