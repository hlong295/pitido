import { createServerClient } from "@/lib/supabase/server"

/**
 * Generates a PITD wallet address with required constraints.
 * - total length = 24
 * - prefix required (e.g. "PITSER")
 * - remaining characters are mixed-case alphanumeric.
 */
export function generatePitdAddress(prefix: string, totalLength = 24) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const safePrefix = prefix.slice(0, Math.min(prefix.length, totalLength))
  const remain = totalLength - safePrefix.length
  let out = safePrefix
  for (let i = 0; i < remain; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export type PlatformWallets = {
  pi: { serviceFeeWallet: string; taxWallet: string }
  pitd: { serviceFeeWallet: string; taxWallet: string }
  // Optional meta
  service_fee_percentage?: number
  tax_percentage?: number
  // Optional receiver info
  pitd_service_fee_receiver_user_id?: string | null
  pitd_tax_receiver_user_id?: string | null
}

const DEFAULT_PI_SERVICE_FEE_WALLET = "GA3B4CM2EFIYUMIF7IRN55EMT73TIFXDFH42RL6WTDYUJY7MYHCYKIY4"
const DEFAULT_PI_TAX_WALLET = "GALRNUCFJW3DADOKAPAD2FL7HL2PPD4K6OVWXBCNCFS64AP53G4SARDE"

const SYSTEM_USERNAMES = {
  pitdServiceFee: "PITODO-SURCHARGE-PITD",
  pitdTax: "PITODO-TAX-PITD",
} as const

async function ensureAppSettingsRow(supabase: any) {
  const { data, error } = await supabase.from("app_settings").select("*").limit(1).maybeSingle()
  if (!error && data) return data

  // If none exists, insert a default row (keep percentages minimal; can be changed in admin UI)
  const { data: inserted, error: insErr } = await supabase
    .from("app_settings")
    .insert({
      service_fee_percentage: 2,
      tax_percentage: 8,
      pi_service_fee_wallet: DEFAULT_PI_SERVICE_FEE_WALLET,
      pi_tax_wallet: DEFAULT_PI_TAX_WALLET,
      pitd_service_fee_receiver_user_id: null,
      pitd_tax_receiver_user_id: null,
    })
    .select("*")
    .single()

  if (insErr) throw insErr
  return inserted
}

async function ensureUserPitdWalletByUserId(supabase: any, userId: string, prefix: string) {
  // Ensure user exists (must be a valid pi_users.id)
  const { data: user, error: uErr } = await supabase.from("pi_users").select("id").eq("id", userId).maybeSingle()
  if (uErr) throw uErr
  if (!user) throw new Error("Receiver user not found")
  return ensurePitdWallet(supabase, userId, prefix)
}

async function ensureSystemUser(supabase: any, pi_username: string) {
  const { data: existing, error } = await supabase.from("pi_users").select("id, pi_username").eq("pi_username", pi_username).maybeSingle()
  if (!error && existing) return existing

  // Create minimal system user record. (Columns are tolerant; extra cols are optional.)
  const { data: created, error: createErr } = await supabase
    .from("pi_users")
    .insert({
      pi_uid: `system_${pi_username}`,
      pi_username,
      full_name: pi_username,
      user_role: "system",
      verification_status: "verified",
      provider_approved: false,
    })
    .select("id, pi_username")
    .single()

  if (createErr) throw createErr
  return created
}

async function ensurePitdWallet(supabase: any, userId: string, prefix: string) {
  const { data: wallet, error } = await supabase
    .from("pitd_wallets")
    .select("id, user_id, balance, locked_balance, total_spent, address")
    .eq("user_id", userId)
    .maybeSingle()

  if (!error && wallet) {
    // If address missing or obviously placeholder, generate a new one.
    const addr = (wallet.address || "").trim()
    if (!addr || addr.length !== 24 || (prefix && !addr.startsWith(prefix))) {
      const newAddress = generatePitdAddress(prefix, 24)
      const { error: upErr } = await supabase.from("pitd_wallets").update({ address: newAddress }).eq("id", wallet.id)
      if (upErr) throw upErr
      return { ...wallet, address: newAddress }
    }
    return wallet
  }

  const address = generatePitdAddress(prefix, 24)
  const { data: created, error: createErr } = await supabase
    .from("pitd_wallets")
    .insert({
      user_id: userId,
      balance: 0,
      locked_balance: 0,
      total_spent: 0,
      address,
    })
    .select("id, user_id, balance, locked_balance, total_spent, address")
    .single()

  if (createErr) throw createErr
  return created
}

/**
 * Ensures platform wallets (Pi + PITD) exist and returns their current addresses.
 * - Pi wallets are stored in app_settings (admin can change later)
 * - PITD wallets are system users + pitd_wallets records (addresses auto-generated once)
 */
export async function getOrCreatePlatformWallets() : Promise<PlatformWallets> {
  const supabase = await createServerClient()

  const settings = await ensureAppSettingsRow(supabase)

  // Ensure system PITD users + wallets always exist (fallback + transparency)
  const surchargeUser = await ensureSystemUser(supabase, SYSTEM_USERNAMES.pitdServiceFee)
  const taxUser = await ensureSystemUser(supabase, SYSTEM_USERNAMES.pitdTax)

  const systemSurchargeWallet = await ensurePitdWallet(supabase, surchargeUser.id, "PITSER")
  // Tax wallet: keep stable prefix for recognition
  const systemTaxWallet = await ensurePitdWallet(supabase, taxUser.id, "PITTAX")

  // Receiver wallets (admin can point to any user/provider). If not set, fallback to system wallets.
  const feeReceiverUserId = (settings?.pitd_service_fee_receiver_user_id || null) as string | null
  const taxReceiverUserId = (settings?.pitd_tax_receiver_user_id || null) as string | null

  const feeReceiverWallet = feeReceiverUserId
    ? await ensureUserPitdWalletByUserId(supabase, feeReceiverUserId, "PITSER")
    : systemSurchargeWallet
  const taxReceiverWallet = taxReceiverUserId
    ? await ensureUserPitdWalletByUserId(supabase, taxReceiverUserId, "PITTAX")
    : systemTaxWallet

  return {
    pi: {
      serviceFeeWallet: (settings?.pi_service_fee_wallet || DEFAULT_PI_SERVICE_FEE_WALLET) as string,
      taxWallet: (settings?.pi_tax_wallet || DEFAULT_PI_TAX_WALLET) as string,
    },
    pitd: {
      serviceFeeWallet: (feeReceiverWallet.address || "") as string,
      taxWallet: (taxReceiverWallet.address || "") as string,
    },
    service_fee_percentage: settings?.service_fee_percentage,
    tax_percentage: settings?.tax_percentage,
    pitd_service_fee_receiver_user_id: feeReceiverUserId,
    pitd_tax_receiver_user_id: taxReceiverUserId,
  }
}

/**
 * Helper: returns system PITD wallet ids for posting transactions.
 */
export async function getSystemPitdWalletIds() {
  const supabase = await createServerClient()

  const surchargeUser = await ensureSystemUser(supabase, SYSTEM_USERNAMES.pitdServiceFee)
  const taxUser = await ensureSystemUser(supabase, SYSTEM_USERNAMES.pitdTax)

  const surchargeWallet = await ensurePitdWallet(supabase, surchargeUser.id, "PITSER")
  const taxWallet = await ensurePitdWallet(supabase, taxUser.id, "PITTAX")

  return {
    surchargeUserId: surchargeUser.id,
    taxUserId: taxUser.id,
    surchargeWalletId: surchargeWallet.id,
    taxWalletId: taxWallet.id,
  }
}

/**
 * Returns the effective PITD wallet ids used for fee/tax split.
 * If admin configured receiver user ids in app_settings, those wallets are used.
 * Otherwise the default system wallets are used.
 */
export async function getEffectivePitdWalletIds() {
  const supabase = await createServerClient()
  const settings = await ensureAppSettingsRow(supabase)

  const system = await getSystemPitdWalletIds()

  const feeReceiverUserId = (settings?.pitd_service_fee_receiver_user_id || null) as string | null
  const taxReceiverUserId = (settings?.pitd_tax_receiver_user_id || null) as string | null

  const feeWallet = feeReceiverUserId
    ? await ensureUserPitdWalletByUserId(supabase, feeReceiverUserId, "PITSER")
    : { id: system.surchargeWalletId }
  const taxWallet = taxReceiverUserId
    ? await ensureUserPitdWalletByUserId(supabase, taxReceiverUserId, "PITTAX")
    : { id: system.taxWalletId }

  return {
    surchargeWalletId: feeWallet.id as string,
    taxWalletId: taxWallet.id as string,
    feeReceiverUserId,
    taxReceiverUserId,
  }
}
