import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const { paymentId } = await request.json()

    if (!paymentId) {
      return NextResponse.json({ error: "Missing paymentId" }, { status: 400 })
    }

    console.log("[v0] payment_check:", paymentId)

    // Get user session
    const cookieStore = await cookies()
    const userCookie = cookieStore.get("pitodo_user")

    if (!userCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // In production: Query payment from database
    // Verify payment status with Pi Platform API
    // const piApiUrl = `https://api.minepi.com/v2/payments/${paymentId}`
    // const response = await fetch(piApiUrl, {
    //   method: 'GET',
    //   headers: {
    //     'Authorization': `Key ${process.env.PI_API_KEY}`
    //   }
    // })
    //
    // const piPayment = await response.json()
    //
    // return NextResponse.json({
    //   status: piPayment.status,
    //   canComplete: piPayment.status === 'approved' && !existingOrder
    // })

    // Mock response
    return NextResponse.json({
      status: "approved",
      canComplete: true,
    })
  } catch (error) {
    console.error("[v0] payment_check_error:", error)
    return NextResponse.json({ error: "Failed to check payment" }, { status: 500 })
  }
}
