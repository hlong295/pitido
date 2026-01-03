import { NextRequest } from "next/server";
import { errJson, okJson } from "@/lib/api/json";
import { authenticateAdmin } from "@/lib/pitd/authenticate-admin";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";
import { adminSupabase } from "@/lib/pitd/admin-supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await authenticateAdmin(req);
  if (!admin.ok) return errJson(admin.status, admin.error, admin.debug);

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return errJson(400, "Missing userId");

  // A1: public.users is master. Resolve candidate into a master users.id
  let masterUserId = userId;
  try {
    const resolved = await resolveMasterUserId(adminSupabase as any, userId);
    masterUserId = (resolved as any).userId || userId;
  } catch (e: any) {
    // Best-effort: don't hard-fail wallet read
    masterUserId = userId;
  }

  const { data: wallet, error } = await adminSupabase
    .from("pitd_wallets")
    .select("id, user_id, balance, locked_balance, total_spent, address, created_at, updated_at")
    .eq("user_id", masterUserId)
    .maybeSingle();

  if (error) return errJson(500, "DB error", { error: error.message });

  return okJson({
    wallet: wallet
      ? {
          ...wallet,
          total_balance: Number(wallet.balance ?? 0) + Number(wallet.locked_balance ?? 0),
        }
      : null,
  });
}
