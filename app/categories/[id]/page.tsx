"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { ProductCard } from "@/components/product-card"
import { Loader2 } from "lucide-react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"

interface Product {
  id: string
  name: string
  price: number
  pi_discount_percent: number | null
  images: string[]
  media: any[]
  flash_sale_enabled: boolean
  flash_sale_start_date: string | null
  flash_sale_end_date: string | null
  average_rating: number
  total_reviews: number
  total_sold: number
  pi_amount?: number
  pitd_amount?: number
  pi_listed_price?: number
  pitd_listed_price?: number
  flash_sale_pi_price?: number
  flash_sale_pitd_price?: number
}

interface Category {
  id: string
  name: string
  name_vi: string
  description: string
}

interface ProductRating {
  avg: number
  count: number
}

export default function CategoryPage() {
  const params = useParams()
  const categoryId = params.id as string
  const [category, setCategory] = useState<Category | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [productRatings, setProductRatings] = useState<Record<string, ProductRating>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCategoryAndProducts()
  }, [categoryId])

  async function loadCategoryAndProducts() {
    try {
      const supabase = createBrowserClient()

      const { data: categoryData } = await supabase.from("categories").select("*").eq("id", categoryId).single()

      if (categoryData) {
        setCategory(categoryData)
      }

      const { data: productsData } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", categoryId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })

      if (productsData) {
        setProducts(productsData)

        const productIds = productsData.map((p) => p.id)
        if (productIds.length > 0) {
          const { data: reviewsData } = await supabase
            .from("reviews")
            .select("product_id, rating")
            .in("product_id", productIds)

          // Calculate real ratings per product
          const ratings: Record<string, ProductRating> = {}
          if (reviewsData && reviewsData.length > 0) {
            productIds.forEach((productId) => {
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
          setProductRatings(ratings)
        }
      }
    } catch (error) {
      console.error("[v0] Error loading category products:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
        <Header />
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <BottomNav />
      </div>
    )
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
        <Header />
        <div className="container py-8">
          <p className="text-center text-muted-foreground">Không tìm thấy danh mục</p>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
      <Header />
      <main className="container py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-purple-900">{category.name_vi || category.name}</h1>
          {category.description && <p className="text-muted-foreground">{category.description}</p>}
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Chưa có sản phẩm nào trong danh mục này</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => {
              const imageUrl = (() => {
                if (Array.isArray(product.media)) {
                  const imageMedia = product.media.find(
                    (m: any) => m.type === "image" && m.url && !m.url.startsWith("blob:"),
                  )
                  if (imageMedia) return imageMedia.url
                }
                if (Array.isArray(product.images) && product.images.length > 0) {
                  return product.images[0]
                }
                return `/placeholder.svg?height=200&width=200&query=${encodeURIComponent(product.name || "product")}`
              })()

              return (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  title={product.name}
                  description=""
                  piAmount={product.pi_amount || product.price}
                  pitdAmount={product.pitd_amount || product.price}
                  originalPiAmount={product.pi_listed_price || product.pi_amount}
                  originalPitdAmount={product.pitd_listed_price || product.pitd_amount}
                  imageUrl={imageUrl}
                  providerName="PITODO"
                  category="Products"
                  rating={productRatings[product.id]?.avg || 0}
                  reviewCount={productRatings[product.id]?.count || 0}
                  quantityExchanged={product.total_sold || 0}
                  deliveryTime="2-3 days"
                  providerLocation="Vietnam"
                  flashSaleEnabled={product.flash_sale_enabled}
                  flashSaleStartDate={
                    product.flash_sale_start_date ? new Date(product.flash_sale_start_date) : undefined
                  }
                  flashSaleEndDate={product.flash_sale_end_date ? new Date(product.flash_sale_end_date) : undefined}
                  flashSalePiPrice={product.flash_sale_pi_price}
              flashSalePitdPrice={product.flash_sale_pitd_price}
                  flashSaleDiscountPercent={product.pi_discount_percent || undefined}
                  discountPercentage={product.pi_discount_percent || undefined}
                  supportsPi={true}
                  supportsPitd={true}
                />
              )
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
