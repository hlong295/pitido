"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"

const SUPABASE_URL = "https://wlewqkcbwbvbbwjfpbck.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZXdxa2Nid2J2YmJ3amZwYmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNjYwODIsImV4cCI6MjA4MDY0MjA4Mn0.gkBIpcBRFn3wzg0koL_m-N2gZyJ76RcbrreghQml-yQ"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const handleCallback = async () => {
      console.log("[v0] AuthCallbackPage: Starting...")
      console.log("[v0] AuthCallbackPage: Full URL:", window.location.href)
      console.log("[v0] AuthCallbackPage: Hash:", window.location.hash)
      console.log("[v0] AuthCallbackPage: Search:", window.location.search)

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
      )

      const hash = window.location.hash
      if (hash && hash.includes("access_token")) {
        console.log("[v0] AuthCallbackPage: Found access_token in hash")

        // Parse hash parameters
        const hashParams = new URLSearchParams(hash.substring(1))
        const accessToken = hashParams.get("access_token")
        const refreshToken = hashParams.get("refresh_token")
        const type = hashParams.get("type")

        console.log("[v0] AuthCallbackPage: Token type:", type)
        console.log("[v0] AuthCallbackPage: Has access_token:", !!accessToken)
        console.log("[v0] AuthCallbackPage: Has refresh_token:", !!refreshToken)

        if (accessToken) {
          try {
            // Set the session manually
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || "",
            })

            if (error) {
              console.error("[v0] AuthCallbackPage: setSession error:", error)
              // Check if already confirmed
              if (
                error.message?.toLowerCase().includes("already") ||
                error.message?.toLowerCase().includes("expired")
              ) {
                // Check if user is already logged in
                const { data: sessionData } = await supabase.auth.getSession()
                if (sessionData?.session?.user) {
                  console.log("[v0] AuthCallbackPage: User already has session")
                  setStatus("success")
                  setMessage("Email đã được xác thực trước đó!")
                  setTimeout(() => {
                    router.push("/auth/verify-result?status=success&message=already_confirmed")
                  }, 1000)
                  return
                }
              }
              setStatus("error")
              setMessage("Không thể xác thực token")
              setTimeout(() => {
                router.push("/auth/verify-result?status=error&message=invalid_token")
              }, 1500)
              return
            }

            if (data?.user) {
              console.log("[v0] AuthCallbackPage: Session set successfully! User:", data.user.email)

              // Ensure pi_user record exists
              await ensurePiUserRecord(supabase, data.user)

              setStatus("success")
              setMessage("Xác thực email thành công!")

              // Redirect to verify-result page
              setTimeout(() => {
                router.push("/auth/verify-result?status=success&message=verified")
              }, 1000)
              return
            }
          } catch (err) {
            console.error("[v0] AuthCallbackPage: Error processing token:", err)
          }
        }
      }

      // Check for query params (PKCE flow)
      const searchParams = new URLSearchParams(window.location.search)
      const code = searchParams.get("code")
      const token_hash = searchParams.get("token_hash")
      const error = searchParams.get("error")
      const errorDescription = searchParams.get("error_description")

      if (error) {
        console.error("[v0] AuthCallbackPage: Error from Supabase:", error, errorDescription)
        setStatus("error")
        setMessage(errorDescription || "Xác thực thất bại")
        setTimeout(() => {
          router.push(`/auth/verify-result?status=error&message=${encodeURIComponent(error)}`)
        }, 1000)
        return
      }

      if (code) {
        console.log("[v0] AuthCallbackPage: Found code, exchanging...")
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
          console.error("[v0] AuthCallbackPage: Exchange error:", error)
          setStatus("error")
          setMessage("Không thể xác thực mã")
          setTimeout(() => {
            router.push("/auth/verify-result?status=error&message=exchange_failed")
          }, 1500)
          return
        }

        if (data?.user) {
          console.log("[v0] AuthCallbackPage: Code exchange success! User:", data.user.email)
          await ensurePiUserRecord(supabase, data.user)
          setStatus("success")
          setMessage("Xác thực email thành công!")
          setTimeout(() => {
            router.push("/auth/verify-result?status=success&message=verified")
          }, 1000)
          return
        }
      }

      if (token_hash) {
        console.log("[v0] AuthCallbackPage: Found token_hash, verifying...")
        const type = (searchParams.get("type") as "signup" | "email" | "recovery" | "magiclink" | "invite") || "signup"

        const { data, error } = await supabase.auth.verifyOtp({
          token_hash,
          type,
        })

        if (error) {
          // Try with different types
          const typesToTry: Array<"signup" | "email" | "recovery"> = ["signup", "email", "recovery"]

          for (const t of typesToTry) {
            if (t === type) continue
            const result = await supabase.auth.verifyOtp({ token_hash, type: t })
            if (!result.error && result.data?.user) {
              console.log("[v0] AuthCallbackPage: verifyOtp success with type:", t)
              await ensurePiUserRecord(supabase, result.data.user)
              setStatus("success")
              setMessage("Xác thực email thành công!")
              setTimeout(() => {
                router.push("/auth/verify-result?status=success&message=verified")
              }, 1000)
              return
            }
          }

          console.error("[v0] AuthCallbackPage: verifyOtp error:", error)
          setStatus("error")
          setMessage("Link xác thực không hợp lệ hoặc đã hết hạn")
          setTimeout(() => {
            router.push("/auth/verify-result?status=error&message=invalid_token")
          }, 1500)
          return
        }

        if (data?.user) {
          console.log("[v0] AuthCallbackPage: verifyOtp success! User:", data.user.email)
          await ensurePiUserRecord(supabase, data.user)
          setStatus("success")
          setMessage("Xác thực email thành công!")
          setTimeout(() => {
            router.push("/auth/verify-result?status=success&message=verified")
          }, 1000)
          return
        }
      }

      // Check existing session
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData?.session?.user) {
        console.log("[v0] AuthCallbackPage: Found existing session:", sessionData.session.user.email)
        setStatus("success")
        setMessage("Bạn đã đăng nhập!")
        setTimeout(() => {
          router.push("/auth/verify-result?status=success&message=already_confirmed")
        }, 1000)
        return
      }

      // No valid auth data found
      console.log("[v0] AuthCallbackPage: No valid auth data found")
      setStatus("error")
      setMessage("Link xác thực không hợp lệ")
      setTimeout(() => {
        router.push("/auth/verify-result?status=error&message=invalid_link")
      }, 2000)
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        {status === "loading" && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Đang xác thực...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-600 font-medium">{message}</p>
            <p className="text-sm text-muted-foreground mt-2">Đang chuyển hướng...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-600 font-medium">{message}</p>
            <p className="text-sm text-muted-foreground mt-2">Đang chuyển hướng...</p>
          </>
        )}
      </div>
    </div>
  )
}

// Helper function to ensure pi_user record exists
async function ensurePiUserRecord(supabase: any, user: any) {
  console.log("[v0] ensurePiUserRecord (callback): Checking user", user.id)

  try {
    const metadata = user.user_metadata || {}

    // Check if record exists
    const { data: existingUser } = await supabase.from("pi_users").select("id").eq("id", user.id).maybeSingle()

    if (existingUser) {
      console.log("[v0] ensurePiUserRecord: Record exists, updating verification_status")
      await supabase.from("pi_users").update({ verification_status: "verified" }).eq("id", user.id)
      return
    }

    // Create new record
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

    const { error } = await supabase.from("pi_users").upsert(newUserData, { onConflict: "id" })

    if (error) {
      console.error("[v0] ensurePiUserRecord: Error:", error)
    } else {
      console.log("[v0] ensurePiUserRecord: Created successfully")
      // Create wallet
      await supabase.from("pitd_wallets").upsert({ user_id: user.id, balance: 0 }, { onConflict: "user_id" })
    }
  } catch (err) {
    console.error("[v0] ensurePiUserRecord: Exception:", err)
  }
}
