import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type UsersRow = {
  id: string;
  email: string | null;
  phone: string | null;
  pi_uid: string | null;
  pi_username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  user_type: string | null;
  user_role: string | null;
  verification_status: string | null;
  totp_secret: string | null;
  totp_enabled: boolean | null;
  email_verified: boolean | null;
  email_verified_at: string | null;
  provider_approved: boolean | null;
  provider_approved_at: string | null;
  provider_approved_by: string | null;
  provider_business_name: string | null;
  provider_description: string | null;
  last_login_at: string | null;
  created_at?: string | null;
};

type PiUsersRow = {
  id: string;
  pi_uid: string;
  pi_username: string;
  full_name: string | null;
  avatar_url: string | null;
  user_type: string | null;
  user_role: string | null;
  verification_status: string | null;
  provider_approved: boolean | null;
  provider_approved_at: string | null;
  provider_approved_by: string | null;
  provider_business_name: string | null;
  provider_description: string | null;
  last_login_at: string | null;
};

/**
 * A1 — User Master resolution.
 * We treat public.users.id as the master id, but we DO NOT change existing login flows.
 * Instead, we ensure that:
 * - If the caller gives a users.id => ok.
 * - If the caller gives a pi_users.id => we create/ensure a matching users row with the SAME id.
 *   (So existing references do not break, while establishing users as the master table.)
 */
export async function resolveMasterUserId(
  admin: SupabaseClient,
  candidateUserId: string
): Promise<{ userId: string; source: "users" | "pi_users" | "created_email_stub" }> {
  // 1) If already exists in users => master
  // IMPORTANT: we keep this query minimal to avoid breaking when the users table
  // does not contain optional columns (user_role, pi_uid, updated_at, ...).
  const { data: u0, error: u0Err } = await admin
    .from("users")
    .select("id")
    .eq("id", candidateUserId)
    .maybeSingle<Pick<UsersRow, "id">>();
  if (u0Err) {
    // best-effort only; if schema differs we continue with pi_users path.
  }
  if (u0?.id) {
    return { userId: u0.id, source: "users" };
  }

  // 2) If matches pi_users.id => mirror into users (same UUID)
  const { data: p0 } = await admin
    .from("pi_users")
    .select(
      "id,pi_uid,pi_username,full_name,avatar_url,user_type,user_role,verification_status,provider_approved,provider_approved_at,provider_approved_by,provider_business_name,provider_description,last_login_at"
    )
    .eq("id", candidateUserId)
    .maybeSingle<PiUsersRow>();

  if (p0?.id) {
    // Ensure users row exists with same id.
    const insertPayload: Partial<UsersRow> = {
      id: p0.id,
      email: null,
      phone: null,
      pi_uid: p0.pi_uid ?? null,
      pi_username: p0.pi_username ?? null,
      full_name: p0.full_name ?? p0.pi_username ?? null,
      avatar_url: p0.avatar_url ?? null,
      user_type: p0.user_type ?? "pi",
      user_role: p0.user_role ?? "redeemer",
      verification_status: p0.verification_status ?? "verified",
      provider_approved: p0.provider_approved ?? false,
      provider_approved_at: p0.provider_approved_at ?? null,
      provider_approved_by: p0.provider_approved_by ?? null,
      provider_business_name: p0.provider_business_name ?? null,
      provider_description: p0.provider_description ?? null,
      last_login_at: p0.last_login_at ?? null,
    };

    // Insert if missing. If already exists (race), ignore.
    const { error: insErr } = await admin.from("users").insert(insertPayload);
    if (insErr) {
      // If conflict (duplicate key), it's fine — another request inserted it.
      // If RLS blocks insert (common when we only have anon key), we still return the pi_users id
      // and let downstream logic attempt to read PITD wallet using that id.
      const code = (insErr as any).code as string | undefined;
      if (code !== "23505") {
        // Do not throw — wallet read should still work even without a mirrored users row.
        // We keep this behavior intentionally to avoid breaking login/UI in constrained runtimes.
        // eslint-disable-next-line no-console
        console.warn("[resolveMasterUserId] ensure users row skipped:", insErr.message);
      }
    }

    return { userId: p0.id, source: "pi_users" };
  }

  // 3) Fallback: candidate might be an email auth uid not yet mirrored into public.users.
  // We create a minimal stub users row using the same id.
  const stub: Partial<UsersRow> = {
    id: candidateUserId,
    user_type: "email",
    user_role: "redeemer",
    verification_status: "pending",
  };
  const { error: stubErr } = await admin.from("users").insert(stub);
  if (stubErr) {
    const code = (stubErr as any).code as string | undefined;
    if (code !== "23505") {
      // Do not throw — wallet read should still work even if we cannot create the users stub.
      // eslint-disable-next-line no-console
      console.warn("[resolveMasterUserId] create users stub skipped:", stubErr.message);
    }
  }

  return { userId: candidateUserId, source: "created_email_stub" };
}
