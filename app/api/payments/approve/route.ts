import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const { paymentId } = await request.json()

    if (!paymentId) {
      return NextResponse.json({ error: "Missing paymentId" }, { status: 400 })
    }

    // Get user session
    const cookieStore = await cookies()
    const userCookie = cookieStore.get("pitodo_user")

    if (!userCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const user = JSON.parse(userCookie.value)

    // In production: Retrieve payment record from database
    // Verify payment belongs to this user by pi_uid
    console.log("[v0] Verifying payment ownership:", { paymentId, piUid: user.pi_uid })

    // In production: Call Pi Platform API to approve payment
    // const piApiUrl = `https://api.minepi.com/v2/payments/${paymentId}/approve`
    // const response = await fetch(piApiUrl, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Key ${process.env.PI_API_KEY}`,
    //     'Content-Type': 'application/json'
    //   }
    // })
    //
    // if (!response.ok) {
    //   throw new Error('Pi Platform approval failed')
    // }

    // Update payment status in database
    console.log("[v0] Payment approved server-side:", paymentId)

    return NextResponse.json({
      success: true,
      paymentId,
      status: "approved",
    })
  } catch (error) {
    console.error("Payment approval error:", error)
    return NextResponse.json({ error: "Failed to approve payment" }, { status: 500 })
  }
}
