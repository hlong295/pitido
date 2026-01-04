"use client"

import type React from "react"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImageLightboxProps {
  images: string[]
  videoUrl?: string
  initialIndex?: number
  alt: string
  onClose: () => void
}

/**
 * Mobile-friendly lightbox:
 * - Uses native swipe (scroll-snap) for smoothness
 * - Close button always works (prevents click-through)
 * - Locks body scroll while open
 */
export function ImageLightbox({ images, videoUrl, initialIndex = 0, alt, onClose }: ImageLightboxProps) {
  const allMedia = useMemo(() => (videoUrl ? [...images, videoUrl] : images), [images, videoUrl])
  const totalItems = allMedia.length

  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  // IMPORTANT:
  // In some app shells (including Pi Browser / embedded webviews), a parent container may have a CSS transform.
  // When that happens, `position: fixed` becomes relative to that transformed ancestor and the lightbox
  // looks like it's "inside a frame" instead of true fullscreen.
  // Rendering via a portal to `document.body` guarantees true fullscreen behavior.
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Fallback width for immediate correct initial scroll before ResizeObserver reports.
    // In some webviews, ResizeObserver can lag a frame or two, causing the lightbox
    // to flash the first slide.
    if (typeof window !== "undefined") {
      const w = window.innerWidth || 0
      if (w > 0) setContainerWidth((prev) => (prev ? prev : w))
    }
  }, [])

  // Zoom / pan state for the currently visible image (mobile pinch + drag)
  const [zoomScale, setZoomScale] = useState(1)
  const [zoomTx, setZoomTx] = useState(0)
  const [zoomTy, setZoomTy] = useState(0)
  const zoomingRef = useRef(false)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const startDistanceRef = useRef<number | null>(null)
  const startScaleRef = useRef(1)
  const startCenterRef = useRef<{ x: number; y: number } | null>(null)
  const startPanRef = useRef<{ x: number; y: number } | null>(null)
  const startTranslateRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Swipe-to-close (when not zoomed)
  const swipeStartRef = useRef<{ x: number; y: number; t: number } | null>(null)

  // When zooming, we must "lock" the carousel to the current slide.
  // Otherwise, small horizontal drift can reveal the neighboring slide under the current one
  // (especially in embedded webviews / Pi Browser), which looks like the zoomed image
  // is "stuck" to the next image.
  const lockScrollToCurrent = () => {
    const el = scrollRef.current
    if (!el || !containerWidth) return
    el.scrollLeft = currentIndex * containerWidth
  }

  const setCarouselLocked = (locked: boolean) => {
    const el = scrollRef.current
    if (!el) return
    el.style.overflowX = locked ? "hidden" : "auto"
    ;(el.style as any).scrollSnapType = locked ? "none" : "x mandatory"
    if (locked) lockScrollToCurrent()
  }

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.hypot(dx, dy)
  }
  const center = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

  const resetZoom = () => {
    zoomingRef.current = false
    pointersRef.current.clear()
    startDistanceRef.current = null
    startCenterRef.current = null
    startPanRef.current = null
    startScaleRef.current = 1
    startTranslateRef.current = { x: 0, y: 0 }
    setZoomScale(1)
    setZoomTx(0)
    setZoomTy(0)

    // Unlock carousel to restore smooth swipe between slides
    setCarouselLocked(false)
  }

  useEffect(() => {
    // lock body scroll
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Reset zoom when slide changes
  useEffect(() => {
    resetZoom()
    // Re-enable slider scrolling
    setCarouselLocked(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex])

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
    // jump to initial index (no animation) once we know width
    const el = scrollRef.current
    if (!el || !containerWidth) return
    const idx = Math.max(0, Math.min(initialIndex, totalItems - 1))
    el.scrollTo({ left: idx * containerWidth, behavior: "auto" })
    setCurrentIndex(idx)
  }, [containerWidth, initialIndex, totalItems])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (!containerWidth) return
        const idx = Math.max(0, Math.min(totalItems - 1, Math.round(el.scrollLeft / containerWidth)))
        setCurrentIndex(idx)
      })
    }

    el.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener("scroll", onScroll)
    }
  }, [containerWidth, totalItems])

  const scrollToIndex = (idx: number) => {
    const el = scrollRef.current
    if (!el || !containerWidth) return
    const next = Math.max(0, Math.min(totalItems - 1, idx))
    el.scrollTo({ left: next * containerWidth, behavior: "smooth" })
    setCurrentIndex(next)
  }

  const handleZoomPointerDown = (e: React.PointerEvent) => {
    // Only zoom images (not video) and only on the active slide wrapper.
    // Capture pointer so we keep getting move events even if finger drifts.
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Swipe-to-close start (only if not zoomed)
    if (zoomScale <= 1.01 && pointersRef.current.size === 1) {
      swipeStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    }

    // Pan start (only if already zoomed)
    if (zoomScale > 1.01 && pointersRef.current.size === 1) {
      startPanRef.current = { x: e.clientX, y: e.clientY }
      startTranslateRef.current = { x: zoomTx, y: zoomTy }
    }

    // Pinch start
    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values())
      startDistanceRef.current = distance(pts[0], pts[1])
      startScaleRef.current = zoomScale
      startCenterRef.current = center(pts[0], pts[1])
      startTranslateRef.current = { x: zoomTx, y: zoomTy }
      zoomingRef.current = true

      // Disable slider scroll while zooming to avoid fight with horizontal swipe
      setCarouselLocked(true)
    }
  }

  const handleZoomPointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const pts = Array.from(pointersRef.current.values())

    // Keep carousel pinned while zooming/panning so the next/prev slide never peeks through.
    if (zoomScale > 1.01 || zoomingRef.current) {
      lockScrollToCurrent()
    }

    // Pinch zoom
    if (pts.length === 2 && startDistanceRef.current && startCenterRef.current) {
      const distNow = distance(pts[0], pts[1])
      const nextScale = clamp((startScaleRef.current * distNow) / startDistanceRef.current, 1, 4)

      // translate with pinch center movement (simple, feels natural)
      const cNow = center(pts[0], pts[1])
      const dcx = cNow.x - startCenterRef.current.x
      const dcy = cNow.y - startCenterRef.current.y

      setZoomScale(nextScale)
      setZoomTx(startTranslateRef.current.x + dcx)
      setZoomTy(startTranslateRef.current.y + dcy)

      // Prevent the underlying carousel from drifting and revealing neighbors.
      lockScrollToCurrent()
      return
    }

    // Pan when zoomed
    if (pts.length === 1 && zoomScale > 1.01 && startPanRef.current) {
      const dx = e.clientX - startPanRef.current.x
      const dy = e.clientY - startPanRef.current.y
      setZoomTx(startTranslateRef.current.x + dx)
      setZoomTy(startTranslateRef.current.y + dy)

      lockScrollToCurrent()
      return
    }

    // Swipe-down to close (only when not zoomed)
    if (pts.length === 1 && zoomScale <= 1.01 && swipeStartRef.current) {
      const dy = e.clientY - swipeStartRef.current.y
      const dx = e.clientX - swipeStartRef.current.x
      // If user is clearly dragging vertically, prevent the horizontal slider from taking over
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
        e.preventDefault()
      }
    }
  }

  const handleZoomPointerUpOrCancel = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId)

    // End pinch
    if (pointersRef.current.size < 2) {
      startDistanceRef.current = null
      startCenterRef.current = null
      zoomingRef.current = false
    }

    // Re-enable slider scroll if not zoomed
    setCarouselLocked(zoomScale > 1.01)

    // Swipe-to-close decision (only if not zoomed)
    if (zoomScale <= 1.01 && swipeStartRef.current) {
      const dx = e.clientX - swipeStartRef.current.x
      const dy = e.clientY - swipeStartRef.current.y
      const dt = Date.now() - swipeStartRef.current.t
      swipeStartRef.current = null

      // close on a clear vertical swipe (down or up)
      if (dt < 700 && Math.abs(dy) > 120 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        onClose()
        return
      }
    }

    // If scale snapped back close to 1, fully reset so swipe between slides works again
    if (zoomScale <= 1.05 && pointersRef.current.size === 0) {
      resetZoom()
      setCarouselLocked(false)
      return
    }

    // If user zoomed in but released, keep state (no-op)
  }

  const goToPrevious = () => scrollToIndex(currentIndex === 0 ? totalItems - 1 : currentIndex - 1)
  const goToNext = () => scrollToIndex(currentIndex === totalItems - 1 ? 0 : currentIndex + 1)

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") goToPrevious()
      if (e.key === "ArrowRight") goToNext()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex])

  const content = (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }}
      onPointerDown={(e) => {
        // prevent click-through on mobile
        e.preventDefault()
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/10 z-50"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }}
      >
        <X className="w-6 h-6" />
      </Button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1.5 rounded-full z-50 pointer-events-none">
        {currentIndex + 1} / {totalItems}
      </div>

      {totalItems > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white z-50"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              goToPrevious()
            }}
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white z-50"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              goToNext()
            }}
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </>
      )}

      <div
        className="relative w-full h-full flex items-center justify-center p-4"
        onClick={(e) => {
          // prevent closing when tapping content
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <div
          ref={scrollRef}
          className="relative w-full h-full flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {allMedia.map((media, idx) => {
            const isVideoItem = idx === images.length && videoUrl !== undefined

            return (
              <div
                key={idx}
                className="relative h-full w-full shrink-0 snap-center flex items-center justify-center overflow-hidden bg-black"
                style={{ minWidth: containerWidth ? `${containerWidth}px` : "100%", scrollSnapStop: "always" }}
              >
                {isVideoItem ? (
                  <video src={videoUrl} controls playsInline className="w-full h-full object-contain rounded-lg" />
                ) : (
                  <div
                    className="relative w-full h-full"
                    // Only attach zoom handlers for the active slide to avoid pointer bookkeeping across slides
                    onPointerDown={idx === currentIndex ? handleZoomPointerDown : undefined}
                    onPointerMove={idx === currentIndex ? handleZoomPointerMove : undefined}
                    onPointerUp={idx === currentIndex ? handleZoomPointerUpOrCancel : undefined}
                    onPointerCancel={idx === currentIndex ? handleZoomPointerUpOrCancel : undefined}
                    style={{ touchAction: idx === currentIndex ? "none" : "pan-x" }}
                  >
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        transform: `translate3d(${zoomTx}px, ${zoomTy}px, 0) scale(${zoomScale})`,
                        transformOrigin: "center center",
                        willChange: "transform",
                      }}
                    >
                      <div className="relative w-full h-full">
                        <Image
                          src={(media as string) || "/placeholder.svg"}
                          alt={`${alt} ${idx + 1}`}
                          fill
                          className="object-contain"
                          sizes="100vw"
                          draggable={false}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(content, document.body)
}
