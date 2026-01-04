import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { randomUUID } from "crypto"
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user"

const ROOT_ADMIN_USERNAME = "HLong295"
const PI_API_URL = "https://api.minepi.com"
async function touchUsersLastLogin(piUsersId: string, piUid: string, piUsername: string) {
  try {
    const admin = getSupabaseAdminClient()
    const { userId: masterUserId } = await resolveMasterUserId(admin, piUsersId)
    const payload: any = {
      last_login_at: new Date().toISOString(),
      // keep Pi identifiers synced on master row (safe)
      pi_uid: piUid,
      pi_username: piUsername,
    }
    await admin.from("users").update(payload).eq("id", masterUserId)
  } catch (e: any) {
    console.warn("[v0] pi-callback: touchUsersLastLogin skipped:", e?.message || e)
  }
}


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

  // If historical duplicates exist (same pi_uid), maybeSingle() would error.
  // Limit to 1 row to make the lookup resilient while you clean data / add uniqueness.
  const { data: user, error } = await supabase
    .from("pi_users")
    .select("*")
    .eq("pi_uid", piUid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error && error.code !== "PGRST116") {
    console.error("[v0] Error finding Pi user:", error)
  }

  return user || null
}

async function upsertPiUser(piUid: string, piUsername: string) {
  const supabase = await getSupabaseServerClient()
  // Prefer service-role client for writes (production on Vercel) to avoid RLS errors.
  // Falls back to the regular server client if the service role key is not configured.
  let admin: ReturnType<typeof getSupabaseAdminClient> | null = null
  try {
    admin = getSupabaseAdminClient()
  } catch (e) {
    console.warn("[v0] Supabase admin client not configured:", (e as any)?.message || e)
  }
  if (!admin && process.env.NODE_ENV === "production") {
    throw new Error(
      "Server misconfig: SUPABASE_SERVICE_ROLE_KEY is missing. Add it in Vercel → Project → Settings → Environment Variables (Production)."
    )
  }
  const writeClient = (admin ?? supabase) as any

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

	// --- FK SAFETY FOR PITD WALLET ---
	// We have a FK: pitd_wallets.user_id -> users.id (constraint: pitd_wallets_user_id_fkey).
	// Some deployments also have a DB trigger that creates a PITD wallet when a Pi user is created.
	// If the matching row in `users` does not exist (same UUID), the trigger (or any wallet insert)
	// will fail with the FK violation you're seeing on Pi Browser.
	//
	// Therefore, before we insert/update `pi_users`, we guarantee a corresponding `users` row exists
	// with the SAME id. We do NOT change any UI; we only harden server-side data consistency.
		const usersClient = getSupabaseAdminClient()
		let targetUserId = existingUser?.id
		if (!targetUserId) {
			// Reuse existing `users` row for this Pi account if present, otherwise create a new uuid.
			const { data: byUid, error: byUidErr } = await usersClient
				.from("users")
				.select("id")
				.eq("pi_uid", piUid)
				.maybeSingle()
			if (byUidErr) {
				console.warn("[v0] users lookup by pi_uid error (non-fatal):", byUidErr)
			}
			targetUserId = byUid?.id || randomUUID()
		}

	// If a users row already exists we only touch Pi linkage + last_login_at (avoid overwriting email users).
	const { data: usersRow, error: usersReadErr } = await usersClient
		.from("users")
		.select("id,user_role,user_type")
		.eq("id", targetUserId)
		.maybeSingle()
	if (usersReadErr) {
		console.warn("[v0] users lookup error (non-fatal):", usersReadErr)
	}

	if (!usersRow) {
		const usersInsertPayload: any = {
			id: targetUserId,
			pi_uid: piUid,
			pi_username: piUsername,
			user_type: "pi",
			user_role: isRootAdmin ? "root" : "redeemer",
			verification_status: "pending",
			last_login_at: new Date().toISOString(),
		}
		const { error: usersInsertErr } = await usersClient.from("users").insert(usersInsertPayload)
		if (usersInsertErr) {
			console.error("[v0] Failed to ensure users row for Pi login:", {
				targetUserId,
				piUid,
				piUsername,
				error: usersInsertErr,
			})
			throw usersInsertErr
		}
	} else {
		const { error: usersUpdateErr } = await usersClient
			.from("users")
			.update({
				pi_uid: piUid,
				pi_username: piUsername,
				last_login_at: new Date().toISOString(),
			})
			.eq("id", targetUserId)
		if (usersUpdateErr) {
			console.warn("[v0] users update error (non-fatal):", usersUpdateErr)
		}
	}

	// Final sanity check (Pi Browser has no console): verify master users row exists.
	const { data: usersRowVerify, error: usersVerifyErr } = await usersClient
		.from("users")
		.select("id,user_type")
		.eq("id", targetUserId)
		.maybeSingle();
	if (usersVerifyErr) {
		console.warn("[pi-callback] users verify error (non-fatal):", usersVerifyErr);
	}
	if (!usersRowVerify) {
		throw new Error(
			`[pi-callback] Missing master users row for targetUserId=${targetUserId} piUid=${piUid} piUsername=${piUsername}`
		);
	}

	if (existingUser) {
    console.log("[v0] Updating existing Pi user:", existingUser.id)

    const { data, error } = await writeClient
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

    const { data, error } = await writeClient
      .from("pi_users")
      .insert({
				id: targetUserId,
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

    await touchUsersLastLogin(String(userProfile.id), String(userProfile.piUid), String(userProfile.piUsername))

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
