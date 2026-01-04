
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user"
import { getAuthenticatedUserId } from "@/lib/pitd/require-user"
import { insertPitdTransaction, normalizePitdAmount } from "@/lib/pitd/ledger"

// Admin PITD routes must use a server-only Supabase client (service_role).
// We centralize that in /lib/supabase/admin.ts so Pi Browser/Pi App Studio
// won't break if the server env cannot be configured.

// Hard allowlist for break-glass root admins (case-insensitive).
// This prevents losing admin permission when the "public.users" shadow row
// has not yet synced user_role, or when Pi Browser keeps a stale email session.
const ROOT_ADMIN_USERNAMES = ["hlong295"]

// We accept either:
// - UUID: users.id / pi_users.id
// - pi_username (public.pi_users.pi_username)
// - email (public.users.email)
// This prevents "User lookup error" when the UI passes a username.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveTargetUserMasterId(
  supabaseAdmin: any,
  identifier: string,
): Promise<{ masterUserId: string; candidateUserIds: string[]; debug: Record<string, any> } | null> {
  const trimmed = (identifier || "").trim()
  if (!trimmed) return null

  // If already a UUID, resolve directly.
  if (UUID_RE.test(trimmed)) {
    const resolved = await resolveMasterUserId(supabaseAdmin, trimmed)
    const masterUserId = resolved.userId
    return {
      masterUserId,
      
      // Backward-compat: wallets may have been created under either the master id or the original id.
      candidateUserIds: Array.from(new Set([masterUserId, trimmed].filter(Boolean))),
      debug: { kind: "uuid", provided: trimmed, resolved, resolvedUserId: masterUserId },
    }
  }

  // Try pi_users by username (case-insensitive).
  const { data: piRow, error: piErr } = await supabaseAdmin
    .from("pi_users")
    .select("id, pi_username")
    .ilike("pi_username", trimmed)
    .maybeSingle()

  if (piRow?.id) {
    const resolved = await resolveMasterUserId(supabaseAdmin, String(piRow.id))
    const masterUserId = resolved.userId
    return {
      masterUserId,
      candidateUserIds: Array.from(new Set([masterUserId, String(piRow.id)].filter(Boolean))),
      debug: {
        kind: "pi_username",
        provided: trimmed,
        pi_user_id: piRow.id,
        pi_username: piRow.pi_username,
        resolved,
        resolvedUserId: masterUserId,
        piErr: piErr ? String(piErr?.message || piErr) : null,
      },
    }
  }

  // Try users by email.
  const { data: uRow, error: uErr } = await supabaseAdmin
    .from("users")
    .select("id, email")
    .ilike("email", trimmed)
    .maybeSingle()

  if (uRow?.id) {
    const resolved = await resolveMasterUserId(supabaseAdmin, String(uRow.id))
    const masterUserId = resolved.userId
    return {
      masterUserId,
      candidateUserIds: Array.from(new Set([masterUserId, String(uRow.id)].filter(Boolean))),
      debug: {
        kind: "email",
        provided: trimmed,
        users_id: uRow.id,
        email: uRow.email,
        resolved,
        resolvedUserId: masterUserId,
        uErr: uErr ? String(uErr?.message || uErr) : null,
      },
    }
  }

  return {
    // not found
    masterUserId: "",
    candidateUserIds: [],
    debug: {
      kind: "not_found",
      provided: trimmed,
      piErr: piErr ? String(piErr?.message || piErr) : null,
      uErr: uErr ? String(uErr?.message || uErr) : null,
    },
  }
}

function genPitdAddress() {
  // PITD + 20 chars (24 total), no hyphen
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let core = ""
  const bytes = randomBytes(32)
  for (let i = 0; i < 20; i++) core += chars[bytes[i] % chars.length]
  return `PITD${core}`
}

