import { NextResponse } from "next/server";

// Minimal JSON helpers for API routes.
// Keep this tiny and dependency-free.

export function okJson(body: any, init?: ResponseInit) {
  return NextResponse.json(body ?? {}, { status: 200, ...(init || {}) });
}

export function errJson(status: number, error: string, debug?: any) {
  const payload: any = { ok: false, error };
  if (debug !== undefined) payload.debug = debug;
  return NextResponse.json(payload, { status });
}
