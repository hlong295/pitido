import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category")
    const limit = searchParams.get("limit") ? Number.parseInt(searchParams.get("limit")!) : 20
    const offset = searchParams.get("offset") ? Number.parseInt(searchParams.get("offset")!) : 0
    const featured = searchParams.get("featured") === "true"
    const search = searchParams.get("search")

    const supabase = await getSupabaseServerClient()

    let query = supabase.from("products").select("*").eq("active", true)

    if (category && category !== "all") {
      query = query.eq("category", category)
    }

    if (featured) {
      query = query.eq("featured", true)
    }

    if (search) {
      query = query.ilike("name", `%${search}%`)
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error) {
      console.error("[v0] Error fetching products:", error)
      return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
    }

    return NextResponse.json({ products: data || [] })
  } catch (error) {
    console.error("[v0] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
