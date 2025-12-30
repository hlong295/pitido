import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://wlewqkcbwbvbbwjfpbck.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZXdxa2Nid2J2YmJ3amZwYmNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA2NjA4MiwiZXhwIjoyMDgwNjQyMDgyfQ.CLNeaPyAXRg-Gacc2A93YINxqip60WrlMD2mcop245k"

// NOTE:
// Do not cache role/provider flags here.
// Admin can promote a member to Provider at any time; caching would cause
// the app to keep showing the old role (e.g., 'redeemer') for minutes.

export async function POST(request: Request) {
  try {
    const { userId, email, metadata } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    console.log("[v0] ensure-user API: Processing user", userId, email)

    // IMPORTANT: no in-memory caching here (see note above)

    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    let existingUser = null

    // 1. Try to find by id (new format: id = auth user id)
    const { data: userById, error: findError } = await adminSupabase
      .from("pi_users")
      .select("id, pi_uid, pi_username, full_name, user_role, verification_status, provider_approved")
      .eq("id", userId)
      .maybeSingle()

    if (findError) {
      console.error("[v0] ensure-user API: find error", findError)
    }

    if (userById) {
      existingUser = userById
      console.log("[v0] ensure-user API: found user by id", existingUser.pi_username)
    }

    // 2. Try to find by pi_uid (old format: pi_uid = "EMAIL-{auth_user_id}")
    if (!existingUser) {
      const piUid = `EMAIL-${userId}`
      const { data: userByPiUid } = await adminSupabase
        .from("pi_users")
        .select("id, pi_uid, pi_username, full_name, user_role, verification_status, provider_approved")
        .eq("pi_uid", piUid)
        .maybeSingle()

      if (userByPiUid) {
        existingUser = userByPiUid
        console.log("[v0] ensure-user API: found user by pi_uid", existingUser.pi_username)
      }
    }

    // 3. Try to find by username from metadata
    if (!existingUser && metadata?.username) {
      const { data: userByUsername } = await adminSupabase
        .from("pi_users")
        .select("id, pi_uid, pi_username, full_name, user_role, verification_status, provider_approved")
        .ilike("pi_username", metadata.username)
        .maybeSingle()

      if (userByUsername) {
        existingUser = userByUsername
        console.log("[v0] ensure-user API: found user by username", existingUser.pi_username)

        // Update the id if different
        if (existingUser.id !== userId) {
          console.log("[v0] ensure-user API: updating user id from", existingUser.id, "to", userId)
          const { error: updateError } = await adminSupabase
            .from("pi_users")
            .update({
              id: existingUser.id,
              pi_uid: `EMAIL-${userId}`,
            })
            .eq("id", existingUser.id)

          if (updateError) {
            console.error("[v0] ensure-user API: failed to update user id", updateError)
          } else {
            existingUser.id = userId
            existingUser.pi_uid = `EMAIL-${userId}`
          }
        }
      }
    }

    if (existingUser) {
      console.log("[v0] ensure-user API: returning existing user", existingUser.pi_username, "id:", existingUser.id)

      // Update verification status if needed
      if (metadata?.email_confirmed_at && existingUser.verification_status !== "verified") {
        await adminSupabase.from("pi_users").update({ verification_status: "verified" }).eq("id", existingUser.id)
        existingUser.verification_status = "verified"
      }

      // Ensure PITD wallet exists for this user (schema: balance, locked_balance, total_spent, address)
      // PITD wallet address rule (PITODO): starts with "PITD" + 20 random chars = 24 chars total.
      const makeAddress = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        let out = ""
        const n = 20
        // Prefer cryptographic RNG when available
        const cryptoAny: any = (globalThis as any).crypto
        if (cryptoAny?.getRandomValues) {
          const buf = new Uint8Array(n)
          cryptoAny.getRandomValues(buf)
          for (let i = 0; i < n; i++) out += chars[buf[i] % chars.length]
        } else {
          for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)]
        }
        return `PITD${out}`
      }

      const { data: existingWallet } = await adminSupabase
        .from("pitd_wallets")
        .select("id, user_id, balance, locked_balance, total_spent, address")
        .eq("user_id", existingUser.id)
        .maybeSingle()

      const walletUpsert = {
        user_id: existingUser.id,
        balance: existingWallet?.balance ?? 0,
        locked_balance: (existingWallet as any)?.locked_balance ?? 0,
        total_spent: (existingWallet as any)?.total_spent ?? 0,
        address: existingWallet?.address || makeAddress(),
      }

      await adminSupabase.from("pitd_wallets").upsert(walletUpsert, { onConflict: "user_id" })


      const result = {
        ...existingUser,
        id: existingUser.id,
      }

      return NextResponse.json({
        ...result,
        email: email,
      })
    }

    // Create new user
    const newUserData = {
      id: userId,
      pi_uid: `EMAIL-${userId}`,
      pi_username: metadata?.username || email?.split("@")[0] || `user_${userId.substring(0, 8)}`,
      full_name: metadata?.full_name || "",
      user_role: "redeemer",
      verification_status: metadata?.email_confirmed_at ? "verified" : "pending",
      provider_approved: false,
    }

    console.log("[v0] ensure-user API: creating new user", newUserData.pi_username)

    const { data: newUser, error: insertError } = await adminSupabase
      .from("pi_users")
      .upsert(newUserData, { onConflict: "id" })
      .select("id, pi_uid, pi_username, full_name, user_role, verification_status, provider_approved")
      .maybeSingle()

    if (insertError) {
      console.error("[v0] ensure-user API: insert error", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    console.log("[v0] ensure-user API: created successfully")

    // Ensure PITD wallet exists (schema: balance, locked_balance, total_spent, address)
    // PITD wallet address rule (PITODO): starts with "PITD" + 20 random chars = 24 chars total.
    const makeAddress = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
      let out = ""
      const n = 20
      const cryptoAny: any = (globalThis as any).crypto
      if (cryptoAny?.getRandomValues) {
        const buf = new Uint8Array(n)
        cryptoAny.getRandomValues(buf)
        for (let i = 0; i < n; i++) out += chars[buf[i] % chars.length]
      } else {
        for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)]
      }
      return `PITD${out}`
    }

    // If wallet exists but missing address, patch it
    const { data: existingWallet } = await adminSupabase
      .from("pitd_wallets")
      .select("id, user_id, balance, locked_balance, total_spent, address")
      .eq("user_id", userId)
      .maybeSingle()

    const walletUpsert = {
      user_id: userId,
      balance: existingWallet?.balance ?? 0,
      locked_balance: (existingWallet as any)?.locked_balance ?? 0,
      total_spent: (existingWallet as any)?.total_spent ?? 0,
      address: existingWallet?.address || makeAddress(),
    }

    await adminSupabase.from("pitd_wallets").upsert(walletUpsert, { onConflict: "user_id" })

    return NextResponse.json({
      ...newUser,
      email: email,
    })
  } catch (error: any) {
    console.error("[v0] ensure-user API error:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 })
  }
}
