"use client"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { ProductCard } from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { ArrowRight, Zap, Star, Sparkles } from "lucide-react"
import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { CATEGORIES } from "@/lib/constants"

export default function HomePage() {
  const { t, language } = useLanguage()
  const router = useRouter()

  const [flashSaleProducts, setFlashSaleProducts] = useState<any[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([])
  const [newProducts, setNewProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true)
        const supabase = createBrowserClient()

        // Performance: fetch in parallel (same UI/output, fewer round-trip delays)
        const nowIso = new Date().toISOString()
        const [flashRes, featuredRes, newRes] = await Promise.all([
          supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .eq("flash_sale_enabled", true)
            .gte("flash_sale_end_date", nowIso)
            .order("average_rating", { ascending: false })
            .order("total_sold", { ascending: false })
            .limit(10),
          supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .eq("is_featured", true)
            .order("average_rating", { ascending: false })
            .order("total_sold", { ascending: false })
            .limit(10),
          supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .order("average_rating", { ascending: false })
            .limit(10),
        ])

        const flashData = flashRes.data || []
        const featuredData = featuredRes.data || []
        const newData = newRes.data || []

        const allProductIds = [...flashData.map((p) => p.id), ...featuredData.map((p) => p.id), ...newData.map((p) => p.id)].filter(
          (id, index, arr) => arr.indexOf(id) === index
        ) // unique IDs

        // Query real reviews count and average rating from reviews table (skip if no products)
        const productRatings: Record<string, { avg: number; count: number }> = {}
        if (allProductIds.length > 0) {
          const { data: reviewsData } = await supabase
            .from("reviews")
            .select("product_id, rating")
            .in("product_id", allProductIds)

          if (reviewsData && reviewsData.length > 0) {
            const sums: Record<string, number> = {}
            const counts: Record<string, number> = {}
            for (const r of reviewsData) {
              const pid = r.product_id
              const rating = Number(r.rating || 0)
              sums[pid] = (sums[pid] || 0) + rating
              counts[pid] = (counts[pid] || 0) + 1
            }
            for (const pid of Object.keys(counts)) {
              const count = counts[pid]
              productRatings[pid] = { count, avg: count > 0 ? sums[pid] / count : 0 }
            }
          }
        }

        const formatProduct = (p: any) => ({
          id: p.id,
          title: p.name,
          description: p.short_description || p.description,
          piAmount: p.pi_amount || p.price,
          pitdAmount: p.pitd_amount || p.price,
          flashSaleEnabled: p.flash_sale_enabled,
          flashSaleStartDate: p.flash_sale_start_date ? new Date(p.flash_sale_start_date) : undefined,
          flashSaleEndDate: p.flash_sale_end_date ? new Date(p.flash_sale_end_date) : undefined,
          flashSalePiPrice: p.flash_sale_pi_price,
          flashSalePitdPrice: p.flash_sale_pitd_price,
          originalPiAmount: p.flash_sale_enabled ? p.pi_amount || p.price : undefined,
          originalPitdAmount: p.flash_sale_enabled ? p.pitd_amount || p.price : undefined,
          imageUrl: (() => {
            // Try media array first
            if (Array.isArray(p.media)) {
              const imageMedia = p.media.find((m: any) => m.type === "image" && m.url && !m.url.startsWith("blob:"))
              if (imageMedia) return imageMedia.url
            }
            // Try image_url field
            if (p.image_url && !p.image_url.startsWith("blob:")) {
              return p.image_url
            }
            // Fallback to placeholder
            return `/placeholder.svg?height=200&width=200&query=${encodeURIComponent(p.name || "product")}`
          })(),
          rating: productRatings[p.id]?.avg || 0,
          reviewCount: productRatings[p.id]?.count || 0,
          quantityExchanged: p.total_sold || 0,
          deliveryTime: p.estimated_delivery_days || "2-3 days",
          providerName: p.provider_name || "PITODO",
          providerLocation: p.store_location || "Vietnam",
        })

        setFlashSaleProducts(flashData.map(formatProduct))
        setFeaturedProducts(featuredData.map(formatProduct))
        setNewProducts(newData.map(formatProduct))
      } catch (error) {
        console.error("Error fetching products:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  const handleRedeem = (productId: string) => {
    router.push(`/product/${productId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 pb-20">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-purple-600">{t("loading")}</p>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 pb-20">
      <Header />

      <main className="container mx-auto px-4 py-6 space-y-10">
        <section>
          <div className="grid grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => router.push(`/exchange?category=${category.id}`)}
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/80 hover:bg-white hover:shadow-lg transition-all duration-200 border border-purple-100/50 min-h-[90px]"
              >
                <div className="text-2xl">{category.icon}</div>
                <span className="text-[10px] font-medium text-center text-gray-700 leading-tight line-clamp-2">
                  {language === "vi" ? category.nameVi : category.name}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Flash Sale Block */}
        {flashSaleProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-md">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  {t("flashSale")}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/exchange?filter=flash")}
                className="gap-1 hover:bg-purple-100 text-purple-700"
              >
                {t("viewAll")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              {flashSaleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  {...product}
                  onRedeem={() => handleRedeem(product.id)}
                  showActionButton={false}
                />
              ))}
            </div>
          </section>
        )}

        {/* Featured Block */}
        {featuredProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-md">
                  <Star className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {t("featuredProducts")}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/exchange?filter=featured")}
                className="gap-1 hover:bg-purple-100 text-purple-700"
              >
                {t("viewAll")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              {featuredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  {...product}
                  onRedeem={() => handleRedeem(product.id)}
                  showActionButton={false}
                />
              ))}
            </div>
          </section>
        )}

        {/* New Products Block */}
        {newProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {t("newProducts")}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/exchange?filter=new")}
                className="gap-1 hover:bg-purple-100 text-purple-700"
              >
                {t("viewAll")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              {newProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  {...product}
                  onRedeem={() => handleRedeem(product.id)}
                  showActionButton={false}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
