"use client"

import type React from "react"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useAuth } from "@/lib/auth-context"
import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Upload, User, Lock, Camera, Save, ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"

const STORAGE_KEYS = ["pitodo_pi_user", "pi_user", "current_user"]

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [piUsername, setPiUsername] = useState<string | null>(null)

  // Form data
  const [fullName, setFullName] = useState("")
  const [address, setAddress] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")

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
        } catch (e) {
          continue
        }
      }
    }

    setCurrentUserId(foundUserId)
    setPiUsername(foundUsername)

    if (foundUserId) {
      loadUserData(foundUserId)
    }
  }, [user, authLoading])

  async function loadUserData(userId: string) {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from("pi_users")
        .select("full_name, address, phone_number, avatar_url")
        .eq("id", userId)
        .single()

      if (error) throw error

      if (data) {
        setFullName(data.full_name || "")
        setAddress(data.address || "")
        setPhoneNumber(data.phone_number || "")
        setAvatarUrl(data.avatar_url || "")
      }
    } catch (error) {
      console.error("Error loading user data:", error)
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUserId) return

    setLoading(true)
    setMessage(null)

    try {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from("pi_users")
        .update({
          full_name: fullName,
          address: address,
          phone_number: phoneNumber,
        })
        .eq("id", currentUserId)

      if (error) throw error

      setMessage({ type: "success", text: "Cập nhật thông tin thành công!" })
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Có lỗi xảy ra" })
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUserId) return

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
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      setMessage({ type: "success", text: "Thay đổi mật khẩu thành công!" })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Có lỗi xảy ra khi đổi mật khẩu" })
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
      const supabase = createBrowserClient()
      const fileExt = file.name.split(".").pop()
      const fileName = `${currentUserId}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage.from("user-uploads").upload(filePath, file, {
        upsert: true,
      })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from("user-uploads").getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from("pi_users")
        .update({ avatar_url: publicUrl })
        .eq("id", currentUserId)

      if (updateError) throw updateError

      setAvatarUrl(publicUrl)
      setMessage({ type: "success", text: "Cập nhật ảnh đại diện thành công!" })
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Có lỗi xảy ra khi tải ảnh lên" })
    } finally {
      setUploading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
        <Header />
        <main className="container px-4 py-6 max-w-lg mx-auto flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!currentUserId) {
    router.push("/login")
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
      <Header />
      <main className="container px-4 py-6 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/account">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-purple-800">Cài đặt tài khoản</h1>
        </div>

        {message && (
          <div
            className={`p-4 rounded-xl ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Avatar Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Ảnh đại diện
            </CardTitle>
            <CardDescription>Cập nhật ảnh đại diện của bạn</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="h-24 w-24 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold">
                  {avatarUrl ? (
                    <Image src={avatarUrl || "/placeholder.svg"} alt="Avatar" fill className="object-cover" />
                  ) : (
                    piUsername?.charAt(0).toUpperCase() || "U"
                  )}
                </div>
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors">
                    <Upload className="h-4 w-4" />
                    Tải ảnh lên
                  </div>
                </Label>
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <p className="text-xs text-gray-500 mt-2">JPG, PNG hoặc GIF (tối đa 5MB)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Thông tin cá nhân
            </CardTitle>
            <CardDescription>Cập nhật thông tin cá nhân của bạn</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <Label htmlFor="username">Tên người dùng</Label>
                <Input id="username" value={piUsername || ""} disabled className="bg-gray-100" />
                <p className="text-xs text-gray-500 mt-1">Tên người dùng không thể thay đổi</p>
              </div>

              <div>
                <Label htmlFor="fullName">Tên thật</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập tên đầy đủ của bạn"
                />
              </div>

              <div>
                <Label htmlFor="address">Địa chỉ</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Nhập địa chỉ của bạn"
                />
              </div>

              <div>
                <Label htmlFor="phoneNumber">Số điện thoại</Label>
                <Input
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+84"
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Lưu thay đổi
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Thay đổi mật khẩu
            </CardTitle>
            <CardDescription>Cập nhật mật khẩu đăng nhập của bạn</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <Label htmlFor="newPassword">Mật khẩu mới</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>

              <Button type="submit" disabled={loading || !newPassword || !confirmPassword} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang thay đổi...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Đổi mật khẩu
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <BottomNav />
    </div>
  )
}
