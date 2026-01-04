import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client.
 *
 * IMPORTANT:
 * - Requires SUPABASE_SERVICE_ROLE_KEY on the server (Vercel Environment Variables).
 * - Never import this file into client components.
 */
export function getSupabaseAdminClient() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceKey) {
    // Throw a clear error so API routes can surface a helpful message.
    throw new Error(
      "Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set this in Vercel Environment Variables)."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
