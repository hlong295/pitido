import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const piUserId = searchParams.get("id")

    console.log("[v0] pi-session: Loading user by ID:", piUserId)

    if (!piUserId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 })
    }

    const supabase = await getSupabaseServerClient()

    // Query user from pi_users table by database ID
    const { data: user, error } = await supabase.from("pi_users").select("*").eq("id", piUserId).maybeSingle()

    if (error) {
      console.error("[v0] pi-session: Database error:", error)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    if (!user) {
      console.log("[v0] pi-session: User not found for ID:", piUserId)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("[v0] pi-session: Found user:", {
      id: user.id,
      username: user.pi_username,
      role: user.user_role,
    })

    // Return user data in consistent format
    return NextResponse.json({
      id: user.id,
      piUid: user.pi_uid,
      piUsername: user.pi_username,
      userRole: user.user_role,
      userType: user.user_type || "pi",
      verificationStatus: user.verification_status,
      fullName: user.full_name || user.pi_username,
    })
  } catch (error: any) {
    console.error("[v0] pi-session: Error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
