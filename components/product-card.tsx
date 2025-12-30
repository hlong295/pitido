"use client"

import type React from "react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/lib/language-context"
import { formatCurrency, isFlashSaleActive, getFlashSalePrice, calculateFlashSaleDiscount } from "@/lib/constants"
import Image from "next/image"
import { Heart, Star, MapPin, Clock, TrendingUp, Zap } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"

interface ProductCardProps {
  id: string
  title: string
  description: string
  piAmount?: number
  pitdAmount?: number
  category: string
  imageUrl?: string
  providerName: string
  onRedeem?: () => void
  discountPercentage?: number
  flashSaleEndDate?: Date
  isFavorite?: boolean
  marketingLabel?: string
  rating?: number
  reviewCount?: number
  quantityExchanged?: number
  deliveryTime?: string
  providerLocation?: string
  supportsPi?: boolean
  supportsPitd?: boolean
  flashSaleEnabled?: boolean
  flashSaleStartDate?: Date
  flashSalePiPrice?: number
  flashSalePitdPrice?: number
  flashSaleDiscountPercent?: number
  originalPiAmount?: number
  originalPitdAmount?: number
  compact?: boolean
  showActionButton?: boolean
}

export function ProductCard({
  title,
  imageUrl,
  providerName,
  piAmount,
  pitdAmount,
  onRedeem,
  discountPercentage,
  flashSaleEndDate,
  isFavorite: initialFavorite = false,
  marketingLabel,
  rating = 0,
  reviewCount = 0,
  quantityExchanged = 0,
  deliveryTime,
  providerLocation,
  supportsPi = true,
  supportsPitd = true,
  id,
  flashSaleEnabled,
  flashSaleStartDate,
  flashSalePiPrice,
  flashSalePitdPrice,
  flashSaleDiscountPercent,
  originalPiAmount,
  originalPitdAmount,
  compact = false,
  showActionButton = false,
}: ProductCardProps) {
  const { t } = useLanguage()
  const [isFavorite, setIsFavorite] = useState(initialFavorite)
  const [timeLeft, setTimeLeft] = useState("")
  const router = useRouter()
  const [loadingFavorite, setLoadingFavorite] = useState(false)

  const flashSaleIsActive = isFlashSaleActive(flashSaleEnabled, flashSaleStartDate, flashSaleEndDate)

  const displayPiAmount =
    flashSaleIsActive && originalPiAmount
      ? getFlashSalePrice(originalPiAmount, flashSalePiPrice, flashSaleDiscountPercent)
      : piAmount

  const displayPitdAmount =
    flashSaleIsActive && originalPitdAmount
      ? getFlashSalePrice(originalPitdAmount, flashSalePitdPrice, flashSaleDiscountPercent)
      : pitdAmount

  const calculatedDiscount =
    flashSaleIsActive && originalPiAmount && displayPiAmount
      ? calculateFlashSaleDiscount(originalPiAmount, displayPiAmount)
      : discountPercentage

  useEffect(() => {
    if (!flashSaleIsActive || !flashSaleEndDate) return

    const updateTimer = () => {
      const now = new Date()
      const diff = flashSaleEndDate.getTime() - now.getTime()

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
  }, [flashSaleIsActive, flashSaleEndDate, t])

  const handleCardClick = () => {
    router.push(`/product/${id}`)
  }

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()

    const STORAGE_KEYS = ["pitodo_pi_user", "pi_user", "current_user"]
    let user: any = null

    for (const key of STORAGE_KEYS) {
      try {
        const data = localStorage.getItem(key)
        if (data) {
          user = JSON.parse(data)
          break
        }
      } catch (e) {
        continue
      }
    }

    if (!user) {
      alert("Vui lòng đăng nhập để lưu sản phẩm yêu thích")
      router.push("/login")
      return
    }

    try {
      setLoadingFavorite(true)
      const supabase = createBrowserClient()

      if (isFavorite) {
        await supabase.from("user_favorites").delete().eq("user_id", user.uid).eq("product_id", id)
        setIsFavorite(false)
      } else {
        const { error } = await supabase.from("user_favorites").insert({
          user_id: user.uid,
          product_id: id,
        })

        if (error) {
          console.error("[v0] Error adding favorite:", error)
          alert("Có lỗi khi lưu sản phẩm yêu thích")
          return
        }
        setIsFavorite(true)
      }
    } catch (error) {
      console.error("[v0] Error toggling favorite:", error)
      alert("Có lỗi khi thao tác với sản phẩm yêu thích")
    } finally {
      setLoadingFavorite(false)
    }
  }

  return (
    <Card
      className="overflow-hidden hover:shadow-2xl transition-all duration-300 relative cursor-pointer border-0 rounded-3xl bg-gradient-to-br from-purple-50/80 via-pink-50/80 to-purple-50/80 backdrop-blur-sm shadow-lg hover:shadow-purple-200/50"
      onClick={handleCardClick}
    >
      <button
        onClick={handleFavoriteToggle}
        disabled={loadingFavorite}
        className={`absolute top-1.5 right-1.5 z-10 bg-gradient-to-br from-violet-100 to-purple-100 backdrop-blur-sm rounded-full hover:from-violet-200 hover:to-purple-200 transition-all shadow-md hover:scale-110 disabled:opacity-50 ${compact ? "p-1" : "p-1.5"}`}
      >
        <Heart
          className={`${compact ? "w-3 h-3" : "w-3.5 h-3.5"} ${isFavorite ? "fill-red-500 text-red-500" : "text-violet-600"}`}
        />
      </button>

      <div className="aspect-square relative bg-gradient-to-br from-purple-100 to-pink-100">
        <Image
          src={imageUrl || "/placeholder.svg?height=400&width=400"}
          alt={title}
          fill
          className="object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = "/placeholder.svg?height=400&width=400"
          }}
        />

        {flashSaleIsActive && (
          <Badge
            className={`absolute top-1.5 left-1.5 z-10 bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 shadow-lg rounded-xl font-bold flex items-center gap-1 ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
          >
            <Zap className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
            Flash Sale
          </Badge>
        )}

        {!flashSaleIsActive && calculatedDiscount && calculatedDiscount > 0 && (
          <Badge
            className={`absolute top-1.5 left-1.5 z-10 bg-gradient-to-br from-pink-500 via-orange-500 to-pink-600 text-white border-0 shadow-lg rounded-xl font-bold ${compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
          >
            -{calculatedDiscount}%
          </Badge>
        )}

        {flashSaleIsActive && flashSaleEndDate && (
          <div
            className={`absolute bottom-1.5 left-1.5 right-1.5 bg-gradient-to-br from-pink-500 via-violet-500 to-pink-600 text-white rounded-xl font-bold shadow-xl backdrop-blur-sm ${compact ? "text-[10px] px-1.5 py-1" : "text-xs px-2 py-1.5"}`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {t("flashSale")}
              </span>
              <span className="bg-white/20 backdrop-blur-sm rounded-lg px-1.5 py-0.5">{timeLeft}</span>
            </div>
          </div>
        )}
      </div>

      <div className={compact ? "p-1.5 space-y-0.5" : "pt-0.5 pb-1.5 px-2 space-y-1"}>
        {!compact && marketingLabel && (
          <Badge
            variant="secondary"
            className="text-[10px] bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 border-0 rounded-xl shadow-sm px-1.5 py-0.5"
          >
            <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
            {marketingLabel}
          </Badge>
        )}

        <h3
          className={`font-semibold line-clamp-2 leading-tight text-purple-900 ${compact ? "text-[11px]" : "text-xs"}`}
        >
          {title}
        </h3>

        {rating > 0 && (
          <div className={`flex items-center gap-1 ${compact ? "text-[9px]" : "text-[10px]"}`}>
            <Star className={`${compact ? "w-2 h-2" : "w-2.5 h-2.5"} fill-yellow-400 text-yellow-400`} />
            <span className="font-semibold text-purple-900">{rating.toFixed(1)}</span>
            {reviewCount > 0 && (
              <span className="text-purple-600/70">
                ({reviewCount} {t("reviews")})
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {supportsPi && displayPiAmount !== undefined && displayPiAmount > 0 && (
            <div className="space-y-0.5">
              {flashSaleIsActive && originalPiAmount && originalPiAmount !== displayPiAmount && (
                <div
                  className={`flex items-center gap-1 text-purple-400 line-through ${compact ? "text-[9px]" : "text-[10px]"}`}
                >
                  <span>π</span>
                  <span>{formatCurrency(originalPiAmount)}</span>
                </div>
              )}
              <div className={`flex items-center gap-1 font-bold ${compact ? "text-[11px]" : "text-sm"}`}>
                <span className="text-purple-600">π</span>
                <span className="text-purple-700">{formatCurrency(displayPiAmount)}</span>
              </div>
            </div>
          )}

          {supportsPi &&
            supportsPitd &&
            displayPiAmount !== undefined &&
            displayPiAmount > 0 &&
            displayPitdAmount !== undefined &&
            displayPitdAmount > 0 && (
              <span className={`text-purple-400 ${compact ? "text-[10px]" : "text-xs"}`}>|</span>
            )}

          {supportsPitd && displayPitdAmount !== undefined && displayPitdAmount > 0 && (
            <div className="space-y-0.5">
              {flashSaleIsActive && originalPitdAmount && originalPitdAmount !== displayPitdAmount && (
                <div
                  className={`flex items-center gap-1 text-pink-400 line-through ${compact ? "text-[9px]" : "text-[10px]"}`}
                >
                  <span>PITD</span>
                  <span>{formatCurrency(originalPitdAmount)}</span>
                </div>
              )}
              <div className={`flex items-center gap-1 font-bold ${compact ? "text-[11px]" : "text-sm"}`}>
                <span className="text-pink-600">PITD</span>
                <span className="text-pink-700">{formatCurrency(displayPitdAmount)}</span>
              </div>
            </div>
          )}
        </div>

        <div className={`flex items-center justify-between gap-2 ${compact ? "text-[9px]" : "text-[10px]"}`}>
          {quantityExchanged > 0 && (
            <p className="text-purple-600/70 flex-shrink-0">
              {quantityExchanged.toLocaleString()} {t("exchanged")}
            </p>
          )}

          {deliveryTime && (
            <div className="flex items-center gap-1 text-purple-600/70 flex-shrink-0">
              <Clock className={`${compact ? "w-2 h-2" : "w-2.5 h-2.5"}`} />
              <span>
                {t("delivery")}: {deliveryTime}
              </span>
            </div>
          )}
        </div>

        <div
          className={`flex items-start gap-1 text-purple-600/70 border-t border-purple-200/50 ${compact ? "text-[9px] pt-0.5" : "text-[10px] pt-0.5"}`}
        >
          <MapPin className={`${compact ? "w-2 h-2" : "w-2.5 h-2.5"} mt-0.5 flex-shrink-0 text-purple-500`} />
          <div className="flex-1 min-w-0 -space-y-0.5">
            <p className="font-medium text-purple-800 truncate">{providerName}</p>
            {providerLocation && <p className="truncate leading-tight">{providerLocation}</p>}
          </div>
        </div>

        {showActionButton && (
          <Button
            onClick={(e) => {
              e.stopPropagation()
              onRedeem?.()
            }}
            className={`w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 shadow-md rounded-2xl ${compact ? "text-[10px] py-1 h-6" : "text-xs py-1.5 h-7"}`}
            size={compact ? "sm" : "default"}
          >
            {t("redeemNow")}
          </Button>
        )}
      </div>
    </Card>
  )
}
