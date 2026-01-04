import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveMasterUserId } from "./resolve-master-user"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

/**
 * Resolve any incoming identifier (users.id, pi_users.id, pi_uid, pi_username)
 * to the master user id (public.users.id).
 */
export async function resolveInternalUserId(supabaseAdmin: SupabaseClient, raw: string) {
  const candidate = (raw || "").trim()
  if (!candidate) return null

  // If it's already a UUID (could be users.id or pi_users.id)
  if (isUuid(candidate)) {
    const resolved = await resolveMasterUserId(supabaseAdmin, candidate)
    return resolved?.userId || null
  }

  // Try resolve via pi_users by pi_uid or pi_username
  try {
    const { data: piUser } = await supabaseAdmin
      .from("pi_users")
      .select("id")
      .or(`pi_uid.eq.${candidate},pi_username.eq.${candidate}`)
      .maybeSingle()
    if (piUser?.id) {
      const resolved = await resolveMasterUserId(supabaseAdmin, piUser.id)
      return resolved?.userId || null
    }
  } catch {
    // ignore
  }

  // Try resolve directly via users table (email / username fields if exist)
  try {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .or(`email.eq.${candidate},username.eq.${candidate}`)
      .maybeSingle()
    if (user?.id) return user.id
  } catch {
    // ignore
  }

  return null
}
