"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

function ConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Redirect to callback with same params
    const token_hash = searchParams.get("token_hash")
    const type = searchParams.get("type") || "signup"

    if (token_hash) {
      router.replace(`/auth/callback?token_hash=${token_hash}&type=${type}`)
    } else {
      router.replace("/auth/verify-result?status=error&message=invalid_link")
    }
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Đang xử lý...</p>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  )
}
