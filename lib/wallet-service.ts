import { createBrowserClient } from "@/lib/supabase/client"

export function generatePitdWalletAddress(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let address = "PITD"
  for (let i = 0; i < 20; i++) {
    address += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return address
}

export async function ensurePitdWallet(
  userId: string,
): Promise<{ walletId: string; balance: number; walletAddress: string } | null> {
  try {
    if (!userId || typeof userId !== "string") {
      console.error("[v0] ensurePitdWallet: invalid userId", userId)
      return null
    }
    const supabase = createBrowserClient()

    // Check if wallet exists
    const { data: existingWallet, error: existingErr } = await supabase
      .from("pitd_wallets")
      .select("id,user_id,balance,locked_balance,total_spent,address,created_at,updated_at")
      .eq("user_id", userId)
      .maybeSingle()

    if (existingErr) {
      console.error("[v0] ensurePitdWallet: Error loading PITD wallet:", existingErr)
      return null
    }

    if (existingWallet) {
      if (!existingWallet.address) {
        const newAddress = generatePitdWalletAddress()
        await supabase.from("pitd_wallets").update({ address: newAddress }).eq("id", existingWallet.id)

        return {
          walletId: existingWallet.id,
          balance: existingWallet.balance || 0,
          walletAddress: newAddress,
        }
      }

      return {
        walletId: existingWallet.id,
        balance: existingWallet.balance || 0,
        walletAddress: existingWallet.address,
      }
    }

    const walletAddress = generatePitdWalletAddress()
    const { data: newWallet, error } = await supabase
      .from("pitd_wallets")
      .insert({
        user_id: userId,
        balance: 0,
        locked_balance: 0,
        address: walletAddress,
        total_spent: 0,
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating PITD wallet:", error)
      return null
    }

    return {
      walletId: newWallet.id,
      balance: newWallet.balance || 0,
      walletAddress: newWallet.address,
    }
  } catch (error) {
    console.error("[v0] Error ensuring PITD wallet:", error)
    return null
  }
}

export async function getPitdWalletBalance(userId: string): Promise<number> {
  try {
    const supabase = createBrowserClient()

    const { data } = await supabase.from("pitd_wallets").select("balance").eq("user_id", userId).single()

    return data?.balance || 0
  } catch (error) {
    console.error("[v0] Error getting PITD wallet balance:", error)
    return 0
  }
}

export async function updatePitdWalletBalance(
  userId: string,
  amount: number,
  type: "add" | "subtract",
): Promise<boolean> {
  try {
    const supabase = createBrowserClient()

    const { data: wallet } = await supabase.from("pitd_wallets").select("balance").eq("user_id", userId).single()

    if (!wallet) {
      console.error("[v0] Wallet not found for user:", userId)
      return false
    }

    const newBalance = type === "add" ? wallet.balance + amount : wallet.balance - amount

    if (newBalance < 0) {
      console.error("[v0] Insufficient balance")
      return false
    }

    const { error } = await supabase.from("pitd_wallets").update({ balance: newBalance }).eq("user_id", userId)

    if (error) {
      console.error("[v0] Error updating wallet balance:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("[v0] Error updating PITD wallet balance:", error)
    return false
  }
}
