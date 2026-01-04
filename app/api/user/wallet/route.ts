import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userCookie = cookieStore.get("pitodo_user")

    if (!userCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const user = JSON.parse(userCookie.value)
    const supabase = await getSupabaseServerClient()

    // Get PITD wallet balance
    const { data: walletData, error: walletError } = await supabase
      .from("pitd_wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single()

    if (walletError && walletError.code !== "PGRST116") {
      console.error("[v0] Error fetching wallet:", walletError)
      return NextResponse.json({ error: "Failed to fetch wallet" }, { status: 500 })
    }

    return NextResponse.json({
      balance: walletData?.balance || 0,
      currency: "PITD",
    })
  } catch (error) {
    console.error("[v0] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
