import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function looksLikeUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Resolve "master user id" (public.users.id) for both Pi-login and email-login flows.
 *
 * IMPORTANT:
 * - For Pi users, the stable identifier is `piUid` (Pi SDK uid) stored in `public.users.pi_uid`.
 *   We MUST resolve by `pi_uid` first to avoid duplicate users when localStorage / candidate ids change.
 * - For email users, `candidateUserId` should be the Supabase Auth user id (uuid) and can be used directly.
 */
export async function resolveMasterUserId(
  candidateUserId: string | null,
  piUid?: string | null,
  piUsername?: string | null
): Promise<{ masterUserId: string; created: boolean }> {
  const supabase = getSupabaseAdminClient();

  // 1) If Pi UID is present, resolve by users.pi_uid FIRST (stable)
  if (piUid && typeof piUid === "string" && piUid.trim()) {
    const pi_uid = piUid.trim();

    const { data: byPiUid, error: byPiUidErr } = await supabase
      .from("users")
      .select("id")
      .eq("pi_uid", pi_uid)
      .limit(1)
      .maybeSingle();

    if (byPiUidErr) {
      throw new Error(`resolveMasterUserId: users lookup by pi_uid failed: ${byPiUidErr.message}`);
    }
    if (byPiUid?.id) {
      return { masterUserId: byPiUid.id, created: false };
    }
  }

  // 2) Fallback: use candidateUserId if it looks like a uuid
  if (!candidateUserId || !looksLikeUuid(candidateUserId)) {
    throw new Error("resolveMasterUserId: missing/invalid candidateUserId and no piUid mapping found");
  }

  const masterUserId = candidateUserId;

  // If users row already exists for this id, return it
  const { data: existingUser, error: existingErr } = await supabase
    .from("users")
    .select("id")
    .eq("id", masterUserId)
    .maybeSingle();

  if (existingErr) {
    throw new Error(`resolveMasterUserId: users lookup by id failed: ${existingErr.message}`);
  }
  if (existingUser?.id) {
    return { masterUserId, created: false };
  }

  // 3) Create a minimal users row.
  // NOTE: we keep id = masterUserId to preserve compatibility with any existing FK rows (pitd_wallets, etc.)
  const insertPayload: any = { id: masterUserId };

  if (piUid && typeof piUid === "string" && piUid.trim()) insertPayload.pi_uid = piUid.trim();
  if (piUsername && typeof piUsername === "string" && piUsername.trim())
    insertPayload.pi_username = piUsername.trim();

  const { error: insErr } = await supabase.from("users").insert(insertPayload);

  if (insErr) {
    throw new Error(`resolveMasterUserId: users insert failed: ${insErr.message}`);
  }

  return { masterUserId, created: true };
}
