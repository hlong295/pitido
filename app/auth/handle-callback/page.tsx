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

            // IMPORTANT (PITODO): PITD is an internal asset.
            // Do NOT create/modify PITD (wallet/transactions) directly from the client.
            // Always go through server API.
            if (data.user) {
              try {
                await fetch("/api/auth/ensure-user", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: data.user.id,
                    email: data.user.email,
                    metadata: { ...(data.user.user_metadata || {}), email_confirmed_at: data.user.email_confirmed_at },
                  }),
                })
              } catch (e) {
                console.warn("[v0] HandleCallback: ensure-user failed (ignored)", e)
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

          // Best-effort: ensure pi_users/users master + PITD wallet is created server-side
          if (data.user) {
            try {
              await fetch("/api/auth/ensure-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: data.user.id,
                  email: data.user.email,
                  metadata: { ...(data.user.user_metadata || {}), email_confirmed_at: data.user.email_confirmed_at },
                }),
              })
            } catch (e) {
              console.warn("[v0] HandleCallback: ensure-user failed (ignored)", e)
            }
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
