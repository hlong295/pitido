import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";
import { safeSelectPitdTransactions, safeSelectPitdTransactionsFiltered } from "@/lib/pitd/ledger";

// Server-only: PITD history must be read via API (service role), never from client anon.

function errJson(status: number, message: string, dbg?: any) {
  return NextResponse.json(
    { ok: false, error: message, ...(dbg ? { dbg } : {}) },
    { status }
  );
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    (v || "").trim()
  );
}

// Some Pi Browser / cookie environments may accidentally pass non-UUID identifiers
// (pi_username / pi_uid / JSON strings). Normalize to a UUID before querying uuid columns.
async function normalizeToUuid(supabaseAdmin: any, candidate: string) {
  const raw = (candidate || "").trim();
  if (!raw) return "";
  if (isUuid(raw)) return raw;

  // Try resolve by pi_users.pi_username or pi_users.pi_uid.
  // Keep minimal select to avoid schema break.
  const { data: piRow, error } = await supabaseAdmin
    .from("pi_users")
    .select("id")
    .or(`pi_username.ilike.${raw},pi_uid.eq.${raw}`)
    .maybeSingle();

  if (error) return "";
  const id = (piRow as any)?.id;
  return typeof id === "string" && id.trim() ? id.trim() : "";
}

// Resolve current user from either:
// - Supabase Auth JWT (email/username login)
// - Pi header user id (Pi Browser login flow)
async function resolveRequesterUserId(req: NextRequest): Promise<{
  ok: true;
  userId: string;
  mode: "supabase" | "pi" | "cookie";
  dbg?: any;
} | {
  ok: false;
  status: number;
  message: string;
  dbg?: any;
}> {
  const dbg: any = { step: "resolveRequesterUserId" };

  // 0) Supabase session cookie (email/username login in browser)
  // Many client fetches rely on Supabase auth cookies (NOT an Authorization header).
  // If we don't read cookie-based sessions here, PITD history will show UNAUTHORIZED.
  try {
    const supabaseFromCookies = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          // In some runtimes the cookies object may not implement getAll().
          // This caused the UI error: "getAll is not a function".
          const anyCookies = (req as any)?.cookies;
          if (anyCookies && typeof anyCookies.getAll === "function") {
            return anyCookies.getAll();
          }

          // Fallback: parse the Cookie header manually.
          const raw = req.headers.get("cookie") || "";
          if (!raw) return [];
          return raw
            .split(";")
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
              const idx = part.indexOf("=");
              const name = idx >= 0 ? part.slice(0, idx).trim() : part;
              const value = idx >= 0 ? part.slice(idx + 1) : "";
              return { name, value };
            });
        },
        setAll() {
          // No-op in route handler (we don't need to mutate cookies for read-only history).
        },
      },
    });

    const { data: u } = await supabaseFromCookies.auth.getUser();
    if (u?.user?.id) {
      dbg.mode = "supabase_cookie";
      dbg.supabaseUserId = u.user.id;
      return { ok: true, userId: u.user.id, mode: "supabase", dbg };
    }
  } catch (e: any) {
    dbg.supabaseCookieException = String(e?.message || e);
  }

  // 1) Supabase JWT first (email/username)
  try {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
      });
      const { data, error } = await supabaseAuth.auth.getUser(token);
      if (!error && data?.user?.id) {
        dbg.mode = "supabase";
        dbg.supabaseUserId = data.user.id;
        return { ok: true, userId: data.user.id, mode: "supabase", dbg };
      }
      dbg.supabaseAuthError = error?.message || null;
    }
  } catch (e: any) {
    dbg.supabaseAuthException = String(e?.message || e);
  }

  // 2) Pi Browser fallback: accept x-pi-user-id
  const piUserId = req.headers.get("x-pi-user-id") || "";
  if (piUserId) {
    dbg.mode = "pi";
    dbg.piUserId = piUserId;
    return { ok: true, userId: piUserId, mode: "pi", dbg };
  }

  
  // 2b) Generic fallback: accept x-user-id (uuid) if present
  const xUserId = (req.headers.get("x-user-id") || "").trim();
  if (xUserId) {
    dbg.mode = "x-user-id";
    dbg.xUserId = xUserId;
    return { ok: true, userId: xUserId, mode: "cookie", dbg };
  }

