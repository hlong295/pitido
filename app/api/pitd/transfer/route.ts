
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user"
import { getAuthenticatedUserId, requireSameUser, requireUserExists } from "@/lib/pitd/require-user"

const adminSupabase = getSupabaseAdminClient()

// Permission gate for PITD transfers (server-side only):
// - Root admin: always allowed
// - Others: only allowed when Root Admin has granted permission by setting
//   an allowed `user_role` in public.users.
// This avoids relying on client-side checks and keeps PITD as an internal asset.
async function requirePitdTransferPermission(userId: string) {
  // Prefer pi_users.user_role (admin UI quản lý ở đây). Nếu không có, fallback sang users.user_role.
  const { data: piRow, error: piErr } = await adminSupabase
    .from("pi_users")
    .select("id,user_role")
    .eq("id", userId)
    .maybeSingle()

  if (piErr && piErr.code !== "PGRST116") {
    throw new Error(`PERMISSION_DB_ERROR_PI_USERS: ${piErr.message}`)
  }

  let role = (piRow?.user_role || "").toString().toLowerCase()

  if (!role) {
    const { data: userRow, error: userErr } = await adminSupabase
      .from("users")
      .select("id,user_role")
      .eq("id", userId)
      .maybeSingle()

    if (userErr) {
      throw new Error(`PERMISSION_DB_ERROR_USERS: ${userErr.message}`)
    }

    role = (userRow?.user_role || "").toString().toLowerCase()
  }

  // Root/admin/system are always allowed
  if (role === "root_admin" || role === "admin" || role === "system") {
    return { ok: true, role }
  }

  // Allowed roles once Root Admin has granted access
  const allowed = new Set(["provider", "redeemer", "user", "member_verified"])
  if (allowed.has(role)) {
    return { ok: true, role }
  }

  return { ok: false, role: role || null }
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

function normalizePitdAddress(v: any): string {
  return typeof v === "string" ? v.trim() : ""
}

function isValidPitdAddress(addr: string): boolean {
  // Spec: "PITD" + 20 ký tự => 24 ký tự, chỉ chữ/số
  return /^PITD[a-zA-Z0-9]{20}$/.test(addr)
}

async function resolveInternalUserId(supabase: any, rawId: string): Promise<string | null> {
  if (!rawId || typeof rawId !== "string") return null
  const v = rawId.trim()
  if (!v) return null
  if (isUuid(v)) {
    try {
      const resolved = await resolveMasterUserId(supabase, v)
      return resolved.userId
    } catch {
      return v
    }
  }

  try {
    const { data } = await supabase
      .from("users")
      .select("id")
      .or(`pi_uid.eq.${v},pi_username.eq.${v}`)
      .maybeSingle()
    if (data?.id) return data.id
  } catch {}

  try {
    const { data } = await supabase
      .from("pi_users")
      .select("id")
      .or(`pi_uid.eq.${v},pi_username.eq.${v}`)
      .maybeSingle()
    if (data?.id) {
      try {
        const resolved = await resolveMasterUserId(supabase, data.id)
        return resolved.userId
      } catch {
        return data.id
      }
    }
  } catch {}

  return null
}

export async function POST(request: Request) {
  try {
    if (!adminSupabase) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }
    const body = await request.json()
    const {
      fromUserId: fromUserIdRaw,
      requesterId,
      // client có thể gửi `toWalletAddress` (mới) hoặc `toAddress` (cũ)
      toWalletAddress: toWalletAddressRaw,
      toAddress,
      amount,
      description,
    } = body ?? {}

    const toWalletAddress = normalizePitdAddress(toWalletAddressRaw ?? (toAddress as any))

    if (!toWalletAddress || amount === undefined || amount === null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!isValidPitdAddress(toWalletAddress)) {
      return NextResponse.json(
        {
          error: "INVALID_PITD_ADDRESS",
          details: { expected: "PITD + 20 ký tự (24 ký tự)", gotLength: toWalletAddress.length },
        },
        { status: 400 }
      )
    }

    // --- Auth (dual mode): Supabase JWT (email user) OR Pi user id header ---
    const authHeader = request.headers.get("authorization") || ""
    const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : ""

    const headerUserId = request.headers.get("x-user-id") || ""
    const headerPiUserId = request.headers.get("x-pi-user-id") || ""

    // IMPORTANT: Pi Browser cookie `pitodo_pi_user` is JSON (piUserId, piUid...).
    // Client code sometimes sends headers like "[object Object]".
    // -> Server must derive requester identity safely from cookie/auth first.
    let requesterResolved: string | null = null
    try {
      const authed = await getAuthenticatedUserId(request)
      if (authed) {
        requesterResolved = await resolveInternalUserId(adminSupabase, authed)
      }
    } catch {
      // Ignore and try headers below
    }

    if (!requesterResolved) {
      if (headerUserId) requesterResolved = await resolveInternalUserId(adminSupabase, headerUserId)
      else if (headerPiUserId) requesterResolved = await resolveInternalUserId(adminSupabase, headerPiUserId)
    }

    if (!requesterResolved) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
    }

    // Sender = requester (server-custodial).
    // NOTE: Một số client cũ có thể gửi `requesterId`/`fromUserId` sai kiểu (thậm chí là object)
    // khiến String(...) thành "[object Object]" và Supabase báo lỗi UUID.
    // Vì PITD là tài sản nội bộ, server KHÔNG tin dữ liệu `fromUserId` từ client.
    // -> Luôn dùng requester đã xác thực từ server.
    const fromUserId = requesterResolved;
    if (!fromUserId) {
      return NextResponse.json({ error: "USER_ID_NOT_RESOLVED" }, { status: 400 })
    }
    requireSameUser(requesterResolved, fromUserId)
    await requireUserExists(adminSupabase, fromUserId)

    // Backward-compatibility: if the sender wallet exists under a legacy user_id
    // (e.g., before master-user unification), the RPC expects the wallet owner user_id.
    let effectiveFromUserId = fromUserId
    try {
      const candidates = Array.from(
        new Set([fromUserId, headerUserId, headerPiUserId].filter((v) => typeof v === "string" && isUuid(v)))
      ) as string[]
      if (candidates.length) {
        const { data: w } = await adminSupabase
          .from("pitd_wallets")
          .select("user_id")
          .in("user_id", candidates)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
        if (w?.user_id && w.user_id !== fromUserId) {
          // Ensure the legacy wallet still belongs to the same requester.
          const resolved = await resolveMasterUserId(adminSupabase, w.user_id)
          if (resolved.masterUserId === requesterResolved) {
            effectiveFromUserId = w.user_id
          }
        }
      }
    } catch {
      // ignore
    }

    // Permission gate (server-only): Root Admin phải "mở quyền" thì user mới được gởi PITD.
    // Quyền được quyết định bởi cột `user_role` trên public.users.
    // - root_admin/admin: luôn allowed
    // - provider/redeemer/user: allowed
    // - member/unknown: blocked
    const permission = await requirePitdTransferPermission(effectiveFromUserId)
    if (!permission.ok) {
      return NextResponse.json(
        {
          error: "PITD_TRANSFER_NOT_ALLOWED",
          detail: permission.reason,
          dbg: permission.dbg,
        },
        { status: 403 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 })
    }

    // A3: atomic transfer in DB (RPC / SQL function) to prevent double-spend
    // Note: run sql/A3_PITD_TRANSFER_ATOMIC.sql once in Supabase SQL Editor.
    const transferDescription = description || "Chuyển PITD"

    const { data: rpcResult, error: rpcError } = await adminSupabase.rpc(
      "pitd_transfer_atomic",
      {
        p_sender_user_id: effectiveFromUserId,
        p_to_address: toWalletAddress,
        p_amount: amount,
        p_description: transferDescription,
        p_metadata: {
          source: "api/pitd/transfer",
        },
      }
    )

    if (rpcError) {
      const msg = rpcError.message || "Transfer failed"
      // Map common function errors to HTTP codes without changing UI
      if (msg.includes("insufficient_balance")) {
        return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
      }
      if (msg.includes("recipient_wallet_not_found")) {
        return NextResponse.json({ error: "Receiver wallet not found" }, { status: 404 })
      }
      if (msg.includes("sender_wallet_not_found")) {
        return NextResponse.json({ error: "Sender wallet not found" }, { status: 404 })
      }
      if (msg.includes("cannot_send_to_self")) {
        return NextResponse.json({ error: "Cannot transfer to your own wallet" }, { status: 400 })
      }
      if (msg.includes("invalid_amount")) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
      }
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    // RPC returns a JSON object
    const newBalance = rpcResult?.sender_balance

    return NextResponse.json({
      success: true,
      message: "Transfer completed successfully",
      newBalance,
      debug: process.env.NODE_ENV === "development" ? rpcResult : undefined,
    })
  } catch (error: any) {
    console.error("Transfer error:", error)
    return NextResponse.json({ error: error.message || "Transfer failed" }, { status: 500 })
  }
}