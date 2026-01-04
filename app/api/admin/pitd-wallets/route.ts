import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const ROOT_ADMIN_USERNAMES = new Set(["HLONG295", "HLONG"]);

async function isRequesterAdmin(req: NextRequest, supabaseAdmin: ReturnType<typeof getSupabaseAdminClient>): Promise<boolean> {
  const piUsername = (req.headers.get("x-pi-username") || "").trim();
  if (piUsername && ROOT_ADMIN_USERNAMES.has(piUsername.toUpperCase())) return true;

  const requesterId = (req.headers.get("x-pi-user-id") || "").trim();
  if (!requesterId) return false;

  const { data, error } = await supabaseAdmin
    .from("pi_users")
    .select("id, user_role")
    .eq("id", requesterId)
    .maybeSingle();

  if (error) return false;
  const role = String((data as any)?.user_role || "").toLowerCase();
  return role === "admin" || role === "root_admin" || role === "root";
}

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const adminOk = await isRequesterAdmin(req, supabaseAdmin);
    if (!adminOk) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("pitd_wallets")
      .select("user_id, balance")
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", details: error.message },
        { status: 500 }
      );
    }

    const wallets = (data || []).map((w: any) => ({
      user_id: w.user_id,
      balance: Number(w.balance ?? 0),
    }));

    return NextResponse.json({ ok: true, wallets });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}