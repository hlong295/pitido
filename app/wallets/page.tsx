"use client"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, Copy, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PLATFORM_WALLETS } from "@/lib/constants"
import { useEffect, useMemo, useState } from "react"

type PlatformWallets = typeof PLATFORM_WALLETS & {
  service_fee_percentage?: number
  tax_percentage?: number
}

export default function WalletsPage() {
  const { t } = useLanguage()
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null)
  const [wallets, setWallets] = useState<PlatformWallets>(PLATFORM_WALLETS as any)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/wallets/public", { cache: "no-store" })
        const data = await res.json()
        if (res.ok && data?.wallets) setWallets(data.wallets)
      } catch (e) {
        // Fallback to constants if API fails
        console.warn("[wallets] failed to load public wallets, using fallback constants")
      }
    })()
  }, [])

  const walletList = useMemo(
    () => [
      {
        id: "pi_service_fee",
        title: `${t("serviceFeeWallet")} - Pi`,
        address: wallets.pi.serviceFeeWallet,
        currency: "π",
      },
      {
        id: "pi_tax",
        title: `${t("taxWallet")} - Pi`,
        address: wallets.pi.taxWallet,
        currency: "π",
      },
      {
        id: "pitd_service_fee",
        title: `${t("serviceFeeWallet")} - PITD`,
        address: wallets.pitd.serviceFeeWallet,
        currency: "PITD",
      },
      {
        id: "pitd_tax",
        title: `${t("taxWallet")} - PITD`,
        address: wallets.pitd.taxWallet,
        currency: "PITD",
      },
    ],
    [t, wallets],
  )

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedWallet(id)
      setTimeout(() => setCopiedWallet(null), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title={t("publicWallets")} showBack />
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">{t("publicWallets")}</h1>
            <p className="text-muted-foreground text-sm">{t("platformWallets")}</p>
          </div>

          <div className="space-y-4">
            {walletList.map((wallet) => (
              <Card key={wallet.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Wallet className="h-5 w-5" />
                    {wallet.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">{t("walletAddress")}:</p>
                      <div className="flex items-start gap-2">
                        <p className="font-mono text-sm bg-muted px-3 py-2 rounded flex-1 break-all">{wallet.address}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(wallet.address, wallet.id)}
                          className="flex-shrink-0"
                        >
                          {copiedWallet === wallet.id ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Currency:</span>
                      <span className="font-medium">{wallet.currency}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Minh bạch ví</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Tất cả ví đều công khai để đảm bảo minh bạch.</p>
                <p>Mỗi giao dịch được tách thành 3 phần: Nhà cung cấp nhận, Phí dịch vụ, Thuế.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
