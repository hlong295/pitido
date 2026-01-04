import { NextResponse } from "next/server"
import { getOrCreatePlatformWallets } from "@/lib/system-wallets"

export async function GET() {
  try {
    const wallets = await getOrCreatePlatformWallets()
    return NextResponse.json({ success: true, wallets })
  } catch (error: any) {
    console.error("[wallets/public] error:", error)
    return NextResponse.json({ success: false, message: error?.message || "Failed" }, { status: 500 })
  }
}
