// NOTE:
// Some API routes import `createSupabaseServerClient` from this module.
// We keep an explicit export with that name for compatibility.
import { createServerClient as _createSupabaseServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config"

// Compatibility export
export const createSupabaseServerClient = _createSupabaseServerClient

export function createServerClient() {
  return getSupabaseServerClient()
}

export async function getSupabaseServerClient() {
  const cookieStore: any = await cookies()

  return _createSupabaseServerClient(
    // IMPORTANT (PITODO): Always use the hard-coded Supabase URL/ANON key.
    // Some deploy targets may inject incorrect env vars at build/runtime.
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          try {
            if (cookieStore && typeof cookieStore.getAll === "function") return cookieStore.getAll()
          } catch {
            // ignore
          }
          return []
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Server Component - ignore
          }
        },
      },
    },
  )
}
