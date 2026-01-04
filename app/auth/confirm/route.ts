import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const SUPABASE_URL = "https://wlewqkcbwbvbbwjfpbck.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZXdxa2Nid2J2YmJ3amZwYmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNjYwODIsImV4cCI6MjA4MDY0MjA4Mn0.gkBIpcBRFn3wzg0koL_m-N2gZyJ76RcbrreghQml-yQ"

function redirectTo(origin: string, status: "success" | "error", message: string) {
  const url = new URL(`${origin}/auth/verify-result`)
  url.searchParams.set("status", status)
  url.searchParams.set("message", message)
  return NextResponse.redirect(url.toString())
}

function mapSupabaseErrorToMessageKey(errMsg: string) {
  const m = (errMsg || "").toLowerCase()
  if (m.includes("expired")) return "link_expired"
  if (m.includes("invalid") || m.includes("token") || m.includes("otp")) return "invalid_token"
  if (m.includes("already") || m.includes("confirmed") || m.includes("used")) return "already_confirmed"
  return "verification_failed"
}

async function ensurePiUserRecord(supabase: any, user: any) {
  const metadata = user.user_metadata || {}

  // Check if record exists
  const { data: existingUser } = await supabase.from("pi_users").select("id").eq("id", user.id).maybeSingle()

  if (existingUser) {
    console.log("[v0] confirm/ensurePiUserRecord: Record already exists")
    // Update verification_status to verified
    await supabase.from("pi_users").update({ verification_status: "verified" }).eq("id", user.id)
    return
  }

  // Create new record
  const newUserData = {
    id: user.id,
    pi_uid: `EMAIL-${user.id}`,
    pi_username: metadata.username || user.email?.split("@")[0] || `user_${user.id.substring(0, 8)}`,
    email: user.email,
    full_name: metadata.full_name || "",
    phone_number: metadata.phone_number || "",
    address: metadata.address || "",
    user_role: "redeemer",
    user_type: "email",
    verification_status: "verified",
  }

  console.log("[v0] confirm/ensurePiUserRecord: Creating record:", newUserData)

  const { error: insertError } = await supabase.from("pi_users").upsert(newUserData, { onConflict: "id" })

  if (insertError) {
    console.error("[v0] confirm/ensurePiUserRecord: Insert error:", insertError)
  } else {
    console.log("[v0] confirm/ensurePiUserRecord: Created successfully")
    // Also create wallet
    await supabase.from("pitd_wallets").upsert({ user_id: user.id, balance: 0 }, { onConflict: "user_id" })
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const { searchParams, origin } = url

  // Get all possible params from Supabase confirmation email
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") || "signup"
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const error_code = searchParams.get("error_code")
  const error_description = searchParams.get("error_description")

  console.log("[v0] ========== AUTH CONFIRM ==========")
  console.log("[v0] Full URL:", req.url)
  console.log("[v0] Origin:", origin)
  console.log("[v0] Params:", {
    token_hash: token_hash ? `${token_hash.substring(0, 15)}...` : null,
    type,
    code: code ? `${code.substring(0, 10)}...` : null,
    error,
    error_code,
    error_description,
  })

  // Handle error from Supabase
  if (error || error_code) {
    console.error("[v0] Supabase returned error:", error, error_description)
    return redirectTo(origin, "error", mapSupabaseErrorToMessageKey(error_description || error || ""))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (e) {
            console.error("[v0] Cookie set error:", e)
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: "", ...options })
          } catch (e) {
            console.error("[v0] Cookie remove error:", e)
          }
        },
      },
    },
  )

  try {
    // FLOW 1: PKCE Code Flow (redirect from OAuth or signUp with PKCE)
    if (code) {
      console.log("[v0] confirm: Processing PKCE code flow...")
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error("[v0] confirm: exchangeCodeForSession error:", error.message)
        return redirectTo(origin, "error", mapSupabaseErrorToMessageKey(error.message))
      }

      console.log("[v0] confirm: PKCE success! User:", data?.user?.email)

      if (data?.user) {
        await ensurePiUserRecord(supabase, data.user)
      }

      return redirectTo(origin, "success", "verified")
    }

    // FLOW 2: Token Hash Flow (Email confirmation OTP)
    if (token_hash) {
      console.log("[v0] confirm: Processing token_hash flow, type:", type)

      // Try multiple OTP types since Supabase might send different types
      const typesToTry: Array<"signup" | "email" | "magiclink" | "recovery" | "invite" | "email_change"> = []

      // Add the requested type first
      if (["signup", "email", "magiclink", "recovery", "invite", "email_change"].includes(type)) {
        typesToTry.push(type as any)
      }

      // Add fallback types
      if (!typesToTry.includes("email")) typesToTry.push("email")
      if (!typesToTry.includes("signup")) typesToTry.push("signup")

      console.log("[v0] confirm: Will try OTP types:", typesToTry)

      let lastError: any = null

      for (const otpType of typesToTry) {
        console.log("[v0] confirm: Trying verifyOtp with type:", otpType)

        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash,
          type: otpType,
        })

        if (!verifyError && data?.user) {
          console.log("[v0] confirm: Token verification SUCCESS with type:", otpType)
          console.log("[v0] confirm: User email:", data.user.email)
          console.log("[v0] confirm: Email confirmed at:", data.user.email_confirmed_at)

          await ensurePiUserRecord(supabase, data.user)

          return redirectTo(origin, "success", "verified")
        }

        if (verifyError) {
          console.log("[v0] confirm: verifyOtp type", otpType, "failed:", verifyError.message)
          lastError = verifyError

          // If already confirmed, treat as success
          const errLower = verifyError.message.toLowerCase()
          if (errLower.includes("already") || errLower.includes("confirmed") || errLower.includes("used")) {
            console.log("[v0] confirm: Token already used - checking existing session")

            const { data: sessionData } = await supabase.auth.getSession()
            if (sessionData?.session?.user) {
              await ensurePiUserRecord(supabase, sessionData.session.user)
            }

            return redirectTo(origin, "success", "already_confirmed")
          }
        }
      }

      // All attempts failed
      if (lastError) {
        console.error("[v0] confirm: All verifyOtp attempts failed:", lastError.message)
        return redirectTo(origin, "error", mapSupabaseErrorToMessageKey(lastError.message))
      }
    }

    // This happens when Supabase redirects with hash fragment (implicit flow)
    // The hash fragment is not visible to server-side code, so we redirect to a client page
    console.log("[v0] confirm: No token_hash or code - checking if this is implicit flow...")

    // Check for existing session first
    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData?.session?.user) {
      console.log("[v0] confirm: User already has active session")
      await ensurePiUserRecord(supabase, sessionData.session.user)
      return redirectTo(origin, "success", "already_confirmed")
    }

    // Redirect to a client page that can read hash fragments
    // The client-side auth-context will handle the hash fragment
    console.log("[v0] confirm: Redirecting to client page to handle potential hash fragment...")
    const clientUrl = new URL(`${origin}/auth/handle-callback`)
    return NextResponse.redirect(clientUrl.toString())
  } catch (err: any) {
    console.error("[v0] confirm: Unexpected error:", err)
    return redirectTo(origin, "error", "unexpected_error")
  }
}
