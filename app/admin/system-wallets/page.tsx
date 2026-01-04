"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Wallet, History, FileText, Loader2, ChevronLeft, Copy, CheckCircle } from "lucide-react"

type AppSettings = {
  pi_service_fee_wallet?: string | null
  pi_tax_wallet?: string | null
  service_fee_percentage?: number | null
  tax_percentage?: number | null
  pitd_service_fee_receiver_user_id?: string | null
  pitd_tax_receiver_user_id?: string | null
}

type PitdWallet = {
  id: string
  user_id: string
  balance: number
  address: string | null
}

type Tx = {
  id: string
  transaction_type: string
  amount: number
  balance_after: number
  description: string | null
  created_at: string
}

export default function AdminSystemWalletsPage() {
  const router = useRouter()
  const { isAdmin } = useAuth()

  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<AppSettings | null>(null)

  const [pitdFeeWallet, setPitdFeeWallet] = useState<PitdWallet | null>(null)
  const [pitdTaxWallet, setPitdTaxWallet] = useState<PitdWallet | null>(null)

  const [activeWallet, setActiveWallet] = useState<{ title: string; walletId: string } | null>(null)
  const [txs, setTxs] = useState<Tx[]>([])
  const [loadingTx, setLoadingTx] = useState(false)

  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin()) {
      router.push("/")
      return
    }
    load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      const supabase = createBrowserClient()

      // Ensure public wallets exist (server will auto-create system PITD wallets + addresses)
      await fetch("/api/wallets/public", { cache: "no-store" }).catch(() => null)

      const { data: settingsData } = await supabase
        .from("app_settings")
        .select(
          "pi_service_fee_wallet, pi_tax_wallet, service_fee_percentage, tax_percentage, pitd_service_fee_receiver_user_id, pitd_tax_receiver_user_id",
        )
        .limit(1)
        .maybeSingle()
      setSettings(settingsData || null)

      // System users (PITD) - fallback
      const { data: systemUsers } = await supabase
        .from("pi_users")
        .select("id, pi_username")
        .in("pi_username", ["PITODO-SURCHARGE-PITD", "PITODO-TAX-PITD"])

      const surchargeUser = systemUsers?.find((u) => u.pi_username === "PITODO-SURCHARGE-PITD")
      const taxUser = systemUsers?.find((u) => u.pi_username === "PITODO-TAX-PITD")

      const feeUserId = (settingsData?.pitd_service_fee_receiver_user_id as string) || surchargeUser?.id || null
      const taxUserId = (settingsData?.pitd_tax_receiver_user_id as string) || taxUser?.id || null

      if (feeUserId) {
        const { data: w } = await supabase.from("pitd_wallets").select("id, user_id, balance, address").eq("user_id", feeUserId).maybeSingle()
        if (w) setPitdFeeWallet(w as any)
      }

      if (taxUserId) {
        const { data: w } = await supabase.from("pitd_wallets").select("id, user_id, balance, address").eq("user_id", taxUserId).maybeSingle()
        if (w) setPitdTaxWallet(w as any)
      }
    } catch (e) {
      console.error("[admin/system-wallets] load error", e)
      alert("Không thể tải dữ liệu ví hệ thống")
    } finally {
      setLoading(false)
    }
  }

  async function openHistory(title: string, walletId: string) {
    try {
      setActiveWallet({ title, walletId })
      setLoadingTx(true)
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from("pitd_transactions")
        .select("id, transaction_type, amount, balance_after, description, created_at")
        .eq("wallet_id", walletId)
        .order("created_at", { ascending: false })
        .limit(200)

      if (error) throw error
      setTxs((data || []) as any)
    } catch (e) {
      console.error(e)
      alert("Không thể tải lịch sử giao dịch")
    } finally {
      setLoadingTx(false)
    }
  }

  function exportCsv() {
    if (!activeWallet) return
    const header = ["created_at", "transaction_type", "amount", "balance_after", "description"]
    const rows = txs.map((t) => [t.created_at, t.transaction_type, String(t.amount), String(t.balance_after), (t.description || "").replaceAll("\n", " ")])
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pitodo_${activeWallet.title.replaceAll(" ", "_")}_statement.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    } catch (e) {
      console.error(e)
    }
  }

  const piCards = useMemo(() => {
    return [
      { id: "pi_fee", title: "Phí dịch vụ - Pi", address: settings?.pi_service_fee_wallet || "" },
      { id: "pi_tax", title: "Thuế - Pi", address: settings?.pi_tax_wallet || "" },
    ]
  }, [settings])

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Ví hệ thống" showBack />

      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Thống kê ví hệ thống</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="h-5 w-5 text-purple-600" />
                <h2 className="font-semibold">Ví hệ thống - Pi (Mainnet)</h2>
              </div>

              <div className="space-y-4">
                {piCards.map((w) => (
                  <div key={w.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{w.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">Địa chỉ ví:</div>
                        <div className="font-mono text-sm bg-muted px-3 py-2 rounded mt-2 break-all">{w.address}</div>
                      </div>
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(w.address, w.id)}>
                        {copied === w.id ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-3">
                      * Số dư Pi hiển thị theo chain (không truy vấn trực tiếp trong app).
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="h-5 w-5 text-orange-600" />
                <h2 className="font-semibold">Ví hệ thống - PITD</h2>
                <div className="ml-auto">
                  <Button variant="outline" size="sm" onClick={() => router.push("/admin/system-wallet-recipients")}> 
                    Chọn tài khoản nhận
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="font-semibold">Phí dịch vụ - PITD</div>
                  <div className="text-sm text-muted-foreground mt-1">Địa chỉ ví:</div>
                  <div className="flex items-start gap-2 mt-2">
                    <div className="font-mono text-sm bg-muted px-3 py-2 rounded flex-1 break-all">
                      {pitdFeeWallet?.address || ""}
                    </div>
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(pitdFeeWallet?.address || "", "pitd_fee")}>
                      {copied === "pitd_fee" ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex justify-between mt-3 text-sm">
                    <span className="text-muted-foreground">Số dư:</span>
                    <span className="font-bold text-orange-600">{Number(pitdFeeWallet?.balance || 0).toLocaleString()} PITD</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" className="flex-1" onClick={() => pitdFeeWallet && openHistory("service_fee_pitd", pitdFeeWallet.id)}>
                      <History className="h-4 w-4 mr-2" />
                      Lịch sử giao dịch
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => pitdFeeWallet && openHistory("service_fee_pitd", pitdFeeWallet.id).then(exportCsv)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Sao kê
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="font-semibold">Thuế - PITD</div>
                  <div className="text-sm text-muted-foreground mt-1">Địa chỉ ví:</div>
                  <div className="flex items-start gap-2 mt-2">
                    <div className="font-mono text-sm bg-muted px-3 py-2 rounded flex-1 break-all">
                      {pitdTaxWallet?.address || ""}
                    </div>
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(pitdTaxWallet?.address || "", "pitd_tax")}>
                      {copied === "pitd_tax" ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex justify-between mt-3 text-sm">
                    <span className="text-muted-foreground">Số dư:</span>
                    <span className="font-bold text-orange-600">{Number(pitdTaxWallet?.balance || 0).toLocaleString()} PITD</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" className="flex-1" onClick={() => pitdTaxWallet && openHistory("tax_pitd", pitdTaxWallet.id)}>
                      <History className="h-4 w-4 mr-2" />
                      Lịch sử giao dịch
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => pitdTaxWallet && openHistory("tax_pitd", pitdTaxWallet.id).then(exportCsv)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Sao kê
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  * PITD là ví nội bộ, lịch sử giao dịch dựa trên bảng <span className="font-mono">pitd_transactions</span>.
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Phí dịch vụ: <span className="font-semibold">{Number(settings?.service_fee_percentage || 0)}%</span></div>
                <div>Thuế: <span className="font-semibold">{Number(settings?.tax_percentage || 0)}%</span></div>
                <div className="text-xs">Mỗi giao dịch PITD được tách thành 3 phần: Nhà cung cấp nhận, Phí dịch vụ, Thuế.</div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* History modal */}
      {activeWallet && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex justify-between items-center">
              <div className="text-white font-semibold">Lịch sử giao dịch - {activeWallet.title}</div>
              <div className="flex gap-2">
                <Button variant="ghost" className="text-white hover:bg-white/20" onClick={exportCsv}>
                  <FileText className="h-4 w-4 mr-2" />
                  Sao kê
                </Button>
                <Button variant="ghost" className="text-white hover:bg-white/20" onClick={() => setActiveWallet(null)}>
                  Đóng
                </Button>
              </div>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {loadingTx ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                </div>
              ) : txs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">Chưa có giao dịch</div>
              ) : (
                <div className="space-y-3">
                  {txs.map((tx) => (
                    <div key={tx.id} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex justify-between items-start mb-1">
                        <Badge variant={tx.transaction_type.includes("credit") || tx.amount > 0 ? "default" : "destructive"}>
                          {tx.transaction_type}
                        </Badge>
                        <span className={`font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                          {tx.amount > 0 ? "+" : ""}{Number(tx.amount).toLocaleString()} PITD
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{tx.description || "Không có mô tả"}</p>
                      <div className="flex justify-between mt-2 text-xs text-gray-500">
                        <span>Số dư sau: {Number(tx.balance_after || 0).toLocaleString()} PITD</span>
                        <span>{new Date(tx.created_at).toLocaleString("vi-VN")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
