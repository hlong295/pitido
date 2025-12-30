import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

// API to set cookie after successful Pi login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { piUserId } = body

    console.log("[v0] pi-login-complete: Setting cookie for piUserId:", piUserId)

    if (!piUserId) {
      return NextResponse.json({ error: "Missing piUserId" }, { status: 400 })
    }

    // Verify user exists in database
    const supabase = await getSupabaseServerClient()
    const { data: user, error } = await supabase
      .from("pi_users")
      .select("id, pi_uid, pi_username, user_role, user_type, verification_status, full_name")
      .eq("id", piUserId)
      .maybeSingle()

    if (error || !user) {
      console.error("[v0] pi-login-complete: User not found:", error)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("[v0] pi-login-complete: Found user:", user.pi_username)

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        piUid: user.pi_uid,
        piUsername: user.pi_username,
        userRole: user.user_role,
        userType: user.user_type || "pi",
        verificationStatus: user.verification_status,
        fullName: user.full_name || user.pi_username,
      },
    })

    // IMPORTANT: On mobile Pi Browser the app can behave like an embedded
    // context; cookies with SameSite=Lax are often not persisted/sent back.
    // To make server-side permission checks reliable, force SameSite=None
    // (requires Secure) when we detect Pi Browser.
    const isProd = process.env.NODE_ENV === "production"
    const ua = request.headers.get("user-agent") || ""
    const isPiBrowser = /pibrowser|pi browser|pinetwork|pi network/i.test(ua)
    const cookieSecure = isPiBrowser ? true : isProd
    const cookieSameSite: "none" | "lax" = isPiBrowser ? "none" : isProd ? "none" : "lax"

    response.cookies.set("pi_user_id", piUserId, {
      httpOnly: false, // Allow JS access for client-side auth
      secure: cookieSecure,
      sameSite: cookieSameSite,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    // Also set a full user data cookie for faster loading
    const userData = {
      uid: user.pi_uid,
      username: user.pi_username,
      authType: "pi",
      role: user.user_role,
      piUserId: user.id,
      fullName: user.full_name || user.pi_username,
      verificationStatus: user.verification_status,
    }

    response.cookies.set("pitodo_pi_user", JSON.stringify(userData), {
      httpOnly: false,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })

    console.log("[v0] pi-login-complete: Cookie set successfully")

    return response
  } catch (error: any) {
    console.error("[v0] pi-login-complete: Error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
