import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// IMPORTANT: Use the validated Supabase URL/KEY from a single source of truth.
// Some hosting environments inject placeholder env vars that can cause 401 "Invalid API key".
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./lib/supabase/config"

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

  // Các route khác: refresh session
  const response = NextResponse.next()

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
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
