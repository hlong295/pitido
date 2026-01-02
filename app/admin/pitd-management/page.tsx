"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Coins, Search, Plus, Minus, Loader2, ChevronLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type User = {
  id: string
  pi_uid: string
  pi_username: string
  display_name: string
  user_role: string
  user_type: string
  full_name: string
  wallet?: {
    id?: string
    balance: number
  }
}

type Transaction = {
  id: string
  user_id: string
  amount: number
  type: "grant" | "revoke"
  description: string
  created_at: string
  username?: string
  status: string
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()\[\]\\\/\+^]/g, '\\$&') + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

export default function PitdManagementPage() {
  const router = useRouter()
  const { user, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingTx, setLoadingTx] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [actionType, setActionType] = useState<"grant" | "revoke">("grant")
  const [submitting, setSubmitting] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>("")

  useEffect(() => {
    // Wait for auth context to resolve
    if (!user) return
    if (!isAdmin()) {
      router.push("/")
      return
    }
    loadData()
  }, [user])

  async function loadData() {
    try {
      setLoading(true)
      const supabase = createBrowserClient()

      // Admin identity for server-side PITD APIs (Pi login)
      // In Pi Browser, the auth context can sometimes be missing fields depending
      // on the login path. Fall back to localStorage keys used by `lib/auth-context.tsx`.
      let adminId: string = (user as any)?.uid || (user as any)?.id || ""
      let adminUsername: string = (user as any)?.username || ""

      try {
        if (typeof window !== "undefined") {
          const piUserJson =
            localStorage.getItem("pi_user") || localStorage.getItem("pitodo_pi_user")
          if (piUserJson) {
            const piUser = JSON.parse(piUserJson)
            adminId = adminId || piUser?.uid || piUser?.id || ""
            adminUsername = adminUsername || piUser?.username || piUser?.piUsername || ""
          }
          adminId =
            adminId ||
            localStorage.getItem("pi_user_id") ||
            localStorage.getItem("user_id") ||
            localStorage.getItem("pitodo_pi_user_id") ||
            ""
          adminUsername =
            adminUsername ||
            localStorage.getItem("pi_username") ||
            localStorage.getItem("pitodo_pi_username") ||
            ""
        }
      } catch {
        // ignore
      }

      console.log("[v0] PITD Management v4.0 - Loading data...")

      const { data: usersData, error: usersError } = await supabase
        .from("pi_users")
        .select("id, pi_uid, pi_username, user_role, user_type, full_name")
        .order("pi_username")

      if (usersError) {
        console.error("[v0] Error loading users:", usersError)
        setDebugInfo(`Error: ${usersError.message}`)
        return
      }

      console.log("[v0] Loaded users:", usersData?.length || 0)

      const usernames = usersData?.map((u) => u.pi_username || u.full_name).join(", ") || ""
      setDebugInfo(`Found ${usersData?.length || 0} users: ${usernames}`)

      // Wallet balances must be fetched server-side (service role)
      const walletMap = new Map<string, { id?: string; balance: number }>()
      try {
        const headers: Record<string, string> = {}
        if (adminId) headers["x-pi-user-id"] = adminId
        if (adminUsername) headers["x-pi-username"] = adminUsername
        headers["x-auth-type"] = "pi"

        const wres = await fetch(`/api/admin/pitd-wallets`, { headers })
        const wjson = await wres.json().catch(() => ({}))
        if (wres.ok && Array.isArray(wjson.wallets)) {
          wjson.wallets.forEach((w: any) => {
            walletMap.set(w.user_id, { id: w.id, balance: Number(w.balance) || 0 })
          })
        } else {
          console.warn("[Admin] pitd-wallets failed", wjson)
        }
      } catch (e) {
        console.warn("[Admin] pitd-wallets error", e)
      }

      // Transactions will be loaded per selected user via /api/admin/pitd-history?userId=...
      // (kept out of the initial load to avoid showing irrelevant/global history.)

      if (usersData) {
        const filteredUsers = usersData.filter((u: any) => {
          const username = (u.pi_username || "").toUpperCase()
          return !username.startsWith("PITODO-") && !username.endsWith("-PITD") && u.user_role !== "system"
        })

        console.log("[v0] After filter:", filteredUsers.length, "users")
        setDebugInfo((prev) => `${prev} | After filter: ${filteredUsers.length} users`)

        setUsers(
          filteredUsers.map((u: any) => ({
            id: u.id,
            pi_uid: u.pi_uid || "",
            pi_username: u.pi_username || "",
            display_name: u.pi_username || u.full_name || "Unknown User",
            user_role: u.user_role,
            user_type: u.user_type,
            full_name: u.full_name || "",
            wallet: {
              id: walletMap.get(u.id)?.id,
              balance: walletMap.get(u.id)?.balance || 0,
            },
          })),
        )
      }

      setTransactions([])
    } catch (error) {
      console.error("[v0] Exception in loadData:", error)
      setDebugInfo(`Exception: ${(error as any).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadHistoryForUser(userId: string) {
    try {
      setLoadingTx(true)
      // Only show debug on screen when ?debug=1 (Pi Browser has no console)
      const debugEnabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1"

      const adminId = getCookie("pitodo_requester_id") || ""
      const adminUsername = getCookie("pitodo_pi_username") || ""

      const headers: Record<string, string> = {}
      if (adminId) headers["x-pi-user-id"] = adminId
      if (adminUsername) headers["x-pi-username"] = adminUsername
      headers["x-auth-type"] = adminUsername ? "pi" : "email"

      const selected = users.find((u) => u.id === userId)
      const walletId = selected?.wallet?.id

      const qp = new URLSearchParams()
      qp.set("userId", userId)
      if (walletId) qp.set("walletId", walletId)
      qp.set("type", "all")
      qp.set("limit", "50")

      const res = await fetch(`/api/admin/pitd-history?${qp.toString()}`, { headers, cache: "no-store" })

      const json = await res.json().catch(() => ({}))
      const ok = Boolean(json?.ok)
      const txs = Array.isArray(json?.transactions) ? json.transactions : []
      setTransactions(ok ? txs : [])

            const txLen = Array.isArray(json?.transactions) ? json.transactions.length : 0;

      // In Pi Browser there is no console, so show minimal debug when history is empty (or when debug=1).
      if (debugEnabled || txLen === 0) {
        const summary = {
          ok: json?.ok,
          txLen,
          meta: json?.meta || null,
        };
        setDebugInfo(`HISTORY DEBUG: ${JSON.stringify(summary)}`);
      } else {
        setDebugInfo("");
      }
    } catch (error: any) {
      setTransactions([])
      const msg = error?.message || String(error)
      setDebugInfo(`HISTORY ERROR: ${msg}`)
    } finally {
      setLoadingTx(false)
    }
  }

  async function handleSubmit() {
    if (!selectedUser) {
      alert("Vui lòng chọn user")
      return
    }

    if (!amount || Number(amount) <= 0) {
      alert("Vui lòng nhập số lượng PITD hợp lệ")
      return
    }

    if (!reason.trim()) {
      alert("Vui lòng nhập lý do")
      return
    }

    const amountNum = Number(amount)
    const currentBalance = selectedUser.wallet?.balance || 0

    if (actionType === "revoke" && currentBalance < amountNum) {
      alert("Số dư PITD không đủ để thu hồi")
      return
    }

    try {
      setSubmitting(true)

      console.log("[v0] Submitting to API v4.0:", {
        userId: selectedUser.id,
        amount: amountNum,
        actionType,
        username: selectedUser.display_name,
      })

      // NOTE: Pi Browser can keep a stale Supabase cookie session from email-login.
      // For PITD admin actions we MUST prefer the Pi user identity if available,
      // so root admin (HLong295) never "loses" permission.
      const piUserStorage =
        typeof window !== "undefined" ? localStorage.getItem("pitodo_pi_user") : null
      let piUserIdFromStorage: string | undefined
      let piUsernameFromStorage: string | undefined
      if (piUserStorage) {
        try {
          const parsed = JSON.parse(piUserStorage)
          piUserIdFromStorage = parsed?.id || parsed?.pi_user_id
          piUsernameFromStorage = parsed?.username || parsed?.pi_username
        } catch {
          // ignore
        }
      }

      const fallbackAdminId =
        (typeof window !== "undefined" &&
          (piUserIdFromStorage || localStorage.getItem("pi_user_id") || localStorage.getItem("user_id"))) ||
        undefined

      const fallbackAdminUsername =
        (typeof window !== "undefined" &&
          (piUsernameFromStorage || localStorage.getItem("pi_username") || localStorage.getItem("username"))) ||
        undefined

      // Ensure we always send a plain string id. Prefer Pi user id if present.
      const rawAdminId: any = fallbackAdminId || user?.id
      const adminId =
        typeof rawAdminId === "string"
          ? rawAdminId
          : (rawAdminId && typeof rawAdminId === "object" ? rawAdminId.id : undefined)

      // Prefer Pi username if present.
      const rawAdminUsername: any =
        (user as any)?.pi_username || (user as any)?.username || fallbackAdminUsername
      const adminUsername =
        typeof rawAdminUsername === "string"
          ? rawAdminUsername
          : (rawAdminUsername && typeof rawAdminUsername === "object" ? rawAdminUsername.pi_username || rawAdminUsername.username : undefined)

      // Show minimal debug info on-screen (Pi Browser has no console).
      setDebugInfo(
        `[Admin Debug] adminId=${adminId || "(missing)"} | adminUsername=${adminUsername || "(missing)"} | userId=${selectedUser.id} | action=${actionType} | amount=${amountNum}`
      )

      const response = await fetch("/api/admin/pitd-grant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminId ? { "x-pi-user-id": adminId } : {}),
          ...(adminUsername ? { "x-pi-username": adminUsername } : {}),
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: amountNum,
          actionType: actionType,
          reason: reason.trim(),
          adminId,
          adminUsername,
        }),
      })

      const result = await response.json()
      console.log("[v0] API response:", result)

      if (!response.ok || !result.success) {
        let debugStr = ""
        if (result?.debug) {
          debugStr =
            typeof result.debug === "string"
              ? result.debug
              : (() => {
                  try {
                    return JSON.stringify(result.debug)
                  } catch {
                    return String(result.debug)
                  }
                })()

          setDebugInfo(`[API Debug] ${debugStr}`)

          // Pi Browser has no console → show debug in alert for screenshots.
          if (debugStr.length > 800) debugStr = debugStr.slice(0, 800) + "…"
          debugStr = `\n\nDEBUG: ${debugStr}`
        }

        throw new Error((result.message || "Có lỗi xảy ra") + debugStr)
      }

      alert(`Đã ${actionType === "grant" ? "cấp phát" : "thu hồi"} ${amountNum} PITD thành công!`)

      setAmount("")
      setReason("")
      await loadData()
      if (selectedUser?.id) {
        await loadHistoryForUser(selectedUser.id)
      }
    } catch (error) {
      console.error("[v0] Error in handleSubmit:", error)
      alert("Có lỗi xảy ra: " + (error as any).message)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return false

    const matchPiUsername = u.pi_username && u.pi_username.toLowerCase().includes(query)
    const matchFullName = u.full_name && u.full_name.toLowerCase().includes(query)
    const matchDisplayName = u.display_name && u.display_name.toLowerCase().includes(query)

    return matchPiUsername || matchFullName || matchDisplayName
  })

  console.log(
    "[v0] Search query:",
    searchQuery,
    "Filtered results:",
    filteredUsers.length,
    "Total users:",
    users.length,
  )

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
        <h1 className="text-lg font-semibold">Quản lý PITD Token</h1>
      </div>

      <main className="container py-6 px-4 max-w-4xl mx-auto space-y-6">
        {debugInfo && (
          <Card className="p-4 bg-yellow-50 border-yellow-200">
            <p className="text-sm text-yellow-800 font-mono break-all whitespace-pre-wrap">{debugInfo}</p>
            <p className="text-xs text-yellow-600 mt-1">Version: PITD Management v4.0</p>
          </Card>
        )}

        <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50">
          <div className="flex items-center gap-3 mb-4">
            <Coins className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-purple-900">Cấp phát / Thu hồi PITD</h2>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={() => setActionType("grant")}
                variant={actionType === "grant" ? "default" : "outline"}
                className={
                  actionType === "grant"
                    ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                    : "border-green-300 text-green-700"
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                Cấp phát
              </Button>
              <Button
                onClick={() => setActionType("revoke")}
                variant={actionType === "revoke" ? "default" : "outline"}
                className={
                  actionType === "revoke"
                    ? "bg-gradient-to-r from-red-600 to-rose-600 text-white"
                    : "border-red-300 text-red-700"
                }
              >
                <Minus className="w-4 h-4 mr-2" />
                Thu hồi
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Tìm kiếm user</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nhập username, email hoặc tên..."
                  className="pl-10"
                />
              </div>
              {searchQuery && (
                <div className="mt-2 max-h-60 overflow-y-auto border rounded-lg bg-white shadow-sm">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setSelectedUser(u)
                          setSearchQuery("")
                          loadHistoryForUser(u.id)
                        }}
                        className="w-full p-3 hover:bg-purple-50 text-left border-b last:border-b-0 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{u.display_name}</span>
                            {u.pi_username && u.pi_username !== u.display_name && (
                              <span className="text-xs text-gray-500 ml-2">@{u.pi_username}</span>
                            )}
                          </div>
                          <span className="text-sm text-pink-600 font-semibold">
                            {u.wallet?.balance?.toLocaleString() || 0} PITD
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-gray-500 text-sm">Không tìm thấy user</div>
                  )}
                </div>
              )}
            </div>

            {selectedUser && (
              <Card className="p-4 bg-white border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-purple-900">{selectedUser.display_name}</p>
                    {selectedUser.pi_username && selectedUser.pi_username !== selectedUser.display_name && (
                      <p className="text-xs text-gray-500">@{selectedUser.pi_username}</p>
                    )}
                    <p className="text-sm text-gray-600">
                      Số dư hiện tại:{" "}
                      <span className="font-semibold text-pink-600">
                        {selectedUser.wallet?.balance?.toLocaleString() || 0} PITD
                      </span>
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                    Xóa
                  </Button>
                </div>
              </Card>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Số lượng PITD</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Nhập số lượng PITD..."
                min="1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Lý do</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`Lý do ${actionType === "grant" ? "cấp phát" : "thu hồi"} PITD...`}
                rows={3}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedUser || !amount || !reason}
              className={`w-full ${
                actionType === "grant"
                  ? "bg-gradient-to-r from-green-600 to-emerald-600"
                  : "bg-gradient-to-r from-red-600 to-rose-600"
              } text-white`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  {actionType === "grant" ? <Plus className="w-4 h-4 mr-2" /> : <Minus className="w-4 h-4 mr-2" />}
                  {actionType === "grant" ? "Cấp phát PITD" : "Thu hồi PITD"}
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-bold text-purple-900 mb-4">Lịch sử giao dịch</h3>
          <div className="space-y-3">
            {transactions.length > 0 ? (
              transactions.map((tx) => (
                <Card key={tx.id} className="p-4 bg-gradient-to-r from-purple-50/50 to-pink-50/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          className={
                            tx.type === "grant"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-red-100 text-red-700 border-red-200"
                          }
                        >
                          {tx.type === "grant" ? (
                            <>
                              <Plus className="w-3 h-3 mr-1" />
                              Cấp phát
                            </>
                          ) : (
                            <>
                              <Minus className="w-3 h-3 mr-1" />
                              Thu hồi
                            </>
                          )}
                        </Badge>
                        <span className="font-semibold text-purple-900">{tx.username}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">{tx.description}</p>
                      <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleString("vi-VN")}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${tx.type === "grant" ? "text-green-600" : "text-red-600"}`}>
                        {tx.type === "grant" ? "+" : "-"}
                        {tx.amount.toLocaleString()} PITD
                      </p>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">Chưa có giao dịch nào</div>
            )}
          </div>
        </Card>
      </main>

      <BottomNav />
    </div>
  )
}


