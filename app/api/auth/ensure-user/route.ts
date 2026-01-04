import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { resolveMasterUserId } from "../../../../lib/pitd/resolve-master-user"

const SUPABASE_URL = "https://wlewqkcbwbvbbwjfpbck.supabase.co"

const SUPABASE_URL_EFF = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY_EFF = process.env.SUPABASE_SERVICE_ROLE_KEY

// NOTE:
// Do not cache role/provider flags here.
// Admin can promote a member to Provider at any time; caching would cause
// the app to keep showing the old role (e.g., 'redeemer') for minutes.

export async function POST(request: Request) {
  const debugEnabled = (() => {
    try {
      const u = new URL(request.url)
      return u.searchParams.get("debug") === "1"
    } catch {
      return false
    }
  })()
  const debug: any[] = []

  try {
    const { userId, email, metadata } = await request.json()

    // Detect Pi-login calls. For Pi login we might receive either:
    // - UUID (pi_users.id / public.users.id)  OR
    // - Pi UID (pi_users.pi_uid)
    const isUuid = (s: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || ""))

    const fromPi = Boolean(body?.fromPi) || Boolean(metadata?.fromPi) || Boolean(metadata?.from_pi) || (!!metadata?.username && !email);
    const piUsername = (body?.piUsername || body?.pi_username || metadata?.pi_username || metadata?.piUsername || metadata?.username) ? String(body?.piUsername || body?.pi_username || metadata?.pi_username || metadata?.piUsername || metadata?.username) : undefined;
    const piUid: string | undefined =
      (metadata?.pi_uid ? String(metadata.pi_uid) : undefined) ||
      (fromPi && userId && !isUuid(String(userId)) ? String(userId) : undefined);

    if (debugEnabled) debug.push({ step: "request", userId, email: email || null, hasMetadata: Boolean(metadata) })

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    console.log("[v0] ensure-user API: Processing user", userId, email)

    // IMPORTANT: no in-memory caching here (see note above)

    const adminSupabase = createClient(SUPABASE_URL_EFF, SUPABASE_SERVICE_ROLE_KEY_EFF)

    // Phase 4 (code-side): update last_login_at / email_verified in public.users (master)
    // Best-effort only: never break login if this step fails.
    const syncLoginFlags = async (candidateUserId: string) => {
      try {
        if (debugEnabled) debug.push({ step: "syncLoginFlags:start", candidateUserId })
        const { userId: masterUserId } = await resolveMasterUserId(adminSupabase, candidateUserId)
        const nowIso = new Date().toISOString()

        const { data: existingUsersRow } = await adminSupabase
          .from("users")
          .select("id,email_verified")
          .eq("id", masterUserId)
          .maybeSingle()

        const emailConfirmed = Boolean(metadata?.email_confirmed_at)
        const nextEmailVerified = emailConfirmed ? true : Boolean((existingUsersRow as any)?.email_verified)

        const updatePayload: any = {
          last_login_at: nowIso,
          email_verified: nextEmailVerified,
        }
        // Keep email in sync when provided (email login). Do not overwrite with null/undefined.
        if (email) updatePayload.email = email

        await adminSupabase.from("users").update(updatePayload).eq("id", masterUserId)

        // ALSO update last_login_at on pi_users for Pi-login tracking.
        // Triggers on pi_users may be disabled in production, so we do it here.
        // We update both candidateUserId and masterUserId (in case they differ).
        const piUpdatePayload: any = { last_login_at: nowIso, updated_at: nowIso }
        await adminSupabase.from("pi_users").update(piUpdatePayload).eq("id", candidateUserId)
        if (masterUserId !== candidateUserId) {
          await adminSupabase.from("pi_users").update(piUpdatePayload).eq("id", masterUserId)
        }

        // If we have Pi UID, update by pi_uid too (covers calls where the client only knows Pi UID)
        if (piUid) {
          await adminSupabase.from("pi_users").update(piUpdatePayload).eq("pi_uid", piUid)
        }

        // Best-effort fallback: if we have a Pi username from metadata, update by pi_username too.
        // (Handles edge cases where pi_users.id was not yet normalized.)
        if (metadata?.username) {
          await adminSupabase
            .from("pi_users")
            .update(piUpdatePayload)
            .ilike("pi_username", String(metadata.username))
        }

        if (debugEnabled) debug.push({ step: "syncLoginFlags:ok", masterUserId, updatePayload })
      } catch (e: any) {
        console.warn("[v0] ensure-user API: syncLoginFlags skipped:", e?.message || e)
        if (debugEnabled) debug.push({ step: "syncLoginFlags:error", error: e?.message || String(e) })
      }
    }

    // Normalize candidateUserId for Phase 4 sync:
    // - If userId is uuid -> use it
    // - If this is a Pi call and we only have piUid -> resolve pi_users.id by pi_uid
    let candidateUserIdForSync: string = String(userId)
    if (fromPi && piUid) {
      try {
        const { data: piRow } = await adminSupabase.from("pi_users").select("id").eq("pi_uid", piUid).maybeSingle()
        if ((piRow as any)?.id) {
          candidateUserIdForSync = String((piRow as any).id)
          if (debugEnabled) debug.push({ step: "pi_uid:resolved", piUid, resolvedId: candidateUserIdForSync })
        } else {
          if (debugEnabled) debug.push({ step: "pi_uid:resolve_miss", piUid })
        }
      } catch (e: any) {
        if (debugEnabled) debug.push({ step: "pi_uid:resolve_error", piUid, error: e?.message || String(e) })
      }
    }

    // Kick Phase 4 sync early (best-effort)
    syncLoginFlags(candidateUserIdForSync)

    let existingUser = null

    // 1. Try to find by id (UUID)
    if (isUuid(String(userId))) {
      const { data: userById, error: findError } = await adminSupabase
        .from("pi_users")
        .select("id, pi_uid, pi_username, full_name, user_role, verification_status, provider_approved")
        .eq("id", userId)
        .maybeSingle()

      if (findError) {
        console.error("[v0] ensure-user API: find error", findError)
      }

      if (userById) {
        existingUser = userById
        console.log("[v0] ensure-user API: found user by id", existingUser.pi_username)
      }
    }

    
    // 1.5 Prefer stable master by username first (avoid creating duplicates when pi_uid signal changes)
    if (!existingUser && metadata?.username) {
      const { data: userByUsernamePref } = await adminSupabase
        .from("pi_users")
        .select("id, pi_uid, pi_username, full_name, user_role, verification_status, provider_approved")
        .ilike("pi_username", metadata.username)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()

      if (userByUsernamePref) {
        existingUser = userByUsernamePref
        console.log("[v0] ensure-user API: found user by username (preferred master)", existingUser.pi_username)
      }
    }

// 2. Try to find by pi_uid
    // - Email login (legacy): pi_uid = "EMAIL-{auth_user_id}"
    // - Pi login: pi_uid = "{Pi UID}" (provided via metadata.pi_uid or userId)
    if (!existingUser) {
      const piUidToFind = fromPi ? String(piUid || "") : `EMAIL-${userId}`
      const { data: userByPiUid } = await adminSupabase
        .from("pi_users")
        .select("id, pi_uid, pi_username, full_name, user_role, verification_status, provider_approved")
        .eq("pi_uid", piUidToFind)
        .maybeSingle()

      if (userByPiUid) {
        existingUser = userByPiUid
        console.log("[v0] ensure-user API: found user by pi_uid", existingUser.pi_username)
      }
    }

    // 3. Try to find by username from metadata
    if (!existingUser && metadata?.username) {
      const { data: userByUsername } = await adminSupabase
        .from("pi_users")
        .select("id, pi_uid, pi_username, full_name, user_role, verification_status, provider_approved")
        .ilike("pi_username", metadata.username)
        .maybeSingle()

      if (userByUsername) {
        existingUser = userByUsername
        console.log("[v0] ensure-user API: found user by username", existingUser.pi_username)

        // IMPORTANT SAFETY:
        // - For Pi login: never mutate pi_uid/id based on an incoming userId (can corrupt Pi identity)
        // - For Email login: if we matched by username and pi_uid is EMAIL-*, we may align pi_uid to EMAIL-${userId}
        if (!metadata?.from_pi) {
          const desiredPiUid = `EMAIL-${userId}`
          const currentPiUid = String((existingUser as any)?.pi_uid || '')
          if (currentPiUid.startsWith('EMAIL-') && currentPiUid !== desiredPiUid) {
            console.log('[v0] ensure-user API: aligning EMAIL pi_uid to', desiredPiUid)
            const { error: updateError } = await adminSupabase
              .from('pi_users')
              .update({ pi_uid: desiredPiUid })
              .eq('id', existingUser.id)

            if (updateError) {
              console.error('[v0] ensure-user API: failed to align EMAIL pi_uid', updateError)
            } else {
              ;(existingUser as any).pi_uid = desiredPiUid
            }
          }
        }
      }
    }

    if (existingUser) {
      console.log("[v0] ensure-user API: returning existing user", existingUser.pi_username, "id:", existingUser.id)

      // Update verification status if needed
      if (metadata?.email_confirmed_at && existingUser.verification_status !== "verified") {
        await adminSupabase.from("pi_users").update({ verification_status: "verified" }).eq("id", existingUser.id)
        existingUser.verification_status = "verified"
      }

      await syncLoginFlags(existingUser.id)

      // Ensure PITD wallet exists for this user.
      // IMPORTANT (P0): pitd_wallets.user_id must reference the MASTER user id (public.users.id).
      // We resolve masterUserId from pi_users.id and only write PITD using that master id.
      // PITD wallet address rule (PITODO): starts with "PITD" + 20 random chars = 24 chars total.
      const makeAddress = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        let out = ""
        const n = 20
        // Prefer cryptographic RNG when available
        const cryptoAny: any = (globalThis as any).crypto
        if (cryptoAny?.getRandomValues) {
          const buf = new Uint8Array(n)
          cryptoAny.getRandomValues(buf)
          for (let i = 0; i < n; i++) out += chars[buf[i] % chars.length]
        } else {
          for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)]
        }
        return `PITD${out}`
      }

      const { userId: masterUserId } = await resolveMasterUserId(adminSupabase, existingUser.id)

      const { data: existingWallet } = await adminSupabase
        .from("pitd_wallets")
        .select("id, user_id, balance, locked_balance, total_spent, address")
        .eq("user_id", masterUserId)
        .maybeSingle()

      const walletUpsert = {
        user_id: masterUserId,
        balance: existingWallet?.balance ?? 0,
        locked_balance: (existingWallet as any)?.locked_balance ?? 0,
        total_spent: (existingWallet as any)?.total_spent ?? 0,
        address: existingWallet?.address || makeAddress(),
      }

      const { error: pitdWalletUpsertErr } = await adminSupabase
        .from("pitd_wallets")
        .upsert(walletUpsert, { onConflict: "user_id" });

      if (pitdWalletUpsertErr) {
        throw new Error(
          `PITD wallet upsert failed: ${pitdWalletUpsertErr.message} | debug=${JSON.stringify({ masterUserId, candidateUserIdForSync, piUid, piUsername })}`
        );
      }


      const result = {
        ...existingUser,
        id: existingUser.id,
      }

      return NextResponse.json({
        ...result,
        email: email,
      })
    }

    // Create new user
    const newUserData = {
      id: userId,
      pi_uid: `EMAIL-${userId}`,
      pi_username: metadata?.username || email?.split("@")[0] || `user_${userId.substring(0, 8)}`,
      full_name: metadata?.full_name || "",
      user_role: "redeemer",
      verification_status: metadata?.email_confirmed_at ? "verified" : "pending",
      provider_approved: false,
    }

    console.log("[v0] ensure-user API: creating new user", newUserData.pi_username)

    const { data: newUser, error: insertError } = await adminSupabase
      .from("pi_users")
      .upsert(newUserData, { onConflict: "id" })
      .select("id, pi_uid, pi_username, full_name, user_role, verification_status, provider_approved")
      .maybeSingle()

    if (insertError) {
      console.error("[v0] ensure-user API: insert error", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    console.log("[v0] ensure-user API: created successfully")

    // Ensure PITD wallet exists (schema: balance, locked_balance, total_spent, address)
    // PITD wallet address rule (PITODO): starts with "PITD" + 20 random chars = 24 chars total.
    const makeAddress = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
      let out = ""
      const n = 20
      const cryptoAny: any = (globalThis as any).crypto
      if (cryptoAny?.getRandomValues) {
        const buf = new Uint8Array(n)
        cryptoAny.getRandomValues(buf)
        for (let i = 0; i < n; i++) out += chars[buf[i] % chars.length]
      } else {
        for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)]
      }
      return `PITD${out}`
    }

    // Resolve MASTER user id (public.users.id) before touching pitd_wallets.
    const { userId: masterUserId } = await resolveMasterUserId(adminSupabase, userId)

    // If wallet exists but missing address, patch it
    const { data: existingWallet } = await adminSupabase
      .from("pitd_wallets")
      .select("id, user_id, balance, locked_balance, total_spent, address")
      .eq("user_id", masterUserId)
      .maybeSingle()

    const walletUpsert = {
      user_id: masterUserId,
      balance: existingWallet?.balance ?? 0,
      locked_balance: (existingWallet as any)?.locked_balance ?? 0,
      total_spent: (existingWallet as any)?.total_spent ?? 0,
      address: existingWallet?.address || makeAddress(),
    }

    const { error: pitdWalletUpsertErr } = await adminSupabase
      .from("pitd_wallets")
      .upsert(walletUpsert, { onConflict: "user_id" });

    if (pitdWalletUpsertErr) {
      throw new Error(
        `PITD wallet upsert failed: ${pitdWalletUpsertErr.message} | debug=${JSON.stringify({ masterUserId, candidateUserIdForSync, piUid, piUsername })}`
      );
    }

    await syncLoginFlags(newUser.id)

    return NextResponse.json({
      ...newUser,
      email: email,
      ...(debugEnabled ? { debug } : {}),
    })
  } catch (error: any) {
    console.error("[v0] ensure-user API error:", error)
    return NextResponse.json({ error: error.message || "Server error", ...(debugEnabled ? { debug } : {}) }, { status: 500 })
  }
}