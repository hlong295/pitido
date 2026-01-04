"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Shield,
  Package,
  Upload,
  X,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  ImageIcon,
  VideoIcon,
  Zap,
  Eye,
  Star,
  Truck,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"

interface Category {
  id: string
  name: string
  name_vi: string
}

interface Provider {
  id: string
  pi_username: string
  provider_business_name: string | null
}

interface MediaFile {
  type: "image" | "video"
  url: string
  file: File | null
  id: string
  thumbnailUrl?: string
  thumbnailBlob?: Blob // Added for video thumbnails
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

export default function AddProductPage() {
  const { t } = useLanguage()
  const { user, isAdmin } = useAuth()
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [currentUserDbId, setCurrentUserDbId] = useState<string | null>(null)

  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

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
    providerId: "",
    isActive: true,
    isFeatured: false,
    // Added for new fields
    weight: "",
    weightUnit: "g",
    dimensionLength: "",
    dimensionWidth: "",
    dimensionHeight: "",
    dimensionUnit: "cm",
    storeLocation: "",
    flashSaleEnabled: false,
    flashSaleStartDate: "",
    flashSaleEndDate: "",
    flashSalePiPrice: "",
    flashSalePitdPrice: "",
  })

  const [colorEnabled, setColorEnabled] = useState(false)
  const [selectedColors, setSelectedColors] = useState<string[]>([])

  const [weightEnabled, setWeightEnabled] = useState(false)
  // const [weightValue, setWeightValue] = useState("") // Moved to formData
  // const [weightUnit, setWeightUnit] = useState("kg") // Moved to formData

  const [dimensionsEnabled, setDimensionsEnabled] = useState(false)
  // const [dimensionLength, setDimensionLength] = useState("") // Moved to formData
  // const [dimensionWidth, setDimensionWidth] = useState("") // Moved to formData
  // const [dimensionHeight, setDimensionHeight] = useState("") // Moved to formData
  // const [dimensionUnit, setDimensionUnit] = useState("cm") // Moved to formData

  const [sizeEnabled, setSizeEnabled] = useState(false)
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])

  const [shippingEnabled, setShippingEnabled] = useState(false)
  const [shippingFeeFree, setShippingFeeFree] = useState(false)
  const [shippingFee, setShippingFee] = useState("")
  const [shippingFeeCurrency, setShippingFeeCurrency] = useState("Pi")
  const [shippingType, setShippingType] = useState("standard")
  const [estimatedDeliveryDays, setEstimatedDeliveryDays] = useState("")

  const supabase = createBrowserClient()

  useEffect(() => {
    loadCategories()
    loadProviders()
    loadCurrentUserDbId()
  }, [user])

    const getCategoryLabel = (cat: Category) => {
    const vi = (cat.name_vi || "").trim()
    const en = (cat.name || "").trim().toLowerCase()
    // Fix: database/category label mismatch (Voucher-Mã should display as Thời trang)
    if (vi === "Voucher-Mã" || vi === "Voucher - Mã" || vi === "Voucher" || en === "voucher" || en === "voucher-ma" || en === "voucher_code") {
      return "Thời trang"
    }
    return cat.name_vi || cat.name
  }

