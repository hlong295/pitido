"use client"

import type React from "react"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ProviderApplyPage() {
  const { t } = useLanguage()
  const { user, applyAsProvider } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  const [formData, setFormData] = useState({
    businessName: "",
    description: "",
  })

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <Header />
        <main className="container px-4 py-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t("authRequiredDesc")}</AlertDescription>
          </Alert>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (user.type === "email" && !user.twoFactorEnabled) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <Header />
        <main className="container px-4 py-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t("twoFactorRequiredDesc")}</AlertDescription>
          </Alert>
          <Button onClick={() => router.push("/profile")} className="mt-4">
            {t("enable2FA")}
          </Button>
        </main>
        <BottomNav />
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      await applyAsProvider(formData.businessName, formData.description)
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || "Failed to submit application")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <Header />
        <main className="container px-4 py-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">{t("applicationSubmitted")}</h2>
              <p className="text-muted-foreground mb-6">{t("pendingApproval")}</p>
              <Button onClick={() => router.push("/")}>{t("navHome")}</Button>
            </CardContent>
          </Card>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main className="container px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("providerApplication")}</CardTitle>
            <CardDescription>{t("becomeProvider")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <Label htmlFor="businessName">{t("businessName")} *</Label>
                <Input
                  id="businessName"
                  required
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="description">{t("businessDescription")} *</Label>
                <Textarea
                  id="description"
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("language") === "vi"
                    ? "Đơn đăng ký của bạn sẽ được root admin (HLong295) xét duyệt trước khi bạn có thể đăng sản phẩm/dịch vụ."
                    : "Your application will be reviewed by root admin (HLong295) before you can post products/services."}
                </AlertDescription>
              </Alert>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "..." : t("submitApplication")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <BottomNav />
    </div>
  )
}
