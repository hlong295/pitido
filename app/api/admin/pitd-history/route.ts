import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Root admins that always pass.
const ROOT_ADMIN_USERNAMES = new Set(["HLONG295", "HLONG"]); // keep existing behavior

type TxRow = {
  id: string;
  wallet_id: string;
  transaction_type: string;
  amount: any;
  description: string | null;
  created_at: string;
  pitd_wallets?: { user_id: string } | null;
};

async function isRequesterAdmin(piUsername?: string | null, requesterId?: string | null) {
  const username = (piUsername || "").trim();
  if (username && ROOT_ADMIN_USERNAMES.has(username.toUpperCase())) {
    return { ok: true, reason: "root_username" as const };
  }

  if (!requesterId) return { ok: false, reason: "missing_requester_id" as const };

  // Check pi_users.user_role for admin/root.
  // (Do NOT query non-existent columns here.)
  const { data, error } = await supabaseAdmin
    .from("pi_users")
    .select("id, user_role")
    .eq("id", requesterId)
    .maybeSingle();

  if (error) return { ok: false, reason: "pi_users_query_error" as const, error: error.message };
  const role = (data?.user_role || "").toString().toLowerCase();
  const ok = role === "admin" || role === "root" || role === "root_admin";
  return { ok, reason: ok ? ("role" as const) : ("not_admin" as const), role };
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const requesterId = req.headers.get("x-pi-user-id") || req.headers.get("x-pitodo-user-id") || "";
    const piUsername = req.headers.get("x-pi-username") || "";
    const authType = req.headers.get("x-auth-type") || "";

    const adminCheck = await isRequesterAdmin(piUsername, requesterId);
    if (!adminCheck.ok) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED", debug: { requesterId, piUsername, authType, adminCheck } },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
    const type = (url.searchParams.get("type") || "").trim();

    const txTypes: string[] = [];
    if (!type) {
      txTypes.push("admin_grant", "admin_revoke");
    } else if (type === "grant") {
      txTypes.push("admin_grant");
    } else if (type === "revoke") {
      txTypes.push("admin_revoke");
    } else {
      // allow raw value for forward-compat
      txTypes.push(type);
    }

    const { data: rows, error } = await supabaseAdmin
      .from("pitd_transactions")
      .select(
        "id, wallet_id, transaction_type, amount, description, created_at, pitd_wallets(user_id)"
      )
      .in("transaction_type", txTypes)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "QUERY_FAILED", details: error.message, debug: { txTypes, limit } },
        { status: 500 }
      );
    }

    const txRows = (rows || []) as TxRow[];
    const userIds = Array.from(
      new Set(txRows.map((r) => r.pitd_wallets?.user_id).filter(Boolean) as string[])
    );

    let userMap = new Map<string, { username?: string; email?: string; full_name?: string }>();
    if (userIds.length > 0) {
      const { data: users, error: uErr } = await supabaseAdmin
        .from("pi_users")
        .select("id, pi_username, email, full_name")
        .in("id", userIds);
      if (!uErr && users) {
        for (const u of users as any[]) {
          userMap.set(u.id, {
            username: u.pi_username || undefined,
            email: u.email || undefined,
            full_name: u.full_name || undefined,
          });
        }
      }
    }

    const transactions = txRows.map((r) => {
      const uid = r.pitd_wallets?.user_id || "";
      const u = uid ? userMap.get(uid) : undefined;
      const mappedType = r.transaction_type === "admin_grant" ? "grant" : r.transaction_type === "admin_revoke" ? "revoke" : r.transaction_type;
      const amountNum = typeof r.amount === "number" ? r.amount : Number(r.amount);

      return {
        id: r.id,
        type: mappedType,
        transaction_type: r.transaction_type,
        amount: Number.isFinite(amountNum) ? amountNum : 0,
        description: r.description || "",
        created_at: r.created_at,
        user_id: uid,
        username: u?.username || u?.email || u?.full_name || uid,
      };
    });

    return NextResponse.json({ ok: true, transactions });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
