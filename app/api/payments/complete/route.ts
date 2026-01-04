import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const { paymentId, txid } = await request.json()

    console.log("[v0] payment_complete_start:", { paymentId, txid })

    if (!paymentId || !txid) {
      console.log("[v0] payment_complete_fail: missing_fields")
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get user session
    const cookieStore = await cookies()
    const userCookie = cookieStore.get("pitodo_user")

    if (!userCookie) {
      console.log("[v0] payment_complete_fail: not_authenticated")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const user = JSON.parse(userCookie.value)

    // In production: Retrieve payment from database
    // Verify payment belongs to this user
    console.log("[v0] payment_verify:", { paymentId, piUid: user.pi_uid })

    // CRITICAL: Verify with Pi Platform API - NEVER trust client
    // In production: Call Pi Platform API to get payment status
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
    // if (piPayment.status !== 'completed') {
    //   console.log("[v0] payment_complete_fail: payment_not_completed_on_platform")
    //   throw new Error('Payment not completed on Pi Platform')
    // }
    //
    // if (piPayment.transaction.txid !== txid) {
    //   console.log("[v0] payment_complete_fail: txid_mismatch")
    //   throw new Error('Transaction ID mismatch')
    // }

    // In production: Query database for existing order with this paymentId
    const existingOrders = JSON.parse(
      typeof localStorage !== "undefined" ? localStorage.getItem("pitodo_orders") || "[]" : "[]",
    )
    const existingOrder = existingOrders.find((o: any) => o.paymentId === paymentId)

    if (existingOrder) {
      console.log("[v0] payment_complete_duplicate:", { paymentId, orderId: existingOrder.orderId })
      return NextResponse.json({
        success: true,
        orderId: existingOrder.orderId,
        message: "Exchange already completed",
        isDuplicate: true,
      })
    }

    // Create exchange order record (NOT "purchase")
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    const now = new Date().toISOString()

    const exchangeOrder = {
      id: orderId,
      orderId,
      paymentId,
      userId: user.id,
      piUid: user.pi_uid,
      productId: "mock_product", // In production, get from payment record
      amount: 0, // In production, get from payment record
      currency: "PI" as const,
      status: "completed" as const,
      txid,
      createdAt: now,
      completedAt: now,
    }

    // Save to database (in production)
    console.log("[v0] payment_complete_success:", { paymentId, orderId, txid })

    return NextResponse.json({
      success: true,
      orderId,
      order: exchangeOrder,
      message: "Exchange completed successfully",
    })
  } catch (error) {
    console.error("[v0] payment_complete_error:", error)
    return NextResponse.json({ error: "Failed to complete payment" }, { status: 500 })
  }
}
