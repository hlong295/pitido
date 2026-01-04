import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// IMPORTANT: Use the validated Supabase URL/KEY from a single source of truth.
// Some hosting environments inject placeholder env vars that can cause 401 "Invalid API key".
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./lib/supabase/config"

function safeCookieGetAll(request: NextRequest): { name: string; value: string }[] {
  const anyReq: any = request as any
  const rc = anyReq?.cookies

  // Newer NextRequest cookie API
  if (rc && typeof rc.getAll === "function") {
    try {
      return rc.getAll()
    } catch {
      // fall through
    }
  }

  // Fallback: parse raw Cookie header
  const raw = request.headers.get("cookie") || ""
  if (!raw) return []

  return raw
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf("=")
      if (idx === -1) return { name: pair, value: "" }
      return { name: pair.slice(0, idx), value: pair.slice(idx + 1) }
    })
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const searchParams = request.nextUrl.searchParams

  console.log("[v0] Middleware path:", path)
  console.log("[v0] Middleware params:", {
    code: searchParams.get("code") ? "yes" : "no",
    token_hash: searchParams.get("token_hash") ? "yes" : "no",
    type: searchParams.get("type"),
    error: searchParams.get("error"),
  })

  /**
   * Bypass TẤT CẢ auth routes - để route handlers xử lý trực tiếp
   * Không redirect, không can thiệp, chỉ bypass
   */
  if (path.startsWith("/auth/")) {
    console.log("[v0] Middleware: Bypassing auth route:", path)
    return NextResponse.next()
  }

  /**
   * Pi Browser / embedded WebViews can have partial cookie APIs that break
   * supabase session refresh in Middleware.
   *
   * Settings/Profile APIs do NOT require middleware session refresh because
   * they authenticate/authorize inside the route handlers.
   *
   * IMPORTANT: This bypass prevents runtime errors like `e.getAll is not a function`
   * on /api/settings/* while keeping the rest of the app unchanged.
   */
  if (path.startsWith("/api/settings/")) {
    console.log("[v0] Middleware: Bypassing settings API:", path)
    return NextResponse.next()
  }

  // Các route khác: refresh session
  const response = NextResponse.next()

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        // Pi Browser / some embedded webviews may hit older runtime bridges
        // where NextRequest.cookies.getAll is missing. Use a safe fallback.
        return safeCookieGetAll(request)
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  await supabase.auth.getSession()

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
