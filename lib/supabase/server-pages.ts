import { createServerClient as createSupabaseServerClient } from "@supabase/ssr"
import type { NextApiRequest, NextApiResponse } from "next"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config"

export function getSupabaseServerClientPages(req: NextApiRequest, res: NextApiResponse) {
  return createSupabaseServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        // NextApiRequest cookies is a plain object
        return Object.entries(req.cookies || {}).map(([name, value]) => ({ name, value: value ?? "" }))
      },
      setAll(cookiesToSet) {
        // Important: write Set-Cookie headers for pages router
        const setCookie = cookiesToSet.map(({ name, value, options }) => {
          const opt = options || {}
          const parts = [`${name}=${value}`]

          if (opt.maxAge) parts.push(`Max-Age=${opt.maxAge}`)
          if (opt.expires) parts.push(`Expires=${(opt.expires as any).toUTCString?.() ?? opt.expires}`)
          if (opt.path) parts.push(`Path=${opt.path}`)
          if (opt.domain) parts.push(`Domain=${opt.domain}`)
          if (opt.sameSite) parts.push(`SameSite=${opt.sameSite}`)
          if (opt.secure) parts.push("Secure")
          if (opt.httpOnly) parts.push("HttpOnly")

          return parts.join("; ")
        })

        // Preserve existing set-cookie headers if any
        const prev = res.getHeader("Set-Cookie")
        const prevArr = Array.isArray(prev) ? prev : prev ? [String(prev)] : []
        res.setHeader("Set-Cookie", [...prevArr, ...setCookie])
      },
    },
  })
}
