import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

const ROOT_ADMIN_USERNAME = "HLong295"
const PI_API_URL = "https://api.minepi.com"

async function verifyPiAccessToken(accessToken: string, uid: string) {
  try {
    console.log("[v0] Verifying Pi access token for uid:", uid)
    const response = await fetch(`${PI_API_URL}/v2/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Pi API verification failed:", response.status, errorText)
      return null
    }

    const data = await response.json()
    console.log("[v0] Pi API response:", { uid: data.uid, username: data.username })

    if (data.uid !== uid) {
      console.error("[v0] UID mismatch:", { expected: uid, got: data.uid })
      return null
    }

    return data
  } catch (error) {
    console.error("[v0] Pi token verification failed:", error)
    return null
  }
}

async function checkPiUsersTableExists() {
  const supabase = await getSupabaseServerClient()

  try {
    const { data, error } = await supabase.from("pi_users").select("id").limit(1)

    if (!error) {
      return true
    }

    if (error.message && error.message.includes("does not exist")) {
      return false
    }

    return true
  } catch (e) {
    return false
  }
}

async function findExistingPiUser(piUid: string) {
  const supabase = await getSupabaseServerClient()

  const { data: user, error } = await supabase.from("pi_users").select("*").eq("pi_uid", piUid).maybeSingle()

  if (error && error.code !== "PGRST116") {
    console.error("[v0] Error finding Pi user:", error)
  }

  return user || null
}

async function upsertPiUser(piUid: string, piUsername: string) {
  const supabase = await getSupabaseServerClient()

  console.log("[v0] Upserting Pi user:", { piUid, piUsername })

  const tableExists = await checkPiUsersTableExists()
  if (!tableExists) {
    console.error("[v0] pi_users table does not exist!")
    throw new Error("Database table 'pi_users' not found. Please run script 108-pi-users-table.sql")
  }

  const existingUser = await findExistingPiUser(piUid)

  const isRootAdmin = piUsername.toLowerCase() === ROOT_ADMIN_USERNAME.toLowerCase()
  let userRole = "redeemer"

  if (existingUser) {
    if (existingUser.user_role === "root_admin") {
      userRole = "root_admin"
    } else if (isRootAdmin) {
      userRole = "root_admin"
    } else {
      userRole = existingUser.user_role || "redeemer"
    }
  } else {
    if (isRootAdmin) {
      userRole = "root_admin"
    }
  }

  if (existingUser) {
    console.log("[v0] Updating existing Pi user:", existingUser.id)

    const { data, error } = await supabase
      .from("pi_users")
      .update({
        pi_username: piUsername,
        full_name: piUsername,
        user_role: userRole,
        user_type: "pi",
        verification_status: "verified",
        last_login_at: new Date().toISOString(),
      })
      .eq("pi_uid", piUid)
      .select()
      .maybeSingle()

    if (error) {
      console.error("[v0] Error updating Pi user:", error)
      throw new Error("Failed to update user: " + error.message)
    }

    if (!data) {
      console.log("[v0] Update returned no data, using existing user data")
      return {
        id: existingUser.id,
        piUid: existingUser.pi_uid,
        piUsername: existingUser.pi_username,
        userRole: existingUser.user_role || userRole,
        userType: "pi" as const,
        verificationStatus: existingUser.verification_status || "verified",
      }
    }

    console.log("[v0] Pi user updated successfully:", data.id)
    return {
      id: data.id,
      piUid: data.pi_uid,
      piUsername: data.pi_username,
      userRole: data.user_role,
      userType: "pi" as const,
      verificationStatus: data.verification_status,
    }
  } else {
    console.log("[v0] Creating new Pi user...")

    const { data, error } = await supabase
      .from("pi_users")
      .insert({
        pi_uid: piUid,
        pi_username: piUsername,
        full_name: piUsername,
        user_role: userRole,
        user_type: "pi",
        verification_status: "verified",
        provider_approved: isRootAdmin,
        last_login_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error("[v0] Error creating Pi user:", error)
      throw new Error("Failed to create user: " + error.message)
    }

    if (!data) {
      console.log("[v0] Insert succeeded but no data returned, fetching user...")
      const createdUser = await findExistingPiUser(piUid)
      if (createdUser) {
        return {
          id: createdUser.id,
          piUid: createdUser.pi_uid,
          piUsername: createdUser.pi_username,
          userRole: createdUser.user_role,
          userType: "pi" as const,
          verificationStatus: createdUser.verification_status,
        }
      }
      throw new Error("Failed to retrieve created user")
    }

    console.log("[v0] Pi user created successfully:", data.id)

    return {
      id: data.id,
      piUid: data.pi_uid,
      piUsername: data.pi_username,
      userRole: data.user_role,
      userType: "pi" as const,
      verificationStatus: data.verification_status,
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accessToken, user } = body

    console.log("[v0] Pi callback received:", {
      hasToken: !!accessToken,
      hasUser: !!user,
      uid: user?.uid,
      username: user?.username,
    })

    if (!accessToken || !user || !user.uid || !user.username) {
      console.error("[v0] Invalid request data - missing fields")
      return NextResponse.json({ error: "Invalid request: missing accessToken or user data" }, { status: 400 })
    }

    const verifiedUser = await verifyPiAccessToken(accessToken, user.uid)

    if (!verifiedUser) {
      console.error("[v0] Pi token verification failed - invalid token or UID mismatch")
      return NextResponse.json({ error: "Access token verification failed" }, { status: 401 })
    }

    console.log("[v0] Pi token verified successfully for:", verifiedUser.username)

    const userProfile = await upsertPiUser(user.uid, user.username)

    console.log("[v0] Pi user profile created/updated:", {
      id: userProfile.id,
      username: userProfile.piUsername,
      role: userProfile.userRole,
    })

    return NextResponse.json({
      id: userProfile.id,
      piUid: userProfile.piUid,
      piUsername: userProfile.piUsername,
      userRole: userProfile.userRole,
      userType: userProfile.userType,
      verificationStatus: userProfile.verificationStatus,
    })
  } catch (error: any) {
    console.error("[v0] Pi callback error:", error.message)
    return NextResponse.json(
      {
        error: error.message || "Authentication failed",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
