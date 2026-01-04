import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";
import { safeSelectPitdTransactions, selectWalletByUserIds } from "@/lib/pitd/ledger";

// Admin PITD history: reads from public.pitd_transactions.
// IMPORTANT:
// - Do not change UI.
// - PITD is internal asset => must go through server routes.
// - No caching (Pi Browser can be aggressive).

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROOT_ADMIN_USERNAMES = new Set(["HLONG295", "HLONG29", "HLONG"]);

function isUuidLike(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((v || "").trim());
}

async function isRequesterAdmin(piUsername?: string | null, requesterId?: string | null) {
  const username = (piUsername || "").trim();
  if (username && ROOT_ADMIN_USERNAMES.has(username.toUpperCase())) {
    return { ok: true, reason: "root_username" as const };
  }

  if (!requesterId) return { ok: false, reason: "missing_requester_id" as const };

  const supabaseAdmin = getSupabaseAdminClient();

  // requesterId can be:
  // - pi_users.id (uuid)
  // - pi_users.pi_uid (string)
  let q = supabaseAdmin.from("pi_users").select("id, user_role, pi_uid");

  if (isUuidLike(requesterId)) {
    q = q.eq("id", requesterId);
  } else {
    q = q.eq("pi_uid", requesterId);
  }

  const { data, error } = await q.maybeSingle();
  if (error) return { ok: false, reason: "query_failed" as const, details: error.message };
  if (!data) return { ok: false, reason: "not_found" as const };

  const role = String((data as any)?.user_role || "").toLowerCase();
  if (role === "admin" || role === "root" || role === "root_admin" || role === "super_admin") {
    return { ok: true, reason: "role" as const };
  }

  return { ok: false, reason: "not_admin" as const };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // Requester identity:
    // - Pi Browser admin uses x-pi-user-id + x-pi-username
    // - Some contexts may only have cookies (pitodo_pi_user)
    const headerRequesterId = req.headers.get("x-pi-user-id") || req.headers.get("x-user-id") || "";
    const piUsername = req.headers.get("x-pi-username") || "";

    let requesterId = headerRequesterId;
    if (!requesterId) {
      try {
        const fromCookie = await getAuthenticatedUserId(req as any);
        if (fromCookie) requesterId = String(fromCookie);
      } catch {
        // ignore
      }
    }

    const auth = await isRequesterAdmin(piUsername, requesterId);
    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: "NOT_AUTHORIZED", debug: { requesterId, piUsername, auth } },
        { status: 403 },
      );
    }

    const targetIdentifier = (url.searchParams.get("userId") || "").trim();
    const walletIdParam = (url.searchParams.get("walletId") || "").trim();
    const typeParam = (url.searchParams.get("type") || "all").toLowerCase(); // all | grant | revoke
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || "50"), 1), 200);

    if (!targetIdentifier) {
      return NextResponse.json({ ok: false, error: "MISSING_USER_ID" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();

    // Resolve master id for PITD wallet lookup.
    // NOTE: resolveMasterUserId expects a UUID. If UI passes a pi_username/email here,
    // the admin grant API already resolves it, but history page may pass UUID.
    const candidateIds: string[] = [];
    if (isUuidLike(targetIdentifier)) {
      const master = await resolveMasterUserId(supabaseAdmin, targetIdentifier);
      candidateIds.push(master.userId, targetIdentifier);
    } else {
      // If it's not UUID, we only return empty history (caller should use admin grant UI which supports username/email).
      return NextResponse.json({ ok: true, transactions: [], meta: { note: "target_userId_not_uuid" } });
    }

    // Wallet resolve.
    let wallet: any = null;
    if (walletIdParam) {
      const { data: w, error: wErr } = await supabaseAdmin
        .from("pitd_wallets")
        .select("id,user_id,balance,locked_balance,total_spent,address,created_at,updated_at")
        .eq("id", walletIdParam)
        .maybeSingle();
      if (wErr) {
        return NextResponse.json(
          { ok: false, error: "WALLET_LOOKUP_FAILED", details: wErr.message },
          { status: 500 },
        );
      }
      wallet = w;
    }

    if (!wallet) {
      wallet = await selectWalletByUserIds(supabaseAdmin, candidateIds);
    }

    if (!wallet?.id) {
      return NextResponse.json({ ok: true, transactions: [], meta: { note: "no_wallet" } });
    }

    // Transactions
    let txs = await safeSelectPitdTransactions(supabaseAdmin, [wallet.id], limit);

    // Optional filter typeParam (do in JS for schema tolerance)
    if (typeParam === "grant") {
      txs = txs.filter((t: any) => {
        const tt = String(t?.transaction_type || "").toLowerCase();
        const action = String(t?.metadata?.action || "").toLowerCase();
        return tt.includes("grant") || action === "grant" || Number(t?.amount) > 0;
      });
    } else if (typeParam === "revoke") {
      txs = txs.filter((t: any) => {
        const tt = String(t?.transaction_type || "").toLowerCase();
        const action = String(t?.metadata?.action || "").toLowerCase();
        return tt.includes("revoke") || action === "revoke" || Number(t?.amount) < 0;
      });
    }

    return NextResponse.json({ ok: true, transactions: txs });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: e?.message || String(e) },
      { status: 500 },
    );
  }
}
