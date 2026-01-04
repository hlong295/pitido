"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Mail } from "lucide-react"

export default function RegisterPage() {
  const { t } = useLanguage()
  const { registerWithEmail } = useAuth()
  const router = useRouter()

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    phoneNumber: "",
    address: "",
  })

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [successState, setSuccessState] = useState<{
    success: boolean
    requiresEmailConfirmation: boolean
    message: string
  } | null>(null)

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Validation
    if (!formData.username.trim()) {
      setError(t("usernameRequired") || "Vui lòng nhập username")
      setLoading(false)
      return
    }

    if (formData.username.length < 3) {
      setError(t("usernameTooShort") || "Username phải có ít nhất 3 ký tự")
      setLoading(false)
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      setError(t("usernameInvalid") || "Username chỉ được chứa chữ cái, số và dấu gạch dưới")
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t("passwordsDoNotMatch") || "Mật khẩu không khớp")
      setLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError(t("passwordTooShort") || "Mật khẩu phải có ít nhất 8 ký tự")
      setLoading(false)
      return
    }

    try {
      const result = await registerWithEmail({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        address: formData.address,
      })

      setSuccessState({
        success: true,
        requiresEmailConfirmation: result?.requiresEmailConfirmation ?? true,
        message: result?.message || "Đăng ký thành công!",
      })
    } catch (err: any) {
      console.error("[v0] Registration error:", err)
      setError(err.message || "Đăng ký thất bại. Vui lòng thử lại.")
    } finally {
      setLoading(false)
    }
  }

  if (successState?.success) {
    if (successState.requiresEmailConfirmation) {
      // Email confirmation required - show check inbox message
      return (
        <div className="min-h-screen bg-background">
          <Header />
          <main className="container px-4 py-8 max-w-md mx-auto">
            <Card>
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                    <Mail className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                <CardTitle className="text-center">Email xác thực đã được gửi</CardTitle>
                <CardDescription className="text-center">
                  Vui lòng kiểm tra hộp thư <strong>{formData.email}</strong> và click vào link xác thực để hoàn tất
                  đăng ký.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Nếu không thấy email, hãy kiểm tra thư mục Spam hoặc Junk.
                </p>
                <Button onClick={() => router.push("/login")} className="w-full">
                  {t("login")}
                </Button>
                <Button variant="outline" onClick={() => router.push("/")} className="w-full">
                  Về trang chủ
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      )
    } else {
      // No email confirmation required - show success and redirect to login
      return (
        <div className="min-h-screen bg-background">
          <Header />
          <main className="container px-4 py-8 max-w-md mx-auto">
            <Card>
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-center">Đăng ký thành công!</CardTitle>
                <CardDescription className="text-center">
                  Tài khoản của bạn đã được tạo. Bạn có thể đăng nhập ngay bây giờ.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => router.push("/login")} className="w-full">
                  {t("login")}
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      )
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 py-8 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{t("register")}</CardTitle>
            <CardDescription>{t("createAccount")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">
                  Username <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange("username")}
                  placeholder="username123"
                  required
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Chỉ chứa chữ cái, số và dấu gạch dưới. Tối thiểu 3 ký tự.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange("email")}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">{t("fullName")}</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleChange("fullName")}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">{t("phoneNumber")}</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={handleChange("phoneNumber")}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{t("address")}</Label>
                <Input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={handleChange("address")}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange("password")}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange("confirmPassword")}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "..." : t("createAccount")}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                {t("alreadyHaveAccount")}{" "}
                <Button variant="link" className="p-0 h-auto" onClick={() => router.push("/login")}>
                  {t("login")}
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
