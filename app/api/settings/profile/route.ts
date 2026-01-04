import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

/**
 * Settings: profile read/update.
 * - Supports both legacy table (pi_users) and new master table (users).
 * - Never changes UI; client page can call this API.
 */

type UpdateBody = {
  requesterId?: string
  full_name?: string
  phone?: string
  phone_number?: string
  address?: string
}

function pickString(v: any): string {
  if (v === null || v === undefined) return ""
  return String(v)
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get("userId") || ""
    if (!userId) {
      return NextResponse.json({ ok: false, error: "MISSING_USER_ID" }, { status: 400 })
    }

    const admin = getSupabaseAdminClient()

    // Try new master table first
    // Use select("*") to avoid hard-failing when some columns are not present
    // (schema may evolve between deployments).
    const { data: u1 } = await admin.from("users").select("*").eq("id", userId).maybeSingle()

    // Fallback: legacy table
    const { data: u2 } = await admin.from("pi_users").select("*").eq("id", userId).maybeSingle()

    const row: any = u1 || u2
    if (!row) {
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: row.id,
        pi_username: row.pi_username,
        full_name: row.full_name ?? "",
        address: row.address ?? "",
        phone: row.phone ?? row.phone_number ?? "",
        avatar_url: row.avatar_url ?? "",
        user_type: row.user_type ?? "",
        user_role: row.user_role ?? "",
        verification_status: row.verification_status ?? "",
        totp_enabled: !!row.totp_enabled,
        email_verified: row.email_verified,
      },
      source: u1 ? "users" : "pi_users",
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "SERVER_ERROR" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdateBody
    const requesterId = pickString(body.requesterId)
    if (!requesterId) {
      return NextResponse.json({ ok: false, error: "MISSING_REQUESTER" }, { status: 400 })
    }

    const patchUsers: any = {}
    const patchPiUsers: any = {}

    if (body.full_name !== undefined) {
      patchUsers.full_name = body.full_name
      patchPiUsers.full_name = body.full_name
    }
    if (body.address !== undefined) {
      patchUsers.address = body.address
      patchPiUsers.address = body.address
    }
    // users table uses 'phone' (per screenshots). legacy uses 'phone_number'.
    const phone = body.phone !== undefined ? body.phone : body.phone_number
    if (phone !== undefined) {
      patchUsers.phone = phone
      patchPiUsers.phone_number = phone
    }

    const admin = getSupabaseAdminClient()

    const safeUpdate = async (table: "users" | "pi_users", patch: any) => {
      // Try to update; if schema mismatch (missing columns), progressively drop fields.
      let cur = { ...patch }
      for (let i = 0; i < 3; i++) {
        const { data, error } = await admin.from(table).update(cur).eq("id", requesterId).select().maybeSingle()
        if (!error) return { data, error: null as any }

        const msg = String(error.message || "")
        const m = msg.match(/column\s+\"([^\"]+)\"\s+does not exist/i)
        if (m && m[1] && cur[m[1]] !== undefined) {
          delete cur[m[1]]
          continue
        }
        // Another common format: 'Could not find the \"address\" column of \"users\"'
        const m2 = msg.match(/find the\s+\"([^\"]+)\"\s+column/i)
        if (m2 && m2[1] && cur[m2[1]] !== undefined) {
          delete cur[m2[1]]
          continue
        }
        return { data: null as any, error }
      }
      return { data: null as any, error: null as any }
    }

    // Attempt to update users first. If the table/columns don't exist, fall back.
    let updated: any = null
    let source = ""

    if (Object.keys(patchUsers).length > 0) {
      const { data, error } = await safeUpdate("users", patchUsers)
      if (!error && data) {
        updated = data
        source = "users"
      }
    }

    if (!updated && Object.keys(patchPiUsers).length > 0) {
      const { data, error } = await safeUpdate("pi_users", patchPiUsers)
      if (error) {
        return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 400 })
      }
      if (data) {
        updated = data
        source = "pi_users"
      }
    }

    // If we updated one table, best-effort sync the other without failing.
    if (updated && source === "users" && Object.keys(patchPiUsers).length > 0) {
      await admin.from("pi_users").update(patchPiUsers).eq("id", requesterId)
    }
    if (updated && source === "pi_users" && Object.keys(patchUsers).length > 0) {
      await admin.from("users").update(patchUsers).eq("id", requesterId)
    }

    if (!updated) {
      return NextResponse.json({ ok: false, error: "NO_CHANGES" }, { status: 400 })
    }

    return NextResponse.json({ ok: true, source })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "SERVER_ERROR" }, { status: 500 })
  }
}
