import { getSupabaseBrowserClient } from "./client"

// NOTE (Vercel build fix):
// This module is imported by client components (e.g. lib/auth-context.tsx).
// Therefore it MUST NOT import or reference server-only modules such as `next/headers`.
// Any server-only queries should live in a separate file (e.g. queries.server.ts) and be used
// ONLY by route handlers / server components.

export async function createOrUpdatePiUser(userData: { piUid: string; piUsername: string; accessToken: string }) {
  console.log("[v0] createOrUpdatePiUser: Calling API with:", {
    piUid: userData.piUid,
    piUsername: userData.piUsername,
    hasAccessToken: !!userData.accessToken,
  })

  // Call the Pi callback API route
  const response = await fetch("/api/auth/pi-callback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accessToken: userData.accessToken,
      user: {
        uid: userData.piUid,
        username: userData.piUsername,
      },
    }),
  })

  // IMPORTANT: In rate-limited situations (Pi Browser proxy/CORS), the response may not be JSON.
  // We must avoid throwing a JSON parse error that would break auth state & keep pages loading forever.
  let data: any = null
  let rawText = ""
  try {
    rawText = await response.text()
    data = rawText ? JSON.parse(rawText) : null
  } catch {
    data = rawText
  }
  console.log("[v0] createOrUpdatePiUser: API response:", { status: response.status, data })

  if (!response.ok) {
    const msg = typeof data === "object" && data ? data.error || data.message : String(data || "")
    console.error("[v0] createOrUpdatePiUser: API error:", data)
    throw new Error(msg || "Failed to authenticate")
  }

  // API returns snake_case (pi_uid, pi_username, user_role, verification_status, ...).
  // Keep this helper tolerant to both snake_case and camelCase.
  const id = data?.id
  const piUid = data?.piUid ?? data?.pi_uid
  const piUsername = data?.piUsername ?? data?.pi_username
  const userRole = data?.userRole ?? data?.user_role
  const verificationStatus = data?.verificationStatus ?? data?.verification_status

  return {
    id,
    piUid,
    piUsername,
    userRole,
    userType: "pi",
    verificationStatus,
  }
}

export async function enableUser2FA(userId: string, totpSecret: string) {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("pi_users")
    .update({
      totp_enabled: true,
      totp_secret: totpSecret,
    })
    .eq("id", userId)
    .select()
    .single()

  if (error) throw new Error("Failed to enable 2FA")
  return data
}

export async function applyForProvider(userData: { userId: string; businessName: string; description: string }) {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("pi_users")
    .update({
      provider_business_name: userData.businessName,
      provider_description: userData.description,
      provider_approved: false, // Will be approved by root admin
    })
    .eq("id", userData.userId)
    .select()
    .single()

  if (error) throw new Error("Failed to submit provider application: " + error.message)
  return data
}

export async function approveProvider(
  providerId: string,
  adminId: string,
  action: "approve" | "reject",
  reason?: string,
) {
  const supabase = getSupabaseBrowserClient()

  if (action === "approve") {
    // Update user to provider role
    const { error: userError } = await supabase
      .from("pi_users")
      .update({
        user_role: "provider",
        provider_approved: true,
        provider_approved_at: new Date().toISOString(),
        provider_approved_by: adminId,
      })
      .eq("id", providerId)

    if (userError) throw new Error("Failed to approve provider")
  }

  // Record approval action
  const { data, error } = await supabase
    .from("provider_approvals")
    .insert({
      provider_id: providerId,
      approved_by: adminId,
      action,
      reason,
    })
    .select()
    .single()

  if (error) throw new Error("Failed to record approval")
  return data
}

export async function getPendingProviders() {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("pi_users")
    .select("id, pi_username, provider_business_name, user_role")
    .or("user_role.eq.provider,user_role.eq.admin")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] getPendingProviders error:", error)
    return []
  }

  return data || []
}

