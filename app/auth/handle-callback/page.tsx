"use client"

import { useEffect, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

export default function HandleCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const handleAuth = async () => {
      const supabase = getSupabaseBrowserClient()

      console.log("[v0] HandleCallback: Starting...")
      console.log("[v0] HandleCallback: Current URL:", window.location.href)
      console.log("[v0] HandleCallback: Hash:", window.location.hash)
      console.log("[v0] HandleCallback: Search:", window.location.search)

      // Check hash fragment first (implicit flow)
      if (window.location.hash) {
        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)

        const accessToken = params.get("access_token")
        const refreshToken = params.get("refresh_token")
        const error = params.get("error")
        const errorDescription = params.get("error_description")

        console.log("[v0] HandleCallback: Hash params:", {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          error,
        })

        if (error) {
          console.error("[v0] HandleCallback: Error in hash:", error)
          window.location.href = `/auth/verify-result?status=error&message=${encodeURIComponent(errorDescription || error)}`
          return
        }

        if (accessToken && refreshToken) {
          try {
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })

            if (sessionError) {
              console.error("[v0] HandleCallback: setSession error:", sessionError)
              window.location.href = `/auth/verify-result?status=error&message=session_error`
              return
            }

            console.log("[v0] HandleCallback: Session set for:", data.user?.email)

            // Create pi_users record if needed
            if (data.user) {
              const metadata = data.user.user_metadata || {}
              const { data: existingUser } = await supabase
                .from("pi_users")
                .select("id")
                .eq("id", data.user.id)
                .maybeSingle()

              if (!existingUser) {
                await supabase.from("pi_users").upsert(
                  {
                    id: data.user.id,
                    pi_uid: `EMAIL-${data.user.id}`,
                    pi_username:
                      metadata.username || data.user.email?.split("@")[0] || `user_${data.user.id.substring(0, 8)}`,
                    email: data.user.email,
                    full_name: metadata.full_name || "",
                    phone_number: metadata.phone_number || "",
                    address: metadata.address || "",
                    user_role: "redeemer",
                    user_type: "email",
                    verification_status: "verified",
                  },
                  { onConflict: "id" },
                )

                await supabase
                  .from("pitd_wallets")
                  .upsert({ user_id: data.user.id, balance: 0 }, { onConflict: "user_id" })
              } else {
                await supabase.from("pi_users").update({ verification_status: "verified" }).eq("id", data.user.id)
              }
            }

            window.location.href = "/auth/verify-result?status=success&message=verified"
            return
          } catch (e) {
            console.error("[v0] HandleCallback: Error:", e)
            window.location.href = `/auth/verify-result?status=error&message=unexpected_error`
            return
          }
        }
      }

      // Check URL params (PKCE flow)
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get("code")
      const error = urlParams.get("error")

      if (error) {
        window.location.href = `/auth/verify-result?status=error&message=${encodeURIComponent(error)}`
        return
      }

      if (code) {
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

          if (exchangeError) {
            console.error("[v0] HandleCallback: Exchange error:", exchangeError)
            window.location.href = `/auth/verify-result?status=error&message=exchange_error`
            return
          }

          console.log("[v0] HandleCallback: Code exchanged for:", data.user?.email)
          window.location.href = "/auth/verify-result?status=success&message=verified"
          return
        } catch (e) {
          console.error("[v0] HandleCallback: Code exchange error:", e)
          window.location.href = `/auth/verify-result?status=error&message=unexpected_error`
          return
        }
      }

      // Check existing session
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData?.session?.user) {
        console.log("[v0] HandleCallback: Existing session found")
        window.location.href = "/auth/verify-result?status=success&message=already_confirmed"
        return
      }

      // No auth data found
      console.log("[v0] HandleCallback: No auth data found")
      window.location.href = "/auth/verify-result?status=error&message=invalid_link"
    }

    handleAuth()
  }, [])

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
        <p className="text-gray-600">Đang xác thực email...</p>
      </div>
    </div>
  )
}
