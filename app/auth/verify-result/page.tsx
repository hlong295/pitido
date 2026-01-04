"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import Link from "next/link"

const messages: Record<string, { title: string; description: string }> = {
  verified: {
    title: "Xác thực thành công!",
    description: "Email của bạn đã được xác thực. Bạn có thể đăng nhập ngay bây giờ.",
  },
  already_confirmed: {
    title: "Email đã xác thực",
    description: "Email này đã được xác thực trước đó. Bạn có thể đăng nhập.",
  },
  link_expired: {
    title: "Link đã hết hạn",
    description: "Link xác thực đã hết hạn. Vui lòng đăng ký lại hoặc yêu cầu gửi lại email xác thực.",
  },
  invalid_token: {
    title: "Link không hợp lệ",
    description: "Link xác thực không hợp lệ hoặc đã được sử dụng. Vui lòng kiểm tra lại email hoặc đăng ký mới.",
  },
  invalid_link: {
    title: "Link không hợp lệ",
    description: "Link xác thực không đúng định dạng. Vui lòng kiểm tra lại email.",
  },
  verification_failed: {
    title: "Xác thực thất bại",
    description: "Không thể xác thực email. Vui lòng thử lại hoặc đăng ký mới.",
  },
  unexpected_error: {
    title: "Lỗi hệ thống",
    description: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
  },
  otp_expired: {
    title: "Mã xác thực hết hạn",
    description: "Mã xác thực đã hết hạn. Vui lòng yêu cầu gửi lại email xác thực.",
  },
  email_not_confirmed: {
    title: "Email chưa xác thực",
    description: "Email chưa được xác thực. Vui lòng kiểm tra hộp thư và click vào link xác thực.",
  },
}

function VerifyResultContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get("status") || "error"
  const messageKey = searchParams.get("message") || "unexpected_error"

  const isSuccess = status === "success"

  const content = messages[messageKey] || {
    title: isSuccess ? "Xác thực thành công!" : "Xác thực thất bại",
    description: messageKey || "Đã xảy ra lỗi không xác định.",
  }

  console.log("[v0] VerifyResultPage:", { status, messageKey, isSuccess })

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-gradient-to-br from-pink-50 to-purple-50">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="text-center pb-2">
          <div
            className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full ${
              isSuccess ? "bg-green-100" : "bg-red-100"
            }`}
          >
            {isSuccess ? (
              <CheckCircle className="h-10 w-10 text-green-600" />
            ) : (
              <XCircle className="h-10 w-10 text-red-600" />
            )}
          </div>
          <CardTitle className={`text-2xl ${isSuccess ? "text-green-600" : "text-red-600"}`}>{content.title}</CardTitle>
          <CardDescription className={`text-base mt-2 ${isSuccess ? "text-green-700" : "text-red-500"}`}>
            {content.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 pt-4">
          {isSuccess ? (
            <>
              <Button
                asChild
                className="w-full h-12 text-base bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
              >
                <Link href="/login">Đăng nhập ngay</Link>
              </Button>
              <Button asChild variant="outline" className="w-full h-12 text-base bg-transparent">
                <Link href="/">Về trang chủ</Link>
              </Button>
            </>
          ) : (
            <>
              <Button
                asChild
                className="w-full h-12 text-base bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
              >
                <Link href="/register">Đăng ký lại</Link>
              </Button>
              <Button asChild variant="outline" className="w-full h-12 text-base bg-transparent">
                <Link href="/login">Đăng nhập</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full h-12 text-base">
                <Link href="/">Về trang chủ</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function VerifyResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center p-4 bg-gradient-to-br from-pink-50 to-purple-50">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
            <p className="text-gray-600">Đang tải...</p>
          </div>
        </div>
      }
    >
      <VerifyResultContent />
    </Suspense>
  )
}
