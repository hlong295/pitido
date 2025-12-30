import { createServerClient as createSupabaseServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config"

export function createServerClient() {
  return getSupabaseServerClient()
}

export async function getSupabaseServerClient() {
  const cookieStore = await cookies()

  return createSupabaseServerClient(
    // IMPORTANT (PITODO): Always use the hard-coded Supabase URL/ANON key.
    // Some deploy targets may inject incorrect env vars at build/runtime.
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
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
