import { getSupabaseBrowserClient } from "./client"

/*
IMPORTANT
This file is CLIENT-SAFE ONLY.
Do NOT import ./server here.
All server-side logic must live in app/api/.../route.ts
*/

export async function getUserByPiUid(piUid: string) {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("pi_users")
    .select("*")
    .eq("pi_uid", piUid)
    .single()

  if (error && error.code !== "PGRST116") return null
  return data
}

export async function getUserByUsername(username: string) {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("pi_users")
    .select("*")
    .eq("pi_username", username)
    .maybeSingle()

  if (error && error.code !== "PGRST116") return null
  return data
}

export async function getPitdWalletBalance(userId: string) {
  const supabase = getSupabaseBrowserClient()

  const { data, error } = await supabase
    .from("pitd_wallets")
    .select("balance")
    .eq("user_id", userId)
    .single()

  if (error && error.code !== "PGRST116") return 0
  return data?.balance || 0
}
