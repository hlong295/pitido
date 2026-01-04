"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Shield,
  Users,
  Search,
  UserCheck,
  UserX,
  Crown,
  Store,
  User,
  AlertCircle,
  CheckCircle,
  Mail,
} from "lucide-react"
import Link from "next/link"
import { createBrowserClient } from "@/lib/supabase/client"

interface Member {
  id: string
  pi_username?: string
  email?: string
  full_name?: string
  user_role: string
  user_type: string
  verification_status: string
  provider_approved?: boolean
  provider_business_name?: string
  created_at: string
  last_login_at?: string
}

export default function AdminMembersPage() {
  const { t } = useLanguage()
  const { user, isAdmin } = useAuth()
  const [piMembers, setPiMembers] = useState<Member[]>([])
  const [emailMembers, setEmailMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  // Pi Browser không có console log, nên lưu debug để hiển thị trên màn hình khi cần.
  const [debugText, setDebugText] = useState<string | null>(null)

  const supabase = createBrowserClient()

  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    setLoading(true)
    try {
      // Load Pi users
      const { data: piData } = await supabase
        .from("pi_users")
        .select("*")
        .eq("user_type", "pi")
        .order("created_at", { ascending: false })

      setPiMembers(
        (piData || []).map((p) => ({
          ...p,
          user_type: "pi",
        })),
      )

      const { data: emailData } = await supabase
        .from("pi_users")
        .select("id, email, full_name, user_role, user_type, verification_status, created_at")
        .eq("user_type", "email")
        .order("created_at", { ascending: false })

      setEmailMembers(
        (emailData || []).map((e) => ({
          ...e,
          user_type: "email",
        })),
      )
    } catch (error) {
      console.error("Error loading members:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateMemberRole = async (memberId: string, newRole: string, memberType: string) => {
    try {
      // Provider approval must persist to DB (pi_users.user_role + provider_approved fields).
      // Client-side direct UPDATE can silently affect 0 rows due to RLS, so we use a server API.
      const approvingProvider = newRole === "provider" || newRole === "redeemer"

      if (approvingProvider) {
        if (!isAdmin()) {
          throw new Error("Bạn không có quyền thực hiện thao tác này.")
        }
        const requesterId = (user as any)?.piUserId || ""
        if (!requesterId) {
          throw new Error("Không xác định được requesterId (piUserId). Vui lòng đăng nhập lại.")
        }

        const res = await fetch("/api/admin/approve-provider", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requesterId,
            targetUserId: memberId,
            approve: newRole === "provider",
          }),
        })

        const json = await res.json().catch(() => ({} as any))
        if (!res.ok || json?.error) {
          // Pi Browser không có console log, nên show lỗi chi tiết ngay trên màn hình để bạn chụp.
          const details = json?.details || json?.debug || json?.message || ""
          const msg = json?.error || "Không thể cập nhật quyền Provider."
          throw new Error(details ? `${msg} | ${details}` : msg)
        }

        const updatedRole = json?.user?.user_role || newRole

        if (memberType === "pi") {
          setPiMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, user_role: updatedRole } : m)))
        } else {
          setEmailMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, user_role: updatedRole } : m)))
        }

        setActionMessage({ type: "success", text: "Đã cập nhật quyền thành công!" })
        setTimeout(() => setActionMessage(null), 3000)
        return
      }

      // Fallback: other roles (if any in the future) - use server-side RLS-aware update later.
      const { data, error } = await supabase
        .from("pi_users")
        .update({ user_role: newRole, updated_at: new Date().toISOString() })
        .eq("id", memberId)
        .select("id")
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error("Không thể cập nhật do thiếu quyền (RLS).")


      // Update local state
      if (memberType === "pi") {
        setPiMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, user_role: newRole } : m)))
      } else {
        setEmailMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, user_role: newRole } : m)))
      }

      setActionMessage({ type: "success", text: "Đã cập nhật quyền thành công!" })
      setTimeout(() => setActionMessage(null), 3000)
    } catch (error) {
      console.error("Error updating role:", error)
      const msg =
        (error as any)?.message && typeof (error as any).message === "string"
          ? (error as any).message
          : "Không thể cập nhật quyền"
      // Pi Browser không có console log, nên hiển thị thông báo lỗi chi tiết ngay trên màn hình
      // để bạn chụp màn hình gửi lại.
      setActionMessage({ type: "error", text: msg.startsWith("Không") ? msg : `Không thể cập nhật quyền: ${msg}` })
    }
  }

  
const approveProvider = async (memberId: string, approve: boolean) => {
  try {
    setDebugText(null)
    // IMPORTANT: do this via server API (service role) to avoid RLS blocking updates.
    const requesterId = (user as any)?.piUserId || ""
    if (!requesterId) throw new Error("Missing requesterId (piUserId)")

    const res = await fetch("/api/admin/approve-provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterId, targetUserId: memberId, approve }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (json?.debug) {
        try {
          setDebugText(JSON.stringify(json.debug, null, 2))
        } catch {
          setDebugText(String(json.debug))
        }
      }
      throw new Error(json?.error || "Không thể cập nhật")
    }

    const updatedRole = json?.user?.user_role || (approve ? "provider" : "redeemer")
    setPiMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              provider_approved: approve,
              user_role: updatedRole,
            }
          : m,
      ),
    )

    setActionMessage({
      type: "success",
      text: approve ? "Đã phê duyệt nhà cung cấp" : "Đã hủy phê duyệt",
    })
    setDebugText(null)
    setTimeout(() => setActionMessage(null), 3000)
  } catch (error) {
    console.error("Error approving provider:", error)
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Không thể cập nhật"
    setActionMessage({ type: "error", text: msg })
  }
}

