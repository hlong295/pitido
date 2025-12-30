import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * PITODO - Supabase query helpers
 *
 * IMPORTANT:
 * - Keep this file browser-safe (no `next/*` imports). It is imported by client code.
 * - Do NOT perform PITD wallet/transaction writes here. PITD is internal asset → server APIs only.
 */

// -----------------------------
// Products (public)
// -----------------------------

export async function getProducts(params?: { limit?: number }) {
  // Lazy import to keep this module usable in more contexts
  const { createBrowserClient } = await import("./client")
  const supabase = createBrowserClient()

  const limit = params?.limit ?? 20
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[queries.getProducts] error:", error)
    return []
  }
  return data ?? []
}

export async function getProductById(id: string) {
  const { createBrowserClient } = await import("./client")
  const supabase = createBrowserClient()

  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle()
  if (error) {
    console.error("[queries.getProductById] error:", error)
    return null
  }
  return data ?? null
}

// -----------------------------
// Auth / User (Pi + Email)
// -----------------------------

/**
 * Ensure/Upsert user rows on server (pi_users + public.users master resolution).
 * This should go through server route to avoid client-side direct writes.
 */
export async function createOrUpdatePiUser(params: {
  piUser?: any
  emailUser?: any
  source?: "pi" | "email"
}) {
  try {
    const res = await fetch("/api/auth/ensure-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    })

    const text = await res.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      // Keep raw text for debugging
      json = { ok: false, raw: text }
    }

    if (!res.ok) {
      console.error("[queries.createOrUpdatePiUser] non-OK:", res.status, json)
      return { ok: false, status: res.status, ...json }
    }

    return { ok: true, ...json }
  } catch (e: any) {
    console.error("[queries.createOrUpdatePiUser] error:", e)
    return { ok: false, error: e?.message ?? String(e) }
  }
}

/**
 * 2FA enable flow (placeholder).
 * If you already have a dedicated API route for enabling 2FA, wire it here.
 */
export async function enableUser2FA(_params: { totpCode: string }) {
  // We keep this exported because auth-context imports it.
  // Implement when 2FA endpoints are finalized.
  return { ok: false, message: "2FA enable endpoint is not configured in this build." }
}

// -----------------------------
// Provider apply / approvals
// -----------------------------

/**
 * User applies to become a provider.
 * This uses the passed-in client because your code already has a session-ready supabase client.
 *
 * Expected pi_users columns (based on your DB screenshots/memory):
 * - provider_business_name (text)
 * - provider_description (text)
 * - provider_approved (bool)
 */
export async function applyForProvider(
  supabase: SupabaseClient,
  params: { userId: string; businessName: string; businessDesc: string },
) {
  const { userId, businessName, businessDesc } = params

  const { error } = await supabase
    .from("pi_users")
    .update({
      provider_business_name: businessName,
      provider_description: businessDesc,
      provider_approved: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) {
    console.error("[queries.applyForProvider] error:", error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/**
 * Admin panel: list pending provider applications.
 * NOTE: This requires RLS to allow admin reads (or you can move this to server API later).
 */
export async function getPendingProviders(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("pi_users")
    .select(
      "id, pi_uid, pi_username, full_name, email, user_role, provider_business_name, provider_description, provider_approved, created_at, updated_at",
    )
    .eq("provider_approved", false)
    .not("provider_business_name", "is", null)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[queries.getPendingProviders] error:", error)
    return []
  }
  return data ?? []
}

/**
 * Approve/Reject provider via server route (so permission checks are enforced server-side).
 */
export async function approveProvider(params: { requesterId: string; targetUserId: string; approve: boolean }) {
  try {
    const res = await fetch("/api/admin/approve-provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    })

    const text = await res.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { ok: false, raw: text }
    }

    if (!res.ok) {
      console.error("[queries.approveProvider] non-OK:", res.status, json)
      return { ok: false, status: res.status, ...json }
    }

    return { ok: true, ...json }
  } catch (e: any) {
    console.error("[queries.approveProvider] error:", e)
    return { ok: false, error: e?.message ?? String(e) }
  }
}
