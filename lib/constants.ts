import type { PlatformWallets } from "./types"

export const PLATFORM_WALLETS: PlatformWallets = {
  pi: {
    serviceFeeWallet: "PITODO_PI_SERVICE_FEE_WALLET_12345678",
    taxWallet: "PITODO_PI_TAX_WALLET_87654321",
  },
  pitd: {
    serviceFeeWallet: "PITODO_PITD_SERVICE_FEE_WALLET_ABCD1234",
    taxWallet: "PITODO_PITD_TAX_WALLET_DCBA4321",
  },
}

export const SERVICE_FEE_PERCENTAGE = 2.5 // Fallback only
export const TAX_PERCENTAGE = 10.0 // Fallback only

export const DECIMAL_PLACES = 6

export const CATEGORIES = [
  {
    id: "48287df3-6c9e-4828-ad71-b319bf1af5f4",
    icon: "🛒",
    name: "Essential Goods",
    nameVi: "Hàng thiết yếu",
    priority: 5,
  },
  {
    id: "98acaa27-aac8-48bf-bd09-3b1374dc4e0d",
    icon: "🛠️",
    name: "Services",
    nameVi: "Dịch vụ - Tiện ích",
    priority: 4,
  },
  {
    id: "5f5630d5-94d8-4957-97e1-a0157b312367",
    icon: "✈️",
    name: "Travel & Food",
    nameVi: "Du lịch - Ẩm thực",
    priority: 4,
  },
  { id: "60d1fc74-1919-4553-8ebb-c2935ad25b59", icon: "📱", name: "Digital", nameVi: "Sản phẩm số", priority: 5 },
  { id: "e7ed7461-b7e4-422b-80d5-e42ee86d2497", icon: "🏠", name: "Home & Living", nameVi: "Gia dụng", priority: 4 },
  {
    id: "9638e015-71e0-487a-ac7d-1658300d08ec",
    icon: "👶",
    name: "Kids & Family",
    nameVi: "Kids - Family",
    priority: 4,
  },
  { id: "6260bd84-7f8c-4751-9273-6390d3b30719", icon: "👗", name: "Fashion", nameVi: "Thời Trang", priority: 5 },
  { id: "90351264-bbaa-45ea-b634-1dc79a88c8ab", icon: "📦", name: "Others", nameVi: "Khác", priority: 3 },
] as const

export type CategoryId = (typeof CATEGORIES)[number]["id"]

export function getCategoryPriority(categoryId: string): number {
  const category = CATEGORIES.find((c) => c.id === categoryId)
  return category?.priority ?? 3
}

export function getCategoryStars(categoryId: string): string {
  const priority = getCategoryPriority(categoryId)
  return "⭐".repeat(priority)
}

export function formatCurrency(value: number, decimals: number = DECIMAL_PLACES): string {
  return value.toFixed(decimals).replace(/\.?0+$/, "")
}

export function calculateBreakdown(
  totalAmount: number,
  serviceFeePercentage?: number,
  taxPercentage?: number,
): {
  providerAmount: number
  serviceFee: number
  tax: number
} {
  const feePercent = serviceFeePercentage ?? SERVICE_FEE_PERCENTAGE
  const taxPercent = taxPercentage ?? TAX_PERCENTAGE

  const serviceFee = totalAmount * (feePercent / 100)
  const tax = totalAmount * (taxPercent / 100)
  const providerAmount = totalAmount - serviceFee - tax

  return {
    providerAmount: Number.parseFloat(providerAmount.toFixed(DECIMAL_PLACES)),
    serviceFee: Number.parseFloat(serviceFee.toFixed(DECIMAL_PLACES)),
    tax: Number.parseFloat(tax.toFixed(DECIMAL_PLACES)),
  }
}

export function isFlashSaleActive(
  flashSaleEnabled?: boolean,
  flashSaleStartDate?: Date,
  flashSaleEndDate?: Date,
): boolean {
  // Must be enabled
  if (flashSaleEnabled !== true) return false

  const now = new Date()

  // Check if flash sale has ended
  if (flashSaleEndDate && flashSaleEndDate.getTime() < now.getTime()) {
    return false
  }

  // Check if flash sale has started
  if (flashSaleStartDate && flashSaleStartDate.getTime() > now.getTime()) {
    return false
  }

  return true
}

export function getFlashSalePrice(
  originalAmount: number,
  flashSalePrice?: number,
  flashSaleDiscountPercent?: number,
): number {
  // If fixed price is set, use it
  if (flashSalePrice !== undefined && flashSalePrice > 0) {
    return flashSalePrice
  }

  // Otherwise, apply discount percentage
  if (flashSaleDiscountPercent !== undefined && flashSaleDiscountPercent > 0) {
    const discountAmount = originalAmount * (flashSaleDiscountPercent / 100)
    return originalAmount - discountAmount
  }

  return originalAmount
}

export function calculateFlashSaleDiscount(originalAmount: number, flashSaleAmount: number): number {
  if (originalAmount <= 0) return 0
  return Math.round(((originalAmount - flashSaleAmount) / originalAmount) * 100)
}
