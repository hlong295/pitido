// Server-only Supabase admin client (Service Role) to bypass RLS for admin actions.
// IMPORTANT: Do NOT import this file in client components.

import { createClient } from "@supabase/supabase-js"
import { SUPABASE_URL as CFG_SUPABASE_URL } from "@/lib/supabase/config"

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  CFG_SUPABASE_URL

/**
 * Service role key (server-only).
 *
 * PITODO baseline hiện không dựa vào .env ổn định trên Pi Browser/App Studio,
 * nên nếu env không tồn tại thì vẫn cần fallback để các admin API hoạt động.
 * IMPORTANT: tuyệt đối KHÔNG import file này vào client component.
 */
/**
 * Service role key (server-only).
 *
 * A3/PITD policy:
 * - PITD is internal asset ⇒ MUST NOT be accessed by client directly.
 * - API routes that read/write PITD MUST use Service Role (bypass RLS).
 *
 * Pi Studio hosting may not reliably inject env vars. If your host supports env,
 * set SUPABASE_SERVICE_ROLE_KEY.
 *
 * If your host does NOT support env vars, you may hard-code the service role key
 * here (server-only file). This file must NEVER be imported into client code.
 */
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Optional hardcoded fallback for hosts without env support.
// NOTE: this value is used SERVER-ONLY. Never expose it to the client.
// If you later gain env access, move this into SUPABASE_SERVICE_ROLE_KEY.
const HARDCODED_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZXdxa2Nid2J2YmJ3amZwYmNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTA2NjA4MiwiZXhwIjoyMDgwNjQyMDgyfQ.CLNeaPyAXRg-Gacc2A93YINxqip60WrlMD2mcop245k"

export function getSupabaseAdminClient() {
  // A3: DO NOT silently fall back to ANON.
  // If Service Role is missing, PITD APIs must fail fast with a clear error,
  // otherwise the app will keep "loading" and you'll only see generic RLS errors.
  const keyToUse = SERVICE_ROLE_KEY || HARDCODED_SERVICE_ROLE_KEY
  if (!keyToUse) {
    throw new Error("MISSING_SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(SUPABASE_URL, keyToUse, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