const loadCategories = async () => {
    try {
      const { data, error } = await supabase.from("categories").select("id, name, name_vi").order("name_vi")

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error("Error loading categories:", error)
    }
  }

  const loadProviders = async () => {
    try {
      const { data, error } = await supabase.from("pi_users").select("id, pi_username, provider_business_name")

      if (error) throw error
      setProviders(data || [])
    } catch (error) {
      console.error("Error loading providers:", error)
    }
  }

  const loadCurrentUserDbId = async () => {
    if (!user) return

    try {
      console.log("[v0] Loading current user DB ID for pi_uid:", user.uid)
      const { data, error } = await supabase.from("pi_users").select("id").eq("pi_uid", user.uid).single()

      if (error) {
        console.error("[v0] Error loading user DB ID:", error)
        return
      }

      if (data) {
        console.log("[v0] Found user DB ID:", data.id)
        setCurrentUserDbId(data.id)
        // Auto-set providerId to current user's DB ID
        setFormData((prev) => ({ ...prev, providerId: data.id }))
      }
    } catch (error) {
      console.error("[v0] Error in loadCurrentUserDbId:", error)
    }
  }

  const generateVideoThumbnail = (file: File): Promise<{ blob: Blob; url: string }> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video")
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        reject(new Error("Canvas context not available"))
        return
      }

      video.preload = "metadata"
      video.muted = true
      video.playsInline = true

      video.currentTime = 0.1

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        console.log("[v0] Video dimensions:", { width: video.videoWidth, height: video.videoHeight })
      }

      video.onseeked = () => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const thumbnailUrl = URL.createObjectURL(blob)
                console.log("[v0] Video thumbnail generated successfully")
                resolve({ blob, url: thumbnailUrl })
              } else {
                reject(new Error("Failed to create thumbnail blob"))
              }
            },
            "image/jpeg",
            0.8,
          )
        } catch (error) {
          console.error("[v0] Error drawing video frame:", error)
          reject(error)
        }
      }

      video.onerror = (error) => {
        console.error("[v0] Video load error:", error)
        reject(new Error("Failed to load video"))
      }

      video.src = URL.createObjectURL(file)
      video.load()
    })
  }

  const handleMediaUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      console.log("[v0] Media upload started:", files.length, "files")

      for (const file of files) {
        const fileId = `${Date.now()}-${Math.random()}`
        console.log("[v0] Processing file:", file.name, file.type, file.size)

        if (file.type.startsWith("image/")) {
          if (mediaFiles.filter((m) => m.type === "image").length >= 10) {
            console.log("[v0] Max images reached")
            alert("Chỉ có thể tải lên tối đa 10 ảnh")
            continue
          }

          const url = URL.createObjectURL(file)

          setMediaFiles((prev) => [
            ...prev,
            {
              type: "image",
              url,
              file,
              id: fileId,
            },
          ])

          // Simulate upload progress
          let progress = 0
          const interval = setInterval(() => {
            progress += 10
            if (progress >= 100) {
              clearInterval(interval)
              setUploadProgress((prev) => {
                const newProgress = { ...prev }
                delete newProgress[fileId]
                return newProgress
              })
            } else {
              setUploadProgress((prev) => ({ ...prev, [fileId]: progress }))
            }
          }, 100)
        } else if (file.type.startsWith("video/")) {
          if (mediaFiles.find((m) => m.type === "video")) {
            console.log("[v0] Max videos reached (1 video limit)")
            alert("Chỉ có thể tải lên tối đa 1 video")
            continue
          }

          console.log("[v0] Starting video upload:", file.name)
          setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }))

          try {
            const videoUrl = URL.createObjectURL(file)
            console.log("[v0] Video URL created:", videoUrl)

            let thumbnailUrl: string | undefined
            let thumbnailBlob: Blob | undefined

            try {
              const video = document.createElement("video")
              video.preload = "metadata"
              video.muted = true
              video.playsInline = true
              video.crossOrigin = "anonymous"
              video.src = videoUrl

              // Wait for video metadata to load
              await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                  console.log("[v0] Video metadata load timeout, continuing without thumbnail")
                  resolve()
                }, 5000)

                video.onloadeddata = () => {
                  clearTimeout(timeout)
                  console.log("[v0] Video data loaded, dimensions:", video.videoWidth, "x", video.videoHeight)
                  resolve()
                }

                video.onerror = (err) => {
                  clearTimeout(timeout)
                  console.error("[v0] Video load error:", err)
                  resolve() // Continue without thumbnail
                }

                video.load()
              })

              // Try to capture first frame
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                const canvas = document.createElement("canvas")
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight
                const ctx = canvas.getContext("2d")

                if (ctx) {
                  // Draw current frame (should be first frame after loadeddata)
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

                  const blob = await new Promise<Blob | null>((resolve) => {
                    canvas.toBlob(resolve, "image/jpeg", 0.8)
                  })

                  if (blob && blob.size > 0) {
                    thumbnailBlob = blob
                    thumbnailUrl = URL.createObjectURL(blob)
                    console.log("[v0] Thumbnail generated successfully, size:", blob.size)
                  } else {
                    console.log("[v0] Failed to create thumbnail blob")
                  }
                }
              } else {
                console.log("[v0] Video dimensions not available, skipping thumbnail")
              }
            } catch (err) {
              console.error("[v0] Thumbnail generation failed:", err)
            }
            // URL.revokeObjectURL(videoUrl) - removed to prevent thumbnail from disappearing

            setMediaFiles((prev) => [
              ...prev,
              {
                type: "video",
                url: videoUrl, // Use existing videoUrl for preview
                thumbnailUrl,
                thumbnailBlob, // Store the thumbnail blob
                file, // Ensure file object is stored for upload
                id: fileId,
              },
            ])

            console.log("[v0] Video added to media files with thumbnail:", !!thumbnailUrl)

            // Simulate upload progress
            let progress = 0
            const interval = setInterval(() => {
              progress += 5
              console.log("[v0] Video upload progress:", progress, "%")

              setUploadProgress((prev) => ({ ...prev, [fileId]: progress }))

              if (progress >= 100) {
                clearInterval(interval)
                console.log("[v0] Video upload complete")
                setTimeout(() => {
                  setUploadProgress((prev) => {
                    const newProgress = { ...prev }
                    delete newProgress[fileId]
                    return newProgress
                  })
                }, 500)
              }
            }, 200)
          } catch (error) {
            console.error("[v0] Video processing error:", error)
            alert("Không thể xử lý video. Vui lòng thử file khác.")
            setUploadProgress((prev) => {
              const newProgress = { ...prev }
              delete newProgress[fileId]
              return newProgress
            })
          }
        }
      }

      // Clear input
      e.target.value = ""
    },
    [mediaFiles],
  )

  const removeMedia = (id: string) => {
    setMediaFiles((prev) => prev.filter((m) => m.id !== id))
    const media = mediaFiles.find((m) => m.id === id)
    if (media) {
      if (media.url.startsWith("blob:")) {
        // Only revoke if it's a local URL
        URL.revokeObjectURL(media.url)
      }
      if (media.thumbnailUrl && media.thumbnailUrl.startsWith("blob:")) {
        URL.revokeObjectURL(media.thumbnailUrl)
      }
    }
  }

  const toggleColor = (colorValue: string) => {
    if (selectedColors.includes(colorValue)) {
      setSelectedColors(selectedColors.filter((c) => c !== colorValue))
    } else {
      setSelectedColors([...selectedColors, colorValue])
    }
  }

  const toggleSize = (size: string) => {
    if (selectedSizes.includes(size)) {
      setSelectedSizes(selectedSizes.filter((s) => s !== size))
    } else {
      setSelectedSizes([...selectedSizes, size])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      console.log("[v0] Submitting product form")

      if (!formData.name || !formData.categoryId || !formData.stockQuantity) {
        throw new Error("Vui lòng điền đầy đủ thông tin bắt buộc")
      }

      if (mediaFiles.length === 0) {
        throw new Error("Vui lòng thêm ít nhất 1 hình ảnh sản phẩm")
      }

      const providerIdToUse = isAdmin() ? formData.providerId || currentUserDbId : currentUserDbId

      if (!providerIdToUse) {
        throw new Error("Không thể xác định nhà cung cấp. Vui lòng thử đăng nhập lại.")
      }

      console.log("[v0] Using provider_id:", providerIdToUse)

      console.log("[v0] Uploading", mediaFiles.length, "media files to Supabase Storage")
      const uploadedMedia: any[] = []

      // Client-side listBuckets() requires service role key which we don't have
      // Just proceed with upload directly - will fail with clear error if bucket missing

      console.log("[v0] Proceeding with upload to product-media bucket")

      for (let i = 0; i < mediaFiles.length; i++) {
        const media = mediaFiles[i]

        if (!media.file) {
          console.error("[v0] Media file missing for:", media.id)
          continue
        }

        const fileExt = media.file.name.split(".").pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `products/${fileName}`

        console.log(`[v0] Uploading file ${i + 1}/${mediaFiles.length} to Supabase:`, filePath)

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("product-media")
          .upload(filePath, media.file, {
            cacheControl: "3600",
            upsert: false,
          })

        if (uploadError) {
          console.error("[v0] Supabase upload error:", uploadError)
          if (uploadError.message?.includes("Bucket not found")) {
            throw new Error(`Storage bucket 'product-media' chưa tồn tại. Vui lòng chạy Script 118 để tạo bucket.`)
          }
          throw new Error(`Lỗi upload file ${media.file.name}: ${uploadError.message}`)
        }

        console.log("[v0] File uploaded successfully:", uploadData.path)

        const {
          data: { publicUrl },
        } = supabase.storage.from("product-media").getPublicUrl(filePath)

        console.log("[v0] Public URL:", publicUrl)

        let thumbnailPublicUrl = null
        if (media.type === "video" && media.thumbnailBlob) {
          const thumbnailFileName = `${Date.now()}-thumb-${Math.random().toString(36).substring(7)}.jpg`
          const thumbnailPath = `products/thumbnails/${thumbnailFileName}`

          console.log("[v0] Uploading video thumbnail:", thumbnailPath)

          const { error: thumbError } = await supabase.storage
            .from("product-media")
            .upload(thumbnailPath, media.thumbnailBlob, {
              cacheControl: "3600",
              upsert: false,
              contentType: "image/jpeg",
            })

          if (!thumbError) {
            const {
              data: { publicUrl: thumbUrl },
            } = supabase.storage.from("product-media").getPublicUrl(thumbnailPath)
            thumbnailPublicUrl = thumbUrl
            console.log("[v0] Thumbnail uploaded:", thumbnailPublicUrl)
          } else {
            console.error("[v0] Thumbnail upload error:", thumbError)
          }
        }

        uploadedMedia.push({
          type: media.type,
          url: publicUrl,
          thumbnail_url: thumbnailPublicUrl,
          display_order: i,
        })
      }

      console.log("[v0] All media uploaded successfully:", uploadedMedia)

      if (uploadedMedia.length === 0) {
        throw new Error("Không thể upload hình ảnh. Vui lòng thử lại.")
      }

      const piPrice = Number.parseFloat(formData.piListedPrice) || 0
      const pitdPrice = Number.parseFloat(formData.pitdListedPrice) || 0
      const piDiscount = Number.parseFloat(formData.piDiscountPercent) || 0
      const pitdDiscount = Number.parseFloat(formData.pitdDiscountPercent) || 0

      const productData = {
        name: formData.name,
        short_description: formData.shortDescription,
        description: formData.description,
        category_id: formData.categoryId,
        price: pitdPrice || piPrice,
        currency: pitdPrice > 0 ? "PITD" : "Pi",
        stock_quantity: Number.parseInt(formData.stockQuantity) || 0,
        provider_id: providerIdToUse, // Now using valid UUID
        is_active: formData.isActive,
        is_featured: formData.isFeatured,
        media: uploadedMedia, // Now contains real Supabase URLs
        image_url: uploadedMedia.find((m) => m.type === "image")?.url || null,
        colors: colorEnabled ? selectedColors : null,
        weight: weightEnabled ? Number.parseFloat(formData.weight) : null,
        weight_unit: weightEnabled ? formData.weightUnit : null,
        dimensions:
          dimensionsEnabled && formData.dimensionLength && formData.dimensionWidth && formData.dimensionHeight
            ? `${formData.dimensionLength}x${formData.dimensionWidth}x${formData.dimensionHeight}`
            : null,
        dimension_unit: dimensionsEnabled ? formData.dimensionUnit : null,
        sizes: sizeEnabled ? selectedSizes : null,
        // Only use shipping_fee and shipping_type which exist in schema
        shipping_fee: shippingEnabled && !shippingFeeFree ? Number.parseFloat(shippingFee) : null,
        shipping_type: shippingEnabled ? (shippingFeeFree ? "free" : shippingType) : null,
        store_location: formData.storeLocation || null,
        flash_sale_enabled: formData.flashSaleEnabled,
        flash_sale_start_date: formData.flashSaleEnabled ? formData.flashSaleStartDate : null,
        flash_sale_end_date: formData.flashSaleEnabled ? formData.flashSaleEndDate : null,
        flash_sale_pi_price: formData.flashSaleEnabled ? Number.parseFloat(formData.flashSalePiPrice) : null,
        flash_sale_pitd_price: formData.flashSaleEnabled ? Number.parseFloat(formData.flashSalePitdPrice) : null,
      }

      console.log("[v0] Creating product with data:", productData)

      const { data: newProduct, error: insertError } = await supabase
        .from("products")
        .insert(productData)
        .select()
        .single()

      if (insertError) {
        console.error("[v0] Database insert error:", insertError)
        throw new Error(`Lỗi tạo sản phẩm: ${insertError.message}`)
      }

      console.log("[v0] Product created successfully:", newProduct)

      setMessage({ type: "success", text: "Sản phẩm đã được tạo thành công!" })

      setTimeout(() => {
        router.push("/admin/products")
      }, 1500)
    } catch (error: any) {
      console.error("[v0] Submit error:", error)
      setMessage({ type: "error", text: error.message || "Có lỗi xảy ra. Vui lòng thử lại." })
    } finally {
      setLoading(false)
    }
  }

  const imageCount = mediaFiles.filter((m) => m.type === "image").length
  const hasVideo = mediaFiles.some((m) => m.type === "video")

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 pb-20">
        <Header />
        <main className="container px-4 py-6">
          <Card className="p-12 rounded-2xl shadow-md">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Shield className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-purple-600">Vui lòng đăng nhập</h3>
              <p className="text-gray-600">Bạn cần đăng nhập để thêm sản phẩm</p>
              <Link href="/login">
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl">
                  Đăng nhập
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
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-purple-100">
      <Header />

      <main className="container px-4 py-4 pb-24">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/admin/products">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <span className="text-gray-600">Quay lại</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <Package className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Thêm sản phẩm/dịch vụ mới
          </h1>
        </div>

        {message && (
          <div className="mb-4">
            <Alert
              className={`rounded-xl ${message.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
            >
              {message.type === "success" ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <AlertDescription className={message.type === "success" ? "text-green-700" : "text-red-700"}>
                {message.text}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
          <Card className="rounded-2xl shadow-sm bg-white/80 backdrop-blur">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="h-5 w-5 text-purple-600" />
                <h2 className="font-semibold text-lg">Hình ảnh & Video (Tối đa 10 ảnh + 1 video)</h2>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {mediaFiles.map((media) => (
                  <div key={media.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeMedia(media.id)
                      }}
                      className="absolute top-2 right-2 z-20 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-all"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    {media.type === "image" ? (
                      <img src={media.url || "/placeholder.svg"} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-900 relative">
                        {media.thumbnailUrl ? (
                          <>
                            <img
                              src={media.thumbnailUrl || "/placeholder.svg"}
                              alt="Video thumbnail"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                                <VideoIcon className="h-6 w-6 text-white" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <VideoIcon className="h-12 w-12 text-white" />
                        )}
                      </div>
                    )}
                    {uploadProgress[media.id] !== undefined && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
                        <div className="text-white font-bold text-lg">{uploadProgress[media.id]}%</div>
                      </div>
                    )}
                  </div>
                ))}

                {(imageCount < 10 || !hasVideo) && (
                  <label className="aspect-square border-2 border-dashed border-purple-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all">
                    <Upload className="h-8 w-8 text-purple-400 mb-2" />
                    <span className="text-sm text-purple-600 font-medium">Thêm</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleMediaUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {imageCount}/10 ảnh, {hasVideo ? "1" : "0"}/1 video
              </p>
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card className="rounded-2xl shadow-sm bg-white/80 backdrop-blur">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Tên sản phẩm/dịch vụ <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="VD: Cà phê Arabica 500g"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">
                  Danh mục <span className="text-red-500">*</span>
                </Label>
                <select
                  id="category"
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  required
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {getCategoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shortDesc">Mô tả ngắn</Label>
                <Textarea
                  id="shortDesc"
                  placeholder="Mô tả tóm tắt (hiển thị trong danh sách)"
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  className="rounded-xl"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Mô tả chi tiết</Label>
                <Textarea
                  id="description"
                  placeholder="Mô tả đầy đủ về sản phẩm/dịch vụ"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="rounded-xl"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Provider Selection (Admin only) */}
          {isAdmin() && (
            <Card className="rounded-2xl shadow-sm bg-white/80 backdrop-blur">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">
                    Nhà cung cấp <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="provider"
                    value={formData.providerId}
                    onChange={(e) => setFormData({ ...formData, providerId: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Chọn nhà cung cấp</option>
                    {currentUserDbId && <option value={currentUserDbId}>Chính tôi ({user.username})</option>}
                    {providers
                      .filter((p) => p.id !== currentUserDbId)
                      .map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.pi_username || provider.provider_business_name || provider.id}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storeLocation">Nơi bán</Label>
                  <Input
                    id="storeLocation"
                    placeholder="VD: Quận 1, TP.HCM"
                    value={formData.storeLocation}
                    onChange={(e) => setFormData({ ...formData, storeLocation: e.target.value })}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-gray-500">Địa chỉ cửa hàng hoặc nơi bán sản phẩm</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Store Location for non-admin */}
          {!isAdmin() && (
            <Card className="rounded-2xl shadow-sm bg-white/80 backdrop-blur">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="storeLocation">Nơi bán</Label>
                  <Input
                    id="storeLocation"
                    placeholder="VD: Quận 1, TP.HCM"
                    value={formData.storeLocation}
                    onChange={(e) => setFormData({ ...formData, storeLocation: e.target.value })}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-gray-500">Địa chỉ cửa hàng hoặc nơi bán sản phẩm</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pricing */}
          <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-amber-50 to-orange-50">
            <CardContent className="p-6 space-y-6">
              <h3 className="font-semibold text-lg text-amber-700">Đơn vị tính trao đổi</h3>

              {/* Pi Price */}
              <div className="p-4 rounded-xl bg-white/80 space-y-3">
                <h4 className="font-medium text-amber-600">Giá Pi</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="piPrice">
                      Giá niêm yết <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="piPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={formData.piListedPrice}
                      onChange={(e) => setFormData({ ...formData, piListedPrice: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="piDiscount">Giảm giá (%)</Label>
                    <Input
                      id="piDiscount"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={formData.piDiscountPercent}
                      onChange={(e) => setFormData({ ...formData, piDiscountPercent: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* PITD Price */}
              <div className="p-4 rounded-xl bg-white/80 space-y-3">
                <h4 className="font-medium text-purple-600">Giá PITD</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pitdPrice">Giá niêm yết</Label>
                    <Input
                      id="pitdPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={formData.pitdListedPrice}
                      onChange={(e) => setFormData({ ...formData, pitdListedPrice: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pitdDiscount">Giảm giá (%)</Label>
                    <Input
                      id="pitdDiscount"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={formData.pitdDiscountPercent}
                      onChange={(e) => setFormData({ ...formData, pitdDiscountPercent: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Stock */}
              <div className="space-y-2">
                <Label htmlFor="stock">
                  Số lượng tồn kho <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                  required
                  className="rounded-xl"
                />
              </div>
            </CardContent>
          </Card>

          {/* Product Attributes */}
          <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-purple-50 to-pink-50">
            <CardContent className="p-6 space-y-6">
              <h3 className="font-semibold text-lg text-purple-700">Thuộc tính sản phẩm</h3>

              {/* Colors */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/80">
                  <Label htmlFor="color-toggle" className="font-medium">
                    Màu sắc
                  </Label>
                  <Switch
                    id="color-toggle"
                    checked={colorEnabled}
                    onCheckedChange={setColorEnabled}
                    className="data-[state=checked]:bg-purple-500"
                  />
                </div>
                {colorEnabled && (
                  <div className="p-4 rounded-xl bg-white/60 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => {
                            if (selectedColors.includes(color.value)) {
                              setSelectedColors(selectedColors.filter((c) => c !== color.value))
                            } else {
                              setSelectedColors([...selectedColors, color.value])
                            }
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                            selectedColors.includes(color.value)
                              ? "border-purple-500 bg-purple-50"
                              : "border-gray-200 hover:border-purple-300"
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-gray-300"
                            style={{ backgroundColor: color.hex }}
                          />
                          <span className="text-sm">{color.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sizes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/80">
                  <Label htmlFor="size-toggle" className="font-medium">
                    Kích cỡ
                  </Label>
                  <Switch
                    id="size-toggle"
                    checked={sizeEnabled}
                    onCheckedChange={setSizeEnabled}
                    className="data-[state=checked]:bg-purple-500"
                  />
                </div>
                {sizeEnabled && (
                  <div className="p-4 rounded-xl bg-white/60 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {["XS", "S", "M", "L", "XL", "XXL", "XXXL"].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            if (selectedSizes.includes(size)) {
                              setSelectedSizes(selectedSizes.filter((s) => s !== size))
                            } else {
                              setSelectedSizes([...selectedSizes, size])
                            }
                          }}
                          className={`px-4 py-2 rounded-lg border transition-all ${
                            selectedSizes.includes(size)
                              ? "border-purple-500 bg-purple-100 text-purple-700"
                              : "border-gray-200 hover:border-purple-300"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Weight */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/80">
                  <Label htmlFor="weight-toggle" className="font-medium">
                    Trọng lượng
                  </Label>
                  <Switch
                    id="weight-toggle"
                    checked={weightEnabled}
                    onCheckedChange={setWeightEnabled}
                    className="data-[state=checked]:bg-purple-500"
                  />
                </div>
                {weightEnabled && (
                  <div className="p-4 rounded-xl bg-white/60">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Trọng lượng"
                        value={formData.weight}
                        onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                        className="rounded-xl flex-1"
                      />
                      <select
                        value={formData.weightUnit}
                        onChange={(e) => setFormData({ ...formData, weightUnit: e.target.value })}
                        className="rounded-xl border border-gray-200 px-3"
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Dimensions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/80">
                  <Label htmlFor="dimensions-toggle" className="font-medium">
                    Kích thước
                  </Label>
                  <Switch
                    id="dimensions-toggle"
                    checked={dimensionsEnabled}
                    onCheckedChange={setDimensionsEnabled}
                    className="data-[state=checked]:bg-purple-500"
                  />
                </div>
                {dimensionsEnabled && (
                  <div className="p-4 rounded-xl bg-white/60 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="Dài"
                        value={formData.dimensionLength}
                        onChange={(e) => setFormData({ ...formData, dimensionLength: e.target.value })}
                        className="rounded-xl"
                      />
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="Rộng"
                        value={formData.dimensionWidth}
                        onChange={(e) => setFormData({ ...formData, dimensionWidth: e.target.value })}
                        className="rounded-xl"
                      />
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="Cao"
                        value={formData.dimensionHeight}
                        onChange={(e) => setFormData({ ...formData, dimensionHeight: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <select
                      value={formData.dimensionUnit}
                      onChange={(e) => setFormData({ ...formData, dimensionUnit: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2"
                    >
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                      <option value="inch">inch</option>
                    </select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shipping */}
          <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-lg text-blue-700">Vận chuyển</h3>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/80">
                <Label htmlFor="shipping-toggle" className="font-medium">
                  Hỗ trợ vận chuyển
                </Label>
                <Switch
                  id="shipping-toggle"
                  checked={shippingEnabled}
                  onCheckedChange={setShippingEnabled}
                  className="data-[state=checked]:bg-blue-500"
                />
              </div>

              {shippingEnabled && (
                <div className="p-4 rounded-xl bg-white/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="free-shipping" className="font-medium">
                      Miễn phí vận chuyển
                    </Label>
                    <Switch
                      id="free-shipping"
                      checked={shippingFeeFree}
                      onCheckedChange={setShippingFeeFree}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </div>

                  {!shippingFeeFree && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Phí vận chuyển</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          value={shippingFee}
                          onChange={(e) => setShippingFee(e.target.value)}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Loại vận chuyển</Label>
                        <select
                          value={shippingType}
                          onChange={(e) => setShippingType(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2"
                        >
                          <option value="standard">Tiêu chuẩn</option>
                          <option value="express">Nhanh</option>
                          <option value="same_day">Trong ngày</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Flash Sale */}
          <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-red-50 to-orange-50">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-lg text-red-700">Flash Sale</h3>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/80">
                <Label htmlFor="flash-sale-toggle" className="font-medium">
                  Kích hoạt Flash Sale
                </Label>
                <Switch
                  id="flash-sale-toggle"
                  checked={formData.flashSaleEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, flashSaleEnabled: checked })}
                  className="data-[state=checked]:bg-red-500"
                />
              </div>

              {formData.flashSaleEnabled && (
                <div className="p-4 rounded-xl bg-white/60 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Ngày bắt đầu</Label>
                      <Input
                        type="datetime-local"
                        value={formData.flashSaleStartDate}
                        onChange={(e) => setFormData({ ...formData, flashSaleStartDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ngày kết thúc</Label>
                      <Input
                        type="datetime-local"
                        value={formData.flashSaleEndDate}
                        onChange={(e) => setFormData({ ...formData, flashSaleEndDate: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Giá Flash Sale (Pi)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        value={formData.flashSalePiPrice}
                        onChange={(e) => setFormData({ ...formData, flashSalePiPrice: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Giá Flash Sale (PITD)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
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

          {/* Visibility Settings */}
          <Card className="rounded-2xl shadow-sm bg-white/80 backdrop-blur">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg">Cài đặt hiển thị</h3>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-gray-600" />
                  <Label htmlFor="active-toggle" className="font-medium">
                    Hiển thị sản phẩm
                  </Label>
                </div>
                <Switch
                  id="active-toggle"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  <Label htmlFor="featured-toggle" className="font-medium">
                    Sản phẩm nổi bật
                  </Label>
                </div>
                <Switch
                  id="featured-toggle"
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
                  className="data-[state=checked]:bg-yellow-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl shadow-lg"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang tạo sản phẩm...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Lưu sản phẩm
              </div>
            )}
          </Button>
        </form>
      </main>

      <BottomNav />
    </div>
  )
}