// 2b) Email/user fallback: accept x-pitodo-user-id
  // Some client environments may not reliably forward Supabase auth cookies.
  // The app can include the current authenticated app user id in a header.
  const pitodoUserId = req.headers.get("x-pitodo-user-id") || "";
  if (pitodoUserId) {
    dbg.mode = "pitodo";
    dbg.pitodoUserId = pitodoUserId;
    return { ok: true, userId: pitodoUserId, mode: "pitodo", dbg };
  }

  // 3) Cookie fallback (Pi login stores a JSON payload in `pitodo_pi_user`)
  try {
    const cookieUserId = await getAuthenticatedUserId(req as any);
    if (cookieUserId) {
      dbg.mode = "cookie";
      dbg.cookieUserId = cookieUserId;
      return { ok: true, userId: cookieUserId, mode: "cookie", dbg };
    }
  } catch (e: any) {
    dbg.cookieException = String(e?.message || e);
  }

  return { ok: false, status: 401, message: "UNAUTHORIZED", dbg };
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dbgOn = url.searchParams.get("dbg") === "1";
  const pitodoUserId = (req.headers.get("x-pitodo-user-id") || "").trim();
  const authType = (req.headers.get("x-auth-type") || "").trim();

  try {
    const resolved = await resolveRequesterUserId(req);
    if (!resolved.ok) return errJson(resolved.status, resolved.message, dbgOn ? resolved.dbg : undefined);

    const dbg: any = { ...(resolved.dbg || {}), step: "GET /api/pitd/transactions" };
    const supabaseAdmin = getSupabaseAdminClient();

    // Ensure the requester id is a UUID before we touch uuid columns.
    const requesterUuid = await normalizeToUuid(supabaseAdmin, resolved.userId);
    if (!requesterUuid) {
      dbg.requesterIdRaw = resolved.userId;
      return errJson(401, "UNAUTHORIZED", dbgOn ? dbg : undefined);
    }

    // PITD tables are keyed by "master user" id (public.users.id). Normalize here so
    // history works consistently for both Pi-login and email-login users.
    const master = await resolveMasterUserId(supabaseAdmin, requesterUuid);
    // Default to resolved master user id, but allow client-provided master id for email flow (after auth verified).
    let requesterUserId = master.userId;
    if (authType === "email" && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(pitodoUserId)) {
      requesterUserId = pitodoUserId;
    }

    // Optional: wallet_id can be provided, but must belong to requester
    const walletIdParam = (url.searchParams.get("wallet_id") || "").trim();
    const limitParam = Number(url.searchParams.get("limit") || "50");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

    // Optional filters for UI tabs & full history
    const directionParamRaw = (url.searchParams.get("direction") || "").trim().toLowerCase();
    const direction = directionParamRaw === "in" || directionParamRaw === "out" ? (directionParamRaw as "in" | "out") : undefined;
    const from = (url.searchParams.get("from") || "").trim();
    const to = (url.searchParams.get("to") || "").trim();

    // Get requester's wallet (and verify ownership if wallet_id was supplied)
    // Backward-compatibility: older deployments may have rows keyed by the pre-normalized id.
    const candidateUserIds = Array.from(
      new Set(
        [requesterUserId, requesterUuid]
          .map((v) => (typeof v === "string" ? v.trim() : ""))
          .filter((v) => v && isUuid(v))
      )
    );

    if (candidateUserIds.length === 0) {
      dbg.candidateUserIds = candidateUserIds;
      dbg.requesterUserId = requesterUserId;
      dbg.requesterUuid = requesterUuid;
      return NextResponse.json({ ok: true, wallet: null, transactions: [] });
    }

    // NOTE: trong quá trình migrate/mapping master user, có thể tồn tại nhiều wallet rows
    // (cũ + mới). Lịch sử phải lấy theo TẤT CẢ wallet_id thuộc về user.
    const { data: wallets, error: walletErr } = await supabaseAdmin
      .from("pitd_wallets")
      .select("id,user_id,balance,locked_balance,total_spent,address,created_at")
      .in("user_id", candidateUserIds)
      .order("created_at", { ascending: true });
    if (walletErr) {
      dbg.walletErr = walletErr.message;
      dbg.candidateUserIds = candidateUserIds;
      return errJson(500, "WALLET_LOOKUP_FAILED", dbgOn ? dbg : undefined);
    }
    const walletList = Array.isArray(wallets) ? wallets : [];
    const primaryWallet = walletList[0] || null;
    if (!primaryWallet?.id) {
      dbg.noWallet = true;
      // wallet route is responsible for creation; here we just return empty history
      return NextResponse.json({ ok: true, wallet: null, transactions: [] });
    }

    const ownedWalletIds = walletList.map((w) => w.id).filter(Boolean);
    if (walletIdParam && !ownedWalletIds.includes(walletIdParam)) {
      dbg.walletIdParam = walletIdParam;
      dbg.walletIdOwned = ownedWalletIds;
      return errJson(403, "FORBIDDEN_WALLET", dbgOn ? dbg : undefined);
    }
    const walletIdsToQuery = walletIdParam ? [walletIdParam] : ownedWalletIds;

    // History
    let txs: any[] = [];
    try {
      // Use filtered selector when any filter is provided
      if (direction || from || to) {
        txs = await safeSelectPitdTransactionsFiltered(supabaseAdmin, walletIdsToQuery, { limit, direction, from: from || undefined, to: to || undefined });
      } else {
        txs = await safeSelectPitdTransactions(supabaseAdmin, walletIdsToQuery, limit);
      }
    } catch (e: any) {
      dbg.txErr = String(e?.message || e);
      return errJson(500, "TX_LOOKUP_FAILED", dbgOn ? dbg : undefined);
    }

    return NextResponse.json({ ok: true, wallet: primaryWallet, transactions: txs || [] });
  } catch (e: any) {
    const dbg = {
      message: e?.message || String(e),
      stack: e?.stack || null,
    };
    return errJson(500, "SERVER_ERROR", dbgOn ? dbg : undefined);
  }
}
