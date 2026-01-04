import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config"

// IMPORTANT (PITODO): Always use the hard-coded Supabase URL/ANON key.
// In some hosting environments (Pi Browser / PiNet deployment), build-time env vars
// can be injected with placeholders and override the correct keys, resulting in:
//  - 401 "Invalid API key"
//  - endless loading when fetching wallet/user data
const url = SUPABASE_URL
const anonKey = SUPABASE_ANON_KEY

declare global {
  var __supabaseClient: ReturnType<typeof createSupabaseBrowserClient> | undefined
}

export function createBrowserClient() {
  if (typeof window !== "undefined" && globalThis.__supabaseClient) {
    return globalThis.__supabaseClient
  }

  const client = createSupabaseBrowserClient(url, anonKey, {
    auth: {
      detectSessionInUrl: true,
      flowType: "implicit",
      persistSession: true,
      autoRefreshToken: true,
    },
  })

  if (typeof window !== "undefined") {
    globalThis.__supabaseClient = client
  }

  return client
}

export function getSupabaseBrowserClient() {
  return createBrowserClient()
}
