
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server"
import { getEffectivePitdWalletIds } from "@/lib/system-wallets"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user"

/**
 * PITD internal payment:
 * - Debits buyer PITD wallet
 * - Credits provider PITD wallet
 * - Credits platform service fee PITD wallet
 * - Credits platform tax PITD wallet
 *
 * NOTE: This matches current DB schema:
 * - pitd_wallets: id, user_id, balance, locked_balance, total_spent, address
 * - pitd_transactions: id, wallet_id, transaction_type, amount, balance_after, reference_id, reference_type, description, metadata, created_at
 */
export async function POST(request: Request) {
  try {
    const { productId, userId, amount, providerId, productName, quantity = 1 } = await request.json()

    if (!productId || !userId || !providerId || !amount) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json({ message: "Server not configured" }, { status: 500 })
    }

    // A1: resolve master users.id without touching login flows
    const buyerResolved = await resolveMasterUserId(supabase as any, String(userId))
    const providerResolved = await resolveMasterUserId(supabase as any, String(providerId))
    const buyerUserId = buyerResolved.userId
    const providerUserId = providerResolved.userId

    // Load percentages (fallback to constants if missing)
    const { data: settings } = await supabase.from("app_settings").select("service_fee_percentage, tax_percentage").limit(1).maybeSingle()
    const serviceFeePercentage = Number(settings?.service_fee_percentage ?? 2)
    const taxPercentage = Number(settings?.tax_percentage ?? 8)

    const total = Number(amount)
    const serviceFee = Math.round((total * serviceFeePercentage) / 100 * 1e6) / 1e6
    const tax = Math.round((total * taxPercentage) / 100 * 1e6) / 1e6
    const providerAmount = Math.round((total - serviceFee - tax) * 1e6) / 1e6

    if (providerAmount < 0) {
      return NextResponse.json({ message: "Invalid fee/tax configuration" }, { status: 400 })
    }

    // Use effective fee/tax wallets (admin-configurable receiver accounts)
    const effective = await getEffectivePitdWalletIds()

    // Fetch wallets
    const { data: buyerWallet, error: buyerErr } = await supabase
      .from("pitd_wallets")
      .select("id, balance, locked_balance, total_spent")
      .eq("user_id", buyerUserId)
      .single()
    if (buyerErr) throw buyerErr

    const buyerBalance = Number(buyerWallet.balance || 0)
    if (buyerBalance < total) {
      return NextResponse.json({ message: "Insufficient PITD balance" }, { status: 400 })
    }

    const { data: providerWallet, error: providerErr } = await supabase
      .from("pitd_wallets")
      .select("id, balance")
      .eq("user_id", providerUserId)
      .single()
    if (providerErr) throw providerErr

    const { data: surchargeWallet, error: surErr } = await supabase
      .from("pitd_wallets")
      .select("id, balance")
      .eq("id", effective.surchargeWalletId)
      .single()
    if (surErr) throw surErr

    const { data: taxWallet, error: taxErr } = await supabase
      .from("pitd_wallets")
      .select("id, balance")
      .eq("id", effective.taxWalletId)
      .single()
    if (taxErr) throw taxErr

    // Update balances
    const buyerNewBalance = Math.round((buyerBalance - total) * 1e6) / 1e6
    const providerNewBalance = Math.round((Number(providerWallet.balance || 0) + providerAmount) * 1e6) / 1e6
    const surchargeNewBalance = Math.round((Number(surchargeWallet.balance || 0) + serviceFee) * 1e6) / 1e6
    const taxNewBalance = Math.round((Number(taxWallet.balance || 0) + tax) * 1e6) / 1e6

    // Buyer
    const { error: buyerUpErr } = await supabase
      .from("pitd_wallets")
      .update({
        balance: buyerNewBalance,
        total_spent: Number(buyerWallet.total_spent || 0) + total,
      })
      .eq("id", buyerWallet.id)
    if (buyerUpErr) throw buyerUpErr

    // Provider
    const { error: provUpErr } = await supabase.from("pitd_wallets").update({ balance: providerNewBalance }).eq("id", providerWallet.id)
    if (provUpErr) throw provUpErr

    // Platform wallets
    const { error: surUpErr } = await supabase.from("pitd_wallets").update({ balance: surchargeNewBalance }).eq("id", surchargeWallet.id)
    if (surUpErr) throw surUpErr

    const { error: taxUpErr2 } = await supabase.from("pitd_wallets").update({ balance: taxNewBalance }).eq("id", taxWallet.id)
    if (taxUpErr2) throw taxUpErr2

    // Insert transactions (statement/history)
    const referenceId = String(productId)
    const referenceType = "product"

    const metadata = { product_id: productId, provider_id: providerUserId, user_id: buyerUserId, quantity, product_name: productName }

    const inserts = [
      {
        wallet_id: buyerWallet.id,
        transaction_type: "debit_purchase",
        amount: -total,
        balance_after: buyerNewBalance,
        reference_id: referenceId,
        reference_type: referenceType,
        description: `Thanh toán PITD: ${productName || productId}`,
        metadata,
      },
      {
        wallet_id: providerWallet.id,
        transaction_type: "credit_provider",
        amount: providerAmount,
        balance_after: providerNewBalance,
        reference_id: referenceId,
        reference_type: referenceType,
        description: `Nhà cung cấp nhận từ ${productName || productId}`,
        metadata,
      },
      {
        wallet_id: surchargeWallet.id,
        transaction_type: "credit_service_fee",
        amount: serviceFee,
        balance_after: surchargeNewBalance,
        reference_id: referenceId,
        reference_type: referenceType,
        description: `Phí dịch vụ từ ${productName || productId}`,
        metadata,
      },
      {
        wallet_id: taxWallet.id,
        transaction_type: "credit_tax",
        amount: tax,
        balance_after: taxNewBalance,
        reference_id: referenceId,
        reference_type: referenceType,
        description: `Thuế từ ${productName || productId}`,
        metadata,
      },
    ]

    const { error: insErr } = await supabase.from("pitd_transactions").insert(inserts as any)
    if (insErr) throw insErr

    return NextResponse.json({
      success: true,
      breakdown: {
        total,
        serviceFee,
        tax,
        providerAmount,
        serviceFeePercentage,
        taxPercentage,
      },
    })
  } catch (error: any) {
    console.error("[payments/pitd] error:", error)
    return NextResponse.json({ message: error?.message || "PITD payment error" }, { status: 500 })
  }
}