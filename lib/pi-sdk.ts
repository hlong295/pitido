// lib/pi-sdk.ts
// Pi SDK helpers (UI-safe). Do NOT change auth flow elsewhere.

export type PiAuthResult = {
  accessToken: string
  user?: {
    uid?: string
    username?: string
    roles?: string[]
  }
}

type AnyObj = Record<string, any>

function getWindow(): any {
  if (typeof window === "undefined") return null
  return window as any
}

export function getPi(): any | null {
  const w = getWindow()
  return w?.Pi ?? null
}

export function isPiSdkPresent(): boolean {
  return !!getPi()
}

/**
 * Backward-compatible helper:
 * Some files expect `isPiBrowser()` from "@/lib/pi-sdk".
 * We treat "Pi Browser" as "Pi SDK injected".
 */
export function isPiBrowser(): boolean {
  return isPiSdkPresent()
}

// --- internal init guard (avoid re-init spam) ---
let _piInitDone = false

// Pi Browser may inject window.Pi a bit later.
// We poll for a short time to avoid false "Missing".
async function waitForPiInjected(timeoutMs = 3500, intervalMs = 120): Promise<any | null> {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const Pi = getPi()
    if (Pi) return Pi
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return null
}

export async function ensurePiSdkReady(): Promise<
  | { ok: true }
  | {
      ok: false
      error: "PI_SDK_MISSING" | "PI_SDK_INIT_FAILED"
      details?: any
    }
> {
  // wait a bit for injection
  const Pi = (getPi() ?? (await waitForPiInjected())) as any
  if (!Pi) return { ok: false, error: "PI_SDK_MISSING" }

  try {
    if (!_piInitDone && typeof Pi.init === "function") {
      // NOTE: sandbox/mainnet depends on your Pi app configuration.
      // Keep sandbox false unless you intentionally test sandbox-only payments.
      Pi.init({ version: "2.0", sandbox: false })
      _piInitDone = true
    }
  } catch (e) {
    return { ok: false, error: "PI_SDK_INIT_FAILED", details: e }
  }

  return { ok: true }
}

/**
 * Backward-compatible export (some components/pages import this).
 * Returns boolean for simple UI checks.
 */
export async function initPiSdk(): Promise<boolean> {
  const r = await ensurePiSdkReady()
  return r.ok
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage))
    }, timeoutMs)

    promise
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

export async function signInWithPi(scopes: string[] = ["username"]): Promise<PiAuthResult> {
  const ready = await ensurePiSdkReady()
  if (!ready.ok) throw new Error(ready.error)

  const Pi = getPi()
  if (!Pi?.authenticate) throw new Error("PI_AUTH_NOT_AVAILABLE")

  try {
    // Wrap authenticate call with a 30-second timeout (instead of waiting 120s)
    const authPromise = Pi.authenticate(scopes, (payment: AnyObj) => {
      console.log("[pi-sdk] onIncompletePaymentFound:", payment)
    })

    const res = await withTimeout(
      authPromise,
      30000, // 30 second timeout
      "PI_AUTH_TIMEOUT",
    )

    if (!res?.accessToken) throw new Error("PI_AUTH_NO_TOKEN")
    return res as PiAuthResult
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (msg.toLowerCase().includes("cancel")) {
      throw new Error("PI_SDK_AUTH_CANCELLED")
    }
    if (msg.includes("PI_AUTH_TIMEOUT")) {
      throw new Error("PI_AUTH_TIMEOUT")
    }
    throw e
  }
}

export type PiPaymentData = {
  amount: number
  memo: string
  metadata?: AnyObj
}

export type PiPaymentCallbacks = {
  onReadyForServerApproval: (paymentId: string) => Promise<void> | void
  onReadyForServerCompletion: (paymentId: string, txid: string) => Promise<void> | void
  onCancel: (paymentId: string) => void
  onError: (error: Error, payment?: AnyObj) => void
}

export async function createPiPayment(paymentData: PiPaymentData, callbacks: PiPaymentCallbacks): Promise<any> {
  const ready = await ensurePiSdkReady()
  if (!ready.ok) throw new Error(ready.error || "PI_SDK_NOT_READY")

  const Pi = getPi()
  if (!Pi?.createPayment) throw new Error("PI_PAYMENT_NOT_AVAILABLE")

  // Wrap createPayment with timeout handling via callbacks
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("PI_PAYMENT_TIMEOUT"))
    }, 60000) // 60 second timeout for payments

    const wrappedCallbacks: PiPaymentCallbacks = {
      onReadyForServerApproval: async (paymentId) => {
        clearTimeout(timeoutId)
        try {
          await callbacks.onReadyForServerApproval(paymentId)
        } catch (e) {
          reject(e)
        }
      },
      onReadyForServerCompletion: async (paymentId, txid) => {
        clearTimeout(timeoutId)
        try {
          await callbacks.onReadyForServerCompletion(paymentId, txid)
          resolve({ paymentId, txid })
        } catch (e) {
          reject(e)
        }
      },
      onCancel: (paymentId) => {
        clearTimeout(timeoutId)
        callbacks.onCancel(paymentId)
        reject(new Error("PI_PAYMENT_CANCELLED"))
      },
      onError: (error, payment) => {
        clearTimeout(timeoutId)
        callbacks.onError(error, payment)
        reject(error)
      },
    }

    try {
      Pi.createPayment(paymentData, wrappedCallbacks)
    } catch (e) {
      clearTimeout(timeoutId)
      reject(e)
    }
  })
}

export function getPiSdkErrorKey(
  err: any,
):
  | "PI_SDK_MISSING"
  | "PI_SDK_INIT_FAILED"
  | "PI_SDK_AUTH_CANCELLED"
  | "PI_AUTH_TIMEOUT"
  | "PI_PAYMENT_TIMEOUT"
  | "UNKNOWN" {
  const msg = String(err?.message || err || "").toUpperCase()
  if (msg.includes("PI_SDK_MISSING")) return "PI_SDK_MISSING"
  if (msg.includes("PI_SDK_INIT_FAILED")) return "PI_SDK_INIT_FAILED"
  if (msg.includes("PI_SDK_AUTH_CANCELLED") || msg.includes("CANCEL")) return "PI_SDK_AUTH_CANCELLED"
  if (msg.includes("PI_AUTH_TIMEOUT")) return "PI_AUTH_TIMEOUT"
  if (msg.includes("PI_PAYMENT_TIMEOUT")) return "PI_PAYMENT_TIMEOUT"
  return "UNKNOWN"
}
