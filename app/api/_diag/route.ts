import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { SUPABASE_PROJECT_REF, SUPABASE_URL } from "@/lib/supabase/config"

// Lightweight diagnostics endpoint for Pi Browser (no console).
// - Does NOT expose keys.
// - Only checks table reachability.
export async function GET() {
  const supabase = getSupabaseServerClient()

  const check = async (table: string) => {
    const { error } = await supabase.from(table).select("id").limit(1)
    return {
      table,
      ok: !error,
      error: error ? { message: error.message, code: (error as any).code } : null,
    }
  }

  const results = await Promise.all([check("users"), check("pi_users"), check("pitd_wallets")])

  return NextResponse.json({
    supabase: { url: SUPABASE_URL, ref: SUPABASE_PROJECT_REF },
    checks: results,
    ts: new Date().toISOString(),
  })
}
