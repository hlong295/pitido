"use client"

import type React from "react"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useAuth } from "@/lib/auth-context"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Upload, User, Lock, Camera, Save, ArrowLeft, Shield } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

// We keep this fallback because Pi Browser sometimes loses React state on refresh.
const STORAGE_KEYS = ["pitodo_pi_user", "pi_user", "current_user"]

export default function SettingsClient() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const debugOn = searchParams.get("dbg") === "1" || searchParams.get("debug") === "1"

  const [resolved, setResolved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [piUsername, setPiUsername] = useState<string | null>(null)

  // Form data
  const [fullName, setFullName] = useState("")
  const [address, setAddress] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")

  // 2FA / TOTP
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [totpSecret, setTotpSecret] = useState("")
  const [totpUri, setTotpUri] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [totpCode, setTotpCode] = useState("")

  const isEmailUser = user?.type === "email"

  useEffect(() => {
    if (authLoading) return

    let foundUserId: string | null = null
    let foundUsername: string | null = null

    if (user) {
      foundUserId = user.uid
      foundUsername = user.username
    } else {
      for (const key of STORAGE_KEYS) {
        try {
          const data = localStorage.getItem(key)
          if (data) {
            const parsed = JSON.parse(data)
            const userId = parsed.uid || parsed.id || parsed.piUserId
            const username = parsed.piUsername || parsed.pi_username || parsed.username
            if (userId) {
              foundUserId = userId
              foundUsername = username
              break
            }
          }
        } catch {
          // ignore
        }
      }
    }

    setCurrentUserId(foundUserId)
    setPiUsername(foundUsername)
    setResolved(true)

    if (foundUserId) {
      loadUserData(foundUserId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  async function loadUserData(userId: string) {
    try {
      const res = await fetch(`/api/settings/profile?userId=${encodeURIComponent(userId)}`)
      const json = await res.json()
      if (debugOn) setDebugInfo({ step: "loadProfile", status: res.status, ok: res.ok, json })

      if (json?.ok && json?.user) {
        setFullName(json.user.full_name || "")
        setAddress(json.user.address || "")
        setPhoneNumber(json.user.phone || "")
        setAvatarUrl(json.user.avatar_url || "")
        setTotpEnabled(!!json.user.totp_enabled)
      }
    } catch (error: any) {
      if (debugOn) setDebugInfo({ step: "loadProfile", error: String(error?.message || error) })
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUserId) return

    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: currentUserId,
          full_name: fullName,
          address,
          phone: phoneNumber,
          phone_number: phoneNumber,
        }),
      })
      const json = await res.json()
      if (debugOn) setDebugInfo({ step: "updateProfile", status: res.status, ok: res.ok, json })
      if (!json?.ok) throw new Error(json?.error || "Cập nhật thất bại")

      setMessage({ type: "success", text: "Cập nhật thông tin thành công!" })
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Có lỗi xảy ra" })
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    // Only for email login. (Pi login has no password here.)
    if (!isEmailUser) {
      setMessage({ type: "error", text: "Chức năng này chỉ áp dụng cho tài khoản đăng nhập bằng email." })
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Mật khẩu xác nhận không khớp!" })
      return
    }

    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "Mật khẩu mới phải có ít nhất 8 ký tự!" })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setMessage({ type: "success", text: "Thay đổi mật khẩu thành công!" })
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Có lỗi xảy ra khi đổi mật khẩu" })
    } finally {
      setLoading(false)
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUserId) return

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Vui lòng chọn file ảnh!" })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Kích thước ảnh không được vượt quá 5MB!" })
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      // Pi Browser / some WebViews can break on multipart FormData uploads.
      // Send JSON (base64) instead to keep compatibility.
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ""
      // chunk to avoid call stack limits
      const chunkSize = 0x8000
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
      }
      const b64 = btoa(binary)

      const res = await fetch("/api/settings/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          filename: file.name,
          contentType: file.type,
          base64: b64,
        }),
      })
      const json = await res.json().catch(() => ({ ok: false, error: "BAD_JSON" }))
      if (debugOn) setDebugInfo({ step: "avatarUpload", status: res.status, ok: res.ok, json })
      if (!json?.ok) throw new Error(json?.error || "Upload thất bại")

      setAvatarUrl(json.avatar_url || "")
      setMessage({ type: "success", text: "Cập nhật ảnh đại diện thành công!" })
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Có lỗi xảy ra khi tải ảnh lên" })
    } finally {
      setUploading(false)
    }
  }

  async function handleTotpSetup() {
    if (!currentUserId) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/settings/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, action: "setup" }),
      })
      const json = await res.json()
      if (debugOn) setDebugInfo({ step: "totpSetup", status: res.status, ok: res.ok, json })
      if (!json?.ok) throw new Error(json?.error || "Không tạo được 2FA")
      setTotpSecret(json.secret || "")
      setTotpUri(json.uri || "")
      setBackupCodes(Array.isArray(json.backup_codes) ? json.backup_codes : [])
      setMessage({ type: "success", text: "Đã tạo mã 2FA. Nhập mã từ app Authenticator để bật." })
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Có lỗi xảy ra" })
    } finally {
      setLoading(false)
    }
  }

  async function handleTotpEnable() {
    if (!currentUserId) return
    if (!totpCode) {
      setMessage({ type: "error", text: "Vui lòng nhập mã 2FA (6 số)." })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/settings/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, action: "enable", code: totpCode }),
      })
      const json = await res.json()
      if (debugOn) setDebugInfo({ step: "totpEnable", status: res.status, ok: res.ok, json })
      if (!json?.ok) throw new Error(json?.error || "Bật 2FA thất bại")
      setTotpEnabled(true)
      setTotpCode("")
      setMessage({ type: "success", text: "Đã bật 2FA thành công!" })
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Có lỗi xảy ra" })
    } finally {
      setLoading(false)
    }
  }

  async function handleTotpDisable() {
    if (!currentUserId) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/settings/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, action: "disable" }),
      })
      const json = await res.json()
      if (debugOn) setDebugInfo({ step: "totpDisable", status: res.status, ok: res.ok, json })
      if (!json?.ok) throw new Error(json?.error || "Tắt 2FA thất bại")
      setTotpEnabled(false)
      setTotpSecret("")
      setTotpUri("")
      setBackupCodes([])
      setMessage({ type: "success", text: "Đã tắt 2FA." })
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Có lỗi xảy ra" })
    } finally {
      setLoading(false)
    }
  }

  // Loading / resolve guard
  if (authLoading || !resolved) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-[70vh]">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
        <BottomNav />
      </div>
    )
  }

  // If not logged in, keep behavior simple.
  if (!currentUserId) {
    router.push("/login")
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" asChild className="mr-2">
            <Link href="/account">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Cài đặt</h1>
        </div>

        {message && (
          <div
            className={`p-4 mb-6 rounded-lg ${
              message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Profile picture */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Camera className="mr-2 h-5 w-5" />
              Ảnh đại diện
            </CardTitle>
            <CardDescription>Cập nhật ảnh đại diện của bạn</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24 mb-4 rounded-full overflow-hidden bg-gray-200">
                {avatarUrl ? (
                  <Image src={avatarUrl || "/placeholder.svg"} alt="Avatar" fill className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <User className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="w-full max-w-xs">
                <Label htmlFor="avatar" className="cursor-pointer">
                  <div className="flex items-center justify-center w-full p-2 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50">
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    <span>{uploading ? "Đang tải lên..." : "Chọn ảnh"}</span>
                  </div>
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              Thông tin cá nhân
            </CardTitle>
            <CardDescription>Cập nhật thông tin cá nhân của bạn</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Họ và tên</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input id="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Địa chỉ</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Lưu thay đổi
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lock className="mr-2 h-5 w-5" />
              Đổi mật khẩu
            </CardTitle>
            <CardDescription>Chỉ áp dụng cho tài khoản đăng nhập bằng email</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Mật khẩu mới</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  disabled={!isEmailUser}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  disabled={!isEmailUser}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !isEmailUser}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Đổi mật khẩu
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 2FA / TOTP */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              Bảo mật 2 lớp (2FA)
            </CardTitle>
            <CardDescription>Bật 2FA/TOTP theo spec</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-700">
              Trạng thái: <span className="font-semibold">{totpEnabled ? "Đã bật" : "Chưa bật"}</span>
            </div>

            {!totpEnabled ? (
              <>
                <Button type="button" className="w-full" disabled={loading} onClick={handleTotpSetup}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                  Tạo mã 2FA
                </Button>

                {totpUri ? (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-700">
                      1) Mở app Authenticator → Add account → Scan QR / nhập secret.
                    </div>
                    <div className="p-3 rounded bg-gray-50 text-xs break-all">{totpSecret}</div>
                    <div className="text-sm text-gray-700">2) Nhập mã 6 số để bật:</div>
                    <Input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="Mã 2FA" />
                    <Button type="button" className="w-full" disabled={loading} onClick={handleTotpEnable}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Bật 2FA
                    </Button>
                    {backupCodes?.length > 0 && (
                      <div className="text-xs text-gray-700">
                        Backup codes (lưu lại):
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {backupCodes.map((c) => (
                            <div key={c} className="p-2 rounded bg-gray-50 font-mono">
                              {c}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <Button type="button" variant="destructive" className="w-full" disabled={loading} onClick={handleTotpDisable}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                Tắt 2FA
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Debug panel (Pi Browser has no console) */}
        {debugOn && (
          <Card className="mb-24">
            <CardHeader>
              <CardTitle>DEBUG</CardTitle>
              <CardDescription>Chụp màn hình gửi lại để mình đọc log (dbg=1)</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs whitespace-pre-wrap break-all bg-gray-50 p-3 rounded">
                {JSON.stringify(
                  {
                    currentUserId,
                    piUsername,
                    userType: user?.type,
                    totpEnabled,
                    debugInfo,
                  },
                  null,
                  2,
                )}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
