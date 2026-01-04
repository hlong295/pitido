import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const ROOT_ADMIN_USERNAME = "HLong295"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const requesterId = (body?.requesterId as string | undefined) ?? ""
    const targetUserId = (body?.targetUserId as string | undefined) ?? ""
    const approve = Boolean(body?.approve)

    if (!requesterId || !targetUserId) {
      return NextResponse.json({ error: "Missing requesterId/targetUserId" }, { status: 400 })
    }

    // Prefer Service Role on the server (bypasses RLS). If not configured, fallback to session client.
    // NOTE: In Pi Browser we may not have a Supabase auth session, so this can be anon.
    // We therefore rely primarily on the SECURITY DEFINER RPC (admin_set_provider_role) to bypass RLS.
    const admin = getSupabaseAdminClient()
    const supabase = admin ?? createSupabaseServerClient(cookies())

    // Best-effort verification (do not hard-fail on select errors; RPC will enforce anyway)
    const { data: requester, error: reqErr } = await supabase
      .from("pi_users")
      .select("id, pi_username, user_role")
      .eq("id", requesterId)
      .maybeSingle()

    // IMPORTANT:
    // Không khóa cứng theo pi_username. Chỉ cần requester có user_role='root_admin' là được.
    // (Bạn có thể tạm set user khác thành root_admin để debug trên PC)
    if (requester && requester.user_role !== "root_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // 1) Primary path: call SECURITY DEFINER RPC that updates role + approval fields (bypasses RLS)
    const { data: rpcData, error: rpcErr } = await supabase.rpc("admin_set_provider_role", {
      requester_id: requesterId,
      target_user_id: targetUserId,
      make_provider: approve,
    })

    if (!rpcErr && rpcData) {
      // Supabase may return an array (SETOF) or a single object depending on function definition.
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
      return NextResponse.json({ ok: true, user: row, via: "rpc" })
    }

    const nowIso = new Date().toISOString()

    // IMPORTANT: provider permission in app is driven by pi_users.user_role ("provider")
    // and approval flag pi_users.provider_approved.
    const payload: Record<string, any> = approve
      ? {
          user_role: "provider",
          provider_approved: true,
          provider_approved_at: nowIso,
          provider_approved_by: requesterId,
        }
      : {
          user_role: "redeemer",
          provider_approved: false,
          provider_approved_at: null,
          provider_approved_by: null,
        }

    // 2) Fallback path (only if RPC is missing). This may be blocked by RLS unless service role is configured.
    if (rpcErr) {
      const msg = String(rpcErr.message || "")
      const lower = msg.toLowerCase()
      const looksMissing = lower.includes("does not exist") && lower.includes("admin_set_provider_role")
      if (!looksMissing) {
        // Surface the real error (Pi Browser has no console, so this is screenshot-friendly)
        const suggestion =
          (rpcErr as any)?.code === "42501" || /permission denied/i.test(msg)
            ? "Thiếu quyền gọi RPC. Nếu API đang chạy bằng role anon/authenticated, hãy GRANT EXECUTE cho function admin_set_provider_role hoặc đảm bảo server dùng SUPABASE_SERVICE_ROLE_KEY."
            : undefined
        return NextResponse.json(
          {
            error: msg || "RPC error",
            detail: "rpc_failed",
            stage: "rpc",
            debug: {
              requesterId,
              targetUserId,
              approve,
              suggestion,
              rpc: {
                code: (rpcErr as any)?.code,
                details: (rpcErr as any)?.details,
                hint: (rpcErr as any)?.hint,
              },
            },
          },
          { status: 500 }
        )
      }
      // else: continue to legacy fallback update below
    }

    const { data: updated, error: updErr } = await supabase
      .from("pi_users")
      .update(payload)
      .eq("id", targetUserId)
      .select("id, pi_username, user_role, provider_approved, provider_approved_at, provider_approved_by")
      .maybeSingle()

    if (updErr) {
      return NextResponse.json({ error: updErr.message, detail: "fallback_update_failed" }, { status: 500 })
    }

    // If update affected 0 rows (commonly due to RLS), PostgREST returns null data without error.
    if (!updated) {
      const hint = admin
        ? "Không tìm thấy user để cập nhật."
        : "Không thể cập nhật do thiếu quyền (RLS). Hãy dùng RPC admin_set_provider_role (SECURITY DEFINER) hoặc cấu hình SUPABASE_SERVICE_ROLE_KEY trên server."
      return NextResponse.json({ error: hint, detail: "fallback_update_no_rows" }, { status: 403 })
    }

    return NextResponse.json({ ok: true, user: updated, via: "fallback_update" })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}
