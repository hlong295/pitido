"use client"

import type React from "react"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Maximize2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ImageLightbox } from "./image-lightbox"

interface MediaSliderProps {
  images: string[]
  videoUrl?: string
  alt: string
}

/**
 * Shopee-like media slider (mobile-friendly):
 * - Native swipe (horizontal scroll + scroll-snap) => smooth, no jitter
 * - Thumbnails strip
 * - Counter badge
 * - Video as a slide item (tap to play)
 * - Image lightbox (tap image to open)
 */
export function MediaSlider({ images, videoUrl, alt }: MediaSliderProps) {
  const allMedia = useMemo(() => (videoUrl ? [...images, videoUrl] : images), [images, videoUrl])
  const totalItems = allMedia.length

  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showVideo, setShowVideo] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)
  // When user taps right after a swipe, `currentIndex` state can lag behind.
  // We store the computed index at tap-time so the fullscreen opens exactly
  // at the media item the user is currently viewing.
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Tap detection (avoid opening lightbox when user is swiping the slider)
  const tapStartRef = useRef<{ x: number; y: number; t: number } | null>(null)

  // Prevent "click-through reopen" on mobile when closing lightbox
  const lastLightboxCloseAt = useRef<number>(0)

  // Video thumbnail (best-effort; can fail due to CORS)
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null)

  const isVideoIndex = videoUrl !== undefined && currentIndex === images.length

  useEffect(() => {
    if (!isVideoIndex) setShowVideo(false)
  }, [isVideoIndex])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const updateSize = () => {
      const w = el.getBoundingClientRect().width || 0
      setContainerWidth(w)
    }

    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (videoUrl && !videoThumbnail) {
      // Defer thumbnail extraction so it doesn't block initial paint / swipe.
      const run = () => extractVideoThumbnail(videoUrl)
      if (typeof (window as any).requestIdleCallback === "function") {
        ;(window as any).requestIdleCallback(run, { timeout: 800 })
      } else {
        setTimeout(run, 0)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl])

  const extractVideoThumbnail = (url: string) => {
    try {
      const video = document.createElement("video")
      video.crossOrigin = "anonymous"
      video.muted = true
      video.playsInline = true
      video.src = url
      video.currentTime = 0.8

      const onLoaded = () => {
        const canvas = document.createElement("canvas")
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        setVideoThumbnail(canvas.toDataURL("image/jpeg", 0.82))
      }

      video.addEventListener("loadeddata", onLoaded, { once: true })
      video.load()
    } catch {
      // ignore
    }
  }

  const clampIndex = (idx: number) => {
    if (idx < 0) return 0
    if (idx > totalItems - 1) return totalItems - 1
    return idx
  }

  const scrollToIndex = (idx: number, behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current
    if (!el || !containerWidth) return
    const next = clampIndex(idx)
    el.scrollTo({ left: next * containerWidth, behavior })
    setCurrentIndex(next)
    setShowVideo(next === images.length && videoUrl !== undefined)
  }

  const goToPrevious = () => scrollToIndex(currentIndex === 0 ? totalItems - 1 : currentIndex - 1)
  const goToNext = () => scrollToIndex(currentIndex === totalItems - 1 ? 0 : currentIndex + 1)

  // Update current index while user swipes
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (!containerWidth) return
        const idx = clampIndex(Math.round(el.scrollLeft / containerWidth))
        setCurrentIndex(idx)
      })
    }

    el.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener("scroll", onScroll)
    }
  }, [containerWidth, totalItems])

  const handlePointerDown = (e: React.PointerEvent) => {
    // If just closed lightbox, ignore the next interaction (prevents immediate reopen)
    if (Date.now() - lastLightboxCloseAt.current < 350) {
      tapStartRef.current = null
      return
    }
    tapStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = tapStartRef.current
    tapStartRef.current = null
    if (!start) return

    // Treat as tap only if finger didn't move much (otherwise it's a swipe)
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const moved = Math.hypot(dx, dy)
    const dt = Date.now() - start.t

    if (moved < 10 && dt < 650) {
      // Open fullscreen for BOTH images and video.
      // Compute index from scrollLeft to avoid lag when user taps right after a swipe.
      const el = scrollRef.current
      const idx = el && containerWidth ? clampIndex(Math.round(el.scrollLeft / containerWidth)) : currentIndex
      setLightboxIndex(idx)
      setShowLightbox(true)
    }
  }

  const closeLightbox = () => {
    lastLightboxCloseAt.current = Date.now()
    setShowLightbox(false)
  }

  return (
    <>
      <div className="space-y-3">
        <div className="relative">
          <div
            ref={scrollRef}
            className="relative aspect-square bg-gradient-to-br from-purple-100 to-pink-100 rounded-3xl overflow-x-auto overflow-y-hidden shadow-[0_8px_30px_rgb(168,85,247,0.12)] flex snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ WebkitOverflowScrolling: "touch" }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            {allMedia.map((media, idx) => {
              const isVideoItem = idx === images.length && videoUrl !== undefined
              const isActive = idx === currentIndex

              return (
                <div
                  key={idx}
                  className="relative h-full w-full shrink-0 snap-center"
                  style={{ scrollSnapStop: "always" }}
                >
                  {isVideoItem ? (
                    isActive && showVideo ? (
                      <video src={videoUrl} controls playsInline className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Image
                          src={videoThumbnail || images[0] || "/placeholder.svg?height=400&width=400"}
                          alt={alt}
                          fill
                          className="object-cover"
                          // Prioritize loading current & neighbor slides for smoother swipe.
                          priority={idx === 0 || idx === currentIndex || idx === currentIndex - 1 || idx === currentIndex + 1}
                          fetchPriority={idx === currentIndex ? "high" : "auto"}
                          sizes="100vw"
                          draggable={false}
                        />
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            scrollToIndex(idx)
                            setShowVideo(true)
                          }}
                          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                        >
                          <div className="bg-white rounded-full p-4 shadow-lg">
                            <Play className="w-8 h-8 text-purple-600 fill-purple-600" />
                          </div>
                        </button>
                      </>
                    )
                  ) : (
                    <>
                      <Image
                        src={(media as string) || "/placeholder.svg?height=400&width=400"}
                        alt={alt}
                        fill
                        className="object-cover"
                        // Prioritize loading current & neighbor slides for smoother swipe.
                        priority={idx === 0 || idx === currentIndex || idx === currentIndex - 1 || idx === currentIndex + 1}
                        fetchPriority={idx === currentIndex ? "high" : "auto"}
                        sizes="100vw"
                        draggable={false}
                      />
                      {isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            // Ensure fullscreen opens at the currently visible slide.
                            const el = scrollRef.current
                            const idx = el && containerWidth ? clampIndex(Math.round(el.scrollLeft / containerWidth)) : currentIndex
                            setLightboxIndex(idx)
                            setShowLightbox(true)
                          }}
                        >
                          <Maximize2 className="w-5 h-5" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Counter badge */}
          {totalItems > 1 && (
            <div className="absolute top-3 left-3 text-white text-xs bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full pointer-events-none">
              {currentIndex + 1} / {totalItems}
            </div>
          )}

          {/* Arrows (desktop assist; still works on mobile tap) */}
          {totalItems > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white shadow-lg rounded-full z-10"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  goToPrevious()
                }}
              >
                <ChevronLeft className="w-5 h-5 text-purple-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white shadow-lg rounded-full z-10"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  goToNext()
                }}
              >
                <ChevronRight className="w-5 h-5 text-purple-600" />
              </Button>
            </>
          )}
        </div>

        {/* Thumbnails strip */}
        {totalItems > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {allMedia.slice(0, 20).map((media, idx) => {
              const isVideoThumb = idx === images.length && videoUrl !== undefined
              const selected = idx === currentIndex
              return (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToIndex(idx)
                  }}
                  className={`relative aspect-square w-14 shrink-0 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl overflow-hidden border-2 transition-all shadow-sm ${
                    selected ? "border-purple-500 shadow-lg shadow-purple-200" : "border-transparent hover:border-purple-300"
                  }`}
                >
                  <Image
                    src={
                      isVideoThumb
                        ? videoThumbnail || images[0] || "/placeholder.svg?height=120&width=120"
                        : ((media as string) || "/placeholder.svg?height=120&width=120")
                    }
                    alt={`${alt} ${idx + 1}`}
                    fill
                    className="object-cover"
                    draggable={false}
                  />
                  {isVideoThumb && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {showLightbox && (
        <ImageLightbox images={images} videoUrl={videoUrl} initialIndex={lightboxIndex} alt={alt} onClose={closeLightbox} />
      )}
    </>
  )
}
