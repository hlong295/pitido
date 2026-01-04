import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function looksLikeUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Resolve "master user id" (public.users.id) for both Pi-login and email-login flows.
 *
 * IMPORTANT:
 * - For Pi users, we primarily resolve by `pi_username` to prevent accidental duplicates in `public.users`
 *   when upstream Pi identifiers change during migrations or early development.
 * - If `pi_username` is unavailable, we fall back to `pi_uid`.
 * - For email users, `candidateUserId` should be the Supabase Auth user id (uuid) and can be used directly.
 */
type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

// Backwards-compatible signature:
// - Newer routes call: resolveMasterUserId(admin, candidateUserId, piUid?, piUsername?)
// - Older code may call: resolveMasterUserId(candidateUserId, piUid?, piUsername?)
export async function resolveMasterUserId(
  adminOrCandidateUserId: AdminClient | string | null,
  candidateOrPiUid?: string | null,
  piUidMaybe?: string | null,
  piUsernameMaybe?: string | null
): Promise<{ userId: string; created: boolean }> {
  const hasAdmin = typeof adminOrCandidateUserId === "object" && adminOrCandidateUserId !== null;
  const supabase: AdminClient = hasAdmin ? (adminOrCandidateUserId as AdminClient) : getSupabaseAdminClient();

  const candidateUserId: string | null = hasAdmin
    ? (candidateOrPiUid ?? null)
    : (adminOrCandidateUserId as string | null);
  let piUid: string | null = hasAdmin ? (piUidMaybe ?? null) : (candidateOrPiUid ?? null);
  let piUsername: string | null = hasAdmin ? (piUsernameMaybe ?? null) : (piUidMaybe ?? null);

  // 0) If Pi username is present, prefer the OLDEST matching users row.
  // Why: during migrations / login changes we can accidentally end up with
  // multiple rows for the same pi_username (e.g. hlong295). For PITD we must
  // use a stable master (the original row) so wallets/tx history remain intact.
  //
  // NOTE: In Pi Browser we sometimes lose reliable localStorage values,
  // so if piUsername is missing we try to derive it from the candidate pi_users row.
  let uname: string | null = piUsername ? String(piUsername).trim() : null;
  if (!uname && candidateUserId && looksLikeUuid(candidateUserId)) {
    const { data: piRow } = await supabase
      .from("pi_users")
      .select("pi_username, pi_uid")
      .eq("id", candidateUserId)
      .maybeSingle();

    const derivedUsername = (piRow?.pi_username ?? "").toString().trim();
    if (derivedUsername) uname = derivedUsername;

    // Also opportunistically derive piUid for later fallback.
    if (!piUid) {
      const derivedUid = (piRow?.pi_uid ?? "").toString().trim();
      if (derivedUid) piUid = derivedUid;
    }
  }

  if (uname) {
    // First try an exact case-insensitive match...
    const { data: byUsernameRows1, error: byUsernameErr1 } = await supabase
      .from("users")
      .select("id, created_at, pi_uid, pi_username")
      .ilike("pi_username", uname)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!byUsernameErr1 && byUsernameRows1 && byUsernameRows1.length > 0) {
      return { userId: byUsernameRows1[0].id as string, created: false };
    }

    // ...then a looser match (helps if there are stray spaces / formatting).
    const { data: byUsernameRows2, error: byUsernameErr2 } = await supabase
      .from("users")
      .select("id, created_at, pi_uid, pi_username")
      .ilike("pi_username", `%${uname}%`)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!byUsernameErr2 && byUsernameRows2 && byUsernameRows2.length > 0) {
      return { userId: byUsernameRows2[0].id as string, created: false };
    }
    // If the query fails or yields nothing, we fall back to other strategies.
  }

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
      return { userId: byPiUid.id, created: false };
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
    return { userId: masterUserId, created: false };
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

  return { userId: masterUserId, created: true };
}

  // 0) Strongest practical signal in Pi Browser is often piUsername.
  // If multiple rows exist with same username (case-insensitive), pick the oldest (created_at asc) as master.
  if (piUsername) {
    const uname = String(piUsername).trim();
    if (uname) {
      try {
        const { data: uByName, error: uByNameErr } = await adminSupabase
          .from("users")
          .select("id, pi_uid, pi_username, created_at")
          .ilike("pi_username", uname)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!uByNameErr && uByName?.id) {
          debug.push({ step: "master:by_username", piUsername: uname, userId: uByName.id, pi_uid: (uByName as any).pi_uid || null });
          return { masterUserId: String(uByName.id), debug };
        } else if (uByNameErr) {
          debug.push({ step: "master:by_username_error", piUsername: uname, error: uByNameErr.message });
        } else {
          debug.push({ step: "master:by_username_miss", piUsername: uname });
        }
      } catch (e: any) {
        debug.push({ step: "master:by_username_exception", piUsername: uname, error: e?.message || String(e) });
      }
    }
  }

