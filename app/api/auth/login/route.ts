import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://wlewqkcbwbvbbwjfpbck.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZXdxa2Nid2J2YmJ3amZwYmNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA2NjA4MiwiZXhwIjoyMDgwNjQyMDgyfQ.CLNeaPyAXRg-Gacc2A93YINxqip60WrlMD2mcop245k"

const usernameCache = new Map<string, { email: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function POST(request: Request) {
  try {
    const { emailOrUsername } = await request.json()

    console.log("[v0] Login API: Looking up user", emailOrUsername)

    // If already an email, return it directly
    if (emailOrUsername.includes("@")) {
      return NextResponse.json({ email: emailOrUsername })
    }

    const cached = usernameCache.get(emailOrUsername.toLowerCase())
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log("[v0] Login API: Returning cached email for", emailOrUsername)
      return NextResponse.json({ email: cached.email })
    }

    // Create admin client on server side
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: piUserData, error: piUserError } = await adminSupabase
      .from("pi_users")
      .select("id, pi_uid, pi_username")
      .ilike("pi_username", emailOrUsername)
      .maybeSingle()

    if (piUserError) {
      console.error("[v0] Login API: Query error", piUserError)
      return NextResponse.json({ error: "Lỗi truy vấn database" }, { status: 500 })
    }

    if (!piUserData) {
      console.error("[v0] Login API: User not found by username", emailOrUsername)
      return NextResponse.json({ error: "Không tìm thấy tài khoản với username này" }, { status: 404 })
    }

    console.log("[v0] Login API: Found pi_user", piUserData.id, "pi_uid:", piUserData.pi_uid)

    let authUserId = piUserData.id

    if (piUserData.pi_uid && piUserData.pi_uid.startsWith("EMAIL-")) {
      const extractedId = piUserData.pi_uid.replace("EMAIL-", "")
      // Use the extracted ID if it looks like a UUID
      if (extractedId.includes("-")) {
        authUserId = extractedId
        console.log("[v0] Login API: Extracted auth ID from pi_uid:", authUserId)
      }
    }

    const { data: authData, error: authError } = await adminSupabase.auth.admin.getUserById(authUserId)

    if (authError || !authData?.user?.email) {
      // Fallback: try with piUserData.id if we extracted from pi_uid
      if (authUserId !== piUserData.id) {
        console.log("[v0] Login API: Trying with pi_users.id instead:", piUserData.id)
        const { data: authData2 } = await adminSupabase.auth.admin.getUserById(piUserData.id)
        if (authData2?.user?.email) {
          console.log("[v0] Login API: Found email using pi_users.id:", authData2.user.email)
          usernameCache.set(emailOrUsername.toLowerCase(), {
            email: authData2.user.email,
            timestamp: Date.now(),
          })
          return NextResponse.json({ email: authData2.user.email })
        }
      }

      console.error("[v0] Login API: Could not get email from auth", authError)
      return NextResponse.json({ error: "Không tìm thấy email cho tài khoản này" }, { status: 404 })
    }

    console.log("[v0] Login API: Found email", authData.user.email)

    usernameCache.set(emailOrUsername.toLowerCase(), {
      email: authData.user.email,
      timestamp: Date.now(),
    })

    return NextResponse.json({ email: authData.user.email })
  } catch (error: any) {
    console.error("[v0] Login API error:", error)
    return NextResponse.json({ error: error.message || "Lỗi server" }, { status: 500 })
  }
}
