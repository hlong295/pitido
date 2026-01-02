"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { ensurePiSdkReady } from "@/lib/pi-sdk"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react"

const PI_USER_STORAGE_KEY = "pitodo_pi_user"

export default function LoginPage() {
  const { t } = useLanguage()
  const { loginWithPi, loginWithEmail, user } = useAuth()
  const router = useRouter()

  const [emailOrUsername, setEmailOrUsername] = useState("")
  const [password, setPassword] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [needsTOTP, setNeedsTOTP] = useState(false)
  const [fullscreenLoading, setFullscreenLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState("")
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [waitingForUserLoad, setWaitingForUserLoad] = useState(false)

  const [piDiagnostic, setPiDiagnostic] = useState({
    hasPi: false,
    isChecking: true,
    sdkVersion: "",
    readyError: "",
  })

  useEffect(() => {
    if (user && !loading) {
      console.log("[v0] LoginPage: User detected in context, redirecting to account")
      router.push("/account")
    }
  }, [user, loading, router])

  useEffect(() => {
    const run = async () => {
      const ready = await ensurePiSdkReady()
      const Pi = typeof window !== "undefined" ? (window as any).Pi : null

      setPiDiagnostic({
        hasPi: !!ready.ok,
        isChecking: false,
        sdkVersion: Pi ? "2.0" : "",
        readyError: ready.error || "",
      })
    }
    run()
  }, [])

  const handlePiLogin = async () => {
    console.log("[v0] LoginPage.handlePiLogin: === BUTTON CLICKED ===")

    if (!piDiagnostic.hasPi) {
      console.log("[v0] LoginPage.handlePiLogin: No Pi SDK - showing error")
      setError("Vui lòng mở app trong Pi Browser để đăng nhập với Pi Network")
      return
    }

    setFullscreenLoading(true)
    setLoadingMessage("Đang kết nối Pi Network...")
    setLoading(true)
    setError("")

    try {
      setLoadingMessage("Đang xác thực với Pi Network...")
      console.log("[v0] LoginPage.handlePiLogin: Calling loginWithPi()...")

      const result = await loginWithPi()

      console.log("[v0] LoginPage.handlePiLogin: loginWithPi returned:", result)

      if (!result.success) {
        console.error("[v0] LoginPage.handlePiLogin: Login did not return success")
        throw new Error("Login failed")
      }

      console.log("[v0] LoginPage.handlePiLogin: Login successful!")
      setLoadingMessage("Đăng nhập thành công! Đang chuyển hướng...")
      setLoginSuccess(true)

      setLoading(false)
      setFullscreenLoading(false)

      setTimeout(() => {
        console.log("[v0] LoginPage.handlePiLogin: Safety timeout - checking user state")
        router.push("/account")
      }, 3000)
    } catch (err: any) {
      console.error("[v0] LoginPage.handlePiLogin: ERROR:", err)
      const errorMessage = err.message || "Unknown error"

      if (
        errorMessage === "piSdkNotInjected" ||
        errorMessage === "openInPiBrowser" ||
        errorMessage === "PI_SDK_MISSING"
      ) {
        setError("Vui lòng mở app trong Pi Browser")
      } else if (errorMessage === "PI_AUTH_TIMEOUT") {
        setError("Kết nối Pi Network bị timeout. Vui lòng thử lại.")
      } else if (errorMessage.includes("Failed to authenticate")) {
        setError("Xác thực thất bại. Vui lòng thử lại.")
      } else if (errorMessage.includes("pi_users")) {
        setError("Lỗi database: Table pi_users chưa được tạo. Vui lòng chạy script 108.")
      } else {
        setError(`Đăng nhập thất bại: ${errorMessage}`)
      }
      setLoading(false)
      setFullscreenLoading(false)
      setLoginSuccess(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setFullscreenLoading(true)
    setLoadingMessage("Đang đăng nhập...")
    setLoading(true)
    setError("")

    try {
      await loginWithEmail(emailOrUsername, password, totpCode || undefined)

      console.log("[v0] LoginPage: loginWithEmail completed successfully")
      setLoadingMessage("Đăng nhập thành công!")
      setLoginSuccess(true)

      setTimeout(() => {
        router.push("/account")
      }, 300)
    } catch (err: any) {
      console.error("[v0] Email login error:", err)

      if (err.message.includes("2FA code required")) {
        setNeedsTOTP(true)
        setError(err.message)
      } else {
        setError(err.message || "Đăng nhập thất bại")
      }
      setLoading(false)
      setFullscreenLoading(false)
    }
  }

  if (fullscreenLoading || waitingForUserLoad) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 flex flex-col items-center justify-center z-50">
        <div className="bg-white/80 backdrop-blur rounded-2xl p-8 shadow-xl flex flex-col items-center gap-4">
          {loginSuccess ? (
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          ) : (
            <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
          )}
          <p className="text-purple-700 font-medium text-lg">{loadingMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 py-8 max-w-md mx-auto">
        <Tabs defaultValue="pi" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/40 p-1 rounded-lg">
            <TabsTrigger
              value="pi"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/50 data-[state=inactive]:opacity-60 data-[state=inactive]:font-normal transition-all duration-200"
            >
              {t("piLogin")}
            </TabsTrigger>
            <TabsTrigger
              value="email"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/50 data-[state=inactive]:opacity-60 data-[state=inactive]:font-normal transition-all duration-200"
            >
              {t("emailLogin")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pi">
            <Card>
              <CardHeader>
                <CardTitle>{t("piLogin")}</CardTitle>
                <CardDescription>{t("step1Desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Pi SDK:</span>
                    {piDiagnostic.isChecking ? (
                      <span className="text-sm text-muted-foreground">Đang kiểm tra...</span>
                    ) : piDiagnostic.hasPi ? (
                      <span className="text-sm text-green-600 font-semibold flex items-center gap-1.5">Connected</span>
                    ) : (
                      <span className="text-sm text-amber-600 font-semibold flex items-center gap-1.5">Missing</span>
                    )}
                  </div>
                </div>

                {!piDiagnostic.hasPi && !piDiagnostic.isChecking && (
                  <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-sm space-y-2 text-amber-900 dark:text-amber-100">
                      <p className="font-semibold">Cách kết nối với Pi Network:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>
                          Mở <strong>Pi Browser</strong> (app màu tím trong Pi Network)
                        </li>
                        <li>
                          Vào menu <strong>Apps</strong> hoặc <strong>Develop</strong>
                        </li>
                        <li>
                          Tìm và mở <strong>PITODO</strong>
                        </li>
                        <li>Nút đăng nhập Pi sẽ hoạt động</li>
                      </ol>
                      <p className="text-xs mt-2 text-amber-700 dark:text-amber-300">
                        App này chỉ hoạt động trong Pi Browser, không hoạt động trên trình duyệt thông thường.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handlePiLogin}
                  disabled={loading || !piDiagnostic.hasPi || piDiagnostic.isChecking}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <span className="text-xl mr-2">π</span>
                      {piDiagnostic.isChecking ? "Đang kiểm tra..." : t("piLogin")}
                    </>
                  )}
                </Button>

                <p className="text-sm text-muted-foreground text-center">{t("step2Desc")}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email">
            <Card>
              <CardHeader>
                <CardTitle>{t("emailLogin")}</CardTitle>
                <CardDescription>{t("notLoggedInDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="emailOrUsername">Email hoặc Username</Label>
                    <Input
                      id="emailOrUsername"
                      type="text"
                      value={emailOrUsername}
                      onChange={(e) => setEmailOrUsername(e.target.value)}
                      placeholder="email@example.com hoặc username"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">{t("password")}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  {needsTOTP && (
                    <div className="space-y-2">
                      <Label htmlFor="totp">{t("verificationCode")}</Label>
                      <Input
                        id="totp"
                        type="text"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        disabled={loading}
                      />
                    </div>
                  )}

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang đăng nhập...
                      </>
                    ) : (
                      t("login")
                    )}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("dontHaveAccount")}{" "}
                    <Button variant="link" className="p-0 h-auto" onClick={() => router.push("/register")}>
                      {t("register")}
                    </Button>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
