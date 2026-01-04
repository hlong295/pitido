import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://wlewqkcbwbvbbwjfpbck.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZXdxa2Nid2J2YmJ3amZwYmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNjYwODIsImV4cCI6MjA4MDY0MjA4Mn0.gkBIpcBRFn3wzg0koL_m-N2gZyJ76RcbrreghQml-yQ"

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZXdxa2Nid2J2YmJ3amZwYmNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA2NjA4MiwiZXhwIjoyMDgwNjQyMDgyfQ.CLNeaPyAXRg-Gacc2A93YINxqip60WrlMD2mcop245k"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY

function getEmailRedirectUrl(request: Request): string {
  // Use dev redirect URL if available (for v0 preview)
  if (process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL) {
    return process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
  }

  // Get origin from request headers
  const origin = request.headers.get("origin")
  if (origin) {
    return `${origin}/auth/callback`
  }

  const proto = request.headers.get("x-forwarded-proto") || "https"
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  if (host) {
    return `${proto}://${host}/auth/callback`
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
  }

  return "http://localhost:3000/auth/callback"
}

export async function POST(request: Request) {
  console.log("[v0] ========== REGISTER API START ==========")

  try {
    const body = await request.json()
    const { username, email, password, fullName, phoneNumber, address } = body

    console.log("[v0] Register: email =", email, "username =", username)

    const supabaseAdmin = createClient(supabaseUrl, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 1. Check username in pi_users
    const { data: existingUsername } = await supabaseAdmin
      .from("pi_users")
      .select("id")
      .ilike("pi_username", username)
      .maybeSingle()

    if (existingUsername) {
      console.log("[v0] Register: Username already exists")
      return NextResponse.json({ error: "Username này đã được sử dụng" }, { status: 400 })
    }

    const emailRedirectTo = getEmailRedirectUrl(request)
    console.log("[v0] Register: emailRedirectTo =", emailRedirectTo)

    console.log("[v0] Register: Calling supabase.auth.signUp...")

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          username: username,
          full_name: fullName,
          phone_number: phoneNumber,
          address: address,
        },
      },
    })

    console.log("[v0] Register: signUp result:", {
      hasUser: !!authData?.user,
      userId: authData?.user?.id,
      hasSession: !!authData?.session,
      emailConfirmedAt: authData?.user?.email_confirmed_at,
      error: authError ? authError.message : null,
    })

    if (authError) {
      console.error("[v0] Register: Auth error:", authError)

      if (authError.message?.includes("already") || authError.message?.includes("registered")) {
        return NextResponse.json({ error: "Email này đã được đăng ký. Vui lòng đăng nhập." }, { status: 400 })
      }

      return NextResponse.json(
        {
          error: "Không thể tạo tài khoản. Vui lòng thử lại.",
          details: authError.message,
        },
        { status: 500 },
      )
    }

    if (!authData?.user) {
      console.error("[v0] Register: No user returned")
      return NextResponse.json({ error: "Không thể tạo tài khoản" }, { status: 500 })
    }

    if (authData.user.identities && authData.user.identities.length === 0) {
      console.log("[v0] Register: Email already exists (empty identities)")
      return NextResponse.json({ error: "Email này đã được đăng ký. Vui lòng đăng nhập." }, { status: 400 })
    }

    console.log("[v0] Register: Auth user created:", authData.user.id)

    const isEmailConfirmed = !!authData.user.email_confirmed_at
    const requiresEmailConfirmation = !isEmailConfirmed && !authData.session

    const { error: insertError } = await supabaseAdmin.from("pi_users").upsert(
      {
        id: authData.user.id,
        pi_uid: `EMAIL-${authData.user.id}`,
        pi_username: username,
        full_name: fullName,
        user_role: "redeemer",
        verification_status: isEmailConfirmed ? "verified" : "pending",
        provider_approved: false,
      },
      { onConflict: "id" },
    )

    if (insertError) {
      console.error("[v0] Register: pi_users insert error:", insertError)
    } else {
      console.log("[v0] Register: pi_users created successfully")
    }

    const { error: walletError } = await supabaseAdmin
      .from("pitd_wallets")
      .upsert({ user_id: authData.user.id, balance: 0 }, { onConflict: "user_id" })

    if (walletError) {
      console.error("[v0] Register: wallet creation error:", walletError)
    } else {
      console.log("[v0] Register: wallet created successfully")
    }

    console.log("[v0] ========== REGISTER API SUCCESS ==========")
    console.log("[v0] Register: requiresEmailConfirmation =", requiresEmailConfirmation)

    return NextResponse.json({
      success: true,
      message: requiresEmailConfirmation
        ? "Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản."
        : "Đăng ký thành công! Bạn có thể đăng nhập ngay.",
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      requiresEmailConfirmation,
    })
  } catch (error: any) {
    console.error("[v0] Register: Unexpected error:", error)
    return NextResponse.json(
      {
        error: "Lỗi không xác định",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
