import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Server-only supabase client using Service Role key.
// All PITD read/write must go through API routes with this client.

export const adminSupabase = getSupabaseAdminClient();
