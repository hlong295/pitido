"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Shield,
  Package,
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle,
  Upload,
  X,
  VideoIcon,
  Zap,
  Eye,
  Star,
  Truck,
} from "lucide-react"
import Link from "next/link"
import { createBrowserClient } from "@/lib/supabase/client"

interface Category {
  id: string
  name: string
  name_vi: string
}

interface MediaFile {
  type: "image" | "video"
  url: string
  file: File | null
  id: string
  thumbnailUrl?: string
  thumbnailBlob?: Blob
}

const COLOR_OPTIONS = [
  { name: "Đỏ", value: "red", hex: "#ef4444" },
  { name: "Cam", value: "orange", hex: "#f97316" },
  { name: "Vàng", value: "yellow", hex: "#eab308" },
  { name: "Xanh lá", value: "green", hex: "#22c55e" },
  { name: "Xanh dương", value: "blue", hex: "#3b82f6" },
  { name: "Tím", value: "purple", hex: "#a855f7" },
  { name: "Hồng", value: "pink", hex: "#ec4899" },
  { name: "Nâu", value: "brown", hex: "#92400e" },
  { name: "Trắng", value: "white", hex: "#ffffff" },
  { name: "Đen", value: "black", hex: "#000000" },
]

export default function EditProductPage() {
  const { t } = useLanguage()
  const { user, isAdmin, isProvider } = useAuth()
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string
  const supabase = createBrowserClient()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Media files
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [uploadingMedia, setUploadingMedia] = useState(false)

  // Form data - matching add product page
  const [formData, setFormData] = useState({
    name: "",
    shortDescription: "",
    description: "",
    piListedPrice: "",
    piDiscountPercent: "",
    pitdListedPrice: "",
    pitdDiscountPercent: "",
    categoryId: "",
    stockQuantity: "",
    isUnlimitedStock: false,
    isActive: true,
    isFeatured: false,
    // Weight
    weight: "",
    weightUnit: "g",
    // Dimensions
    dimensionLength: "",
    dimensionWidth: "",
    dimensionHeight: "",
    dimensionUnit: "cm",
    // Location
    storeLocation: "",
    // Flash Sale
    flashSaleEnabled: false,
    flashSaleStartDate: "",
    flashSaleEndDate: "",
    flashSalePiPrice: "",
    flashSalePitdPrice: "",
  })

  // Color options
  const [colorEnabled, setColorEnabled] = useState(false)
  const [selectedColors, setSelectedColors] = useState<string[]>([])

  // Weight toggle
  const [weightEnabled, setWeightEnabled] = useState(false)

  // Dimensions toggle
  const [dimensionsEnabled, setDimensionsEnabled] = useState(false)

  // Shipping
  const [shippingEnabled, setShippingEnabled] = useState(false)
  const [shippingFeeFree, setShippingFeeFree] = useState(false)
  const [shippingFee, setShippingFee] = useState("")
  const [deliveryTime, setDeliveryTime] = useState("")

  useEffect(() => {
    loadData()
  }, [productId])

  const loadData = async () => {
    try {
      // Load categories
      const { data: cats } = await supabase.from("categories").select("*").eq("is_active", true).order("display_order")
      setCategories(cats || [])

      // Load product with all fields
      const { data: product, error } = await supabase.from("products").select("*").eq("id", productId).single()

      if (error) throw error

      if (product) {
        // Parse dimensions if exists
        let dimL = "",
          dimW = "",
          dimH = ""
        if (product.dimensions) {
          const parts = product.dimensions.split("x")
          if (parts.length === 3) {
            dimL = parts[0]
            dimW = parts[1]
            dimH = parts[2]
          }
        }

        setFormData({
          name: product.name || "",
          shortDescription: product.short_description || "",
          description: product.description || "",
          piListedPrice: product.pi_listed_price?.toString() || product.pi_amount?.toString() || "",
          piDiscountPercent: product.pi_discount_percent?.toString() || "",
          pitdListedPrice:
            product.pitd_listed_price?.toString() || product.pitd_amount?.toString() || product.price?.toString() || "",
          pitdDiscountPercent: product.pitd_discount_percent?.toString() || "",
          categoryId: product.category_id || "",
          stockQuantity: product.stock_quantity?.toString() || "0",
          isUnlimitedStock: product.is_unlimited_stock || false,
          isActive: product.is_active ?? true,
          isFeatured: product.is_featured || false,
          weight: product.weight?.toString() || "",
          weightUnit: product.weight_unit || "g",
          dimensionLength: dimL,
          dimensionWidth: dimW,
          dimensionHeight: dimH,
          dimensionUnit: product.dimension_unit || "cm",
          storeLocation: product.store_location || "",
          flashSaleEnabled: product.flash_sale_enabled || false,
          flashSaleStartDate: product.flash_sale_start_date ? product.flash_sale_start_date.substring(0, 16) : "",
          flashSaleEndDate: product.flash_sale_end_date ? product.flash_sale_end_date.substring(0, 16) : "",
          flashSalePiPrice: product.flash_sale_pi_price?.toString() || "",
          flashSalePitdPrice: product.flash_sale_pitd_price?.toString() || "",
        })

        // Set color options
        if (product.colors && Array.isArray(product.colors) && product.colors.length > 0) {
          setColorEnabled(true)
          setSelectedColors(product.colors)
        }

        // Set weight
        if (product.weight) {
          setWeightEnabled(true)
        }

        // Set dimensions
        if (product.dimensions) {
          setDimensionsEnabled(true)
        }

        // Set shipping
        if (product.shipping_fee !== null || product.delivery_time) {
          setShippingEnabled(true)
          setShippingFeeFree(product.shipping_fee === 0)
          setShippingFee(product.shipping_fee?.toString() || "")
          setDeliveryTime(product.delivery_time || "")
        }

        // Load media files
        if (product.media && Array.isArray(product.media)) {
          setMediaFiles(
            product.media.map((m: any, idx: number) => ({
              type: m.type || "image",
              url: m.url,
              file: null,
              id: `existing-${idx}`,
              thumbnailUrl: m.thumbnail_url,
            })),
          )
        } else if (product.image_url) {
          setMediaFiles([
            {
              type: "image",
              url: product.image_url,
              file: null,
              id: "existing-0",
            },
          ])
        }
      }
    } catch (error) {
      console.error("Error loading data:", error)
      setMessage({ type: "error", text: "Không thể tải thông tin sản phẩm" })
    } finally {
      setLoading(false)
    }
  }

  const handleMediaUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])

      for (const file of files) {
        const fileId = `${Date.now()}-${Math.random()}`

        if (file.type.startsWith("image/")) {
          if (mediaFiles.filter((m) => m.type === "image").length >= 10) {
            alert("Chỉ có thể tải lên tối đa 10 ảnh")
            continue
          }
          const url = URL.createObjectURL(file)
          setMediaFiles((prev) => [...prev, { type: "image", url, file, id: fileId }])
        } else if (file.type.startsWith("video/")) {
          if (mediaFiles.find((m) => m.type === "video")) {
            alert("Chỉ có thể tải lên tối đa 1 video")
            continue
          }
          const url = URL.createObjectURL(file)
          setMediaFiles((prev) => [...prev, { type: "video", url, file, id: fileId }])
        }
      }
      e.target.value = ""
    },
    [mediaFiles],
  )

  const removeMedia = (id: string) => {
    setMediaFiles((prev) => prev.filter((m) => m.id !== id))
  }

  const toggleColor = (colorValue: string) => {
    if (selectedColors.includes(colorValue)) {
      setSelectedColors(selectedColors.filter((c) => c !== colorValue))
    } else {
      setSelectedColors([...selectedColors, colorValue])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      if (!formData.name) {
        throw new Error("Vui lòng nhập tên sản phẩm")
      }

      // Upload new media files
      const uploadedMedia: any[] = []

      for (const media of mediaFiles) {
        if (media.file) {
          // New file - upload to storage
          const fileExt = media.file.name.split(".").pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
          const filePath = `products/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from("product-media")
            .upload(filePath, media.file, { cacheControl: "3600", upsert: false })

          if (uploadError) throw uploadError

          const {
            data: { publicUrl },
          } = supabase.storage.from("product-media").getPublicUrl(filePath)

          uploadedMedia.push({
            type: media.type,
            url: publicUrl,
            display_order: uploadedMedia.length,
          })
        } else {
          // Existing file - keep the URL
          uploadedMedia.push({
            type: media.type,
            url: media.url,
            thumbnail_url: media.thumbnailUrl,
            display_order: uploadedMedia.length,
          })
        }
      }

      const piPrice = Number.parseFloat(formData.piListedPrice) || 0
      const pitdPrice = Number.parseFloat(formData.pitdListedPrice) || 0

      const updateData: any = {
        name: formData.name,
        short_description: formData.shortDescription,
        description: formData.description,
        pi_listed_price: piPrice,
        pi_amount: piPrice,
        pi_discount_percent: Number.parseFloat(formData.piDiscountPercent) || 0,
        pitd_listed_price: pitdPrice,
        pitd_amount: pitdPrice,
        pitd_discount_percent: Number.parseFloat(formData.pitdDiscountPercent) || 0,
        price: pitdPrice || piPrice,
        currency: pitdPrice > 0 ? "PITD" : "Pi",
        category_id: formData.categoryId || null,
        stock_quantity: formData.isUnlimitedStock ? 999999 : Number.parseInt(formData.stockQuantity) || 0,
        is_unlimited_stock: formData.isUnlimitedStock,
        is_active: formData.isActive,
        is_featured: formData.isFeatured,
        store_location: formData.storeLocation || null,
        // Colors
        colors: colorEnabled ? selectedColors : null,
        // Weight
        weight: weightEnabled ? Number.parseFloat(formData.weight) : null,
        weight_unit: weightEnabled ? formData.weightUnit : null,
        // Dimensions
        dimensions:
          dimensionsEnabled && formData.dimensionLength && formData.dimensionWidth && formData.dimensionHeight
            ? `${formData.dimensionLength}x${formData.dimensionWidth}x${formData.dimensionHeight}`
            : null,
        dimension_unit: dimensionsEnabled ? formData.dimensionUnit : null,
        // Shipping
        shipping_fee: shippingEnabled ? (shippingFeeFree ? 0 : Number.parseFloat(shippingFee) || null) : null,
        delivery_time: shippingEnabled && deliveryTime ? deliveryTime : null,
        // Flash Sale
        flash_sale_enabled: formData.flashSaleEnabled,
        flash_sale_start_date:
          formData.flashSaleEnabled && formData.flashSaleStartDate
            ? new Date(formData.flashSaleStartDate).toISOString()
            : null,
        flash_sale_end_date:
          formData.flashSaleEnabled && formData.flashSaleEndDate
            ? new Date(formData.flashSaleEndDate).toISOString()
            : null,
        flash_sale_pi_price: formData.flashSaleEnabled ? Number.parseFloat(formData.flashSalePiPrice) || null : null,
        flash_sale_pitd_price: formData.flashSaleEnabled
          ? Number.parseFloat(formData.flashSalePitdPrice) || null
          : null,
        // Media
        media: uploadedMedia,
        image_url: uploadedMedia.find((m) => m.type === "image")?.url || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from("products").update(updateData).eq("id", productId)

      if (error) throw error

      setMessage({ type: "success", text: "Đã cập nhật sản phẩm!" })
      setTimeout(() => router.push("/admin/products"), 1500)
    } catch (error: any) {
      console.error("Error updating product:", error)
      setMessage({ type: "error", text: error.message || "Không thể cập nhật sản phẩm" })
    } finally {
      setSaving(false)
    }
  }

  if (!user || (!isAdmin() && !isProvider())) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 pb-20">
        <Header />
        <main className="container px-4 py-6">
          <Card className="p-12 rounded-2xl shadow-md">
            <div className="text-center space-y-4">
              <Shield className="h-16 w-16 text-purple-500 mx-auto" />
              <h3 className="text-xl font-bold">{t("adminOnly")}</h3>
            </div>
          </Card>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-purple-50 pb-20">
        <Header />
        <main className="container px-4 py-6 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-gray-600">Đang tải...</p>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-purple-50 pb-20">
      <Header />
      <main className="container px-4 py-6 max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin/products">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-purple-700">Sửa sản phẩm</h1>
          </div>
        </div>

        {/* Message */}
        {message && (
          <Alert
            className={`rounded-xl ${message.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={message.type === "success" ? "text-green-700" : "text-red-700"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <Card className="rounded-2xl shadow-sm bg-white/70 backdrop-blur">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-purple-700">Thông tin cơ bản</h3>

              <div className="space-y-2">
                <Label htmlFor="name">Tên sản phẩm *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shortDescription">Mô tả ngắn</Label>
                <Input
                  id="shortDescription"
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  className="rounded-xl"
                  placeholder="Mô tả ngắn gọn về sản phẩm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Mô tả chi tiết</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="rounded-xl min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Danh mục</Label>
                <Select value={formData.categoryId} onValueChange={(v) => setFormData({ ...formData, categoryId: v })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Chọn danh mục" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {getCategoryLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeLocation">Địa điểm cửa hàng</Label>
                <Input
                  id="storeLocation"
                  value={formData.storeLocation}
                  onChange={(e) => setFormData({ ...formData, storeLocation: e.target.value })}
                  className="rounded-xl"
                  placeholder="VD: Hà Nội, Việt Nam"
                />
              </div>
            </CardContent>
          </Card>

          {/* Media */}
          <Card className="rounded-2xl shadow-sm bg-white/70 backdrop-blur">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-purple-700">Hình ảnh & Video</h3>

              <div className="grid grid-cols-4 gap-2">
                {mediaFiles.map((media) => (
                  <div key={media.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    {media.type === "image" ? (
                      <img src={media.url || "/placeholder.svg"} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200">
                        <VideoIcon className="h-8 w-8 text-gray-500" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(media.id)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-purple-400">
                  <Upload className="h-6 w-6 text-gray-400" />
                  <span className="text-xs text-gray-500 mt-1">Thêm</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleMediaUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500">Tối đa 10 ảnh và 1 video</p>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card className="rounded-2xl shadow-sm bg-white/70 backdrop-blur">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-purple-700">Giá bán</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Giá Pi</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={formData.piListedPrice}
                    onChange={(e) => setFormData({ ...formData, piListedPrice: e.target.value })}
                    className="rounded-xl"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Giảm giá Pi (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.piDiscountPercent}
                    onChange={(e) => setFormData({ ...formData, piDiscountPercent: e.target.value })}
                    className="rounded-xl"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Giá PITD</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={formData.pitdListedPrice}
                    onChange={(e) => setFormData({ ...formData, pitdListedPrice: e.target.value })}
                    className="rounded-xl"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Giảm giá PITD (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.pitdDiscountPercent}
                    onChange={(e) => setFormData({ ...formData, pitdDiscountPercent: e.target.value })}
                    className="rounded-xl"
                    placeholder="0"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stock */}
          <Card className="rounded-2xl shadow-sm bg-white/70 backdrop-blur">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-purple-700">Kho hàng</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Số lượng tồn kho</Label>
                  <Input
                    type="number"
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                    className="rounded-xl"
                    disabled={formData.isUnlimitedStock}
                  />
                </div>
                <div className="flex items-center gap-3 pt-8">
                  <Switch
                    checked={formData.isUnlimitedStock}
                    onCheckedChange={(v) => setFormData({ ...formData, isUnlimitedStock: v })}
                  />
                  <Label>Không giới hạn</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card className="rounded-2xl shadow-sm bg-white/70 backdrop-blur">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-purple-700">Màu sắc</h3>
                <Switch checked={colorEnabled} onCheckedChange={setColorEnabled} />
              </div>

              {colorEnabled && (
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => toggleColor(color.value)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all ${
                        selectedColors.includes(color.value) ? "border-purple-500 bg-purple-50" : "border-gray-200"
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: color.hex }} />
                      <span className="text-sm">{color.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weight */}
          <Card className="rounded-2xl shadow-sm bg-white/70 backdrop-blur">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-purple-700">Cân nặng</h3>
                <Switch checked={weightEnabled} onCheckedChange={setWeightEnabled} />
              </div>

              {weightEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Khối lượng</Label>
                    <Input
                      type="number"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Đơn vị</Label>
                    <Select
                      value={formData.weightUnit}
                      onValueChange={(v) => setFormData({ ...formData, weightUnit: v })}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="g">gram (g)</SelectItem>
                        <SelectItem value="kg">kilogram (kg)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dimensions */}
          <Card className="rounded-2xl shadow-sm bg-white/70 backdrop-blur">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-purple-700">Kích thước</h3>
                <Switch checked={dimensionsEnabled} onCheckedChange={setDimensionsEnabled} />
              </div>

              {dimensionsEnabled && (
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-2">
                    <Label>Dài</Label>
                    <Input
                      type="number"
                      value={formData.dimensionLength}
                      onChange={(e) => setFormData({ ...formData, dimensionLength: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rộng</Label>
                    <Input
                      type="number"
                      value={formData.dimensionWidth}
                      onChange={(e) => setFormData({ ...formData, dimensionWidth: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cao</Label>
                    <Input
                      type="number"
                      value={formData.dimensionHeight}
                      onChange={(e) => setFormData({ ...formData, dimensionHeight: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Đơn vị</Label>
                    <Select
                      value={formData.dimensionUnit}
                      onValueChange={(v) => setFormData({ ...formData, dimensionUnit: v })}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cm">cm</SelectItem>
                        <SelectItem value="m">m</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping */}
          <Card className="rounded-2xl shadow-sm bg-white/70 backdrop-blur">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-purple-500" />
                  <h3 className="font-semibold text-purple-700">Vận chuyển</h3>
                </div>
                <Switch checked={shippingEnabled} onCheckedChange={setShippingEnabled} />
              </div>

              {shippingEnabled && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch checked={shippingFeeFree} onCheckedChange={setShippingFeeFree} />
                    <Label>Miễn phí vận chuyển</Label>
                  </div>

                  {!shippingFeeFree && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Phí vận chuyển</Label>
                        <Input
                          type="number"
                          value={shippingFee}
                          onChange={(e) => setShippingFee(e.target.value)}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Thời gian giao hàng</Label>
                    <Input
                      type="text"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="rounded-xl"
                      placeholder="VD: 2-3 ngày"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Flash Sale */}
          <Card className="rounded-2xl shadow-sm bg-white/70 backdrop-blur">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                  <h3 className="font-semibold text-orange-600">Flash Sale</h3>
                </div>
                <Switch
                  checked={formData.flashSaleEnabled}
                  onCheckedChange={(v) => setFormData({ ...formData, flashSaleEnabled: v })}
                />
              </div>

              {formData.flashSaleEnabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bắt đầu</Label>
                      <Input
                        type="datetime-local"
                        value={formData.flashSaleStartDate}
                        onChange={(e) => setFormData({ ...formData, flashSaleStartDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kết thúc</Label>
                      <Input
                        type="datetime-local"
                        value={formData.flashSaleEndDate}
                        onChange={(e) => setFormData({ ...formData, flashSaleEndDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Giá Flash Sale (Pi)</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={formData.flashSalePiPrice}
                        onChange={(e) => setFormData({ ...formData, flashSalePiPrice: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Giá Flash Sale (PITD)</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={formData.flashSalePitdPrice}
                        onChange={(e) => setFormData({ ...formData, flashSalePitdPrice: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visibility */}
          <Card className="rounded-2xl shadow-sm bg-white/70 backdrop-blur">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-purple-700">Hiển thị</h3>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                  />
                  <Label className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    Hiển thị
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isFeatured}
                    onCheckedChange={(v) => setFormData({ ...formData, isFeatured: v })}
                  />
                  <Label className="flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    Nổi bật
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button
            type="submit"
            disabled={saving || !formData.name}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl h-12"
          >
            {saving ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                Cập nhật sản phẩm
              </>
            )}
          </Button>
        </form>
      </main>
      <BottomNav />
    </div>
  )
}  const getCategoryLabel = (cat: Category) => {
    const vi = (cat.name_vi || "").trim()
    const en = (cat.name || "").trim().toLowerCase()
    // Fix: category label mismatch (Voucher-Mã should display as Thời trang)
    if (vi === "Voucher-Mã" || vi === "Voucher - Mã" || vi === "Voucher" || en === "voucher" || en === "voucher-ma" || en === "voucher_code") {
      return "Thời trang"
    }
    return cat.name_vi || cat.name
  }
