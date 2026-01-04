import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type ResolveMasterUserInput = {
  /**
   * Current app user type.
   * - "pi": Pi user login (Pi SDK)
   * - "email": Email/user login
   */
  userType: "pi" | "email";

  /**
   * The id your auth layer currently yields (may be Supabase Auth user id).
   * For Pi users this is often a generated UUID and can change.
   */
  currentUserId: string;

  /** Pi SDK username (if userType === "pi") */
  piUsername?: string | null;

  /** Pi SDK UID (if userType === "pi") */
  piUid?: string | null;
};

export type ResolveMasterUserResult = {
  masterUserId: string;
  /** debug is optional but helpful on Pi Browser (no console) */
  debug?: any[];
};

function normStr(v: any): string {
  return (typeof v === "string" ? v : "").trim();
}

function normLower(v: any): string {
  return normStr(v).toLowerCase();
}

/**
 * MASTER RULE:
 * - Email users: masterUserId == currentUserId
 * - Pi users: masterUserId is resolved by (pi_username OR pi_uid) from public.users
 *   and ensured to exist. We NEVER rely on the volatile currentUserId for Pi users.
 */
export async function resolveMasterUser(input: ResolveMasterUserInput): Promise<ResolveMasterUserResult> {
  const admin = getSupabaseAdminClient();
  const debug: any[] = [];

  const userType = input.userType;
  const currentUserId = normStr(input.currentUserId);
  const piUsername = normStr(input.piUsername);
  const piUid = normStr(input.piUid);

  debug.push({ step: "input", userType, currentUserId, piUsername: piUsername || null, piUid: piUid || null });

  // Email login → stable: use the auth user id as master.
  if (userType === "email") {
    if (!currentUserId) {
      debug.push({ step: "email:missing_currentUserId" });
      return { masterUserId: "", debug };
    }
    debug.push({ step: "email:master", masterUserId: currentUserId });
    return { masterUserId: currentUserId, debug };
  }

  // Pi login: resolve master by username first (human stable), then by pi_uid.
  const unameLower = piUsername ? normLower(piUsername) : "";

  // 1) Try resolve by pi_username (case-insensitive)
  if (unameLower) {
    const { data: byName, error: byNameErr } = await admin
      .from("users")
      .select("id, pi_uid, pi_username")
      .ilike("pi_username", piUsername)
      .limit(1)
      .maybeSingle();

    if (!byNameErr && byName?.id) {
      debug.push({ step: "pi:master_by_username", masterUserId: String(byName.id), pi_uid: (byName as any).pi_uid || null });
      return { masterUserId: String(byName.id), debug };
    }
    if (byNameErr) debug.push({ step: "pi:master_by_username_error", error: byNameErr.message });
    else debug.push({ step: "pi:master_by_username_not_found" });
  } else {
    debug.push({ step: "pi:missing_piUsername" });
  }

  // 2) Try resolve by pi_uid (stable from Pi SDK)
  if (piUid) {
    const { data: byUid, error: byUidErr } = await admin
      .from("users")
      .select("id, pi_uid, pi_username")
      .eq("pi_uid", piUid)
      .limit(1)
      .maybeSingle();

    if (!byUidErr && byUid?.id) {
      debug.push({ step: "pi:master_by_pi_uid", masterUserId: String(byUid.id) });
      return { masterUserId: String(byUid.id), debug };
    }
    if (byUidErr) debug.push({ step: "pi:master_by_pi_uid_error", error: byUidErr.message });
    else debug.push({ step: "pi:master_by_pi_uid_not_found" });
  } else {
    debug.push({ step: "pi:missing_piUid" });
  }

  // 3) Ensure a master row exists.
  // If we reach here, we couldn't find by username/pi_uid. We create a new master user row.
  // IMPORTANT: we MUST NOT create random ids for Pi users.
  // We only create a new row when necessary. In that case, we use currentUserId as a fallback id.
  // (In your DB you prefer master == legacy id, but if not found we still need an id to attach a wallet.)
  if (!currentUserId) {
    debug.push({ step: "pi:create_master_failed_missing_currentUserId" });
    return { masterUserId: "", debug };
  }

  const insertPayload: any = {
    id: currentUserId,
    pi_uid: piUid || null,
    pi_username: piUsername || null,
  };

  const { error: insErr } = await admin.from("users").insert(insertPayload);
  if (insErr) {
    // If duplicate id, just use it.
    debug.push({ step: "pi:create_master_insert_error", error: insErr.message });
  } else {
    debug.push({ step: "pi:create_master_insert_ok", masterUserId: currentUserId });
  }

  return { masterUserId: currentUserId, debug };
}
