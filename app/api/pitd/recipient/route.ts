import { NextRequest, NextResponse } from "next/server"

import { getAdminSupabase } from "@/lib/supabase/admin"
import { getAuthenticatedUserId } from "@/lib/pitd/require-user"

function normalize(addr: any): string {
  return typeof addr === "string" ? addr.trim() : ""
}

function isValidPitdAddress(addr: string): boolean {
  return /^PITD[a-zA-Z0-9]{20}$/.test(addr)
}

/**
 * Recipient lookup (wallet-style): map PITD address -> user_id.
 * NOTE: requires auth (Pi token or Supabase JWT) to avoid making address harvesting trivial.
 */
export async function GET(request: NextRequest) {
  try {
    // Require a logged-in user (either Pi token or Supabase JWT)
    await getAuthenticatedUserId(request)

    const address = normalize(request.nextUrl.searchParams.get("address"))

    if (!address || !isValidPitdAddress(address)) {
      return NextResponse.json({ ok: false, error: { code: "INVALID_ADDRESS", message: "Invalid PITD address" } }, { status: 400 })
    }

    const adminSupabase = getAdminSupabase()

    const { data: wallet, error } = await adminSupabase
      .from("pitd_wallets")
      .select("id,user_id,address")
      .eq("address", address)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { ok: false, error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      )
    }

    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: { code: "RECIPIENT_NOT_FOUND", message: "Recipient wallet not found" } },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true, recipient: wallet })
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "UNAUTHORIZED", message: e?.message || "Unauthorized" },
      },
      { status: 401 }
    )
  }
}
