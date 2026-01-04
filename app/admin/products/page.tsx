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
import {
  Shield,
  Package,
  Search,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  AlertCircle,
  CheckCircle,
  User,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { createBrowserClient } from "@/lib/supabase/client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Product {
  id: string
  name: string
  description: string
  price: number
  currency: string
  provider_id: string
  provider_name?: string
  category_id: string
  category_name?: string
  is_active: boolean
  stock_quantity: number
  total_sold: number
  image_url?: string
  created_at: string
  flash_sale_enabled?: boolean
  flash_sale_end_date?: string
}

export default function AdminProductsPage() {
  const { t } = useLanguage()
  const { user, isAdmin, isProvider } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "hidden">("all")
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [currentUserDbId, setCurrentUserDbId] = useState<string | null>(null)

  const supabase = createBrowserClient()

  useEffect(() => {
    loadProducts()
    if (user) {
      loadCurrentUserDbId()
    }
  }, [user])

  const loadCurrentUserDbId = async () => {
    if (!user) return

    try {
      if (user.type === "pi") {
        const { data, error } = await supabase.from("pi_users").select("id").eq("pi_uid", user.uid).single()

        if (!error && data) {
          setCurrentUserDbId(data.id)
        }
      } else {
        setCurrentUserDbId(user.uid)
      }
    } catch (error) {
      console.error("Error loading user db id:", error)
    }
  }

  const loadProducts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false })

      if (error) {
        console.error("Products query error:", error)
        throw error
      }

      const formattedProducts = (data || []).map((p: any) => {
        let imageUrl = p.image_url
        if (!imageUrl && p.media) {
          if (Array.isArray(p.media) && p.media.length > 0) {
            const firstImage = p.media.find((m: any) => m.type === "image" && m.url && !m.url.startsWith("blob:"))
            imageUrl = firstImage?.url
          }
        }

        if (!imageUrl || imageUrl.startsWith("blob:")) {
          imageUrl = `/placeholder.svg?height=80&width=80&query=${encodeURIComponent(p.name || "product")}`
        }

        return {
          ...p,
          name: p.name || "Untitled Product",
          description: p.short_description || p.description || "",
          price: p.price || p.pi_amount || p.pitd_amount || 0,
          currency: p.currency || "PITD",
          provider_id: p.provider_id,
          provider_name: p.provider_name || "Unknown",
          category_id: p.category_id,
          category_name: p.category_name || "Uncategorized",
          is_active: p.is_active !== undefined ? p.is_active : true,
          stock_quantity: p.stock_quantity || 0,
          total_sold: p.total_sold || 0,
          image_url: imageUrl,
          created_at: p.created_at,
          flash_sale_enabled: p.flash_sale_enabled || false,
          flash_sale_end_date: p.flash_sale_end_date,
        }
      })

      setProducts(formattedProducts)
    } catch (error) {
      console.error("Error loading products:", error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const toggleProductVisibility = async (productId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq("id", productId)

      if (error) throw error

      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, is_active: !currentStatus } : p)))

      setActionMessage({
        type: "success",
        text: !currentStatus ? "Đã hiển thị sản phẩm" : "Đã ẩn sản phẩm",
      })
      setTimeout(() => setActionMessage(null), 3000)
    } catch (error) {
      console.error("Error toggling product:", error)
      setActionMessage({ type: "error", text: "Không thể cập nhật sản phẩm" })
    }
  }

  const deleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase.from("products").delete().eq("id", productId)

      if (error) throw error

      setProducts((prev) => prev.filter((p) => p.id !== productId))
      setDeleteProductId(null)
      setActionMessage({ type: "success", text: "Đã xóa sản phẩm" })
      setTimeout(() => setActionMessage(null), 3000)
    } catch (error) {
      console.error("Error deleting product:", error)
      setActionMessage({ type: "error", text: "Không thể xóa sản phẩm" })
    }
  }

  const isFlashSaleActive = (product: Product) => {
    return product.flash_sale_enabled === true
  }

  const getFilteredProducts = () => {
    let filtered = products

    // If not admin, only show user's own products
    if (!isAdmin() && currentUserDbId) {
      filtered = products.filter((p) => p.provider_id === currentUserDbId)
    }

    // Apply search and status filters
    return filtered.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.provider_name?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter =
        filterStatus === "all" ||
        (filterStatus === "active" && p.is_active) ||
        (filterStatus === "hidden" && !p.is_active)
      return matchesSearch && matchesFilter
    })
  }

  const filteredProducts = getFilteredProducts()

  if (!user || (!isAdmin() && !isProvider())) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 pb-20">
        <Header />
        <main className="container px-4 py-6">
          <Card className="p-12 rounded-2xl shadow-md">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Shield className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-purple-600">{t("adminOnly")}</h3>
              <p className="text-gray-600">Trang này chỉ dành cho admin hoặc nhà cung cấp</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-purple-50 pb-20">
      <Header />
      <main className="container px-4 py-6 max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-purple-700">Quản lý sản phẩm</h1>
              <p className="text-sm text-gray-600">{filteredProducts.length} sản phẩm</p>
            </div>
          </div>
          <Link href="/admin/products/add">
            <Button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl">
              <Plus className="h-4 w-4 mr-2" />
              Thêm mới
            </Button>
          </Link>
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
            </AlertDescription>
          </Alert>
        )}

        {/* Search and Filter */}
        <Card className="rounded-2xl shadow-sm bg-white/60 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Tìm theo tên sản phẩm hoặc nhà cung cấp..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl border-gray-200"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterStatus === "all" ? "default" : "outline"}
                  onClick={() => setFilterStatus("all")}
                  className={`rounded-xl ${filterStatus === "all" ? "bg-purple-500" : ""}`}
                >
                  Tất cả
                </Button>
                <Button
                  variant={filterStatus === "active" ? "default" : "outline"}
                  onClick={() => setFilterStatus("active")}
                  className={`rounded-xl ${filterStatus === "active" ? "bg-green-500" : ""}`}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Hiển thị
                </Button>
                <Button
                  variant={filterStatus === "hidden" ? "default" : "outline"}
                  onClick={() => setFilterStatus("hidden")}
                  className={`rounded-xl ${filterStatus === "hidden" ? "bg-gray-500" : ""}`}
                >
                  <EyeOff className="h-4 w-4 mr-1" />
                  Đã ẩn
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-gray-600">Đang tải...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card className="rounded-2xl shadow-sm bg-white/60">
            <CardContent className="p-12 text-center">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600">Không có sản phẩm</h3>
              <p className="text-gray-500 mt-2">
                {isAdmin() ? "Chưa có sản phẩm nào trong hệ thống" : "Bạn chưa có sản phẩm nào"}
              </p>
              <Link href="/admin/products/add">
                <Button className="mt-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl">
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm sản phẩm đầu tiên
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className={`rounded-xl shadow-sm transition-all ${!product.is_active ? "opacity-60" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 relative">
                      <img
                        src={product.image_url || "/diverse-products-still-life.png"}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                      {isFlashSaleActive(product) && (
                        <div className="absolute top-1 left-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                          <Zap className="h-3 w-3" />
                          <span>Flash</span>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm line-clamp-1">{product.name}</h3>
                        <div className="flex gap-1 flex-shrink-0">
                          {isFlashSaleActive(product) && (
                            <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 text-[10px]">
                              <Zap className="h-3 w-3 mr-0.5" />
                              Flash Sale
                            </Badge>
                          )}
                          <Badge variant={product.is_active ? "default" : "secondary"}>
                            {product.is_active ? "Hiển thị" : "Đã ẩn"}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <User className="h-3 w-3" />
                        <span>{product.provider_name}</span>
                        <span>•</span>
                        <span>{product.category_name}</span>
                      </div>

                      <div className="flex items-center gap-4 mt-2">
                        <div className="text-base font-bold text-purple-600">
                          {product.price} {product.currency || "PITD"}
                        </div>
                        <div className="text-xs text-gray-500">
                          Đã bán: {product.total_sold} • Tồn: {product.stock_quantity}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <Link href={`/admin/products/${product.id}/edit`}>
                        <Button size="sm" variant="outline" className="w-full rounded-lg bg-transparent">
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg bg-transparent"
                        onClick={() => toggleProductVisibility(product.id, product.is_active)}
                      >
                        {product.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 bg-transparent"
                        onClick={() => setDeleteProductId(product.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteProductId} onOpenChange={() => setDeleteProductId(null)}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa sản phẩm</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn xóa sản phẩm này? Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Hủy</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-500 hover:bg-red-600 rounded-xl"
                onClick={() => deleteProductId && deleteProduct(deleteProductId)}
              >
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
      <BottomNav />
    </div>
  )
}
