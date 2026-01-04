"use client"

import { useMemo, useState } from "react"
import { createPiPayment, ensurePiSdkReady, getPiSdkErrorKey } from "@/lib/pi-sdk"
import { createBrowserClient } from "@/lib/supabase/client"
import { CheckCircle, Loader2 } from "lucide-react"

type AnyObj = Record<string, any>

type Currency = "PI" | "PITD"

type ExchangeModalProps = {
  open: boolean
  onClose: () => void
  product: AnyObj | null
  amountPi?: number
  amountPitd?: number
  currency?: Currency
}

export default function ExchangeModal({
  open,
  onClose,
  product,
  amountPi,
  amountPitd,
  currency = "PI",
}: ExchangeModalProps) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(currency)

  const amount = selectedCurrency === "PI" ? amountPi : amountPitd

  const title = useMemo(() => {
    const name = product?.name ?? product?.title ?? "Product"
    return `Exchange: ${name}`
  }, [product])

  const memo = useMemo(() => {
    const name = product?.name ?? product?.title ?? "product"
    const id = product?.id ?? ""
    return `PITODO exchange - ${name}${id ? ` (#${id})` : ""}`
  }, [product])

  if (!open) return null

  const handlePiPayment = async () => {
    if (!amountPi) throw new Error("INVALID_PI_AMOUNT")

    const ready = await ensurePiSdkReady()
    if (!ready.ok) throw new Error(ready.error)

    if (!product) throw new Error("NO_PRODUCT")

    await createPiPayment(
      {
        amount: Number(amountPi),
        memo,
        metadata: {
          productId: product?.id ?? null,
          category: product?.category ?? null,
          merchant: product?.merchant_username ?? product?.merchant_name ?? null,
        },
      },
      {
        onReadyForServerApproval: async (paymentId: string) => {
          try {
            await fetch("/api/payments/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId }),
            })
          } catch (e) {
            console.log("[exchange-modal] approve error:", e)
          }
        },
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          try {
            await fetch("/api/payments/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId, txid }),
            })
          } finally {
            setDone(true)
            setBusy(false)
          }
        },
        onCancel: (paymentId: string) => {
          console.log("[exchange-modal] cancelled:", paymentId)
          setBusy(false)
          setErr("Payment cancelled.")
        },
        onError: (error: Error, payment?: AnyObj) => {
          console.log("[exchange-modal] error:", error, payment)
          setBusy(false)
          setErr(String(error?.message || error))
        },
      },
    )
  }

  const handlePitdPayment = async () => {
    if (!amountPitd) throw new Error("INVALID_PITD_AMOUNT")
    if (!product) throw new Error("NO_PRODUCT")

    // Get user from localStorage
    const STORAGE_KEYS = ["pitodo_pi_user", "pi_user", "current_user"]
    let userId: string | null = null

    for (const key of STORAGE_KEYS) {
      try {
        const data = localStorage.getItem(key)
        if (data) {
          const parsed = JSON.parse(data)
          const username = parsed.piUsername || parsed.pi_username || parsed.username

          if (username) {
            // Get database user ID
            const supabase = createBrowserClient()
            const { data: userData } = await supabase.from("pi_users").select("id").eq("pi_username", username).single()

            if (userData) {
              userId = userData.id
              break
            }
          }
        }
      } catch (e) {
        continue
      }
    }

    if (!userId) {
      throw new Error("USER_NOT_FOUND")
    }

    const supabase = createBrowserClient()
    const { data: productData } = await supabase.from("products").select("seller_id").eq("id", product.id).single()

    const providerId = productData?.seller_id

    const response = await fetch("/api/payments/pitd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        userId,
        amount: amountPitd,
        providerId,
        productName: product?.name ?? product?.title ?? "Product",
        quantity: 1,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || "Payment failed")
    }

    console.log("[v0] PITD payment completed:", result)
  }

  const start = async () => {
    setErr(null)
    setDone(false)
    setBusy(true)

    try {
      if (!product) throw new Error("NO_PRODUCT")
      if (!amount || Number.isNaN(amount) || amount <= 0) throw new Error("INVALID_AMOUNT")

      if (selectedCurrency === "PI") {
        await handlePiPayment()
      } else {
        await handlePitdPayment()
        setDone(true)
        setBusy(false)
      }
    } catch (e: any) {
      const key = getPiSdkErrorKey(e)
      if (key === "PI_SDK_MISSING") setErr("Pi SDK is missing. Please open PITODO inside Pi Browser.")
      else if (key === "PI_SDK_AUTH_CANCELLED") setErr("You cancelled the Pi confirmation.")
      else if (String(e?.message).includes("Insufficient PITD balance")) setErr("Số dư PITD không đủ.")
      else if (String(e?.message).includes("USER_NOT_FOUND"))
        setErr("Không tìm thấy tài khoản. Vui lòng đăng nhập lại.")
      else setErr(String(e?.message || e))
      setBusy(false)
    }
  }

  const handleClose = () => {
    setDone(false)
    setErr(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3">
      <div className="w-full max-w-md rounded-2xl bg-white/90 backdrop-blur shadow-xl border border-white/60">
        <div className="p-4">
          {done ? (
            <div className="py-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-green-700 mb-2">Thanh toán thành công!</h3>
              <p className="text-gray-600 mb-1">Bạn đã mua thành công sản phẩm</p>
              <p className="font-semibold text-purple-700 mb-4">{product?.name ?? product?.title ?? "Product"}</p>
              <p className="text-sm text-gray-500 mb-6">
                Số tiền:{" "}
                <span className="font-semibold text-pink-600">
                  {amount} {selectedCurrency === "PI" ? "π" : "PITD"}
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium hover:bg-gray-50"
                  onClick={handleClose}
                >
                  Đóng
                </button>
                <button
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 text-sm font-semibold text-white hover:from-purple-700 hover:to-pink-700"
                  onClick={() => {
                    handleClose()
                    window.location.href = "/account"
                  }}
                >
                  Xem đơn hàng
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-base font-semibold text-[#6e2036]">{title}</div>
              <div className="mt-1 text-sm text-gray-600">
                {selectedCurrency === "PI"
                  ? "Bạn sẽ kết nối ví Pi khi xác nhận."
                  : "Thanh toán sẽ được trừ từ ví PITD của bạn."}
              </div>

              {/* Currency selector */}
              {amountPi && amountPitd && (
                <div className="mt-3 flex gap-2 rounded-xl bg-gray-100 p-1">
                  <button
                    onClick={() => setSelectedCurrency("PI")}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                      selectedCurrency === "PI" ? "bg-white shadow-sm text-purple-700" : "text-gray-600"
                    }`}
                  >
                    Thanh toán Pi
                  </button>
                  <button
                    onClick={() => setSelectedCurrency("PITD")}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                      selectedCurrency === "PITD" ? "bg-white shadow-sm text-pink-700" : "text-gray-600"
                    }`}
                  >
                    Thanh toán PITD
                  </button>
                </div>
              )}

              <div className="mt-3 rounded-xl bg-white/80 border border-gray-200 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Số tiền</span>
                  <span className={`font-semibold ${selectedCurrency === "PI" ? "text-purple-600" : "text-pink-600"}`}>
                    {amount} {selectedCurrency === "PI" ? "π" : "PITD"}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-500 break-words">Ghi chú: {memo}</div>
              </div>

              {err ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {err}
                </div>
              ) : null}

              <div className="mt-4 flex gap-2">
                <button
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium"
                  onClick={handleClose}
                  disabled={busy}
                >
                  Hủy
                </button>

                <button
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 ${
                    selectedCurrency === "PI"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600"
                      : "bg-gradient-to-r from-pink-600 to-purple-600"
                  }`}
                  onClick={start}
                  disabled={busy}
                >
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang xử lý...
                    </span>
                  ) : (
                    "Xác nhận thanh toán"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export { ExchangeModal }
