"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Settings, HelpCircle, Info, Wallet, Shield, CheckCircle2, AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function ProfilePage() {
  const { t, language } = useLanguage()
  const { user, setupTwoFactor, enableTwoFactor } = useAuth()
  const [show2FADialog, setShow2FADialog] = useState(false)
  const [qrCode, setQrCode] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handle2FASetup = async () => {
    setLoading(true)
    setError("")
    try {
      const { qrCode } = await setupTwoFactor()
      setQrCode(qrCode)
      setShow2FADialog(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEnable2FA = async () => {
    setLoading(true)
    setError("")
    try {
      await enableTwoFactor(totpCode)
      setShow2FADialog(false)
      setTotpCode("")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main className="container px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">{t("profileTitle")}</h1>

        {!user ? (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <span className="text-3xl">π</span>
              </div>
              <h3 className="text-xl font-semibold">{t("notLoggedIn")}</h3>
              <p className="text-muted-foreground">{t("notLoggedInDesc")}</p>
              <Button onClick={() => (window.location.href = "/login")} size="lg">
                {t("login")}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary-foreground">π</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {user.type === "pi" ? user.username : user.fullName || user.email}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {user.type === "pi" ? (
                        <>
                          {t("piWallet")}{" "}
                          {user.isAdmin && (
                            <span className="ml-2 text-xs bg-purple-500 text-white px-2 py-0.5 rounded">
                              ROOT ADMIN
                            </span>
                          )}
                        </>
                      ) : (
                        t("pitdWallet")
                      )}
                    </p>
                  </div>
                </div>

                {user.type === "pi" ? (
                  <div className="p-4 rounded-lg bg-secondary border-2 border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">{t("piWallet")}</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {language === "vi"
                          ? "Ví Pi của bạn chỉ kết nối qua Pi SDK khi thanh toán."
                          : "Your Pi wallet connects via Pi SDK only during payment."}
                      </p>
                      <p className="text-xs text-muted-foreground/80">
                        {language === "vi"
                          ? "Số dư Pi không hiển thị ở đây. Khi bạn trao đổi hàng hóa/dịch vụ, ứng dụng sẽ kết nối đến ví Pi của bạn để thanh toán."
                          : "Pi balance is not shown here. When you exchange goods/services, the app will connect to your Pi wallet for payment."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-secondary">
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        <span className="text-sm text-muted-foreground">{t("pitdWallet")}</span>
                      </div>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-2xl font-bold">{user.pitdWallet.balance.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground">PITD</span>
                      </div>
                      <p className="text-xs text-muted-foreground break-all">{user.pitdWallet.address}</p>
                      <p className="text-xs text-muted-foreground/70 mt-2">
                        {language === "vi"
                          ? "PITD là token do Pitodo quản lý cho tài khoản email."
                          : "PITD is a token managed by Pitodo for email accounts."}
                      </p>
                    </div>

                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">{t("twoFactorRequired")}</p>
                            <p className="text-xs text-muted-foreground">
                              {user.twoFactorEnabled ? t("twoFactorEnabled") : t("enable2FA")}
                            </p>
                          </div>
                        </div>
                        {user.twoFactorEnabled ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Button size="sm" onClick={handle2FASetup} disabled={loading}>
                            {t("enable")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <button className="w-full flex items-center gap-3 p-4 hover:bg-accent transition-colors border-b border-border">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{t("settings")}</span>
                </button>
                <button className="w-full flex items-center gap-3 p-4 hover:bg-accent transition-colors border-b border-border">
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{t("help")}</span>
                </button>
                <button className="w-full flex items-center gap-3 p-4 hover:bg-accent transition-colors">
                  <Info className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{t("about")}</span>
                </button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("enable2FA")}</DialogTitle>
            <DialogDescription>{t("twoFactorDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {qrCode && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`}
                  alt="QR Code"
                  className="h-48 w-48"
                />
              </div>
            )}
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
            <Button onClick={handleEnable2FA} disabled={loading || !totpCode} className="w-full">
              {loading ? "..." : t("enable")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  )
}