export async function getProducts(options?: {
  category?: string
  limit?: number
  offset?: number
  featured?: boolean
  flashSale?: boolean
}) {
  const supabase = getSupabaseBrowserClient()

  let query = supabase.from("products").select("*").eq("is_active", true)

  if (options?.category && options.category !== "all") {
    query = query.eq("category_id", options.category)
  }

  if (options?.featured) {
    query = query.eq("is_featured", true)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options?.offset, options.offset + (options.limit || 10) - 1)
  }

  query = query.order("created_at", { ascending: false })

  const { data, error } = await query

  if (error) return []

  const productsWithRealReviews = await Promise.all(
    (data || []).map(async (product: any) => {
      // Get real reviews from database
      const { data: reviewsData } = await supabase.from("reviews").select("rating").eq("product_id", product.id)

      let averageRating = 0
      let totalReviews = 0

      if (reviewsData && reviewsData.length > 0) {
        totalReviews = reviewsData.length
        const sumRatings = reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0)
        averageRating = sumRatings / totalReviews
      }

      let images: string[] = []

      if (product.media && Array.isArray(product.media)) {
        images = product.media
          .filter((m: any) => m.type === "image" && m.url && !m.url.startsWith("blob:"))
          .map((m: any) => m.url)
      }

      if (images.length === 0 && product.image_url && !product.image_url.startsWith("blob:")) {
        images = [product.image_url]
      }

      if (images.length === 0) {
        images = [`/placeholder.svg?height=300&width=300&query=${encodeURIComponent(product.name || "product")}`]
      }

      return {
        id: product.id,
        uuid: product.id,
        title: product.name,
        description: product.description,
        category: product.category_id,
        piAmount: product.price,
        pitdAmount: product.price,
        imageUrl: images[0],
        providerName: "Provider",
        providerLocation: "Vietnam",
        rating: averageRating,
        reviewCount: totalReviews,
        quantityExchanged: product.total_sold || 0,
        deliveryTime: "2-3 days",
        supportsPi: product.currency === "PI" || product.currency === "PITD",
        supportsPitd: true,
        images: images,
        stock: product.stock_quantity,
        active: product.is_active,
        createdAt: product.created_at,
      }
    }),
  )

  return productsWithRealReviews
}

export async function getProductById(productId: string) {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase.from("products").select("*").eq("id", productId).eq("is_active", true).single()

  if (error && error.code !== "PGRST116") {
    return null
  }

  if (!data) {
    return null
  }

  const { data: reviewsData, error: reviewsError } = await supabase
    .from("reviews")
    .select("rating")
    .eq("product_id", productId)

  let averageRating = 0
  let totalReviews = 0

  if (reviewsData && reviewsData.length > 0) {
    totalReviews = reviewsData.length
    const sumRatings = reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0)
    averageRating = Math.round((sumRatings / totalReviews) * 10) / 10 // Round to 1 decimal
  }

  const finalRating = averageRating
  const finalReviewCount = totalReviews

  let allImages: string[] = []
  let videoUrl: string | undefined

  if (data.media && Array.isArray(data.media)) {
    allImages = data.media
      .filter((m: any) => m.type === "image" && m.url && !m.url.startsWith("blob:"))
      .map((m: any) => m.url)

    const videoMedia = data.media.find((m: any) => m.type === "video" && m.url && !m.url.startsWith("blob:"))
    if (videoMedia) {
      videoUrl = videoMedia.url
    }
  }

  if (allImages.length === 0 && data.image_url && !data.image_url.startsWith("blob:")) {
    allImages = [data.image_url]
  }

  if (allImages.length === 0) {
    allImages = [`/placeholder.svg?height=400&width=400&query=${encodeURIComponent(data.name || "product")}`]
  }

  console.log("[v0] Product detail images:", { id: data.id, name: data.name, allImages, videoUrl })

  // Price mapping (IMPORTANT): Home / Categories already map prices from DB as:
  //   piAmount   = pi_amount (or price_pi) fallback to price
  //   pitdAmount = pitd_amount fallback to price
  // Do NOT apply any implicit conversion here (e.g., price * 10), because it will
  // diverge from the values stored in DB and the values shown on other screens.
  const mappedPiAmount = Number((data as any).pi_amount ?? (data as any).price_pi ?? (data as any).price ?? 0)
  const mappedPitdAmount = Number((data as any).pitd_amount ?? (data as any).price ?? 0)

  // Flash sale mapping (keep consistent with Home/ProductCard)
  const flashSaleEnabled = Boolean((data as any).flash_sale_enabled)
  const flashSaleStartDate = (data as any).flash_sale_start_date ? new Date((data as any).flash_sale_start_date) : undefined
  const flashSaleEndDate = (data as any).flash_sale_end_date ? new Date((data as any).flash_sale_end_date) : undefined

  // IMPORTANT: PI and PITD flash prices are separate fields in DB.
    // IMPORTANT: PI and PITD flash prices are separate fields in DB.
  // Support a few legacy column names to avoid breaking older data.
  const flashSalePiPriceRaw =
    (data as any).flash_sale_pi_price ??
    (data as any).flash_sale_pi_amount ??
    (data as any).flash_sale_price_pi ??
    (data as any).flash_pi_price ??
    (data as any).flash_price_pi ??
    null
    const flashSalePitdPriceRaw =
    (data as any).flash_sale_pitd_price ??
    (data as any).flash_sale_pitd_amount ??
    (data as any).flash_sale_price_pitd ??
    (data as any).flash_pitd_price ??
    (data as any).flash_price_pitd ??
    null

  const flashSalePiPrice =
    flashSalePiPriceRaw !== undefined && flashSalePiPriceRaw !== null ? Number(flashSalePiPriceRaw) : undefined
  const flashSalePitdPrice =
    flashSalePitdPriceRaw !== undefined && flashSalePitdPriceRaw !== null ? Number(flashSalePitdPriceRaw) : undefined

  return {
    id: data.id,
    uuid: data.id,
    title: data.name,
    description: data.description || data.short_description,
    category: data.category_id,
    piAmount: mappedPiAmount,
    pitdAmount: mappedPitdAmount,
    flashSaleEnabled,
    flashSaleStartDate,
    flashSaleEndDate,
    flashSalePiPrice,
    flashSalePitdPrice,
    imageUrl: allImages[0],
    providerName: data.merchant_username || "PITODO",
    providerLocation: data.store_location || "Vietnam",
    rating: finalRating,
    reviewCount: finalReviewCount,
    quantityExchanged: data.total_sold || 0,
    deliveryTime: data.shipping_info || "2-3 days",
    supportsPi: data.currency === "PI" || data.currency === "PITD",
    supportsPitd: true,
    images: allImages,
    videoUrl: videoUrl,
    productCode: data.product_code || `PROD-${data.id.substring(0, 8)}`,
    weight: data.weight,
    weightUnit: data.weight_unit || "g",
    dimensions: data.dimensions,
    dimensionUnit: data.dimension_unit || "cm",
    colors: data.colors || [],
    shippingFee: data.shipping_fee,
    shippingFeeCurrency: data.shipping_fee_currency,
    discountPercentage: data.discount_percentage || 0,
    providerWalletPi: data.provider_wallet_pi || "GDR47...XYZ",
    providerWalletPitd: data.provider_wallet_pitd || "PTD89...ABC",
    surchargePercentage: data.surcharge_percentage || 2.5,
    surchargeWalletPi: data.surcharge_wallet_pi || "PITODO-SURCHARGE-PI",
    surchargeWalletPitd: data.surcharge_wallet_pitd || "PITODO-SURCHARGE-PITD",
    taxPercentage: data.tax_percentage || 10,
    taxWalletPi: data.tax_wallet_pi || "PITODO-TAX-PI",
    taxWalletPitd: data.tax_wallet_pitd || "PITODO-TAX-PITD",
    stock: data.stock_quantity || 0,
    active: data.is_active,
    createdAt: data.created_at,
  }
}

