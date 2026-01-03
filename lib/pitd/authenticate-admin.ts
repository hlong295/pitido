import "server-only";

import type { NextRequest } from "next/server";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/pitd/require-user";

type AuthOk = { ok: true; userId: string };
type AuthErr = { ok: false; status: number; error: string; debug?: any };

// Authenticate an admin caller without changing existing login flows.
// Priority:
// - Bearer token (email login)
// - Pi cookie / headers (Pi Browser)

export async function authenticateAdmin(req: NextRequest): Promise<AuthOk | AuthErr> {
  try {
    const userId = await getAuthenticatedUserId(req as any);
    if (!userId) {
      return { ok: false, status: 401, error: "UNAUTHORIZED" };
    }

    try {
      await requireAdmin(userId);
    } catch (e: any) {
      return { ok: false, status: 403, error: "FORBIDDEN_NOT_ADMIN", debug: { message: e?.message || String(e) } };
    }

    return { ok: true, userId };
  } catch (e: any) {
    return { ok: false, status: 500, error: "AUTH_ERROR", debug: { message: e?.message || String(e) } };
  }
}
