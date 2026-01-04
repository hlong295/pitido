import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { buildOtpAuthUri, generateBackupCodes, generateTotpSecret, verifyTotpCode } from "@/lib/security/totp"

type Body = {
  userId?: string
  action?: "status" | "setup" | "enable" | "disable"
  code?: string
}

// NOTE: Authentication in PITODO Pi Browser flow is handled app-level.
// We keep this API minimal: requires userId and performs server-side changes.

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    const userId = String(body.userId || "")
    const action = body.action || "status"
    if (!userId) {
      return NextResponse.json({ ok: false, error: "MISSING_USER_ID" }, { status: 400 })
    }

    const admin = getSupabaseAdminClient()

    const getRow = async () => {
      const { data } = await admin
        .from("user_totp")
        .select("id,user_id,secret,enabled,enabled_at,backup_codes")
        .eq("user_id", userId)
        .maybeSingle()
      return data as any
    }

    if (action === "status") {
      const row = await getRow()
      return NextResponse.json({ ok: true, enabled: !!row?.enabled, has_secret: !!row?.secret })
    }

    if (action === "setup") {
      // Create or refresh secret (not enabled yet)
      const secret = generateTotpSecret(20)
      const backup_codes = generateBackupCodes(8)

      const existing = await getRow()
      if (existing) {
        await admin
          .from("user_totp")
          .update({ secret, enabled: false, enabled_at: null, backup_codes })
          .eq("user_id", userId)
      } else {
        await admin.from("user_totp").insert({ user_id: userId, secret, enabled: false, backup_codes })
      }

      const uri = buildOtpAuthUri({ issuer: "PITODO", label: `PITODO:${userId}`, secret })
      return NextResponse.json({ ok: true, secret, uri, backup_codes })
    }

    if (action === "enable") {
      const code = String(body.code || "")
      const row = await getRow()
      if (!row?.secret) {
        return NextResponse.json({ ok: false, error: "NO_SECRET" }, { status: 400 })
      }
      const ok = verifyTotpCode(row.secret, code, 1)
      if (!ok) {
        return NextResponse.json({ ok: false, error: "INVALID_CODE" }, { status: 400 })
      }

      await admin
        .from("user_totp")
        .update({ enabled: true, enabled_at: new Date().toISOString() })
        .eq("user_id", userId)

      // Best-effort mirror to user tables if they have totp_enabled
      await admin.from("users").update({ totp_enabled: true }).eq("id", userId)
      await admin.from("pi_users").update({ totp_enabled: true }).eq("id", userId)

      return NextResponse.json({ ok: true, enabled: true })
    }

    if (action === "disable") {
      await admin.from("user_totp").update({ enabled: false, enabled_at: null }).eq("user_id", userId)
      await admin.from("users").update({ totp_enabled: false }).eq("id", userId)
      await admin.from("pi_users").update({ totp_enabled: false }).eq("id", userId)
      return NextResponse.json({ ok: true, enabled: false })
    }

    return NextResponse.json({ ok: false, error: "UNKNOWN_ACTION" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "SERVER_ERROR" }, { status: 500 })
  }
}
