export type UserType = "pi" | "email"

export type UserRole = "redeemer" | "provider" | "root_admin"

export type TrustLevel = "admin-verified" | "user-rated" | "unverified"

export type VerificationStatus = "verified" | "unverified" | "pending"

export type PiUser = {
  uid: string
  username: string
  accessToken: string
  type: "pi"
	// internal UUID in public.pi_users
	piUserId?: string | null
  isAdmin: boolean
  role: UserRole
  verificationStatus: VerificationStatus
}

export type EmailUser = {
  uid: string
  email: string
  fullName: string
  phoneNumber: string
  address: string
  type: "email"
  emailVerified: boolean
  twoFactorEnabled: boolean
  twoFactorSecret?: string
  pitdWallet: {
    address: string
    balance: number
  }
  isAdmin: boolean
  role: UserRole
  verificationStatus: VerificationStatus
}

export type User = PiUser | EmailUser

export type ProviderApproval = {
  id: string
  provider_id: string
  approved_by: string
  action: "approve" | "reject" | "revoke"
  reason?: string
  created_at: string
}

export type Provider = {
  id: string
  userId: string
  businessName: string
  contactPerson: string
  email: string
  phone: string
  address: string
  description: string
  piWallet?: string
  pitdWallet?: string
  rating: number
  totalExchanges: number
  isApproved: boolean
  isActive: boolean
  location: string
  createdAt: Date
  approvedBy?: string
  approvedAt?: Date
  verificationStatus: VerificationStatus
}

export type Currency = "PI" | "PITD"

export type PlatformWallets = {
  pi: {
    serviceFeeWallet: string
    taxWallet: string
  }
  pitd: {
    serviceFeeWallet: string
    taxWallet: string
  }
}

export type TransactionBreakdown = {
  totalAmount: number
  providerAmount: number
  serviceFee: number
  tax: number
  currency: Currency
}

export type Transaction = {
  id: string
  userId: string
  type: "exchange" | "redeem"
  currency: Currency
  breakdown: TransactionBreakdown
  providerWallet: string
  item: string
  itemDescription?: string
  status: "pending" | "completed" | "cancelled"
  createdAt: Date
}

export type Offer = {
  id: string
  providerId: string
  title: string
  description: string
  category: string
  image: string
  piAmount: number
  pitdAmount: number
  providerName: string
  providerPiWallet: string
  providerPitdWallet: string
  available: boolean
  featured: boolean
  isHidden: boolean
  createdAt: Date
  updatedAt: Date
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
  productCode?: string
  images?: string[]
  videoUrl?: string
  weight?: string
  dimensions?: string
  colors?: string[]
  shippingInfo?: string
  fullDescription?: string
  flashSaleEnabled?: boolean
  flashSaleStartDate?: Date
  flashSalePiPrice?: number // Fixed PI price during flash sale
  flashSalePitdPrice?: number // Fixed PITD price during flash sale
  flashSaleDiscountPercent?: number // OR discount percentage
  originalPiAmount?: number // Store original price
  originalPitdAmount?: number // Store original price
}

export type PaymentRecord = {
  id: string
  paymentId: string // Pi Platform payment ID
  userId: string
  piUid: string
  productId: string
  amount: number
  memo: string
  metadata: Record<string, any>
  status: "created" | "approved" | "completed" | "cancelled"
  createdAt: string
  approvedAt?: string
  completedAt?: string
  txid?: string
}

export type ExchangeOrder = {
  id: string
  orderId: string
  paymentId: string
  userId: string
  piUid: string
  productId: string
  amount: number
  currency: Currency
  status: "completed"
  txid: string
  createdAt: string
  completedAt: string
}

export type Product = {
  id: string
  uuid: string
  name: string
  short_description: string
  category: string
  price: number
  stock: number
  weight?: string
  image_url?: string
  merchant_username: string
  pi_username?: string
  active: boolean
  notes?: string
  created_at: string
  product_code?: string
  description?: string // Full description
  media?: Array<{ type: "image" | "video"; url: string; thumbnailUrl?: string; file?: File; id?: string }> // Max 10 images + 1 video
  weight_unit?: string // g / kg / ton
  dimensions?: string
  dimension_unit?: string // cm / m
  colors?: string[] // Max 10 colors
  exchange_currency?: "pi" | "pitd" | "both" // What currencies are supported
  shipping_fee?: number
  shipping_fee_currency?: "pi" | "pitd"
  discount_percentage?: number
  provider_wallet_pi?: string
  provider_wallet_pitd?: string
  surcharge_percentage?: number
  surcharge_wallet_pi?: string
  surcharge_wallet_pitd?: string
  tax_percentage?: number
  tax_wallet_pi?: string
  tax_wallet_pitd?: string
  // Additional computed fields
  piAmount?: number
  pitdAmount?: number
  providerName?: string
  providerLocation?: string
  rating?: number
  reviewCount?: number
  quantityExchanged?: number
  deliveryTime?: string
  images?: string[]
  title?: string
  providerVerified?: boolean
  flashSaleEnabled?: boolean
  flashSaleStartDate?: Date
  flashSaleEndDate?: Date
  flashSalePiPrice?: number
  flashSalePitdPrice?: number
  flashSaleDiscountPercent?: number
  marketingLabel?: string
}

interface MediaFile {
  type: "image" | "video"
  url: string
  thumbnailUrl?: string // Add thumbnail for video
  file?: File
  id?: string // Add id for tracking upload progress
}