const filterMembers = (members: Member[]) => {
    if (!searchQuery) return members
    const q = searchQuery.toLowerCase()
    return members.filter(
      (m) =>
        m.pi_username?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.full_name?.toLowerCase().includes(q) ||
        m.provider_business_name?.toLowerCase().includes(q),
    )
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "root_admin":
        return (
          <Badge className="bg-red-500 text-white">
            <Crown className="h-3 w-3 mr-1" />
            ROOT ADMIN
          </Badge>
        )
      case "provider":
        return (
          <Badge className="bg-purple-500 text-white">
            <Store className="h-3 w-3 mr-1" />
            Provider
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <User className="h-3 w-3 mr-1" />
            Redeemer
          </Badge>
        )
    }
  }

  if (!user || !isAdmin()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 pb-20">
        <Header />
        <main className="container px-4 py-6">
          <Card className="p-12 rounded-2xl shadow-md">
            <div className="text-center space-y-4">
              <Shield className="h-16 w-16 text-purple-500 mx-auto" />
              <h3 className="text-xl font-bold">{t("adminOnly")}</h3>
              <Link href="/">
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl">
                  {t("navHome")}
                </Button>
              </Link>
            </div>
          </Card>
        </main>
        <BottomNav />
      </div>
    )
  }

  const totalMembers = piMembers.length + emailMembers.length
  const totalProviders = piMembers.filter((m) => m.user_role === "provider").length
  const approvedProviders = piMembers.filter((m) => m.user_role === "provider" && m.provider_approved).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-purple-50 pb-20">
      <Header />
      <main className="container px-4 py-6 max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-purple-700">Quản lý thành viên</h1>
            <p className="text-sm text-gray-600">{totalMembers} thành viên</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="rounded-xl shadow-sm bg-white/60">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{piMembers.length}</div>
              <div className="text-xs text-gray-500">Pi Users</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm bg-white/60">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{emailMembers.length}</div>
              <div className="text-xs text-gray-500">Email Users</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm bg-white/60">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {approvedProviders}/{totalProviders}
              </div>
              <div className="text-xs text-gray-500">Providers</div>
            </CardContent>
          </Card>
        </div>

        {/* Action Message */}
        {actionMessage && (
          <Alert
            className={`rounded-xl ${actionMessage.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
          >
            {actionMessage.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={actionMessage.type === "success" ? "text-green-700" : "text-red-700"}>
              {actionMessage.text}
              {actionMessage.type === "error" && debugText ? (
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-black/5 p-2 text-xs leading-relaxed">
                  {debugText}
                </pre>
              ) : null}
            </AlertDescription>
          </Alert>
        )}

        {/* Search */}
        <Card className="rounded-2xl shadow-sm bg-white/60">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tìm theo tên, email, username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl border-gray-200"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="pi" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 bg-white/60 rounded-xl p-1">
            <TabsTrigger
              value="pi"
              className="rounded-lg data-[state=active]:bg-purple-500 data-[state=active]:text-white"
            >
              Pi Users ({piMembers.length})
            </TabsTrigger>
            <TabsTrigger
              value="email"
              className="rounded-lg data-[state=active]:bg-purple-500 data-[state=active]:text-white"
            >
              Email Users ({emailMembers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pi">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : filterMembers(piMembers).length === 0 ? (
              <Card className="rounded-2xl bg-white/60">
                <CardContent className="p-12 text-center">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Không có thành viên Pi</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filterMembers(piMembers).map((member) => (
                  <Card key={member.id} className="rounded-xl shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                          π
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{member.pi_username}</h3>
                            {getRoleBadge(member.user_role)}
                          </div>
                          {member.provider_business_name && (
                            <p className="text-sm text-gray-500">{member.provider_business_name}</p>
                          )}
                          <p className="text-xs text-gray-400">
                            Tham gia: {new Date(member.created_at).toLocaleDateString("vi-VN")}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          {member.user_role === "provider" && (
                            <Button
                              size="sm"
                              variant={member.provider_approved ? "outline" : "default"}
                              className={`rounded-lg ${member.provider_approved ? "" : "bg-green-500 hover:bg-green-600"}`}
                              onClick={() => approveProvider(member.id, !member.provider_approved)}
                            >
                              {member.provider_approved ? (
                                <>
                                  <UserX className="h-3.5 w-3.5 mr-1" />
                                  Hủy
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                                  Duyệt
                                </>
                              )}
                            </Button>
                          )}
                          {member.user_role !== "root_admin" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg bg-transparent"
                              onClick={() =>
                                updateMemberRole(
                                  member.id,
                                  member.user_role === "provider" ? "redeemer" : "provider",
                                  "pi",
                                )
                              }
                            >
                              {member.user_role === "provider" ? (
                                <>
                                  <User className="h-3.5 w-3.5 mr-1" />→ User
                                </>
                              ) : (
                                <>
                                  <Store className="h-3.5 w-3.5 mr-1" />→ Provider
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="email">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : filterMembers(emailMembers).length === 0 ? (
              <Card className="rounded-2xl bg-white/60">
                <CardContent className="p-12 text-center">
                  <Mail className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Không có thành viên Email</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filterMembers(emailMembers).map((member) => (
                  <Card key={member.id} className="rounded-xl shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white">
                          <Mail className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{member.full_name || member.email}</h3>
                            {getRoleBadge(member.user_role)}
                          </div>
                          <p className="text-sm text-gray-500">{member.email}</p>
                          <p className="text-xs text-gray-400">
                            Tham gia: {new Date(member.created_at).toLocaleDateString("vi-VN")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <BottomNav />
    </div>
  )
}
