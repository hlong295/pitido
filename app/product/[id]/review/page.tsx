"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Star, Loader2, ArrowLeft } from "lucide-react"
import { Card } from "@/components/ui/card"

export default function WriteReviewPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string

  const [product, setProduct] = useState<any>(null)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    loadProduct()
    loadUser()
  }, [productId])

  async function loadProduct() {
    try {
      const supabase = createBrowserClient()
      const { data } = await supabase.from("products").select("*").eq("id", productId).single()

      if (data) {
        setProduct(data)
      }
    } catch (error) {
      console.error("[v0] Error loading product:", error)
    } finally {
      setLoading(false)
    }
  }

  function loadUser() {
    const STORAGE_KEYS = ["pitodo_pi_user", "pi_user", "current_user"]
    for (const key of STORAGE_KEYS) {
      try {
        const data = localStorage.getItem(key)
        if (data) {
          const parsed = JSON.parse(data)
          setUser(parsed)
          break
        }
      } catch (e) {
        continue
      }
    }
  }

  async function handleSubmit() {
    if (!user) {
      alert("Vui lòng đăng nhập để viết đánh giá")
      router.push("/login")
      return
    }

    if (rating === 0) {
      alert("Vui lòng chọn số sao đánh giá")
      return
    }

    if (!comment.trim()) {
      alert("Vui lòng viết nhận xét")
      return
    }

    try {
      setSubmitting(true)
      const supabase = createBrowserClient()

      const userId = (user as any).piUserId || user.id || user.uid || user.pi_uid

      console.log("[v0] Submitting review with user ID:", userId)

      // Insert review
      const { error } = await supabase.from("reviews").insert({
        product_id: productId,
        user_id: userId,
        rating: rating,
        comment: comment.trim(),
      })

      if (error) {
        console.error("[v0] Error submitting review:", error)
        alert("Có lỗi khi gửi đánh giá: " + error.message)
        return
      }

      // Update product average rating
      const { data: allReviews } = await supabase.from("reviews").select("rating").eq("product_id", productId)

      if (allReviews && allReviews.length > 0) {
        const totalReviews = allReviews.length
        const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews

        await supabase
          .from("products")
          .update({
            average_rating: avgRating,
            total_reviews: totalReviews,
          })
          .eq("id", productId)
      }

      setShowSuccess(true)
    } catch (error) {
      console.error("[v0] Error submitting review:", error)
      alert("Có lỗi khi gửi đánh giá")
    } finally {
      setSubmitting(false)
    }
  }

  function handleSuccessOk() {
    router.push(`/product/${productId}`)
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

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
        <Header />
        <div className="container py-8">
          <p className="text-center text-muted-foreground">Không tìm thấy sản phẩm</p>
        </div>
        <BottomNav />
      </div>
    )
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
        <Header />
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-6 max-w-sm w-full text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Đánh giá của bạn đã được gửi thành công!</h3>
            <p className="text-sm text-muted-foreground">Cảm ơn bạn đã đánh giá sản phẩm.</p>
            <Button onClick={handleSuccessOk} className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
              Xem sản phẩm
            </Button>
          </Card>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
      <Header />
      <main className="container py-6 px-4 max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>

        <Card className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-purple-900 mb-2">Viết đánh giá</h1>
            <p className="text-sm text-muted-foreground">Đánh giá cho: {product.name}</p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Đánh giá của bạn</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= (hoverRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-purple-600">
                {rating === 1 && "Rất tệ"}
                {rating === 2 && "Tệ"}
                {rating === 3 && "Bình thường"}
                {rating === 4 && "Tốt"}
                {rating === 5 && "Rất tốt"}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Nhận xét của bạn</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..."
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">{comment.length}/500 ký tự</p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={submitting || rating === 0 || !comment.trim()}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang gửi...
                </>
              ) : (
                "Gửi đánh giá"
              )}
            </Button>
            <Button variant="outline" onClick={() => router.back()} disabled={submitting}>
              Hủy
            </Button>
          </div>
        </Card>
      </main>
      <BottomNav />
    </div>
  )
}
