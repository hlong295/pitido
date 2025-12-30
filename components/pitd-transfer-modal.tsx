"use client"

import type React from "react"

import { useState } from "react"
import { X, ArrowRight, Loader2, AlertCircle, CheckCircle2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type PitdTransferModalProps = {
  isOpen: boolean
  onClose: () => void
  currentBalance: number
  walletAddress: string
  onTransferComplete: () => void
}

export function PitdTransferModal({
  isOpen,
  onClose,
  currentBalance,
  walletAddress,
  onTransferComplete,
}: PitdTransferModalProps) {
  const [toAddress, setToAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyMyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!toAddress || !amount) {
      setError("Vui lòng nhập đầy đủ thông tin")
      return
    }

    if (!toAddress.startsWith("PITD") || toAddress.length !== 24) {
      setError("Địa chỉ ví không hợp lệ. Địa chỉ phải bắt đầu bằng 'PITD' và có 24 ký tự")
      return
    }

    const numAmount = Number.parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Số tiền không hợp lệ")
      return
    }

    if (numAmount > currentBalance) {
      setError("Số dư không đủ")
      return
    }

    if (toAddress === walletAddress) {
      setError("Không thể chuyển cho chính mình")
      return
    }

    setLoading(true)

    try {
      const authType = localStorage.getItem("auth_type") || ""
      const currentUserId = localStorage.getItem("current_user_id") || ""
      const authAccessToken = localStorage.getItem("auth_access_token") || ""
      const piUserId = localStorage.getItem("pi_user_id") || ""
      const piUsername = localStorage.getItem("pi_username") || ""

      const isUuid = (v: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)

      // Prefer a real uuid for PITD APIs (Pi user id or supabase users.id). Some browsers can accidentally store objects.
      const effectiveUserId = isUuid(piUserId) ? piUserId : isUuid(currentUserId) ? currentUserId : ""

      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (authType) headers["x-user-type"] = authType
      if (effectiveUserId) headers["x-user-id"] = effectiveUserId
      if (isUuid(piUserId)) headers["x-pi-user-id"] = piUserId
      if (piUsername) headers["x-pi-username"] = piUsername
      if (authAccessToken) headers["authorization"] = `Bearer ${authAccessToken}`

      const response = await fetch("/api/pitd/transfer", {
        method: "POST",
        headers,
        body: JSON.stringify({
          requesterId: effectiveUserId ? String(effectiveUserId) : "",
          // Backward/forward compatibility: server sẽ chấp nhận cả 2 key
          toWalletAddress: toAddress,
          toAddress: toAddress,
          amount: numAmount,
          note: description || "Chuyển PITD",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Chuyển tiền thất bại")
      }

      setSuccess(true)
      setTimeout(() => {
        onTransferComplete()
        handleClose()
      }, 2000)
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setToAddress("")
    setAmount("")
    setDescription("")
    setError(null)
    setSuccess(false)
    onClose()
  }

  const setMaxAmount = () => {
    setAmount(currentBalance.toString())
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 pb-20 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl animate-in zoom-in-95 fade-in duration-200 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-800">Chuyển PITD</h2>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Chuyển tiền thành công!</h3>
              <p className="text-gray-600">Đã chuyển {Number.parseFloat(amount).toLocaleString("vi-VN")} PITD</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <p className="text-xs text-gray-600 mb-1">Địa chỉ ví của bạn (để nhận PITD)</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-blue-700 flex-1 break-all">{walletAddress}</p>
                  <button
                    type="button"
                    onClick={copyMyAddress}
                    className="p-2 hover:bg-blue-100 rounded-lg transition-colors flex-shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-blue-500" />}
                  </button>
                </div>
              </div>

              {/* Balance Display */}
              <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl p-4 border border-pink-200">
                <p className="text-xs text-gray-600 mb-1">Số dư hiện tại</p>
                <p className="text-2xl font-bold text-pink-700">
                  {currentBalance.toLocaleString("vi-VN", { minimumFractionDigits: 2 })} PITD
                </p>
              </div>

              {/* Receiver Address */}
              <div>
                <Label htmlFor="toAddress">Địa chỉ ví người nhận</Label>
                <Input
                  id="toAddress"
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  placeholder="PITDxxxxxxxxxxxxxxxxxxxx"
                  className="mt-1 font-mono"
                  maxLength={24}
                />
                <p className="text-xs text-gray-500 mt-1">Địa chỉ bắt đầu bằng PITD, gồm 24 ký tự</p>
              </div>

              {/* Amount */}
              <div>
                <Label htmlFor="amount">Số tiền</Label>
                <div className="relative mt-1">
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pr-20"
                  />
                  <button
                    type="button"
                    onClick={setMaxAmount}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                  >
                    Tối đa
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Ghi chú (tùy chọn)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nhập ghi chú"
                  className="mt-1"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Xác nhận chuyển
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
