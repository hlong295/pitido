import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params.id
    const admin = getSupabaseAdminClient()

    // Prefer new `users` table, fallback to legacy `pi_users`.
    const { data: u } = await admin.from("users").select("*").eq("id", id).maybeSingle()
    const { data: p } = await admin.from("pi_users").select("*").eq("id", id).maybeSingle()

    const profile = u || p
    if (!profile) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, profile })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "SERVER_ERROR" }, { status: 500 })
  }
}
