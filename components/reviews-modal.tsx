"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Star, Edit2, Trash2, X, Check } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"

interface Review {
  id: string
  user_id: string
  product_id: string
  rating: number
  comment: string
  created_at: string
  pi_users?: {
    pi_username: string
  }
}

interface ReviewsModalProps {
  open: boolean
  onClose: () => void
  reviews: Review[]
  productName: string
  currentUserId?: string
  isAdmin: boolean
  onReviewUpdated: () => void
}

export function ReviewsModal({
  open,
  onClose,
  reviews,
  productName,
  currentUserId,
  isAdmin,
  onReviewUpdated,
}: ReviewsModalProps) {
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null)
  const [editRating, setEditRating] = useState(0)
  const [editComment, setEditComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const startEdit = (review: Review) => {
    setEditingReviewId(review.id)
    setEditRating(review.rating)
    setEditComment(review.comment || "")
  }

  const cancelEdit = () => {
    setEditingReviewId(null)
    setEditRating(0)
    setEditComment("")
  }

  const saveEdit = async (reviewId: string) => {
    if (editRating < 1 || editRating > 5) {
      alert("Vui lòng chọn số sao từ 1-5")
      return
    }

    setLoading(true)
    try {
      const supabase = createBrowserClient()

      const { error } = await supabase
        .from("reviews")
        .update({
          rating: editRating,
          comment: editComment,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reviewId)

      if (error) throw error

      const review = reviews.find((r) => r.id === reviewId)
      if (review) {
        const { data: allReviews } = await supabase.from("reviews").select("rating").eq("product_id", review.product_id)

        if (allReviews && allReviews.length > 0) {
          const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
          await supabase
            .from("products")
            .update({
              average_rating: avgRating,
              total_reviews: allReviews.length,
            })
            .eq("id", review.product_id)
        }
      }

      cancelEdit()
      onReviewUpdated()
    } catch (error: any) {
      alert("Lỗi khi cập nhật đánh giá: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteReview = async (reviewId: string) => {
    setLoading(true)
    try {
      const supabase = createBrowserClient()
      const review = reviews.find((r) => r.id === reviewId)

      const { error } = await supabase.from("reviews").delete().eq("id", reviewId)

      if (error) throw error

      if (review) {
        const { data: remainingReviews } = await supabase
          .from("reviews")
          .select("rating")
          .eq("product_id", review.product_id)

        if (remainingReviews) {
          const avgRating =
            remainingReviews.length > 0
              ? remainingReviews.reduce((sum, r) => sum + r.rating, 0) / remainingReviews.length
              : 0
          await supabase
            .from("products")
            .update({
              average_rating: avgRating,
              total_reviews: remainingReviews.length,
            })
            .eq("id", review.product_id)
        }
      }

      setDeleteConfirmId(null)
      onReviewUpdated()
    } catch (error: any) {
      alert("Lỗi khi xóa đánh giá: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const canEditReview = (review: Review) => {
    return isAdmin || review.user_id === currentUserId
  }

  const canDeleteReview = (review: Review) => {
    return isAdmin
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-purple-700">Đánh giá sản phẩm</DialogTitle>
          <p className="text-sm text-gray-500 truncate">{productName}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {reviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Chưa có đánh giá nào</div>
          ) : (
            reviews.map((review) => (
              <div
                key={review.id}
                className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100"
              >
                {editingReviewId === review.id ? (
                  // Edit mode
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                        {review.pi_users?.pi_username?.charAt(0) || "U"}
                      </div>
                      <span className="font-medium text-sm">{review.pi_users?.pi_username || "Anonymous"}</span>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">Chọn số sao:</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} type="button" onClick={() => setEditRating(star)} className="p-1">
                            <Star
                              className={`w-6 h-6 transition-colors ${
                                star <= editRating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300 hover:text-yellow-300"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <Textarea
                      value={editComment}
                      onChange={(e) => setEditComment(e.target.value)}
                      placeholder="Nhập nội dung đánh giá..."
                      className="min-h-[80px] text-sm"
                    />

                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={cancelEdit} disabled={loading}>
                        <X className="w-4 h-4 mr-1" />
                        Hủy
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveEdit(review.id)}
                        disabled={loading}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        {loading ? "Đang lưu..." : "Lưu"}
                      </Button>
                    </div>
                  </div>
                ) : deleteConfirmId === review.id ? (
                  // Delete confirmation
                  <div className="space-y-3">
                    <p className="text-sm text-center text-gray-700">Bạn có chắc muốn xóa đánh giá này?</p>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)} disabled={loading}>
                        Hủy
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteReview(review.id)}
                        disabled={loading}
                      >
                        {loading ? "Đang xóa..." : "Xóa"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode - Added debug logging to track review display and permissions
                  <div className="space-y-2">
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
                                className={`w-3 h-3 ${
                                  star <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {canEditReview(review) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                            onClick={() => startEdit(review)}
                            title="Sửa đánh giá"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        {canDeleteReview(review) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-100"
                            onClick={() => setDeleteConfirmId(review.id)}
                            title="Xóa đánh giá"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {review.comment && <p className="text-sm text-gray-700 pl-10">{review.comment}</p>}
                    <p className="text-xs text-gray-400 pl-10">
                      {new Date(review.created_at).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
