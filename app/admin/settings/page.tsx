"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ChevronLeft, Settings, Wallet, History, FileText, Loader2, X, Copy } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type AppSettings = {
  service_fee_percentage: number
  tax_percentage: number
  pi_service_fee_wallet?: string | null
  pi_tax_wallet?: string | null
  pitd_service_fee_receiver_user_id?: string | null
  pitd_tax_receiver_user_id?: string | null
}

type SystemWallet = {
  userId: string
  username: string
  walletId: string | null
  balance: number
  address?: string
}

type Transaction = {
  id: string
  transaction_type: string
  amount: number
  balance_after: number
  description: string
  created_at: string
}

export default function AdminSettingsPage() {
  const router = useRouter()
  const { user, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [serviceFee, setServiceFee] = useState("")
  const [taxPercentage, setTaxPercentage] = useState("")
  const [piServiceFeeWallet, setPiServiceFeeWallet] = useState("")
  const [piTaxWallet, setPiTaxWallet] = useState("")

  // PITD system wallets (fee/tax)
  const [servicePitdAddress, setServicePitdAddress] = useState("")
  const [taxPitdAddress, setTaxPitdAddress] = useState("")
  const [systemWallets, setSystemWallets] = useState<SystemWallet[]>([])

  // PITD receiver selection (admin can choose which user/provider receives PITD fee/tax)
  const [users, setUsers] = useState<any[]>([])
  const [feeReceiverId, setFeeReceiverId] = useState<string>("")
  const [taxReceiverId, setTaxReceiverId] = useState<string>("")
  const [savingReceivers, setSavingReceivers] = useState(false)
  const [loadingReceivers, setLoadingReceivers] = useState(false)
  const [savingPitdWallets, setSavingPitdWallets] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  // Transaction history modal
  const [showHistory, setShowHistory] = useState(false)
  const [historyWallet, setHistoryWallet] = useState<SystemWallet | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    if (!isAdmin()) {
      router.push("/")
      return
    }
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const supabase = createBrowserClient()

      // Get app settings
      const { data: settingsData } = await supabase.from("app_settings").select("*").limit(1).single()

      const feeReceiver = (settingsData?.pitd_service_fee_receiver_user_id || "") as string
      const taxReceiver = (settingsData?.pitd_tax_receiver_user_id || "") as string

      if (settingsData) {
        setSettings(settingsData)
        setServiceFee(settingsData.service_fee_percentage?.toString() || "5")
        setTaxPercentage(settingsData.tax_percentage?.toString() || "10")
        setPiServiceFeeWallet(settingsData.pi_service_fee_wallet || "")
        setPiTaxWallet(settingsData.pi_tax_wallet || "")
        setFeeReceiverId(feeReceiver)
        setTaxReceiverId(taxReceiver)
      }

      const { data: systemUsers } = await supabase
        .from("pi_users")
        .select("id, pi_username")
        .in("pi_username", ["PITODO-SURCHARGE-PITD", "PITODO-TAX-PITD"])

      const sysUserIds = (systemUsers || []).map((u) => u.id)
      const allWalletUserIds = Array.from(new Set([...(sysUserIds || []), ...(feeReceiver ? [feeReceiver] : []), ...(taxReceiver ? [taxReceiver] : [])]))

      if (allWalletUserIds.length > 0) {
        const { data: walletsData } = await supabase
          .from("pitd_wallets")
          .select("id, user_id, balance, address")
          .in("user_id", allWalletUserIds)

        const walletMap = new Map(walletsData?.map((w: any) => [w.user_id, { id: w.id, balance: Number(w.balance || 0), address: w.address || "" }]) || [])

        setSystemWallets(
          (systemUsers || []).map((u) => ({
            userId: u.id,
            username: u.pi_username,
            walletId: walletMap.get(u.id)?.id || null,
            balance: walletMap.get(u.id)?.balance || 0,
            address: walletMap.get(u.id)?.address || "",
          })),
        )

        // Prefill PITD addresses based on effective receiver (if set) else system wallets
        const sysFeeUserId = (systemUsers || []).find((u) => u.pi_username === "PITODO-SURCHARGE-PITD")?.id
        const sysTaxUserId = (systemUsers || []).find((u) => u.pi_username === "PITODO-TAX-PITD")?.id

        const feeTargetId = feeReceiver || sysFeeUserId || ""
        const taxTargetId = taxReceiver || sysTaxUserId || ""

        if (feeTargetId) setServicePitdAddress(walletMap.get(feeTargetId)?.address || "")
        if (taxTargetId) setTaxPitdAddress(walletMap.get(taxTargetId)?.address || "")
      }
    

      // Load users for PITD receiver selection (admin only)
      try {
        setLoadingReceivers(true)
        const { data: usersData } = await supabase
          .from("pi_users")
          .select("id, pi_username, full_name, user_role, provider_approved, created_at")
          .order("created_at", { ascending: false })
          .limit(500)
        setUsers((usersData || []) as any[])
      } catch (e) {
        console.error("Error loading users for receiver selection:", e)
      } finally {
        setLoadingReceivers(false)
      }
} catch (error) {
      console.error("Error loading settings:", error)
    } finally {
      setLoading(false)
    }
  }

  

  async function handleSavePitdReceivers() {
    try {
      setSavingReceivers(true)
      const supabase = createBrowserClient()

      const { data: existing, error: existingErr } = await supabase
        .from("app_settings")
        .select("id")
        .limit(1)
        .maybeSingle()
      if (existingErr) throw existingErr

      const payload: any = {
        pitd_service_fee_receiver_user_id: feeReceiverId || null,
        pitd_tax_receiver_user_id: taxReceiverId || null,
        updated_at: new Date().toISOString(),
      }

      if (existing?.id) {
        const { error: upErr } = await supabase.from("app_settings").update(payload).eq("id", existing.id)
        if (upErr) throw upErr
      } else {
        const { error: insErr } = await supabase.from("app_settings").insert(payload)
        if (insErr) throw insErr
      }

      await fetch("/api/wallets/public", { cache: "no-store" }).catch(() => null)
      await loadData()
      alert("Đã cập nhật tài khoản nhận PITD (phí/thuế).")
    } catch (e) {
      console.error("Save PITD receivers error:", e)
      alert("Lỗi: Không thể cập nhật tài khoản nhận PITD. Vui lòng thử lại.")
    } finally {
      setSavingReceivers(false)
    }
  }

  function genPitdAddress(prefix: string) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    const totalLen = 24
    const need = Math.max(0, totalLen - prefix.length)
    let s = ""
    for (let i = 0; i < need; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
    return (prefix + s).slice(0, totalLen)
  }

  async function ensurePitdWallet(userId: string, defaultPrefix: string) {
    const supabase = createBrowserClient()
    const { data, error } = await supabase.from("pitd_wallets").select("id, user_id, balance, address").eq("user_id", userId).maybeSingle()
    if (error) throw error
    if (data?.id) return { id: data.id as string, address: (data.address || "") as string, balance: Number(data.balance || 0) }

    const address = genPitdAddress(defaultPrefix)
    const { data: inserted, error: insErr } = await supabase
      .from("pitd_wallets")
      .insert({ user_id: userId, balance: 0, locked_balance: 0, total_spent: 0, address })
      .select("id, address")
      .single()
    if (insErr) throw insErr
    return { id: inserted.id as string, address: (inserted.address || "") as string, balance: 0 }
  }

  async function handleSavePitdWalletConfig() {
    try {
      setSavingPitdWallets(true)
      const supabase = createBrowserClient()

      // Read system PITD users (fallback when receiver is not chosen)
      const { data: systemUsers } = await supabase
        .from("pi_users")
        .select("id, pi_username")
        .in("pi_username", ["PITODO-SURCHARGE-PITD", "PITODO-TAX-PITD"])

      const sysFeeUserId = (systemUsers || []).find((u: any) => u.pi_username === "PITODO-SURCHARGE-PITD")?.id || ""
      const sysTaxUserId = (systemUsers || []).find((u: any) => u.pi_username === "PITODO-TAX-PITD")?.id || ""

      const feeTargetId = feeReceiverId || sysFeeUserId
      const taxTargetId = taxReceiverId || sysTaxUserId

      if (!feeTargetId || !taxTargetId) {
        alert("Thiếu ví hệ thống PITD (PITODO-SURCHARGE-PITD / PITODO-TAX-PITD). Vui lòng kiểm tra bảng pi_users.")
        return
      }

      // Ensure wallets exist
      const feeWallet = await ensurePitdWallet(feeTargetId, "PITSER")
      const taxWallet = await ensurePitdWallet(taxTargetId, "PITTAX")

      // Update addresses if admin entered a value
      const nextFeeAddr = (servicePitdAddress || "").trim()
      const nextTaxAddr = (taxPitdAddress || "").trim()

      if (nextFeeAddr && nextFeeAddr !== feeWallet.address) {
        const { error: upErr } = await supabase.from("pitd_wallets").update({ address: nextFeeAddr }).eq("id", feeWallet.id)
        if (upErr) throw upErr
      }
      if (nextTaxAddr && nextTaxAddr !== taxWallet.address) {
        const { error: upErr } = await supabase.from("pitd_wallets").update({ address: nextTaxAddr }).eq("id", taxWallet.id)
        if (upErr) throw upErr
      }

      // Persist receiver selection in app_settings
      await handleSavePitdReceivers()
      await loadData()
      alert("Đã cập nhật ví nhận PITD (phí/thuế).")
    } catch (e) {
      console.error("Save PITD wallet config error:", e)
      alert("Lỗi: Không thể cập nhật ví nhận PITD. Vui lòng thử lại.")
    } finally {
      setSavingPitdWallets(false)
    }
  }

  function copyText(text: string) {
    try {
      if (!text) return
      navigator.clipboard?.writeText(text)
    } catch {}
  }