export async function POST(request: Request) {
  console.log("[v0] ==== PITD GRANT API v4.1 START ====")

  try {
    const body = await request.json()
    console.log("[v0] Request body:", JSON.stringify(body))

    // Debug for Pi Browser (no console access). We expose a short debug
    // string in error responses so you can screenshot it.
    const cookieHeader = request.headers.get("cookie") || ""
    const hasPitodoPiCookie = cookieHeader.includes("pitodo_pi_user=")
    const hasPiUserIdCookie = cookieHeader.includes("pi_user_id=")
    const authDebug = `cookie(pitodo_pi_user=${hasPitodoPiCookie ? "1" : "0"}, pi_user_id=${hasPiUserIdCookie ? "1" : "0"})`

    const { userId, amount, actionType, reason, adminId, adminUsername } = body

    // On Pi Browser, the client may not reliably send adminId. ...
    let effectiveAdminId: any = adminId
    if (!effectiveAdminId) {
      try {
        effectiveAdminId = await getAuthenticatedUserId(request)
      } catch {
        // ignore
      }
    }

    if (effectiveAdminId && typeof effectiveAdminId === "object") {
      // Defensive: if an object was passed accidentally, try common fields
      effectiveAdminId = effectiveAdminId.id || effectiveAdminId.userId || effectiveAdminId.piUserId || ""
    }

    // Validate
    if (!userId || !amount || !actionType || !reason) {
      console.log("[v0] Missing required fields")
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields",
        },
        { status: 400 },
      )
    }

    if (!effectiveAdminId) {
      console.log("[v0] Missing adminId")
      return NextResponse.json(
        { success: false, message: "Missing adminId", debug: authDebug },
        { status: 401 },
      )
    }

    let amountNum = 0
    try {
      amountNum = normalizePitdAmount(amount)
    } catch {
      console.log("[v0] Invalid amount:", amount)
      return NextResponse.json(
        {
          success: false,
          message: "Invalid amount",
        },
        { status: 400 },
      )
    }

    console.log("[v0] Creating Supabase admin client with service role...")

	    let supabaseAdmin: ReturnType<typeof getSupabaseAdminClient>
	    try {
	      // Server-only Supabase client with Service Role key (configured in lib/supabase/admin.ts)
	      supabaseAdmin = getSupabaseAdminClient()
	    } catch (e: any) {
	      return NextResponse.json(
	        {
	          success: false,
	          message: "Admin PITD service is not configured",
	          error: e?.message || "Admin PITD service is not configured",
	          code: "ADMIN_SERVICE_NOT_CONFIGURED",
	          debug: {
	            expected: "lib/supabase/admin.ts must return a service-role client",
	          },
	        },
	        { status: 500 },
	      )
	    }

    // A1: resolve admin to master users.id (pi_users.id may be passed from Pi Browser)
    // NOTE: On Pi Browser, localStorage may accidentally contain JSON or object-like strings.
    // Always coerce to string and keep a copy for debug.
    const candidateAdminId = String(effectiveAdminId || "")

    // Keep the raw requester identity (as provided by cookie/header/UI) for audit/debug.
    // (Do NOT reference any variable that may be undefined in Pi Browser runtime.)
    const requesterIdentityRaw = candidateAdminId

    const usernameLower = String(adminUsername || "").trim().toLowerCase()
    const forceRootByUsername = ROOT_ADMIN_USERNAMES.includes(usernameLower)

    // Some Pi Browser flows may send a non-UUID adminId. In that case, resolve admin via username.
    const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)

    let masterAdminId: string | null = null

    // 1) If request provides a known root username, resolve master admin id from pi_users first.
    // This prevents "not authorized" caused by a stale email Supabase session cookie overriding Pi identity.
    if (forceRootByUsername) {
      const { data: adminByName } = await supabaseAdmin
        .from("pi_users")
        .select("id")
        .ilike("pi_username", String(adminUsername))
        .limit(1)
      masterAdminId = (adminByName && adminByName[0]?.id) || null
    }

    // 2) Otherwise, resolve by candidate UUID id
    if (!masterAdminId && candidateAdminId && isUuid(candidateAdminId)) {
      const resolvedAdmin = await resolveMasterUserId(supabaseAdmin as any, candidateAdminId)
      masterAdminId = resolvedAdmin?.userId || null
    }

    // 3) Final fallback: resolve by username if provided
    if (!masterAdminId && adminUsername) {
      const { data: adminByName } = await supabaseAdmin
        .from("pi_users")
        .select("id")
        .ilike("pi_username", String(adminUsername))
        .limit(1)

      masterAdminId = (adminByName && adminByName[0]?.id) || null
    }

    if (!masterAdminId) {
      return NextResponse.json(
        { success: false, message: "Missing adminId" },
        { status: 401 },
      )
    }

    // Permission: only root_admin / system can grant/revoke
    // NOTE: public.users schema can differ between environments, so avoid selecting
    // columns that might not exist (would break admin actions in Pi Browser).
    const { data: adminRow, error: adminErr } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", String(masterAdminId))
      .maybeSingle()

    console.log("[v0] Admin check:", { adminRow, error: adminErr?.message })

    const normalizeRole = (v: any) =>
      String(v || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")

    const adminRole = normalizeRole((adminRow as any)?.user_role)
    const adminType = normalizeRole((adminRow as any)?.user_type)

    let isAllowed =
      adminType === "system" ||
      adminRole === "root_admin" ||
      adminRole === "root" ||
      adminRole === "admin" ||
      adminRole === "super_admin" ||
      // Be tolerant with legacy forms
      adminRole === "rootadmin" ||
      adminRole === "superadmin"

    // Root admin fallback by Pi username (stable across schema changes)
    // NOTE: Pi username in our project is the primary root identifier (e.g. HLong295).
    if (!isAllowed) {
      // NOTE: previously this referenced an undefined variable `candidateAdminUsername`
      // which caused runtime errors in Pi Browser.
      const u = (adminUsername || "").toString().trim().toLowerCase()
      if (u === "hlong295") {
        isAllowed = true
        // Also normalize masterAdminId to the authoritative pi_users.id for audit consistency.
        const { data: piRoot } = await supabaseAdmin
          .from("pi_users")
          .select("id")
          .ilike("pi_username", "HLong295")
          .maybeSingle()
        if (piRoot?.id) masterAdminId = String(piRoot.id)
      }
    }

    // Fallback: some deployments keep the authoritative role in pi_users
    if (!isAllowed) {
      // masterAdminId may be users.id while Pi login... try both
      const candidateIds = [String(masterAdminId), String(candidateAdminId)].filter(Boolean)
      const { data: piAdmins, error: piAdminsErr } = await supabaseAdmin
        .from("pi_users")
        .select("id, user_role")
        .in("id", candidateIds)

      const anyPiAdminRow = Array.isArray(piAdmins)
        ? piAdmins.find((r: any) => {
            const role = normalizeRole(r?.user_role)
            return (
              role === "root_admin" ||
              role === "root" ||
              role === "admin" ||
              role === "super_admin" ||
              role === "rootadmin" ||
              role === "superadmin"
            )
          })
        : null
      if (piAdminsErr) console.log("[v0] Admin fallback pi_users (by id) error:", piAdminsErr)

      let piRole = normalizeRole((anyPiAdminRow as any)?.user_role)
      isAllowed = Boolean(anyPiAdminRow)
      console.log("[v0] Admin fallback pi_users (by id):", { piRole, isAllowed })

      // Secondary fallback: allow resolving admin by username (Pi Browser often has no console/logs)
      if (!isAllowed && adminUsername) {
        const uname = String(adminUsername || "").trim()
        if (uname) {
          const { data: piAdminByUname } = await supabaseAdmin
            .from("pi_users")
            .select("id, user_role, pi_username")
            .ilike("pi_username", uname)
            .maybeSingle()

          piRole = normalizeRole((piAdminByUname as any)?.user_role)
          isAllowed =
            piRole === "root_admin" ||
            piRole === "admin" ||
            piRole === "super_admin" ||
            piRole === "rootadmin" ||
            piRole === "superadmin"

          console.log("[v0] Admin fallback pi_users (by username):", {
            adminUsername: uname,
            matched: Boolean(piAdminByUname?.id),
            piRole,
            isAllowed,
          })
        }
      }
    }

    // Don't fail just because user schema differs; allow if our fallback checks pass.
    if (!isAllowed) {
      // Provide lightweight debug context for Pi Browser (no console).
      return NextResponse.json(
        {
          success: false,
          message: "Not authorized",
          debug: {
            candidateAdminId: String(candidateAdminId),
            masterAdminId: String(masterAdminId),
            usersRole: adminRole,
            usersType: adminType,
            adminErr: adminErr ? String((adminErr as any)?.message ?? adminErr) : null,
          },
        },
        { status: 403 },
      )
    }

    // A1: resolve master users.id without touching login flows.
    // Accept UUID or username/email from UI.
    // NOTE: Prior patch referenced resolveUserIdentifierToMasterId (non-existent),
    // causing runtime error "Can't find variable: resolveUserIdentifierToMasterId".
    const resolved = await resolveTargetUserMasterId(supabaseAdmin, String(userId))
    if (!resolved?.masterUserId) {
      return NextResponse.json(
        {
          error: "User lookup error",
          message: "User not found",
          debug: {
            identifier: String(userId),
            resolved,
          },
        },
        { status: 404 },
      )
    }
    const masterUserId = resolved.masterUserId

    // IMPORTANT:
    // - We only need a stable master user id to credit/debit PITD.
    // - The master id is the primary key of public.users (and equals pi_users.id in our design).
    // - Do NOT hard-fail here if profile columns are missing/mismatched;
    //   resolveMasterUserId already ensures the row exists when needed.
    const targetUserId = masterUserId

    // Backward-compat: in older baselines, pitd_wallets.user_id may have been created
    // under a pre-normalized id. For revoke, we MUST read the existing wallet balance.
    const candidateWalletUserIds = Array.from(
      new Set((resolved.candidateUserIds || [targetUserId]).filter((v) => typeof v === "string" && UUID_RE.test(v)))
    )

    console.log("[v0] Getting wallet for target user (candidates):", candidateWalletUserIds)
    // Use limit(1) to avoid maybeSingle() failing if there are accidental duplicates.
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("pitd_wallets")
      .select("id, balance")
      .in("user_id", candidateWalletUserIds.length ? candidateWalletUserIds : [targetUserId])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    console.log("[v0] Wallet query result:", { wallet, error: walletError?.message })

    let walletId: string
    let currentBalance = 0

    if (wallet && !walletError) {
      walletId = wallet.id
      currentBalance = Number(wallet.balance) || 0
      console.log("[v0] Existing wallet, balance:", currentBalance)
    } else {
      console.log("[v0] Creating (or fetching) wallet...", { walletError: walletError?.message })
      // Upsert by user_id so we don't fail if the wallet already exists.
      const { data: newWallet, error: createError } = await supabaseAdmin
        .from("pitd_wallets")
        .upsert(
          {
            user_id: targetUserId,
            balance: 0,
            locked_balance: 0,
            total_spent: 0,
            address: genPitdAddress(),
          },
          { onConflict: "user_id" },
        )
        .select("id, balance")
        .single()

      if (createError || !newWallet) {
        console.log("[v0] Failed to create wallet:", createError?.message)
        return NextResponse.json(
          {
            success: false,
            message: "Failed to create wallet",
            debug: {
              identifier: String(userId),
              resolved,
              targetUserId,
              walletError: walletError ? String((walletError as any)?.message ?? walletError) : null,
              createError: createError ? String((createError as any)?.message ?? createError) : null,
            },
          },
          { status: 500 },
        )
      }

      walletId = newWallet.id
      currentBalance = Number((newWallet as any).balance) || 0
      console.log("[v0] New wallet created:", walletId)
    }

    if (actionType === "revoke" && currentBalance < amountNum) {
      console.log("[v0] Insufficient balance")
      return NextResponse.json(
        {
          success: false,
          message: "Insufficient balance",
        },
        { status: 400 },
      )
    }

    const newBalance = actionType === "grant" ? currentBalance + amountNum : currentBalance - amountNum

    console.log("[v0] Updating wallet balance from", currentBalance, "to", newBalance)

    const { error: updateError } = await supabaseAdmin
      .from("pitd_wallets")
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", walletId)

    if (updateError) {
      console.log("[v0] Failed to update wallet:", updateError.message)
      return NextResponse.json(
        {
          success: false,
          message: updateError.message,
        },
        { status: 500 },
      )
    }

    console.log("[v0] Wallet updated successfully")

    // ---- Ledger (pitd_transactions) ----
    // IMPORTANT: PITD history MUST be recorded for every admin grant/revoke.
    // We insert a signed amount (+grant, -revoke).
    // transaction_type uses the canonical values admin_grant/admin_revoke.
    // If your DB constraint differs, insertPitdTransaction retries with smaller payloads
    // (e.g., without reference_type/balance_after) but it will NOT hide constraint errors.

    const signedAmount = actionType === "revoke" ? -amountNum : amountNum
    const txTypePrimary = actionType === "revoke" ? "admin_revoke" : "admin_grant"
    const txTypeFallback = "admin_grant" // some older DB constraints only allow one value

    try {
      try {
        await insertPitdTransaction(supabaseAdmin, {
          walletId,
          transactionType: txTypePrimary,
          amount: signedAmount,
          balanceAfter: newBalance,
          description: reason || `Admin ${actionType}`,
          referenceId: String(masterAdminId),
          referenceType: "admin",
          metadata: {
            action: actionType,
            requester_identity_raw: requesterIdentityRaw,
            target_user_id: targetUserId,
          },
        })
      } catch (e: any) {
        // Fallback when DB restricts transaction_type values.
        await insertPitdTransaction(supabaseAdmin, {
          walletId,
          transactionType: txTypeFallback,
          amount: signedAmount,
          balanceAfter: newBalance,
          description: reason || `Admin ${actionType}`,
          referenceId: String(masterAdminId),
          referenceType: "admin",
          metadata: {
            action: actionType,
            requester_identity_raw: requesterIdentityRaw,
            target_user_id: targetUserId,
            _fallback_type_used: txTypeFallback,
            _primary_type_failed: txTypePrimary,
            _primary_error: e?.message || String(e),
          },
        })
      }
    } catch (txErr: any) {
      console.log("[v0] Transaction creation failed:", txErr?.message || txErr)
      // IMPORTANT: Do not report success if we cannot record history.
      // Try to rollback the wallet balance to keep data consistent.
      try {
        await supabaseAdmin
          .from("pitd_wallets")
          .update({ balance: currentBalance, updated_at: new Date().toISOString() })
          .eq("id", walletId)
        console.log("[v0] Rolled back wallet balance due to tx insert failure")
      } catch (rollbackErr: any) {
        console.log("[v0] Rollback failed:", rollbackErr?.message || rollbackErr)
      }

      return NextResponse.json(
        {
          success: false,
          message: "Failed to record PITD transaction history",
          debug: {
            walletId,
            currentBalance,
            attemptedNewBalance: newBalance,
            amount: signedAmount,
            actionType,
            txError: txErr?.message || String(txErr),
          },
        },
        { status: 500 },
      )
    }

    console.log("[v0] Transaction created successfully")

    console.log("[v0] ==== PITD GRANT API v4.1 SUCCESS ====")

    return NextResponse.json({
      success: true,
      message: `Successfully ${actionType} ${amountNum} PITD`,
      newBalance,
    })
  } catch (error: any) {
    console.error("[v0] ==== PITD GRANT API v4.1 ERROR ====")
    console.error("[v0] Error:", error)
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Unexpected error",
      },
      { status: 500 },
    )
  }
}