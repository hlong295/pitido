import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

// Upload avatar.
// Supports:
// 1) JSON body: { userId, filename, contentType, base64 }
//    (preferred for Pi Browser / older WebViews that break on multipart uploads)
// 2) multipart/form-data: { userId, file }

export async function POST(request: Request) {
  try {
    // Polyfill: some deployments provide a Headers implementation without `.getAll()`.
    // A dependency in the stack still calls `headers.getAll(...)`, which results in:
    // "e.getAll is not a function". Adding this tiny polyfill makes it robust.
    try {
      const hp: any = (globalThis as any)?.Headers?.prototype
      if (hp && typeof hp.getAll !== "function") {
        hp.getAll = function (name: string) {
          const v = this.get(name)
          return v == null ? [] : [v]
        }
      }
    } catch {}

    let userId = ""
    let filename = ""
    let contentType = "image/jpeg"
    let bytes: Uint8Array | null = null

    const ct = request.headers.get("content-type") || ""

    if (ct.includes("application/json")) {
      const body = await request.json().catch(() => ({})) as any
      userId = String(body.userId || "")
      filename = String(body.filename || "avatar.jpg")
      contentType = String(body.contentType || "image/jpeg")
      const base64 = String(body.base64 || "")
      if (!userId || !base64) {
        return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 })
      }
      const buf = Buffer.from(base64, "base64")
      if (buf.byteLength > 5 * 1024 * 1024) {
        return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 400 })
      }
      bytes = new Uint8Array(buf)
    } else {
      const form = await request.formData()
      userId = String(form.get("userId") || "")
      const file = form.get("file") as File | null
      if (!userId || !file) {
        return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 })
      }
      filename = file.name
      contentType = file.type || "image/jpeg"

      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 400 })
      }

      bytes = new Uint8Array(await file.arrayBuffer())
    }

    if (!bytes) {
      return NextResponse.json({ ok: false, error: "BAD_PAYLOAD" }, { status: 400 })
    }

    const admin = getSupabaseAdminClient()

    const ext = (filename.split(".").pop() || "jpg").toLowerCase()
    const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg"
    const filePath = `avatars/${userId}-${Date.now()}.${safeExt}`

    const { error: upErr } = await admin.storage.from("user-uploads").upload(filePath, bytes, {
      contentType,
      upsert: true,
    })
    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })
    }

    const { data: pub } = admin.storage.from("user-uploads").getPublicUrl(filePath)
    const publicUrl = pub?.publicUrl || ""
    if (!publicUrl) {
      return NextResponse.json({ ok: false, error: "NO_PUBLIC_URL" }, { status: 500 })
    }

    // Best-effort update both possible user tables.
    await admin.from("users").update({ avatar_url: publicUrl }).eq("id", userId)
    await admin.from("pi_users").update({ avatar_url: publicUrl }).eq("id", userId)

    return NextResponse.json({ ok: true, avatar_url: publicUrl })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "SERVER_ERROR" }, { status: 500 })
  }
}