async function handleViewHistory(wallet: SystemWallet) {
    if (!wallet.walletId) {
      alert("Ví chưa có giao dịch nào")
      return
    }

    setHistoryWallet(wallet)
    setShowHistory(true)
    setLoadingHistory(true)

    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from("pitd_transactions")
        .select("*")
        .eq("wallet_id", wallet.walletId)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error
      setTransactions(data || [])
    } catch (error) {
      console.error("Error loading transactions:", error)
      alert("Không thể tải lịch sử giao dịch")
    } finally {
      setLoadingHistory(false)
    }
  }

  async function handleExportStatement(wallet: SystemWallet) {
    if (!wallet.walletId) {
      alert("Ví chưa có giao dịch nào")
      return
    }

    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from("pitd_transactions")
        .select("*")
        .eq("wallet_id", wallet.walletId)
        .order("created_at", { ascending: false })

      if (error) throw error
      if (!data || data.length === 0) {
        alert("Không có giao dịch nào để xuất")
        return
      }

      // Create CSV content
      const walletName = wallet.username === "PITODO-SURCHARGE-PITD" ? "Phi_Dich_Vu" : "Thue"
      const headers = ["STT", "Ngày giờ", "Loại giao dịch", "Số tiền", "Số dư sau", "Mô tả"]
      const rows = data.map((tx, index) => [
        index + 1,
        new Date(tx.created_at).toLocaleString("vi-VN"),
        tx.transaction_type,
        tx.amount,
        tx.balance_after,
        tx.description || "",
      ])

      const csvContent = [
        `Sao kê ví ${walletName}`,
        `Xuất ngày: ${new Date().toLocaleString("vi-VN")}`,
        `Số dư hiện tại: ${wallet.balance} PITD`,
        "",
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n")

      // Download file
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `saoke_${walletName}_${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error exporting statement:", error)
      alert("Không thể xuất sao kê")
    }
  }

  async function handleUpdateSettings() {
    if (!serviceFee || !taxPercentage) {
      alert("Vui lòng nhập đầy đủ thông tin")
      return
    }

    const feeNum = Number(serviceFee)
    const taxNum = Number(taxPercentage)

    if (isNaN(feeNum) || feeNum < 0 || feeNum > 100) {
      alert("Phí dịch vụ phải từ 0-100%")
      return
    }

    if (isNaN(taxNum) || taxNum < 0 || taxNum > 100) {
      alert("Thuế phải từ 0-100%")
      return
    }

    try {
      setSubmitting(true)
      const supabase = createBrowserClient()

      const { error } = await supabase
        .from("app_settings")
        .update({
          service_fee_percentage: feeNum,
          tax_percentage: taxNum,
          pi_service_fee_wallet: piServiceFeeWallet?.trim() || null,
          pi_tax_wallet: piTaxWallet?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .neq("id", "00000000-0000-0000-0000-000000000000")

      if (error) throw error

      alert("Đã cập nhật cài đặt thành công!")
      loadData()
    } catch (error) {
      console.error("Error updating settings:", error)
      alert("Có lỗi xảy ra: " + (error as any).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
        <Header />
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
      <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex items-center gap-4 shadow-lg">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 rounded-full"
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-lg font-semibold">Cài đặt hệ thống</h1>
      </div>

      <main className="container py-6 px-4 max-w-4xl mx-auto space-y-6">
        {/* Cài đặt phí và thuế */}
        <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-purple-900">Cài đặt phí và thuế</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Phí dịch vụ (%)</label>
              <Input
                type="number"
                value={serviceFee}
                onChange={(e) => setServiceFee(e.target.value)}
                placeholder="Nhập % phí dịch vụ..."
                min="0"
                max="100"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">
                Phí dịch vụ hiện tại: {settings?.service_fee_percentage || 0}%
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Thuế (%)</label>
              <Input
                type="number"
                value={taxPercentage}
                onChange={(e) => setTaxPercentage(e.target.value)}
                placeholder="Nhập % thuế..."
                min="0"
                max="100"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">Thuế hiện tại: {settings?.tax_percentage || 0}%</p>
            </div>

            
            <div className="mt-6 border-t pt-6">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Wallet className="h-5 w-5 text-purple-600" />
                Ví hệ thống - Pi (Mainnet)
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Địa chỉ ví phí dịch vụ (Pi)</label>
                  <Input
                    value={piServiceFeeWallet}
                    onChange={(e) => setPiServiceFeeWallet(e.target.value)}
                    placeholder="Nhập địa chỉ ví Pi mainnet nhận phí dịch vụ"
                    className="mt-1 font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">Admin có thể thay đổi địa chỉ ví nhận phí dịch vụ bằng Pi trong tương lai.</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Địa chỉ ví thuế (Pi)</label>
                  <Input
                    value={piTaxWallet}
                    onChange={(e) => setPiTaxWallet(e.target.value)}
                    placeholder="Nhập địa chỉ ví Pi mainnet nhận thuế"
                    className="mt-1 font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">Admin có thể thay đổi địa chỉ ví nhận thuế bằng Pi trong tương lai.</p>
                </div>
              </div>
            </div>
<Button
              onClick={handleUpdateSettings}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang cập nhật...
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4 mr-2" />
                  Cập nhật cài đặt
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-purple-900">Ví hệ thống</h2>
          </div>

          <div className="space-y-4">
            {/* Ví phí dịch vụ */}
            {(() => {
              const serviceWallet = systemWallets.find((w) => w.username === "PITODO-SURCHARGE-PITD")
              return (
                <div className="border border-purple-200 rounded-lg p-4 bg-purple-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-purple-700 font-semibold">1. Địa chỉ ví phí dịch vụ:</span>
                  </div>
                  <div className="ml-4 space-y-2">
                    <p className="text-sm text-gray-600">
                      Địa chỉ ví:{" "}
                      <span className="font-mono text-xs break-all">{servicePitdAddress || serviceWallet?.address || "—"}</span>
                      {(servicePitdAddress || serviceWallet?.address) ? (
                        <button
                          type="button"
                          className="ml-2 inline-flex items-center justify-center p-1 rounded border border-purple-300 text-purple-700"
                          onClick={() => copyText((servicePitdAddress || serviceWallet?.address || "") as string)}
                          title="Copy"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      ) : null}
                    </p>

                    <p className="text-sm text-gray-600">
                      Số dư ví phí dịch vụ:{" "}
                      <span className="font-bold text-purple-700">
                        {(serviceWallet?.balance || 0).toLocaleString()} PITD
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-purple-700 border-purple-300 hover:bg-purple-100 bg-transparent"
                        onClick={() => serviceWallet && handleViewHistory(serviceWallet)}
                      >
                        <History className="w-4 h-4 mr-1" />
                        Xem lịch sử giao dịch
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-purple-700 border-purple-300 hover:bg-purple-100 bg-transparent"
                        onClick={() => serviceWallet && handleExportStatement(serviceWallet)}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Sao kê giao dịch
                      </Button>
                    </div>

                    {/* Cấu hình ví nhận PITD (phí dịch vụ) */}
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className="text-xs text-gray-600">Địa chỉ ví nhận PITD (phí dịch vụ)</label>
                        <Input
                          value={servicePitdAddress}
                          onChange={(e) => setServicePitdAddress(e.target.value)}
                          placeholder="PITSER... (24 ký tự)"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-600">Tài khoản nhận phí dịch vụ (PITD)</label>
                        <select
                          className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                          value={feeReceiverId}
                          onChange={(e) => setFeeReceiverId(e.target.value)}
                        >
                          <option value="">Ví hệ thống (PITODO-SURCHARGE-PITD)</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {(u.pi_username || u.id).toString()} {u.full_name ? `- ${u.full_name}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Ví thuế */}
            {(() => {
              const taxWallet = systemWallets.find((w) => w.username === "PITODO-TAX-PITD")
              return (
                <div className="border border-pink-200 rounded-lg p-4 bg-pink-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-pink-700 font-semibold">2. Địa chỉ ví thuế:</span>
                  </div>
                  <div className="ml-4 space-y-2">
                    <p className="text-sm text-gray-600">
                      Địa chỉ ví:{" "}
                      <span className="font-mono text-xs break-all">{taxPitdAddress || taxWallet?.address || "—"}</span>
                      {(taxPitdAddress || taxWallet?.address) ? (
                        <button
                          type="button"
                          className="ml-2 inline-flex items-center justify-center p-1 rounded border border-pink-300 text-pink-700"
                          onClick={() => copyText((taxPitdAddress || taxWallet?.address || "") as string)}
                          title="Copy"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      ) : null}
                    </p>

                    <p className="text-sm text-gray-600">
                      Số dư ví thuế:{" "}
                      <span className="font-bold text-pink-700">{(taxWallet?.balance || 0).toLocaleString()} PITD</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-pink-700 border-pink-300 hover:bg-pink-100 bg-transparent"
                        onClick={() => taxWallet && handleViewHistory(taxWallet)}
                      >
                        <History className="w-4 h-4 mr-1" />
                        Xem lịch sử giao dịch
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-pink-700 border-pink-300 hover:bg-pink-100 bg-transparent"
                        onClick={() => taxWallet && handleExportStatement(taxWallet)}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Sao kê giao dịch
                      </Button>
                    </div>

                    {/* Cấu hình ví nhận PITD (thuế) */}
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className="text-xs text-gray-600">Địa chỉ ví nhận PITD (thuế)</label>
                        <Input
                          value={taxPitdAddress}
                          onChange={(e) => setTaxPitdAddress(e.target.value)}
                          placeholder="PITTAX... (24 ký tự)"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-600">Tài khoản nhận thuế (PITD)</label>
                        <select
                          className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                          value={taxReceiverId}
                          onChange={(e) => setTaxReceiverId(e.target.value)}
                        >
                          <option value="">Ví hệ thống (PITODO-TAX-PITD)</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {(u.pi_username || u.id).toString()} {u.full_name ? `- ${u.full_name}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            <div className="pt-2">
              <Button
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-xl shadow-lg"
                onClick={handleSavePitdWalletConfig}
                disabled={savingPitdWallets}
              >
                {savingPitdWallets ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    Cập nhật ví PITD (phí/thuế)
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Chọn tài khoản nhận phí/thuế bằng PITD và/hoặc nhập địa chỉ ví PITD. Nếu tài khoản chưa có ví PITD, hệ thống sẽ tự tạo.
              </p>
            </div>
          </div>
        </Card>
      </main>

      {showHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex items-center justify-between">
              <h3 className="font-semibold">
                Lịch sử giao dịch - {historyWallet?.username === "PITODO-SURCHARGE-PITD" ? "Ví phí dịch vụ" : "Ví thuế"}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 rounded-full"
                onClick={() => setShowHistory(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                </div>
              ) : transactions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Chưa có giao dịch nào</p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex justify-between items-start mb-1">
                        <Badge
                          variant={tx.transaction_type.includes("credit") || tx.amount > 0 ? "default" : "destructive"}
                        >
                          {tx.transaction_type}
                        </Badge>
                        <span className={`font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                          {tx.amount > 0 ? "+" : ""}
                          {tx.amount.toLocaleString()} PITD
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{tx.description || "Không có mô tả"}</p>
                      <div className="flex justify-between mt-2 text-xs text-gray-500">
                        <span>Số dư sau: {tx.balance_after?.toLocaleString() || 0} PITD</span>
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
