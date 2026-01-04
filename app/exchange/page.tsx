"use client"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import type { Offer, Product } from "@/lib/types"
import { ExchangeModal } from "@/components/exchange-modal"
import { CATEGORIES } from "@/lib/constants"
import { ProductCard } from "@/components/product-card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useSearchParams, useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ProductRating {
  avg: number
  count: number
}

export default function ExchangePage() {
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const filter = searchParams.get("filter")
  const searchQuery = searchParams.get("search")
  const categoryParam = searchParams.get("category")

  const [selectedCategory, setSelectedCategory] = useState(categoryParam || "all")
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [showExchangeModal, setShowExchangeModal] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [productRatings, setProductRatings] = useState<Record<string, ProductRating>>({})
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<string>("rating")

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      try {
        const supabase = createBrowserClient()
        let query = supabase.from("products").select("*").eq("is_active", true)

        if (selectedCategory !== "all") {
          query = query.eq("category_id", selectedCategory)
        }

        if (searchQuery) {
          query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        }

        if (filter === "flash") {
          query = query.eq("flash_sale_enabled", true).gte("flash_sale_end_date", new Date().toISOString())
        } else if (filter === "featured") {
          query = query.eq("is_featured", true)
        }

        if (sortBy === "rating") {
          query = query.order("average_rating", { ascending: false })
        } else if (sortBy === "price_low") {
          query = query.order("price", { ascending: true })
        } else if (sortBy === "price_high") {
          query = query.order("price", { ascending: false })
        } else if (sortBy === "newest") {
          query = query.order("created_at", { ascending: false })
        }

        query = query.order("total_sold", { ascending: false }).limit(50)

        const { data, error } = await query

        if (error) throw error

        const productIds = (data || []).map((p: any) => p.id)
        const ratings: Record<string, ProductRating> = {}

        if (productIds.length > 0) {
          const { data: reviewsData } = await supabase
            .from("reviews")
            .select("product_id, rating")
            .in("product_id", productIds)

          if (reviewsData && reviewsData.length > 0) {
            productIds.forEach((productId: string) => {
              const productReviews = reviewsData.filter((r) => r.product_id === productId)
              if (productReviews.length > 0) {
                const sum = productReviews.reduce((acc, r) => acc + (r.rating || 0), 0)
                ratings[productId] = {
                  avg: sum / productReviews.length,
                  count: productReviews.length,
                }
              }
            })
          }
        }
        setProductRatings(ratings)

        const formattedProducts = (data || []).map((p: any) => ({
          id: p.id,
          uuid: p.id,
          name: p.name,
          title: p.name,
          shortDescription: p.short_description,
          description: p.description,
          category: p.category_id,
          price: p.price || p.pi_amount || p.pitd_amount,
          piAmount: p.pi_amount || p.price,
          pitdAmount: p.pitd_amount || p.price,
          imageUrl: (() => {
            if (Array.isArray(p.media)) {
              const imageMedia = p.media.find((m: any) => m.type === "image" && m.url && !m.url.startsWith("blob:"))
              if (imageMedia) return imageMedia.url
            }
            if (p.image_url && !p.image_url.startsWith("blob:")) return p.image_url
            return `/placeholder.svg?height=200&width=200&query=${encodeURIComponent(p.name || "product")}`
          })(),
          merchantUsername: p.provider_name || "PITODO",
          providerName: p.provider_name || "PITODO",
          providerLocation: p.store_location || "Vietnam",
          stock: p.stock_quantity,
          active: p.is_active,
          createdAt: p.created_at,
          rating: ratings[p.id]?.avg || 0,
          reviewCount: ratings[p.id]?.count || 0,
          quantityExchanged: p.total_sold || 0,
          deliveryTime: p.delivery_time || "2-3 days",
          flashSaleEnabled: p.flash_sale_enabled,
          flashSaleStartDate: p.flash_sale_start_date ? new Date(p.flash_sale_start_date) : undefined,
          flashSaleEndDate: p.flash_sale_end_date ? new Date(p.flash_sale_end_date) : undefined,
          flashSalePiPrice: p.flash_sale_pi_price,
          flashSalePitdPrice: p.flash_sale_pitd_price,
          originalPiAmount: p.flash_sale_enabled ? p.pi_amount || p.price : undefined,
          originalPitdAmount: p.flash_sale_enabled ? p.pitd_amount || p.price : undefined,
          supportsPi: true,
          supportsPitd: true,
        }))

        setProducts(formattedProducts)
      } catch (error) {
        console.error("Error fetching products:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [selectedCategory, searchQuery, filter, sortBy])

  const handleExchangeClick = (product: Product) => {
    router.push(`/product/${product.id}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 pb-20">
      <Header />
      <main className="container px-4 py-6 max-w-7xl mx-auto space-y-4">
        <div className="grid grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all duration-200 border min-h-[90px] ${
                selectedCategory === category.id
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent shadow-md"
                  : "bg-white/80 hover:bg-white hover:shadow-lg border-purple-100/50 text-gray-700"
              }`}
            >
              <div className="text-2xl">{category.icon}</div>
              <span
                className={`text-[10px] font-medium text-center leading-tight line-clamp-2 ${
                  selectedCategory === category.id ? "text-white" : "text-gray-700"
                }`}
              >
                {language === "vi" ? category.nameVi : category.name}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 p-4 bg-white/80 rounded-2xl shadow-sm">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            onClick={() => setSelectedCategory("all")}
            className="rounded-xl"
          >
            {t("allCategories")}
          </Button>
          <div className="flex-1 min-w-[200px]">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={t("sortBy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">{t("highestRated")}</SelectItem>
                <SelectItem value="price_low">{t("lowestPrice")}</SelectItem>
                <SelectItem value="price_high">{t("highestPrice")}</SelectItem>
                <SelectItem value="newest">{t("newest")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">{t("loading")}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white/60 rounded-2xl">
            <p className="text-gray-600">{t("noProductsFound")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                {...product}
                onRedeem={() => handleExchangeClick(product)}
                showActionButton={false}
              />
            ))}
          </div>
        )}
      </main>
      <BottomNav />

      {selectedOffer && (
        <ExchangeModal
          offer={selectedOffer}
          isOpen={showExchangeModal}
          onClose={() => {
            setShowExchangeModal(false)
            setSelectedOffer(null)
          }}
        />
      )}
    </div>
  )
}
