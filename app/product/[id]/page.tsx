"use client"

import { Suspense } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MediaSlider } from "@/components/media-slider"
import { ExchangeModal } from "@/components/exchange-modal"
import { ReviewsModal } from "@/components/reviews-modal"
import { Edit2, X, Heart } from "lucide-react"
import { Star, MapPin, Clock, Package, Ruler, Weight, Shield, TrendingUp, Zap, CheckCircle } from "lucide-react"
import {
  formatCurrency,
  calculateBreakdown,
  isFlashSaleActive,
  getFlashSalePrice,
  calculateFlashSaleDiscount,
} from "@/lib/constants"
import type { Offer, Currency } from "@/lib/types"
import { getProductById } from "@/lib/supabase/queries"
import { createBrowserClient } from "@/lib/supabase/client"

function ProductDetailContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const { user, isAdmin } = useAuth()
  const [selectedColor, setSelectedColor] = useState<string>("")
  const [showExchangeModal, setShowExchangeModal] = useState(false)
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("PI")
  const [timeLeft, setTimeLeft] = useState("")
  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<Offer | null>(null)
  const [flashSaleIsActive, setFlashSaleIsActive] = useState(false)
  const [calculatedDiscount, setCalculatedDiscount] = useState<number | null>(null)
  const [displayPiAmount, setDisplayPiAmount] = useState<number | null>(null)
  const [displayPitdAmount, setDisplayPitdAmount] = useState<number | null>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [appSettings, setAppSettings] = useState<{ service_fee_percentage: number; tax_percentage: number } | null>(
    null,
  )
  const [showReviewsModal, setShowReviewsModal] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [loadingFavorite, setLoadingFavorite] = useState(false)

  useEffect(() => {
    const reviewAdded = searchParams.get("reviewAdded")
    const timestamp = searchParams.get("t")
    if (reviewAdded === "true") {
      setRefreshKey((prev) => prev + 1)
      router.replace(`/product/${params.id}`, { scroll: false })
    }
  }, [searchParams, params.id, router])

  useEffect(() => {
    async function fetchProduct() {
      if (!params.id) return

      setLoading(true)
      try {
        console.log("[v0] Fetching product:", params.id)
        const productData = await getProductById(params.id as string)

        if (productData) {
          console.log("[v0] Product data received:", {
            id: productData.id,
            title: productData.title,
            images: productData.images,
            videoUrl: productData.videoUrl,
          })

          const offer: Offer = {
            id: productData.id,
            providerId: "provider1",
            title: productData.title,
            description: productData.description,
            fullDescription: productData.description,
            category: productData.category || "category-digital-goods",
            productCode: productData.productCode,
            images:
              productData.images && productData.images.length > 0
                ? productData.images
                : productData.imageUrl
                  ? [productData.imageUrl]
                  : ["/diverse-products-still-life.png"],
            videoUrl: productData.videoUrl,
            image: productData.images?.[0] || productData.imageUrl || "/placeholder.svg?height=400&width=400",
            piAmount: productData.piAmount,
            pitdAmount: productData.pitdAmount,
            // Flash sale fields (must match Home/ProductCard behavior)
            flashSaleEnabled: productData.flashSaleEnabled || false,
            flashSaleStartDate: productData.flashSaleStartDate,
            flashSaleEndDate: productData.flashSaleEndDate,
            flashSalePiPrice: productData.flashSalePiPrice,
    flashSalePitdPrice: productData.flashSalePitdPrice,
            originalPiAmount: productData.flashSaleEnabled ? productData.piAmount : undefined,
            originalPitdAmount: productData.flashSaleEnabled ? productData.pitdAmount : undefined,
            supportsPi: productData.supportsPi ?? true,
            supportsPitd: productData.supportsPitd ?? true,
            providerName: productData.providerName,
            providerLocation: productData.providerLocation,
            providerPiWallet: productData.providerWalletPi || "GDR47...XYZ",
            providerPitdWallet: productData.providerWalletPitd || "PTD89...ABC",
            rating: productData.rating,
            reviewCount: productData.reviewCount,
            quantityExchanged: productData.quantityExchanged,
            deliveryTime: productData.deliveryTime,
            weight: productData.weight ? `${productData.weight} ${productData.weightUnit}` : undefined,
            dimensions: productData.dimensions ? `${productData.dimensions} ${productData.dimensionUnit}` : undefined,
            colors: productData.colors || [],
            shippingInfo: productData.shippingFee
              ? `${productData.shippingFee} ${productData.shippingFeeCurrency?.toUpperCase()} shipping fee`
              : "Free shipping nationwide",
            flashSaleDiscountPercent: productData.discountPercentage || 0,
            marketingLabel: undefined,
            available: true,
            featured: false,
            isHidden: false,
            createdAt: new Date(productData.created_at),
            updatedAt: new Date(productData.created_at),
          }

          console.log("[v0] Offer created with images:", offer.images)
          setProduct(offer)
        } else {
          console.error("[v0] Product not found")
        }
      } catch (error) {
        console.error("[v0] Error fetching product:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [params.id, refreshKey])

  useEffect(() => {
    if (product) {
      const isActive = isFlashSaleActive(product.flashSaleEnabled, product.flashSaleStartDate, product.flashSaleEndDate)
      setFlashSaleIsActive(isActive)

      const piAmount =
        isActive && product.originalPiAmount
          ? getFlashSalePrice(product.originalPiAmount, product.flashSalePiPrice, product.flashSaleDiscountPercent)
          : product.piAmount
      setDisplayPiAmount(piAmount)

      const pitdAmount =
        isActive && product.originalPitdAmount
          ? getFlashSalePrice(product.originalPitdAmount, product.flashSalePitdPrice, product.flashSaleDiscountPercent)
          : product.pitdAmount
      setDisplayPitdAmount(pitdAmount)

      const discount =
        isActive && product.originalPiAmount && piAmount
          ? calculateFlashSaleDiscount(product.originalPiAmount, piAmount)
          : product.flashSaleDiscountPercent
      setCalculatedDiscount(discount)
    }
  }, [product])

  useEffect(() => {
    if (!flashSaleIsActive || !product?.flashSaleEndDate) return

    const updateTimer = () => {
      const now = new Date()
      const diff = product.flashSaleEndDate.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeLeft(t("flashSaleExpired"))
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      if (days > 0) {
        setTimeLeft(`${days} ${t("days")}`)
      } else if (hours > 0) {
        setTimeLeft(`${hours} ${t("hours")}`)
      } else {
        setTimeLeft(`${minutes} min`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 60000)

    return () => clearInterval(interval)
  }, [flashSaleIsActive, product?.flashSaleEndDate, t])

  useEffect(() => {
    async function loadReviews() {
      try {
        const supabase = createBrowserClient()

        console.log("[v0] Loading reviews for product:", params.id)

        const { data: reviewsData, error: reviewsError } = await supabase
          .from("reviews")
          .select("*")
          .eq("product_id", params.id)
          .order("created_at", { ascending: false })
          .limit(10)

        console.log("[v0] Reviews query result:", { reviewsData, reviewsError })

        if (reviewsError) {
          console.error("[v0] Reviews query error:", reviewsError)
          setReviews([])
          return
        }

        if (!reviewsData || reviewsData.length === 0) {
          console.log("[v0] No reviews found")
          setReviews([])
          return
        }

        const userIds = [...new Set(reviewsData.map((r) => r.user_id))]
        const { data: usersData } = await supabase.from("pi_users").select("id, pi_username").in("id", userIds)

        const usersMap = new Map(usersData?.map((u) => [u.id, u.pi_username]) || [])

        const reviewsWithUsers = reviewsData.map((review) => ({
          ...review,
          pi_users: {
            pi_username: usersMap.get(review.user_id) || "Anonymous",
          },
        }))

        console.log("[v0] Found", reviewsWithUsers.length, "reviews with users")
        setReviews(reviewsWithUsers)
      } catch (error) {
        console.error("[v0] Error loading reviews:", error)
        setReviews([])
      }
    }

    if (params.id) {
      loadReviews()
    }
  }, [params.id, refreshKey])

  useEffect(() => {
    async function loadAppSettings() {
      try {
        const supabase = createBrowserClient()
        const { data } = await supabase.from("app_settings").select("service_fee_percentage, tax_percentage").single()

        if (data) {
          setAppSettings(data)
        }
      } catch (error) {
        console.error("[v0] Error loading app settings:", error)
      }
    }

    loadAppSettings()
  }, [])

  useEffect(() => {
    if (product?.id && user?.uid) {
      checkIfFavorite()
    }
  }, [product?.id, user?.uid])

  async function checkIfFavorite() {
    if (!product?.id || !user?.uid) return
    try {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from("user_favorites")
        .select("id")
        .eq("user_id", user.uid)
        .eq("product_id", product.id)
        .single()

      setIsFavorite(!!data)
    } catch (error) {
      console.error("[v0] Error checking favorite:", error)
    }
  }

  async function toggleFavorite() {
    if (!product?.id || !user?.uid) return
    try {
      setLoadingFavorite(true)
      const supabase = createBrowserClient()

      if (isFavorite) {
        await supabase.from("user_favorites").delete().eq("user_id", user.uid).eq("product_id", product.id)
        setIsFavorite(false)
      } else {
        await supabase.from("user_favorites").insert({
          user_id: user.uid,
          product_id: product.id,
        })
        setIsFavorite(true)
      }
    } catch (error) {
      console.error("[v0] Error toggling favorite:", error)
    } finally {
      setLoadingFavorite(false)
    }
  }

  const reloadReviews = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const handleExchange = (currency: Currency) => {
    if (!product) return
    if (product.colors && product.colors.length > 0 && !selectedColor) {
      alert(t("selectColorFirst"))
      return
    }
    if (!user) {
      router.push("/login")
      return
    }
    setSelectedCurrency(currency)
    setShowExchangeModal(true)
  }

  const piBreakdown = product
    ? calculateBreakdown(
        displayPiAmount || product.piAmount || 0,
        appSettings?.service_fee_percentage,
        appSettings?.tax_percentage,
      )
    : null
  const pitdBreakdown = product
    ? calculateBreakdown(
        displayPitdAmount || product.pitdAmount || 0,
        appSettings?.service_fee_percentage,
        appSettings?.tax_percentage,
      )
    : null

  if (loading) {
    return null
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 pb-20">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex items-center gap-4 shadow-lg">
          <div className="h-6 w-6" />
          <h1 className="text-lg font-semibold">Chi tiết sản phẩm</h1>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <Package className="h-16 w-16 text-gray-300 mb-4" />
          <p className="text-gray-600 text-center">Không tìm thấy sản phẩm</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
      <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex items-center gap-4 shadow-lg">
        <div className="h-6 w-6" />
        <h1 className="text-lg font-semibold">Chi tiết sản phẩm</h1>
      </div>

      <div className="px-4 py-6 space-y-4">
        <Card className="overflow-hidden rounded-3xl border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <div className="p-4">
            <MediaSlider
              images={product.images || ["/placeholder.svg"]}
              videoUrl={product.videoUrl}
              alt={product.title}
            />
          </div>
          {/* Admin buttons moved here after media slider */}
          {user && (isAdmin() || product.providerId === user.id) && (
            <div className="px-4 pb-4 flex justify-end gap-2">
              <Button
                onClick={() => router.push(`/admin/products/${product.id}/edit`)}
                size="sm"
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 h-8"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1" />
                Sửa
              </Button>
              <Button
                onClick={async () => {
                  if (confirm("Bạn có chắc chắn muốn xóa sản phẩm này?")) {
                    try {
                      const supabase = createBrowserClient()
                      const { error } = await supabase.from("products").delete().eq("id", product.id)

                      if (error) throw error

                      alert("Đã xóa sản phẩm thành công")
                      router.push("/admin/products")
                    } catch (error) {
                      console.error("[v0] Delete error:", error)
                      alert("Không thể xóa sản phẩm")
                    }
                  }
                }}
                size="sm"
                variant="destructive"
                className="rounded-full px-3 h-8"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Xóa
              </Button>
            </div>
          )}
        </Card>

        {flashSaleIsActive && (
          <Card className="p-4 bg-gradient-to-br from-pink-500 via-violet-500 to-pink-600 text-white shadow-xl rounded-2xl border-0">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-2.5 shadow-md">
                <Zap className="w-6 h-6 fill-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">{t("flashSale")}</p>
                <p className="text-sm opacity-90">
                  {t("endsIn")}: {timeLeft}
                </p>
              </div>
              {calculatedDiscount && calculatedDiscount > 0 && (
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2 text-right shadow-md">
                  <p className="text-2xl font-bold">-{calculatedDiscount}%</p>
                </div>
              )}
            </div>
          </Card>
        )}

        <Card className="p-4 bg-gradient-to-br from-purple-50/80 via-white/80 to-pink-50/80 backdrop-blur-sm shadow-lg rounded-3xl border-0">
          <div className="space-y-2">
            {product.marketingLabel && (
              <Badge
                variant="secondary"
                className="text-xs bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 border-0 rounded-xl shadow-sm"
              >
                <TrendingUp className="w-3 h-3 mr-1" />
                {product.marketingLabel}
              </Badge>
            )}

            <h1 className="text-xl font-bold text-balance leading-tight">{product.title}</h1>

            {product.productCode && (
              <p className="text-xs text-muted-foreground">
                {t("productCode")}: <span className="font-mono font-medium">{product.productCode}</span>
              </p>
            )}

            <div className="flex items-center gap-3 flex-wrap text-sm">
              {product.rating && product.rating > 0 && (
                <>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{product.rating.toFixed(1)}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    ({product.reviewCount} {t("reviews")})
                  </span>
                </>
              )}
              {product.quantityExchanged && product.quantityExchanged > 0 && (
                <span className="text-muted-foreground text-xs">
                  • {product.quantityExchanged.toLocaleString()} {t("exchanged")}
                </span>
              )}
              {product.deliveryTime && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{product.deliveryTime}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t">
              <Shield className="w-4 h-4 text-violet-600" />
              <span className="text-sm font-medium">{product.providerName}</span>
              <CheckCircle className="w-4 h-4 text-violet-500 drop-shadow-sm" />
              {product.providerLocation && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {product.providerLocation}
                </span>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50/80 via-white/80 to-pink-50/80 backdrop-blur-sm shadow-lg rounded-3xl border-0">
          <div className="space-y-2">
            {product.supportsPi && displayPiAmount !== undefined && displayPiAmount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {flashSaleIsActive && product.originalPiAmount && product.originalPiAmount !== displayPiAmount && (
                    <div className="text-xs text-purple-400 line-through mb-0.5">
                      π {formatCurrency(product.originalPiAmount)}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-purple-600 text-3xl font-bold">π</span>
                    <span className="text-3xl font-bold text-purple-700">{formatCurrency(displayPiAmount)}</span>
                    <span className="text-sm text-purple-500 font-medium">Pi</span>
                  </div>
                </div>
                {flashSaleIsActive && (
                  <Badge className="bg-gradient-to-br from-pink-500 via-orange-500 to-pink-600 text-white border-0 shadow-lg rounded-xl px-2.5 py-1">
                    ⚡ Flash Sale
                  </Badge>
                )}
              </div>
            )}
            {product.supportsPitd && displayPitdAmount !== undefined && displayPitdAmount > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-purple-100">
                <div className="flex-1">
                  {flashSaleIsActive &&
                    product.originalPitdAmount &&
                    product.originalPitdAmount !== displayPitdAmount && (
                      <div className="text-xs text-pink-400 line-through mb-0.5">
                        PITD {formatCurrency(product.originalPitdAmount)}
                      </div>
                    )}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl text-pink-600 font-bold">PITD</span>
                    <div>
                      <p className="font-semibold text-base text-pink-700">
                        {formatCurrency(displayPitdAmount || product.pitdAmount)} PITD
                      </p>
                    </div>
                  </div>
                </div>
                {flashSaleIsActive && (
                  <Badge className="bg-gradient-to-br from-pink-500 via-orange-500 to-pink-600 text-white border-0 shadow-lg rounded-xl px-2.5 py-1">
                    ⚡ Flash Sale
                  </Badge>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4 shadow-lg rounded-2xl border-0 bg-white/70 backdrop-blur-sm">
          <h2 className="font-semibold text-sm mb-3 text-purple-700">{t("exchangeOptions")}</h2>
          <div className="space-y-3">
            {/* Pi Option */}
            {product.supportsPi && (
              <Card className="p-3 shadow-md rounded-2xl bg-gradient-to-br from-purple-50 to-white border border-purple-100">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl text-purple-600">π</span>
                      <div>
                        <p className="font-semibold text-base text-purple-700">
                          {formatCurrency(displayPiAmount || product.piAmount)} Pi
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleExchange("PI")}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 rounded-full h-10 px-6 text-sm font-semibold shadow-lg"
                    >
                      {t("exchangeWithPi")}
                    </Button>
                  </div>

                  {piBreakdown && (
                    <div className="border-t border-purple-100 pt-2 space-y-1.5 text-xs">
                      <div className="flex justify-between items-start">
                        <span className="text-purple-600/70">{t("providerReceives")}:</span>
                        <div className="text-right">
                          <span className="font-medium text-purple-700 block">
                            {formatCurrency(piBreakdown.providerAmount)} π
                          </span>
                          <span className="text-[10px] text-purple-500/60">{product.providerPiWallet}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-purple-600/70">
                          {t("serviceFee")} ({appSettings?.service_fee_percentage || 2.5}%):
                        </span>
                        <div className="text-right">
                          <span className="font-medium text-purple-700 block">
                            {formatCurrency(piBreakdown.serviceFee)} π
                          </span>
                          <span className="text-[10px] text-purple-500/60">PITODO-SURCHARGE-PI</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-purple-600/70">
                          {t("tax")} ({appSettings?.tax_percentage || 10}%):
                        </span>
                        <div className="text-right">
                          <span className="font-medium text-purple-700 block">{formatCurrency(piBreakdown.tax)} π</span>
                          <span className="text-[10px] text-purple-500/60">PITODO-TAX-PI</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* PITD Option */}
            {product.supportsPitd && (
              <Card className="p-3 shadow-md rounded-2xl bg-gradient-to-br from-pink-50 to-white border border-pink-100">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl text-pink-600 font-bold">PITD</span>
                      <div>
                        <p className="font-semibold text-base text-pink-700">
                          {formatCurrency(displayPitdAmount || product.pitdAmount)} PITD
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleExchange("PITD")}
                      className="bg-gradient-to-r from-pink-600 to-purple-600 text-white hover:from-pink-700 hover:to-purple-700 rounded-full h-10 px-6 text-sm font-semibold shadow-lg"
                    >
                      {t("exchangeWithPitd")}
                    </Button>
                  </div>

                  {pitdBreakdown && (
                    <div className="border-t border-pink-100 pt-2 space-y-1.5 text-xs">
                      <div className="flex justify-between items-start">
                        <span className="text-pink-600/70">{t("providerReceives")}:</span>
                        <div className="text-right">
                          <span className="font-medium text-pink-700 block">
                            {formatCurrency(pitdBreakdown.providerAmount)} PITD
                          </span>
                          <span className="text-[10px] text-pink-500/60">{product.providerPitdWallet}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-pink-600/70">
                          {t("serviceFee")} ({appSettings?.service_fee_percentage || 2.5}%):
                        </span>
                        <div className="text-right">
                          <span className="font-medium text-pink-700 block">
                            {formatCurrency(pitdBreakdown.serviceFee)} PITD
                          </span>
                          <span className="text-[10px] text-pink-500/60">PITODO-SURCHARGE-PITD</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-pink-600/70">
                          {t("tax")} ({appSettings?.tax_percentage || 10}%):
                        </span>
                        <div className="text-right">
                          <span className="font-medium text-pink-700 block">
                            {formatCurrency(pitdBreakdown.tax)} PITD
                          </span>
                          <span className="text-[10px] text-pink-500/60">PITODO-TAX-PITD</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </Card>

        <Card className="p-4 shadow-md rounded-2xl border-0 bg-white/50 backdrop-blur-sm">
          <h2 className="font-semibold text-base mb-3">{t("specifications")}</h2>
          <div className="space-y-2 text-sm">
            {product.weight && (
              <div className="flex items-start gap-3 py-2 border-b border-gray-100">
                <Weight className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{t("weight")}</p>
                  <p className="font-medium">{product.weight}</p>
                </div>
              </div>
            )}
            {product.dimensions && (
              <div className="flex items-start gap-3 py-2 border-b border-gray-100">
                <Ruler className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{t("dimensions")}</p>
                  <p className="font-medium">{product.dimensions}</p>
                </div>
              </div>
            )}
            {product.colors && product.colors.length > 0 && (
              <div className="flex items-start gap-3 py-2 border-b border-gray-100">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{t("availableColors")}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {product.colors.map((color, idx) => (
                      <div
                        key={idx}
                        className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-all ${
                          selectedColor === color ? "border-purple-600 scale-110" : "border-gray-200"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setSelectedColor(color)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 py-2 border-b border-gray-100">
              <Package className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{t("shipping")}</p>
                <p className="font-medium">{product.shippingInfo}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-md rounded-2xl border-0 bg-white/70 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-700">{product.rating?.toFixed(1) || "0.0"}</div>
              <div className="flex items-center justify-center gap-0.5 my-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${star <= Math.round(product.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                  />
                ))}
              </div>
              <button
                onClick={() => setShowReviewsModal(true)}
                className="text-xs text-purple-600 hover:text-purple-700 hover:underline cursor-pointer"
              >
                {product.reviewCount || 0} {t("reviews")}
              </button>
            </div>
            <div className="flex-1">
              <Button
                onClick={() => router.push(`/product/${product.id}/review`)}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full"
              >
                {t("writeReview")}
              </Button>
            </div>
            <button
              onClick={toggleFavorite}
              disabled={loadingFavorite || !user}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isFavorite ? "bg-pink-500 text-white hover:bg-pink-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              } disabled:opacity-50`}
            >
              <Heart className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`} />
              {isFavorite ? "Yêu thích" : "Thêm yêu thích"}
            </button>
          </div>
          <div className="space-y-3 border-t pt-3">
            {reviews.length > 0 ? (
              <div className="space-y-3 border-t pt-3">
                {reviews.slice(0, 2).map((review) => (
                  <div key={review.id} className="space-y-2 pb-3 border-b last:border-b-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                          {review.pi_users?.pi_username?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{review.pi_users?.pi_username || "Anonymous"}</p>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3 h-3 ${star <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString("vi-VN")}</p>
                    </div>
                    <p className="text-sm text-gray-700">{review.comment}</p>
                  </div>
                ))}
                {reviews.length > 2 && (
                  <Button
                    variant="outline"
                    className="w-full text-purple-600 border-purple-200 hover:bg-purple-50 bg-transparent"
                    onClick={() => setShowReviewsModal(true)}
                  >
                    Xem tất cả {reviews.length} đánh giá
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-600 text-center py-4 border-t">Chưa có đánh giá nào</div>
            )}
          </div>
        </Card>

        <Card className="p-4 shadow-md rounded-2xl border-0 bg-white/50 backdrop-blur-sm">
          <h2 className="font-semibold text-sm mb-3 text-purple-700">{t("description")}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
            {product.fullDescription || product.description}
          </p>
        </Card>
      </div>

      {showExchangeModal && product && (
        <ExchangeModal
          open={showExchangeModal}
          onClose={() => setShowExchangeModal(false)}
          product={product}
          amountPi={displayPiAmount || product.piAmount}
          amountPitd={displayPitdAmount || product.pitdAmount}
          currency={selectedCurrency}
        />
      )}

      {showReviewsModal && product && (
        <ReviewsModal
          open={showReviewsModal}
          onClose={() => setShowReviewsModal(false)}
          reviews={reviews}
          productName={product.title}
          currentUserId={user?.uid}
          isAdmin={isAdmin()}
          onReviewUpdated={reloadReviews}
        />
      )}
    </div>
  )
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<ProductDetailLoading />}>
      <ProductDetailContent />
    </Suspense>
  )
}

function ProductDetailLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 pb-20">
      <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex items-center gap-4 shadow-lg">
        <div className="h-6 w-6" />
        <h1 className="text-lg font-semibold">Chi tiết sản phẩm</h1>
      </div>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    </div>
  )
}
