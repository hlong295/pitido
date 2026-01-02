"use client"

import { useState, useEffect, useMemo } from "react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Edit2, Eye, EyeOff, AlertCircle, Search } from "lucide-react"
import Link from "next/link"
import { createBrowserClient } from "@/lib/supabase/client"

type ProductRow = Record<string, any>

export default function ProviderProductsPage() {
  const { t } = useLanguage()
  const { user, isAdmin } = useAuth()

  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const supabase = createBrowserClient()

  const isProvider = (user as any)?.role === "provider" || isAdmin()

  useEffect(() => {
    if (!user) return
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const loadProducts = async () => {
    if (!user) return
    setLoading(true)
    try {
      // Provider only sees & manages their own products
      let query = supabase.from("products").select("*").order("created_at", { ascending: false })

      if (!isAdmin()) {
        query = query.eq("provider_id", (user as any)?.piUserId || (user as any).uid)
      }

      const { data, error } = await query
      if (error) throw error

      const formatted = (data || []).map((p: any) => {
        let imageUrl = p.image_url
        if (!imageUrl && p.media_urls && Array.isArray(p.media_urls) && p.media_urls.length > 0) imageUrl = p.media_urls[0]
        if (!imageUrl && p.thumbnail) imageUrl = p.thumbnail
        if (!imageUrl) imageUrl = `/placeholder.svg?height=200&width=200&query=${encodeURIComponent(p.name || "product")}`
        return { ...p, _imageUrl: imageUrl }
      })

      setProducts(formatted)
    } catch (e) {
      console.error("Error loading provider products:", e)
      setMessage({ type: "error", text: "Không thể tải danh sách bài đăng" })
    } finally {
      setLoading(false)
    }
  }

  const toggleVisibility = async (productId: string, nextActive: boolean) => {
    try {
      // Provider can only update their own records
      let q = supabase.from("products").update({ is_active: nextActive, active: nextActive }).eq("id", productId)
      if (!isAdmin() && user) q = q.eq("provider_id", (user as any)?.piUserId || (user as any).uid)

      const { error } = await q
      if (error) throw error

      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, is_active: nextActive, active: nextActive } : p)))
    } catch (e) {
      console.error("Error toggling product visibility:", e)
      setMessage({ type: "error", text: "Không thể cập nhật trạng thái" })
      setTimeout(() => setMessage(null), 2500)
    }
  }

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => String(p.name || p.title || "").toLowerCase().includes(q) || String(p.id || "").toLowerCase().includes(q))
  }, [products, searchQuery])

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 pb-20">
        <Header />
        <main className="container px-4 py-6 max-w-2xl mx-auto">
          <Alert className="rounded-2xl border-purple-200 bg-purple-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Bạn cần đăng nhập để sử dụng chức năng này.</AlertDescription>
          </Alert>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!isProvider) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 pb-20">
        <Header />
        <main className="container px-4 py-6 max-w-2xl mx-auto">
          <Alert className="rounded-2xl border-purple-200 bg-purple-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Bạn chưa được duyệt nhà cung cấp (Provider).</AlertDescription>
          </Alert>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 pb-20">
      <Header />
      <main className="container px-4 py-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-purple-900">Bài đăng của tôi</h1>
            <p className="text-purple-700 text-sm">Đăng bài & quản lý hàng hóa/dịch vụ của bạn</p>
          </div>

          <Link href="/provider/products/add">
            <Button className="rounded-xl bg-purple-600 hover:bg-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Đăng bài
            </Button>
          </Link>
        </div>

        {message && (
          <Alert className={`mb-4 rounded-2xl ${message.type === "error" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <Card className="rounded-2xl shadow-sm border-purple-100 mb-4">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên hoặc mã bài đăng..."
                className="pl-10 rounded-xl border-purple-200"
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card className="rounded-2xl shadow-sm border-purple-100">
            <CardContent className="p-6 text-center text-purple-700">Đang tải...</CardContent>
          </Card>
        ) : filteredProducts.length === 0 ? (
          <Card className="rounded-2xl shadow-sm border-purple-100">
            <CardContent className="p-6 text-center text-purple-700">Chưa có bài đăng nào.</CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((product) => {
              const active = product.is_active ?? product.active ?? true
              const pi = product.price_pi ?? product.pi_amount ?? null
              const pitd = product.price ?? product.pitd_amount ?? null
              return (
                <Card key={product.id} className="rounded-2xl shadow-sm border-purple-100 overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-purple-100 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product._imageUrl} alt={product.name || "product"} className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-purple-900 truncate">{product.name || product.title || "Sản phẩm"}</h3>
                            <p className="text-xs text-purple-600">Mã: {product.id}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={`rounded-full ${active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                                {active ? "Đang hiển thị" : "Đã ẩn"}
                              </Badge>
                              {(pi !== null || pitd !== null) && (
                                <span className="text-sm text-purple-700">
                                  {pi !== null ? `${Number(pi)} Pi` : ""}{pi !== null && pitd !== null ? " | " : ""}{pitd !== null ? `${Number(pitd)} PITD` : ""}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 items-end">
                            <Link href={`/provider/products/${product.id}/edit`}>
                              <Button size="sm" variant="outline" className="rounded-lg bg-transparent">
                                <Edit2 className="h-3.5 w-3.5 mr-1" />
                                Sửa
                              </Button>
                            </Link>

                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg bg-transparent"
                              onClick={() => toggleVisibility(product.id, !active)}
                            >
                              {active ? (
                                <>
                                  <EyeOff className="h-3.5 w-3.5 mr-1" />
                                  Ẩn
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  Hiện
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
