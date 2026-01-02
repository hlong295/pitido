import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const { productId, amountPi, memo, metadata } = await request.json()

    console.log("[v0] payment_create_start:", { productId, amountPi })

    // Validate inputs
    if (!productId || !amountPi || !memo) {
      console.log("[v0] payment_create_fail: missing_fields")
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get user session from cookie
    const cookieStore = await cookies()
    const userCookie = cookieStore.get("pitodo_user")

    if (!userCookie) {
      console.log("[v0] payment_create_fail: not_authenticated")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const user = JSON.parse(userCookie.value)

    // Require Pi user with uid
    if (!user.pi_uid) {
      console.log("[v0] payment_create_fail: pi_login_required")
      return NextResponse.json({ error: "Pi login required for Pi payments" }, { status: 403 })
    }

    // Generate unique payment ID
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`

    // Create payment record in mock database (in production, use real database)
    const paymentRecord = {
      id: paymentId,
      paymentId,
      userId: user.id,
      piUid: user.pi_uid,
      productId,
      amount: amountPi,
      memo,
      metadata,
      status: "created" as const,
      createdAt: new Date().toISOString(),
    }

    // Store in mock database
    console.log("[v0] payment_create_success:", { paymentId, piUid: user.pi_uid })

    // Return payment parameters for Pi.createPayment()
    return NextResponse.json({
      success: true,
      paymentId,
      payment: {
        amount: amountPi,
        memo,
        metadata: {
          ...metadata,
          paymentId,
          productId,
          userId: user.id,
          piUid: user.pi_uid,
        },
      },
    })
  } catch (error) {
    console.error("[v0] payment_create_error:", error)
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 })
  }
}
