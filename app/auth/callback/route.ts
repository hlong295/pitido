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
    console.log("[v0] ensurePiUserRecord: Record already exists, updating verification_status")
    // Update verification status to verified
    await supabase.from("pi_users").update({ verification_status: "verified" }).eq("id", user.id)
    return
  }

  // Create new record - only use columns that exist in pi_users table
  const newUserData = {
    id: user.id,
    pi_uid: `EMAIL-${user.id}`,
    pi_username: metadata.username || user.email?.split("@")[0] || `user_${user.id.substring(0, 8)}`,
    full_name: metadata.full_name || "",
    user_role: "redeemer",
    verification_status: "verified",
    provider_approved: false,
  }

  console.log("[v0] ensurePiUserRecord: Creating record:", newUserData)

  const { error: insertError } = await supabase.from("pi_users").upsert(newUserData, { onConflict: "id" })

  if (insertError) {
    console.error("[v0] ensurePiUserRecord: Insert error:", insertError)
  } else {
    console.log("[v0] ensurePiUserRecord: Created successfully")

    // Also create wallet
    await supabase.from("pitd_wallets").upsert({ user_id: user.id, balance: 0 }, { onConflict: "user_id" })
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const { searchParams, origin } = url

  // Lấy tất cả params có thể có
  const code = searchParams.get("code")
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") || "signup"
  const error = searchParams.get("error")
  const error_code = searchParams.get("error_code")
  const error_description = searchParams.get("error_description")

  console.log("[v0] ========== AUTH CALLBACK ==========")
  console.log("[v0] Full URL:", req.url)
  console.log("[v0] Origin:", origin)
  console.log("[v0] Params:", {
    code: code ? `${code.substring(0, 10)}...` : null,
    token_hash: token_hash ? `${token_hash.substring(0, 10)}...` : null,
    type,
    error,
    error_code,
    error_description,
  })

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
    // FLOW 1: Authorization Code Flow (PKCE)
    if (code) {
      console.log("[v0] Processing PKCE code flow...")
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error("[v0] exchangeCodeForSession error:", error.message)
        return redirectTo(origin, "error", mapSupabaseErrorToMessageKey(error.message))
      }

      console.log("[v0] PKCE success! User:", data?.user?.email)

      if (data?.user) {
        await ensurePiUserRecord(supabase, data.user)
      }

      return redirectTo(origin, "success", "verified")
    }

    // FLOW 2: Token Hash Flow (Magic Link / Email OTP)
    if (token_hash) {
      console.log("[v0] Processing token_hash flow, type:", type)

      // Depending on how the token was generated, the correct type may vary
      const typesToTry: Array<"signup" | "email" | "magiclink" | "recovery" | "invite"> = []

      // Add the requested type first
      if (type === "signup" || type === "email" || type === "magiclink" || type === "recovery" || type === "invite") {
        typesToTry.push(type as any)
      }

      // Then add fallback types
      if (type !== "email") typesToTry.push("email")
      if (type !== "signup") typesToTry.push("signup")

      console.log("[v0] Will try OTP types in order:", typesToTry)

      let lastError: any = null

      for (const otpType of typesToTry) {
        console.log("[v0] Trying verifyOtp with type:", otpType)

        const { data, error } = await supabase.auth.verifyOtp({
          token_hash,
          type: otpType,
        })

        if (!error && data?.user) {
          console.log("[v0] Token hash verification success with type:", otpType)
          console.log("[v0] User verified:", data.user.email)
          console.log("[v0] Email confirmed at:", data.user.email_confirmed_at)

          await ensurePiUserRecord(supabase, data.user)

          return redirectTo(origin, "success", "verified")
        }

        if (error) {
          console.log("[v0] verifyOtp with type", otpType, "failed:", error.message)
          lastError = error

          // If the error is "already confirmed" or "already used", treat as success
          const errLower = error.message.toLowerCase()
          if (errLower.includes("already") || errLower.includes("confirmed") || errLower.includes("used")) {
            console.log("[v0] Token already used/confirmed - treating as success")

            const { data: sessionData } = await supabase.auth.getSession()
            if (sessionData?.session?.user) {
              await ensurePiUserRecord(supabase, sessionData.session.user)
            }

            return redirectTo(origin, "success", "already_confirmed")
          }
        }
      }

      // All types failed
      if (lastError) {
        console.error("[v0] All verifyOtp attempts failed. Last error:", lastError.message)
        return redirectTo(origin, "error", mapSupabaseErrorToMessageKey(lastError.message))
      }
    }

    // Check if user already has session
    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData?.session) {
      console.log("[v0] User already has active session:", sessionData.session.user.email)

      await ensurePiUserRecord(supabase, sessionData.session.user)

      return redirectTo(origin, "success", "already_confirmed")
    }

    // Không có code/token_hash và không có session
    console.error("[v0] No code, token_hash, or existing session found")
    return redirectTo(origin, "error", "invalid_link")
  } catch (err: any) {
    console.error("[v0] Unexpected error in auth callback:", err)
    return redirectTo(origin, "error", "unexpected_error")
  }
}