export async function getPitdWalletBalance(userId: string) {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase.from("pitd_wallets").select("balance").eq("user_id", userId).single()

  if (error && error.code !== "PGRST116") {
    return 0
  }

  return data?.balance || 0
}

export async function createPitdTransaction(transaction: {
  walletId: string
  type: string
  amount: number
  balanceAfter: number
  description: string
  metadata?: any
}) {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("pitd_transactions")
    .insert({
      wallet_id: transaction.walletId,
      transaction_type: transaction.type,
      amount: transaction.amount,
      balance_after: transaction.balanceAfter,
      description: transaction.description,
      metadata: transaction.metadata,
    })
    .select()
    .single()

  if (error) {
    throw new Error("Failed to create transaction: " + error.message)
  }

  return data
}

export async function getProviderByUserId(userId: string) {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("pi_users")
    .select("*")
    .eq("id", userId)
    .eq("user_role", "provider")
    .single()

  if (error && error.code !== "PGRST116") {
    return null
  }

  return data
}

export async function searchProducts(searchTerm: string, category?: string) {
  const supabase = getSupabaseBrowserClient()

  let query = supabase.from("products").select("*").eq("is_active", true)

  if (searchTerm && searchTerm.trim()) {
    query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
  }

  if (category && category !== "all") {
    query = query.eq("category_id", category)
  }

  query = query.order("created_at", { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error("[v0] searchProducts error:", error)
    return []
  }

  return (data || []).map((product: any) => {
    let images: string[] = []

    if (product.media && Array.isArray(product.media)) {
      images = product.media
        .filter((m: any) => m.type === "image" && m.url && !m.url.startsWith("blob:"))
        .map((m: any) => m.url)
    }

    if (images.length === 0 && product.image_url && !product.image_url.startsWith("blob:")) {
      images = [product.image_url]
    }

    if (images.length === 0) {
      images = [`/placeholder.svg?height=300&width=300&query=${encodeURIComponent(product.name || "product")}`]
    }

    return {
      ...product,
      imageUrl: images[0],
      images: images,
    }
  })
}

export async function createProduct(productData: any) {
  const supabase = getSupabaseBrowserClient()

  console.log("[v0] createProduct: Inserting product with data:", productData)

  const insertData = {
    provider_id: productData.providerId,
    category_id: productData.categoryId,
    name: productData.name,
    description: productData.description,
    short_description: productData.shortDescription,
    price: productData.price || 0,
    currency: productData.currency || "PITD",
    stock_quantity: productData.stockQuantity || 0,
    is_unlimited_stock: productData.isUnlimitedStock || false,
    is_active: productData.isActive !== undefined ? productData.isActive : true,
    is_featured: productData.isFeatured || false,

    pi_listed_price: productData.piListedPrice,
    pitd_listed_price: productData.pitdListedPrice,
    pi_discount_percent: productData.piDiscountPercent,
    pitd_discount_percent: productData.pitdDiscountPercent,
    pi_amount: productData.piAmount,
    pitd_amount: productData.pitdAmount,

    flash_sale_enabled: productData.flashSaleEnabled || false,
    flash_sale_start_date: productData.flashSaleStartDate,
    flash_sale_end_date: productData.flashSaleEndDate,
    flash_sale_pi_price: productData.flashSalePiPrice,
    flash_sale_pitd_price: productData.flashSalePitdPrice,

    weight: productData.weight,
    weight_unit: productData.weightUnit,
    dimensions: productData.dimensions,
    dimension_unit: productData.dimensionUnit,
    colors: productData.colors,
    sizes: productData.sizes,
    store_location: productData.storeLocation,
    product_code: productData.productCode,

    shipping_enabled: productData.shippingEnabled || false,
    shipping_fee: productData.shippingFee,
    shipping_type: productData.shippingType,
    delivery_time: productData.deliveryTime || "2-3 days",

    media: productData.media || [],
  }

  console.log("[v0] createProduct: Mapped insert data:", insertData)

  const { data, error } = await supabase.from("products").insert(insertData).select().single()

  if (error) {
    console.error("[v0] createProduct error:", error)
    throw new Error(`Failed to create product: ${error.message}`)
  }

  console.log("[v0] createProduct: Success:", data)
  return data
}

export async function updateProduct(productId: string, productData: any) {
  const supabase = getSupabaseBrowserClient()

  const updateData = {
    category_id: productData.categoryId,
    name: productData.name,
    description: productData.description,
    short_description: productData.shortDescription,
    price: productData.price,
    currency: productData.currency,
    stock_quantity: productData.stockQuantity,
    is_unlimited_stock: productData.isUnlimitedStock,
    is_active: productData.isActive,
    is_featured: productData.isFeatured,
    pi_listed_price: productData.piListedPrice,
    pitd_listed_price: productData.pitdListedPrice,
    pi_discount_percent: productData.piDiscountPercent,
    pitd_discount_percent: productData.pitdDiscountPercent,
    pi_amount: productData.piAmount,
    pitd_amount: productData.pitdAmount,
    flash_sale_enabled: productData.flashSaleEnabled,
    flash_sale_start_date: productData.flashSaleStartDate,
    flash_sale_end_date: productData.flashSaleEndDate,
    flash_sale_pi_price: productData.flashSalePiPrice,
    flash_sale_pitd_price: productData.flashSalePitdPrice,
    weight: productData.weight,
    weight_unit: productData.weightUnit,
    dimensions: productData.dimensions,
    dimension_unit: productData.dimensionUnit,
    colors: productData.colors,
    sizes: productData.sizes,
    store_location: productData.storeLocation,
    shipping_enabled: productData.shippingEnabled,
    shipping_fee: productData.shippingFee,
    shipping_type: productData.shippingType,
    delivery_time: productData.deliveryTime,
    media: productData.media,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase.from("products").update(updateData).eq("id", productId).select().single()

  if (error) {
    throw new Error(`Failed to update product: ${error.message}`)
  }

  return data
}

export async function deleteProduct(productId: string) {
  const supabase = getSupabaseBrowserClient()

  const { error } = await supabase.from("products").delete().eq("id", productId)

  if (error) {
    throw new Error(`Failed to delete product: ${error.message}`)
  }

  return true
}

export async function getAllProviders() {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("pi_users")
    .select("id, pi_username, provider_business_name, user_role")
    .or("user_role.eq.provider,user_role.eq.admin")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] getAllProviders error:", error)
    return []
  }

  return data || []
}
