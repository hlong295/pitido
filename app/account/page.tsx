"use client"

import * as React from "react"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { initPiSdk } from "@/lib/pi-sdk"
import { createBrowserClient } from "@/lib/supabase/client"
import { SUPABASE_PROJECT_REF, SUPABASE_URL } from "@/lib/supabase/config"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useAuth } from "@/lib/auth-context"
import { PitdTransferModal } from "@/components/pitd-transfer-modal"
import {
  Shield,
  Package,
  Users,
  Store,
  Settings,
  HelpCircle,
  Info,
  LogOut,
  Plus,
  ChevronRight,
  Loader2,
  Coins,
  Wallet,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  X,
  Heart,
  ShoppingBag,
  Send,
  AlertTriangle,
} from "lucide-react"

const ROOT_ADMIN_USERNAME = "HLong295"
const STORAGE_KEYS = ["pitodo_pi_user", "pi_user", "current_user"]

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  )
}

type Transaction = {
  id: string
  wallet_id: string
  user_id: string
  amount: number
  transaction_type: string
  description: string
  status: string
  created_at: string
  balance_after?: number
  metadata?: any
}

type WalletData = {
  id: string
  user_id: string
  balance: number
  address: string
  // Tổng số dư hiển thị (tính tại client = balance + locked_balance)
  total_balance?: number
  // Current DB schema: includes locked_balance (numeric) and total_spent (numeric).
  // Some older builds had extra columns; keep optionals so UI code stays stable.
  locked_balance?: number
  // total_earned is NOT a DB column in current schema; we compute it on the client for display.
  total_earned?: number
  total_spent: number
  created_at: string
}

type Purchase = {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  total_price: number
  payment_method: string
  status: string
  created_at: string
  product?: {
    id: string
    name: string
    image_url?: string
    media?: any[]
    price: number
  }
}

type Favorite = {
  id: string
  product_id: string
  created_at: string
  product?: {
    id: string
    name: string
    image_url?: string
    media?: any[]
    price: number
  }
}

export default function AccountPage() {
  const { user, isLoading: authLoading, logout } = useAuth()

  // DEBUG (Pi Browser has no console): show diagnostics only for root admin (hidden for everyone else)
  const debugEnabled = (() => {
    if (!user) return false
    const role = String((user as any).role || '').toLowerCase()
    const username = String((user as any).username || '').toLowerCase()
    const piUsername = String((user as any).pi_username || '').toLowerCase()
    // root admin visible only
    return (
      role === 'root_admin' ||
      role === 'root' ||
      username === ROOT_ADMIN_USERNAME.toLowerCase() ||
      piUsername === ROOT_ADMIN_USERNAME.toLowerCase() ||
      username === 'hlong295' ||
      piUsername === 'hlong295'
    )
  })()
  const [debugAuth, setDebugAuth] = React.useState<any>(null)
  const [debugEnsure, setDebugEnsure] = React.useState<any>(null)
  const [debugLoading, setDebugLoading] = React.useState(false)

  React.useEffect(() => {
    if (!debugEnabled) return
    ;(async () => {
      try {
        const supabase = createBrowserClient()
        const { data: sessionData } = await supabase.auth.getSession()
        const { data: userData } = await supabase.auth.getUser()
        setDebugAuth({
          appUser: user
            ? {
                type: (user as any).type,
                role: (user as any).role || null,
                username: (user as any).username || (user as any).pi_username || null,
                uid: (user as any).uid || null,
                piUserId: (user as any).piUserId || (user as any).piUserIdCookie || null,
                email: (user as any).email || null,
              }
            : null,
          cookies: (() => {
            try {
              const m = document.cookie.match(/(?:^|; )pi_user_id=([^;]+)/)
              return { pi_user_id: m ? decodeURIComponent(m[1]) : null }
            } catch {
              return { pi_user_id: null }
            }
          })(),
          session: sessionData?.session
            ? { userId: sessionData.session.user.id, email: sessionData.session.user.email }
            : null,
          authUser: userData?.user
            ? {
                id: userData.user.id,
                email: userData.user.email,
                email_confirmed_at: (userData.user as any).email_confirmed_at,
              }
            : null,
        })
      } catch (e: any) {
        setDebugAuth({ error: e?.message || String(e) })
      }
      try {
        setDebugEnsure((window as any).__pitodoEnsureUserLast || null)
      } catch {}
    })()
  }, [debugEnabled])

  // Auto-run once for root admin so Pi Browser can capture without needing ?debug=1
  React.useEffect(() => {
    if (!debugEnabled) return
    // avoid spamming
    if ((window as any).__pitodoEnsureUserAutoRan) return
    ;(window as any).__pitodoEnsureUserAutoRan = true
    runEnsureUserDebug()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugEnabled])

  const runEnsureUserDebug = async () => {
    if (!debugEnabled) return
    setDebugLoading(true)
    try {
      const authUser = (debugAuth as any)?.authUser
      const piUserIdFromCookie = (() => {
        try {
          const m = document.cookie.match(/(?:^|; )pi_user_id=([^;]+)/)
          return m ? decodeURIComponent(m[1]) : null
        } catch {
          return null
        }
      })()
      const payload = authUser
        ? { userId: authUser.id, email: authUser.email, metadata: { email_confirmed_at: (authUser as any).email_confirmed_at } }
        : user
          ? {
              // For Pi login we do not have Supabase auth user; use our internal UUID (Pi user uid).
              // Prefer internal UUID in public.pi_users (piUserId) if available; uid is Pi Network string.
              userId: (user as any).piUserId || piUserIdFromCookie || (user as any).id || (user as any).uid,
              email: (user as any).email || null,
              metadata: {
                from_pi: true,
                email_confirmed_at: (user as any)?.email_confirmed_at,
                username: (user as any)?.pi_username || (user as any)?.username || null,
              },
            }
          : null

      if (!payload?.userId) {
        setDebugEnsure({ at: new Date().toISOString(), ok: false, error: 'No auth userId available (no Supabase session?)' })
        return
      }

      const res = await fetch('/api/auth/ensure-user?debug=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      const pack = { at: new Date().toISOString(), ok: res.ok, status: res.status, data }
      ;(window as any).__pitodoEnsureUserLast = pack
      setDebugEnsure(pack)
    } catch (e: any) {
      setDebugEnsure({ at: new Date().toISOString(), ok: false, error: e?.message || String(e) })
    } finally {
      setDebugLoading(false)
    }
  }
  const [isLoading, setIsLoading] = useState(true)
  const [piUsername, setPiUsername] = useState<string | null>(null)
  const [isRootAdmin, setIsRootAdmin] = useState(false)
  const [userRole, setUserRole] = useState("redeemer")
  const [pitdBalance, setPitdBalance] = useState<number>(0)
  const [loadingWallet, setLoadingWallet] = useState(false)
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [walletErrStack, setWalletErrStack] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionsIn, setTransactionsIn] = useState<Transaction[]>([])
  const [transactionsOut, setTransactionsOut] = useState<Transaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [transactionsError, setTransactionsError] = useState<string | null>(null)
  const [showTransactionHistory, setShowTransactionHistory] = useState(false)
  const [txTab, setTxTab] = useState<"in" | "out">("in")
  const [txShowAll, setTxShowAll] = useState(false)
  const [txAllDirection, setTxAllDirection] = useState<"all" | "in" | "out">("all")
  const [txFrom, setTxFrom] = useState("")
  const [txTo, setTxTo] = useState("")
  const [copied, setCopied] = useState(false)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [showPurchases, setShowPurchases] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [loadingPurchases, setLoadingPurchases] = useState(false)
  const [loadingFavorites, setLoadingFavorites] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)

  // Debug overlay for Pi Browser (no console). Enabled only when ?dbg=1 or localStorage.pitodo_debug=1
  const [dbgEnabled, setDbgEnabled] = useState(false)
  const [dbgLines, setDbgLines] = useState<string[]>([])
  const dbgPush = (line: string) => {
    try {
      if (!dbgEnabled) return
      setDbgLines((prev) => {
        const next = [...prev, `${new Date().toISOString()} | ${line}`]
        // keep last 60 lines
        return next.length > 60 ? next.slice(next.length - 60) : next
      })
    } catch {
      // ignore
    }
  }

  // Backward-compatible helpers (avoid ReferenceError in some builds)
  const dbgAdd = (tag: string, data?: any) => {
    try {
      const payload = data !== undefined ? ` ${JSON.stringify(data)}` : ""
      dbgPush(`${tag}${payload}`)
    } catch {
      dbgPush(`${tag}`)
    }
  }
  const addDebugLog = (line: string) => dbgPush(line)

  // Tránh gọi loadWallet lặp / chạy song song (gây 429 và treo spinner)
  const lastLoadedWalletUserIdRef = useRef<string | null>(null)
  const loadWalletInFlightRef = useRef(false)

  useEffect(() => {
    try {
      initPiSdk()
    } catch (err) {
      console.error("[v0] AccountPage: Failed to init Pi SDK:", err)
    }
  }, [])

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const enabled = sp.get("dbg") === "1" || localStorage.getItem("pitodo_debug") === "1"
      setDbgEnabled(enabled)
      if (enabled) {
        setDbgLines([`${new Date().toISOString()} | DBG enabled`])
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    console.log("[v0] AccountPage: user =", user ? user.username : "null", "authLoading =", authLoading)
  }, [user, authLoading])

  useEffect(() => {
    const initializeAccount = async () => {
      try {
        console.log("[v0] AccountPage: initializeAccount starting...")

        if (authLoading) {
          console.log("[v0] AccountPage: Still loading auth, waiting...")
          return
        }

        let foundUsername: string | null = null
        let foundRole = "redeemer"
        let foundUserId: string | null = null

        if (user) {
          console.log("[v0] AccountPage: Using user from auth context:", user.username)
          foundUsername = user.username
          foundRole = user.role || "redeemer"
          // ✅ IMPORTANT: only use localStorage pi_user_id for Pi users.
          // For email users, using a stale pi_user_id will make PITD wallet look "missing".
          const storedPiUserId = (() => {
            try {
              return typeof window !== "undefined" ? localStorage.getItem("pi_user_id") : null
            } catch {
              return null
            }
          })()

          if ((user as any).type === "pi") {
            const candidate = (user as any).piUserId || storedPiUserId || user.uid
            foundUserId = isUuid(candidate) ? candidate : null
          } else {
            const candidate = user.uid
            if (isUuid(candidate)) {
              foundUserId = candidate
            } else {
              // Fallback: read session directly from Supabase client (no login flow changes)
              try {
                const sb = createBrowserClient()
                const { data } = await sb.auth.getSession()
                const sid = data.session?.user?.id
                foundUserId = isUuid(sid) ? sid : null
              } catch {
                foundUserId = null
              }
            }
          }
        } else {
          console.log("[v0] AccountPage: No auth user, checking localStorage...")

          if (typeof window !== "undefined" && window.localStorage) {
            for (const key of STORAGE_KEYS) {
              try {
                const data = localStorage.getItem(key)
                console.log("[v0] AccountPage: Checking key", key, ":", data ? "found" : "empty")

                if (data) {
                  const parsed = JSON.parse(data)
                  const username = parsed.piUsername || parsed.pi_username || parsed.username
                  const role = parsed.userRole || parsed.user_role || parsed.role || "redeemer"
                  const userId = parsed.uid || parsed.id || parsed.piUserId

                  if (username) {
                    console.log("[v0] AccountPage: Found user in localStorage:", username)
                    foundUsername = username
                    foundRole = role
                    foundUserId = userId
                    break
                  }
                }
              } catch (e) {
                console.error("[v0] AccountPage: Error parsing localStorage key", key, ":", e)
                continue
              }
            }
          } else {
            console.warn("[v0] AccountPage: localStorage not available")
          }
        }

        // Normalize/validate user id
        let normalizedUserId: string | null = isUuid(foundUserId) ? foundUserId : null
        if (!normalizedUserId) {
          // For Pi login, a stable UUID is stored in localStorage "pi_user_id".
          try {
            const storedPiUserId = localStorage.getItem("pi_user_id")
            if (isUuid(storedPiUserId)) normalizedUserId = storedPiUserId
          } catch {}
        }

        console.log("[v0] AccountPage: Final - username:", foundUsername, "role:", foundRole, "userId:", normalizedUserId)

        if (dbgEnabled) {
          const storedPiUserId = (() => {
            try {
              return typeof window !== "undefined" ? localStorage.getItem("pi_user_id") : null
            } catch {
              return null
            }
          })()
          dbgPush(
            `init | authUser=${user ? user.username : "null"} | type=${(user as any)?.type || "-"} | foundUserId=${
              foundUserId || "-"
            } | stored_pi_user_id=${storedPiUserId || "-"}`,
          )
        }

        setPiUsername(foundUsername)
        setUserRole(foundRole)
        setCurrentUserId(normalizedUserId)

        if (foundUsername && !normalizedUserId) {
          // Logged-in username but missing a stable UUID: don't call wallet API.
          // (This helps avoid confusing loops and makes debugging on Pi Browser easier.)
          setWalletError("MISSING_USER_ID")
          dbgAdd("missing_user_id", { foundUsername, foundUserId })
        }

        const isAdmin = foundUsername?.toLowerCase() === ROOT_ADMIN_USERNAME.toLowerCase()
        setIsRootAdmin(isAdmin)

        setIsLoading(false)

        if (foundUsername && normalizedUserId) {
          try {
            await loadWallet(normalizedUserId)
          } catch (walletErr) {
            console.error("[v0] AccountPage: Wallet load failed:", walletErr)
          }
        }
      } catch (error) {
        console.error("[v0] AccountPage: Critical error in initializeAccount:", error)
        setPageError("Đã xảy ra lỗi khi tải trang. Vui lòng thử lại.")
        setIsLoading(false)
      }
    }

    initializeAccount()
  }, [user, authLoading])

  const loadWallet = async (userId: any, forceRefresh: boolean = false) => {
    console.log("[v0] AccountPage.loadWallet: Starting for userId:", userId)
    if (dbgEnabled) dbgPush(`loadWallet start | userId=${userId}`)
    const CACHE_KEY = `pitd_wallet_cache:${userId}`
    // Chống gọi song song / lặp quá nhanh (tránh 429 và UI quay mãi)
    if (loadWalletInFlightRef.current) return
    if (!forceRefresh && lastLoadedWalletUserIdRef.current === userId && walletData) return
    loadWalletInFlightRef.current = true

    setLoadingWallet(true)
    setWalletError(null)

    try {
      const isRateLimitLike = (e: any) => {
        const msg = String(e?.message || e || "")
        const status = Number(e?.status || e?.code || 0)
        return status === 429 || msg.includes("Too Many") || msg.includes("429") || msg.includes("rate")
      }

      const readCache = () => {
        try {
          const raw = localStorage.getItem(CACHE_KEY)
          if (!raw) return null
          return JSON.parse(raw)
        } catch {
          return null
        }
      }

      const writeCache = (x: any) => {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(x))
        } catch {}
      }

      let wallet: any = null
      let lastErr: any = null

      // IMPORTANT: Do NOT query pitd_wallets directly from the browser.
      // Pi User login may not have a Supabase auth session, and RLS can block the query.
      // Always fetch via server API (service role) to make Pi Browser + Pi User work reliably.
	      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const controller = new AbortController()
          const t = setTimeout(() => controller.abort(), 12000)
          // Prefer server-side identity (Supabase session cookie / Pi cookie).
          // Only pass userId if it is a valid UUID string (avoid "[object Object]" bugs).
          const qp: string[] = []
          if (typeof userId === "string" && isUuid(userId)) {
            qp.push(`userId=${encodeURIComponent(userId)}`)
          }
          if (dbgEnabled) qp.push("dbg=1")
          const url = `/api/pitd/wallet${qp.length ? `?${qp.join("&")}` : ""}`

	          // Build auth headers so the server can verify access even if the browser
	          // does not send cookies (some embedded/webview contexts).
	          const headers: Record<string, string> = {
	            "x-user-type": user?.type || "unknown",
	          }

	          // Only send x-user-id when it is a UUID string.
	          // (Avoid accidental "[object Object]" being sent to server and breaking uuid filters.)
	          if (typeof userId === "string" && isUuid(userId)) {
	            headers["x-user-id"] = userId
	          }

	          // If this is an email-auth user, forward the Supabase access token.
	          if (user?.type === "email") {
	            try {
	              const supabase = createBrowserClient()
	              const { data } = await supabase.auth.getSession()
	              const token = data?.session?.access_token
	              if (token) headers["authorization"] = `Bearer ${token}`
	            } catch (e) {
	              addDebugLog(`loadWallet: could not read email session token: ${String(e)}`)
	            }
	          }

          // If this is a Pi-auth user, forward the Pi auth headers expected by server routes.
          // (Pi Browser has no console, so we keep it explicit and debuggable.)
          if (user?.type === "pi") {
            try {
              const storedPiUserId = localStorage.getItem("pi_user_id") || ""
              const piUserId = (storedPiUserId || user?.id || "").trim()
              if (piUserId) headers["x-pi-user-id"] = piUserId

              // The wallet API requires both id + username.
              const storedPiUsername = localStorage.getItem("pi_username") || ""
              const piUsername = (
                (storedPiUsername || (user as any)?.piUsername || (user as any)?.username || "")
              ).trim()
              if (piUsername) headers["x-pi-username"] = piUsername
            } catch (e) {
              addDebugLog(`loadWallet: could not read Pi headers: ${String(e)}`)
            }
          }

	          const res = await fetch(url, {
	            method: "GET",
	            // Be explicit: Pi Browser mobile can be picky.
	            credentials: "include",
	            headers,
	            signal: controller.signal,
	          }).finally(() => clearTimeout(t))

          if (!res.ok) {
            const ct = res.headers.get("content-type") || ""
            let detailsText = ""
            let stackFromServer = ""
            if (ct.includes("application/json")) {
              try {
                const j = await res.json()
                detailsText = j?.details ? (typeof j.details === "string" ? j.details : JSON.stringify(j.details)) : (j?.error || "")
                stackFromServer = typeof j?.stack === "string" ? j.stack : ""
              } catch {
                detailsText = await res.text().catch(() => "")
              }
            } else {
              detailsText = await res.text().catch(() => "")
            }
            const err: any = new Error(detailsText || `HTTP_${res.status}`)
            err.status = res.status
            if (stackFromServer) err.stack = stackFromServer
            throw err
          }

          const json = await res.json().catch(async () => {
            const text = await res.text().catch(() => "")
            throw new Error(text || "WALLET_API_INVALID_JSON")
          })

	          if (json?.ok === false) {
	            const msg = json?.details || json?.error || "WALLET_API_OK_FALSE"
	            throw new Error(msg)
	          }
	          wallet = json?.wallet
          if (dbgEnabled && json?.dbg) {
            try {
              const s = JSON.stringify(json.dbg)
              dbgPush(`wallet_api_dbg | ${s.length > 800 ? s.slice(0, 800) + "..." : s}`)
            } catch {}
          }
          lastErr = null
          break
        } catch (e: any) {
          lastErr = e
          if (attempt === 0 && isRateLimitLike(e)) {
            await new Promise((r) => setTimeout(r, 700))
            continue
          }
          break
        }
      }

      console.log("[v0] AccountPage.loadWallet: Query result - wallet:", !!wallet, "error:", (lastErr as any)?.message)
      if (dbgEnabled) dbgPush(`loadWallet query | wallet=${wallet ? "yes" : "no"} | err=${String((lastErr as any)?.message || lastErr || "-")}`)

      if (lastErr) {
        // Fallback to cache so the UI still shows address when the DB call is rate-limited
        const cached = readCache()
        if (cached) {
          setWalletData(cached)
          setPitdBalance(Number(cached.balance ?? 0))
          lastLoadedWalletUserIdRef.current = userId
        }

        setWalletError(String((lastErr as any)?.message || lastErr))
        setWalletErrStack(String((lastErr as any)?.stack || ""))
        return
      }

      // The API already ensures wallet exists and has an address.

      // 3) Normalize & save (and cache)
      if (wallet) {
        const balanceNow = Number(wallet.balance ?? 0)
        const lockedNow = Number(wallet.locked_balance ?? 0)
        const totalBalanceNow = balanceNow + lockedNow
        const spentNow = Number(wallet.total_spent ?? 0)
        // DB does not have total_earned. We compute for UI only.
        const earnedNow = Number(totalBalanceNow + spentNow)

        const normalized = {
          id: wallet.id,
          user_id: wallet.user_id,
          balance: balanceNow,
          total_balance: totalBalanceNow,
          address: wallet.address || "",
          total_earned: earnedNow,
          total_spent: spentNow,
          locked_balance: lockedNow,
          created_at: wallet.created_at || new Date().toISOString(),
        }

        console.log("[v0] AccountPage.loadWallet: Success - balance:", balanceNow, "address:", wallet.address)
        setWalletData(normalized)
        setPitdBalance(balanceNow)
        setWalletErrStack(null)
        // If the caller userId is missing or stale (Pi Browser storage can be inconsistent),
        // we can safely recover it from the wallet response to unlock other PITD APIs
        // (history/transfer). This does not change any UI/layout.
        if (!currentUserId && normalized.user_id && isUuid(normalized.user_id)) {
          setCurrentUserId(normalized.user_id)
        }
        localStorage.setItem("current_user_id", userId || normalized.user_id || "")
        lastLoadedWalletUserIdRef.current = userId
        writeCache(normalized)
        if (dbgEnabled) dbgPush(`loadWallet ok | address=${normalized.address} | bal=${balanceNow} | locked=${lockedNow}`)
      }
    } catch (error) {
      console.error("[v0] AccountPage.loadWallet: Exception:", error)
      setWalletData(null)
      setWalletError("Không thể tải ví PITD.")
      setWalletErrStack(String((error as any)?.stack || ""))
      if (dbgEnabled) dbgPush(`loadWallet exception | ${String((error as any)?.message || error)}`)
    } finally {
      setLoadingWallet(false)
      loadWalletInFlightRef.current = false
    }
  }

  async function loadTransactions(opts?: {
    direction?: "in" | "out"
    limit?: number
    from?: string
    to?: string
    target?: "in" | "out" | "all"
  }) {
    if (!user) return
    try {
      setLoadingTransactions(true)
      setTransactionsError(null)

      // Normalize auth type (older code used authType, newer uses type)
      const authType = (user as any)?.type || (user as any)?.authType || "unknown"

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-pitodo-user-id": (user as any).id,
        "x-auth-type": authType,
        "x-user-type": authType,
      }

      // Send uuid user id if we have it (helps server normalize)
      if (typeof (user as any).id === "string" && isUuid((user as any).id)) {
        headers["x-user-id"] = (user as any).id
      }

      // Email login: attach Supabase JWT (server verifies)
      if (authType === "email") {
        try {
          const supabase = createBrowserClient()
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            headers["authorization"] = `Bearer ${session.access_token}`
          }
        } catch (e: any) {
          // ignore; server may still accept cookie session
          if (dbgEnabled) dbgPush(`tx: cannot read email token: ${String(e?.message || e)}`)
        }
      }

      // Pi login: forward Pi identity from storage (Pi Browser sometimes doesn't send cookies reliably)
      if (authType === "pi") {
        try {
          const piUserId = localStorage.getItem("pi_user_id") || ""
          const piUsername = localStorage.getItem("pi_username") || ""
          if (piUserId) headers["x-pi-user-id"] = piUserId
          if (piUsername) headers["x-pi-username"] = piUsername
        } catch (e: any) {
          if (dbgEnabled) dbgPush(`tx: cannot read pi storage: ${String(e?.message || e)}`)
        }
      }

      const txUrl = new URL("/api/pitd/transactions", window.location.origin)
      const limit = opts?.limit ?? 50
      txUrl.searchParams.set("limit", String(limit))
      if (opts?.direction) txUrl.searchParams.set("direction", opts.direction)
      if (opts?.from) txUrl.searchParams.set("from", opts.from)
      if (opts?.to) txUrl.searchParams.set("to", opts.to)
      if (dbgEnabled) txUrl.searchParams.set("dbg", "1")

      const res = await fetch(txUrl.toString(), {
        method: "GET",
        headers,
        credentials: "include",
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.ok) {
        const msg = payload?.error || payload?.message || `HTTP ${res.status}`
        setTransactionsError(String(msg))
        const target = opts?.target || (opts?.direction ? opts.direction : "all")
        if (target === "in") setTransactionsIn([])
        else if (target === "out") setTransactionsOut([])
        else setTransactions([])
        if (dbgEnabled && payload?.dbg) {
          try {
            dbgPush(`loadTransactions error | ${String(msg)} | dbg=${JSON.stringify(payload.dbg)}`)
          } catch {
            dbgPush(`loadTransactions error | ${String(msg)}`)
          }
        }
        return
      }

      const list = Array.isArray(payload.transactions) ? payload.transactions : []
      const mapped: Transaction[] = list.map((t: any) => ({
        id: String(t.id ?? ""),
        wallet_id: String(t.wallet_id ?? payload.wallet?.id ?? ""),
        user_id: String(payload.wallet?.user_id ?? user.id),
        transaction_type: String(t.transaction_type ?? ""),
        amount: Number(t.amount ?? 0),
        description: String(t.description ?? ""),
        status: "completed",
        created_at: String(t.created_at ?? ""),
        ...(t.balance_after !== undefined ? { balance_after: Number(t.balance_after) } : {}),
        ...(t.metadata !== undefined ? { metadata: t.metadata } : {}),
      }))

      const target = opts?.target || (opts?.direction ? opts.direction : "all")
      if (target === "in") setTransactionsIn(mapped)
      else if (target === "out") setTransactionsOut(mapped)
      else setTransactions(mapped)
    } catch (e: any) {
      setTransactionsError(String(e?.message || e))
      // clear only the requested target to avoid wiping other tabs
      const target = opts?.target || (opts?.direction ? opts.direction : "all")
      if (target === "in") setTransactionsIn([])
      else if (target === "out") setTransactionsOut([])
      else setTransactions([])
    } finally {
      setLoadingTransactions(false)
    }
  }

  async function loadTransactionTabs() {
    // Always fetch each tab separately so "20 gần nhất" stays correct
    await loadTransactions({ direction: "in", limit: 20, target: "in" })
    await loadTransactions({ direction: "out", limit: 20, target: "out" })
  }

  async function loadTransactionAllWithFilters() {
    const dir = txAllDirection === "all" ? undefined : txAllDirection
    await loadTransactions({
      direction: dir,
      limit: 200,
      from: txFrom || undefined,
      to: txTo || undefined,
      target: "all",
    })
  }

  async function loadPurchases() {
    if (!currentUserId) return
    try {
      setLoadingPurchases(true)
      const supabase = createBrowserClient()

      const { data: purchasesData } = await supabase
        .from("user_purchases")
        .select(
          `
          *,
          product:products(id, name, image_url, media, price)
        `,
        )
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })

      if (purchasesData) {
        setPurchases(purchasesData)
      }
    } catch (error) {
      console.error("[v0] Error loading purchases:", error)
    } finally {
      setLoadingPurchases(false)
    }
  }

  async function loadFavorites() {
    if (!currentUserId) return
    try {
      setLoadingFavorites(true)
      const supabase = createBrowserClient()

      const { data: favoritesData } = await supabase
        .from("user_favorites")
        .select(
          `
          *,
          product:products(id, name, image_url, media, price)
        `,
        )
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })

      if (favoritesData) {
        setFavorites(favoritesData)
      }
    } catch (error) {
      console.error("[v0] Error loading favorites:", error)
    } finally {
      setLoadingFavorites(false)
    }
  }

  async function removeFavorite(favoriteId: string) {
    try {
      const supabase = createBrowserClient()
      await supabase.from("user_favorites").delete().eq("id", favoriteId)
      setFavorites((prev) => prev.filter((f) => f.id !== favoriteId))
    } catch (error) {
      console.error("[v0] Error removing favorite:", error)
    }
  }

  const copyWalletAddress = () => {
    if (walletData?.address) {
      navigator.clipboard.writeText(walletData.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatWalletAddress = (address: string) => {
    if (!address) return "N/A"
    if (address.length <= 16) return address
    return `${address.slice(0, 8)}...${address.slice(-8)}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getTransactionIcon = (type: string, amount: number) => {
    if (amount > 0) {
      return <ArrowDownLeft className="h-4 w-4 text-green-500" />
    }
    return <ArrowUpRight className="h-4 w-4 text-red-500" />
  }

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      purchase: "Mua hàng",
      sale: "Bán hàng",
      transfer_in: "Nhận chuyển",
      transfer_out: "Chuyển đi",
      service_fee: "Phí dịch vụ",
      tax: "Thuế",
      reward: "Thưởng",
      refund: "Hoàn tiền",
      deposit: "Nạp tiền",
      withdrawal: "Rút tiền",
    }
    return labels[type] || type
  }

  const getProductImage = (product: any) => {
    if (!product) return "/diverse-products-still-life.png"
    if (product.media && Array.isArray(product.media)) {
      const imageMedia = product.media.find((m: any) => m.type === "image" && m.url && !m.url.startsWith("blob:"))
      if (imageMedia) return imageMedia.url
    }
    if (product.image_url && !product.image_url.startsWith("blob:")) return product.image_url
    return `/placeholder.svg?height=80&width=80&query=${encodeURIComponent(product.name || "product")}`
  }

  const handleLogout = () => {
    try {
      STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
      logout()
      window.location.href = "/"
    } catch (err) {
      console.error("[v0] AccountPage: Logout error:", err)
      window.location.href = "/"
    }
  }

  const loggedIn = !!piUsername
  const isProvider = userRole === "provider" || isRootAdmin

  if (pageError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
        <Header />
        <main className="container px-4 py-6 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
          <p className="text-center text-gray-700">{pageError}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-purple-600 text-white rounded-lg">
            Tải lại trang
          </button>
        </main>
        <BottomNav />

{debugEnabled ? (
  <div className="mt-4 p-3 border border-purple-300 rounded-lg bg-white">
    <div className="text-xs font-bold text-purple-900 mb-2">DEBUG (?debug=1) — Ensure User / Auth</div>
    <div className="text-xs whitespace-pre-wrap break-words">
      <div className="mb-2"><b>Auth Context user:</b> {JSON.stringify(user)}</div>
      <div className="mb-2"><b>Supabase auth/session:</b> {JSON.stringify(debugAuth)}</div>
      <div className="mb-2"><b>Last ensure-user result:</b> {JSON.stringify(debugEnsure)}</div>
    </div>
    <button
      type="button"
      onClick={runEnsureUserDebug}
      disabled={debugLoading}
      className="mt-2 px-3 py-2 rounded-md bg-purple-700 text-white text-sm disabled:opacity-60"
    >
      {debugLoading ? "Running ensure-user..." : "Run /api/auth/ensure-user (debug=1)"}
    </button>
  </div>
) : null}

      </div>
    )
  }

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
        <Header />
        <main className="container px-4 py-6 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <p className="text-sm text-gray-500">Đang tải tài khoản...</p>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
      <Header />
      <main className="container px-4 py-6 max-w-lg mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-purple-800">Tài khoản</h1>

        {/* User Card */}
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm p-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
              π
            </div>
            <div className="flex-1">
              <div className="text-lg font-semibold text-purple-800">{piUsername || "Khách"}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-600">{piUsername ? "Ví Pi" : "Chưa đăng nhập"}</span>
                {loggedIn && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      isRootAdmin
                        ? "bg-red-100 text-red-600"
                        : isProvider
                          ? "bg-purple-100 text-purple-600"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {isRootAdmin ? "ROOT ADMIN" : userRole.toUpperCase().replace("_", " ")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Pi Wallet Info */}
          {piUsername && (
            <>
              <div className="mt-4 rounded-xl bg-white/60 border border-white/60 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-purple-700">Ví Pi</span>
                </div>
                <p className="text-xs text-gray-500">
                  Ví Pi của bạn chỉ kết nối qua Pi SDK khi thanh toán. Số dư Pi không hiển thị ở đây. Khi bạn trao đổi
                  hàng hóa/dịch vụ, ứng dụng sẽ kết nối đến ví Pi của bạn để thanh toán.
                </p>
              </div>

              <div className="mt-4 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 p-4 space-y-4">
                {/* Wallet Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-pink-600" />
                    <span className="text-sm font-semibold text-pink-700">Ví PITD</span>
                  </div>
                  {loadingWallet && <Loader2 className="h-4 w-4 animate-spin text-pink-500" />}
                </div>

                {/* Wallet Address */}
                {walletData?.address && (
                  <div className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">Địa chỉ ví</p>
                      <p className="text-sm font-mono text-gray-700 truncate">
                        {formatWalletAddress(walletData.address)}
                      </p>
                    </div>
                    <button
                      onClick={copyWalletAddress}
                      className="ml-2 p-2 rounded-lg hover:bg-pink-100 transition-colors"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-pink-500" />
                      )}
                    </button>
                  </div>
                )}

                {/* Balance */}
                <div className="text-center py-3 bg-white/60 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Số dư</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-bold text-pink-700">
                      {pitdBalance.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </span>
                    <span className="text-lg text-pink-500 font-medium">PITD</span>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50/80 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-600 mb-1">Tổng nhận</p>
                    <p className="text-sm font-semibold text-green-700">
                      +{(walletData?.total_earned || 0).toLocaleString("vi-VN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-red-50/80 rounded-lg p-3 text-center">
                    <p className="text-xs text-red-600 mb-1">Tổng chi</p>
                    <p className="text-sm font-semibold text-red-700">
                      -{(walletData?.total_spent || 0).toLocaleString("vi-VN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Transaction History Button */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium text-sm hover:from-purple-600 hover:to-pink-600 transition-all"
                  >
                    <Send className="h-4 w-4" />
                    Gửi PITD
                  </button>
                  <button
                    onClick={async () => {
                      setTxShowAll(false)
                      setTxTab("in")
                      // Load 20 latest received + sent for tabs
                      await Promise.all([
                        loadTransactions({ direction: "in", limit: 20, target: "in" }),
                        loadTransactions({ direction: "out", limit: 20, target: "out" }),
                      ])
                      setShowTransactionHistory(true)
                    }}
                    className="flex items-center justify-center gap-2 py-3 bg-white border-2 border-pink-300 text-pink-600 rounded-xl font-medium text-sm hover:bg-pink-50 transition-all"
                  >
                    <History className="h-4 w-4" />
                    Lịch sử
                  </button>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  PITD (Pi Token Dao) là token nội bộ của ứng dụng. Bạn có thể sử dụng PITD để thanh toán và trao đổi
                  hàng hóa/dịch vụ trên PITODO.
                </p>

                {dbgEnabled && isRootAdmin && (
                  <div className="rounded-xl bg-white/80 border border-pink-200 p-3 text-[11px] text-gray-700">
                    <div className="mb-2">
                      <span className="font-semibold text-pink-700">DBG</span>
                      <div className="text-[10px] text-gray-500">Bật bằng cách thêm <span className="font-mono">?dbg=1</span> vào URL.</div>
                    </div>
                    <div className="space-y-1">
                      <div>
                        supabase.url: <span className="font-mono">{SUPABASE_URL}</span>
                      </div>
                      <div>
                        supabase.ref: <span className="font-mono">{SUPABASE_PROJECT_REF}</span>
                      </div>
                      <div>
                        user.type: <span className="font-mono">{(user as any)?.type || "-"}</span>
                      </div>
                      <div>
                        user.uid: <span className="font-mono">{(user as any)?.uid || "-"}</span>
                      </div>
                      <div>
                        pi_user_id(ls):{" "}
                        <span className="font-mono">
                          {(() => {
                            try {
                              return localStorage.getItem("pi_user_id") || "-"
                            } catch {
                              return "-"
                            }
                          })()}
                        </span>
                      </div>
                      <div>
                        currentUserId: <span className="font-mono">{currentUserId || "-"}</span>
                      </div>
                      <div>
                        wallet.id: <span className="font-mono">{walletData?.id || "-"}</span>
                      </div>
                      <div>
                        wallet.address: <span className="font-mono">{walletData?.address || "-"}</span>
                      </div>
                      <div>
                        walletError: <span className="font-mono">{walletError || "-"}</span>
                      </div>
                    </div>
                    <div className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono">
                      {dbgLines.length ? dbgLines.join("\n") : "(no logs)"}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {!loggedIn && (
            <Link
              href="/login"
              className="mt-4 block w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Đăng nhập
            </Link>
          )}
        </div>

        {loggedIn && (
          <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-orange-400 to-pink-500">
              <div className="flex items-center gap-2 text-white">
                <ShoppingBag className="h-5 w-5" />
                <span className="font-semibold">Quản lý đơn hàng</span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowPurchases(true)
                loadPurchases()
              }}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
            >
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-orange-500" />
                <div className="text-left">
                  <span className="font-medium text-gray-800">Sản phẩm đã mua</span>
                  <p className="text-xs text-gray-500">Xem lịch sử mua hàng của bạn</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>

            <button
              onClick={() => {
                setShowFavorites(true)
                loadFavorites()
              }}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Heart className="h-5 w-5 text-pink-500" />
                <div className="text-left">
                  <span className="font-medium text-gray-800">Sản phẩm yêu thích</span>
                  <p className="text-xs text-gray-500">Danh sách sản phẩm đã lưu</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        )}

        {/* ROOT ADMIN Menu - Always show for HLong295 */}
        {isRootAdmin && (
          <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500">
              <div className="flex items-center gap-2 text-white">
                <Shield className="h-5 w-5" />
                <span className="font-semibold">Quản trị hệ thống</span>
              </div>
            </div>

            <Link
              href="/admin"
              className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
            >
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-red-500" />
                <span className="font-medium text-gray-800">Bảng điều khiển</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </Link>

            <Link
              href="/admin/products"
              className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
            >
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-purple-600" />
                <span className="font-medium text-gray-800">Quản lý sản phẩm</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </Link>

            <Link
              href="/admin/products/add"
              className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
            >
              <div className="flex items-center gap-3">
                <Plus className="h-5 w-5 text-green-600" />
                <span className="font-medium text-gray-800">Thêm sản phẩm mới</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </Link>

            <Link
              href="/admin/pitd-management"
              className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
            >
              <div className="flex items-center gap-3">
                <Coins className="h-5 w-5 text-pink-600" />
                <span className="font-medium text-gray-800">Quản lý PITD Token</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </Link>

            <Link
              href="/admin/members"
              className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-gray-800">Quản lý thành viên</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </Link>

            <Link
              href="/admin/providers"
              className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-orange-500" />
                <span className="font-medium text-gray-800">Duyệt nhà cung cấp</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </Link>

            <Link
              href="/admin/settings"
              className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-t border-b border-gray-100"
            >
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-gray-600" />
                <span className="font-medium text-gray-800">Quản lý phí & thuế</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </Link>

            <Link
              href="/admin/settings"
              className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-gray-700" />
                <span className="font-medium text-gray-800">Chọn ví nhận PITD (phí/thuế)</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </Link>
          </div>
        )}

        {/* Provider Menu - Show for providers only (not root admin) */}
        {isProvider && !isRootAdmin && (
          <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500">
              <div className="flex items-center gap-2 text-white">
                <Store className="h-5 w-5" />
                <span className="font-semibold">Nhà cung cấp</span>
              </div>
            </div>
            <Link
              href="/provider/products"
              className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-purple-600" />
                <span className="font-medium text-gray-800">Sản phẩm của tôi</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </Link>
          </div>
        )}

        {/* General Menu */}
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm overflow-hidden">
          <Link
            href="/settings"
            className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-purple-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-800">Cài đặt</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>

          <Link
            href="/help"
            className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-purple-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-800">Trợ giúp</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>

          <Link
            href="/about"
            className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-purple-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-800">Về PITODO</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>

          {loggedIn && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-5 w-5 text-red-500" />
              <span className="font-medium text-red-500">Đăng xuất</span>
            </button>
          )}
        </div>
      </main>

      {/* Transaction History Modal */}
      {showTransactionHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 pb-20">
          <div className="w-full max-w-lg bg-white rounded-3xl max-h-[75vh] flex flex-col animate-in slide-in-from-bottom mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-pink-600" />
                <h2 className="text-lg font-semibold text-gray-800">Lịch sử giao dịch</h2>
              </div>
              <button
                onClick={() => setShowTransactionHistory(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Transaction List */}
            <div className="flex-1 overflow-y-auto p-4">
              {transactionsError && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {transactionsError}
                </div>
              )}
              {/* Tabs view (20 latest) */}
              {!txShowAll && (
                <>
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setTxTab("in")}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                        txTab === "in"
                          ? "bg-pink-600 text-white border-pink-600"
                          : "bg-white text-pink-600 border-pink-200 hover:bg-pink-50"
                      }`}
                    >
                      Nhận PITD
                    </button>
                    <button
                      onClick={() => setTxTab("out")}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                        txTab === "out"
                          ? "bg-pink-600 text-white border-pink-600"
                          : "bg-white text-pink-600 border-pink-200 hover:bg-pink-50"
                      }`}
                    >
                      Gửi PITD
                    </button>
                  </div>

                  {loadingTransactions ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    </div>
                  ) : (txTab === "in" ? transactionsIn : transactionsOut).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <History className="h-12 w-12 mb-3 text-gray-300" />
                      <p>Chưa có giao dịch nào</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(txTab === "in" ? transactionsIn : transactionsOut).map((tx) => (
                        <div key={tx.id} className="bg-gray-50 rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${tx.amount > 0 ? "bg-green-100" : "bg-red-100"}`}>
                                {getTransactionIcon(tx.transaction_type, tx.amount)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{getTransactionLabel(tx.transaction_type)}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{tx.description}</p>
                                <p className="text-xs text-gray-400 mt-1">{formatDate(tx.created_at)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                                {tx.amount > 0 ? "+" : ""}
                                {tx.amount.toLocaleString("vi-VN", { minimumFractionDigits: 2 })} PITD
                              </p>
                              {tx.balance_after !== undefined && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Số dư: {tx.balance_after.toLocaleString("vi-VN", { minimumFractionDigits: 2 })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4">
                    <button
                      onClick={async () => {
                        setTxShowAll(true)
                        setTxAllDirection("all")
                        setTxFrom("")
                        setTxTo("")
                        await loadTransactions({ limit: 200, target: "all" })
                      }}
                      className="w-full py-3 bg-white border-2 border-pink-200 text-pink-600 rounded-xl font-medium text-sm hover:bg-pink-50 transition-all"
                    >
                      Xem tất cả lịch sử giao dịch
                    </button>
                  </div>
                </>
              )}

              {/* Full history with date filters */}
              {txShowAll && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => setTxShowAll(false)}
                      className="text-sm font-medium text-pink-600 hover:text-pink-700"
                    >
                      ← Quay lại
                    </button>
                    <span className="text-xs text-gray-500">Tối đa 200 giao dịch gần nhất</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 mb-4">
                    <select
                      value={txAllDirection}
                      onChange={(e) => setTxAllDirection(e.target.value as any)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="all">Tất cả</option>
                      <option value="in">Nhận PITD</option>
                      <option value="out">Gửi PITD</option>
                    </select>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="datetime-local"
                        value={txFrom}
                        onChange={(e) => setTxFrom(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        placeholder="Từ"
                      />
                      <input
                        type="datetime-local"
                        value={txTo}
                        onChange={(e) => setTxTo(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        placeholder="Đến"
                      />
                    </div>

                    <button
                      onClick={async () => {
                        const toISO = (v: string) => {
                          if (!v) return ""
                          const d = new Date(v)
                          if (isNaN(d.getTime())) return ""
                          return d.toISOString()
                        }
                        const dir = txAllDirection === "all" ? undefined : (txAllDirection as "in" | "out")
                        await loadTransactions({
                          target: "all",
                          limit: 200,
                          direction: dir,
                          from: toISO(txFrom) || undefined,
                          to: toISO(txTo) || undefined,
                        })
                      }}
                      className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium text-sm hover:from-purple-600 hover:to-pink-600 transition-all"
                    >
                      Lọc lịch sử
                    </button>
                  </div>

                  {loadingTransactions ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <History className="h-12 w-12 mb-3 text-gray-300" />
                      <p>Chưa có giao dịch nào</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="bg-gray-50 rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${tx.amount > 0 ? "bg-green-100" : "bg-red-100"}`}>
                                {getTransactionIcon(tx.transaction_type, tx.amount)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{getTransactionLabel(tx.transaction_type)}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{tx.description}</p>
                                <p className="text-xs text-gray-400 mt-1">{formatDate(tx.created_at)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                                {tx.amount > 0 ? "+" : ""}
                                {tx.amount.toLocaleString("vi-VN", { minimumFractionDigits: 2 })} PITD
                              </p>
                              {tx.balance_after !== undefined && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Số dư: {tx.balance_after.toLocaleString("vi-VN", { minimumFractionDigits: 2 })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showPurchases && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 pb-20">
          <div className="w-full max-w-lg mx-4 bg-white rounded-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-800">Sản phẩm đã mua</h2>
              </div>
              <button
                onClick={() => setShowPurchases(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Purchases List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingPurchases ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              ) : purchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Package className="h-12 w-12 mb-3 text-gray-300" />
                  <p>Bạn chưa mua sản phẩm nào</p>
                  <Link href="/" className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium">
                    Khám phá sản phẩm
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {purchases.map((purchase) => (
                    <Link
                      key={purchase.id}
                      href={`/product/${purchase.product_id}`}
                      className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors"
                    >
                      <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                        <Image
                          src={getProductImage(purchase.product) || "/placeholder.svg"}
                          alt={purchase.product?.name || "Product"}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{purchase.product?.name || "Sản phẩm"}</p>
                        <p className="text-sm text-gray-500">Số lượng: {purchase.quantity}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm font-semibold text-pink-600">
                            {(purchase.total_price || 0).toLocaleString("vi-VN")}{" "}
                            {purchase.payment_method === "pitd" ? "PITD" : "Pi"}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              purchase.status === "completed"
                                ? "bg-green-100 text-green-600"
                                : "bg-yellow-100 text-yellow-600"
                            }`}
                          >
                            {purchase.status === "completed" ? "Hoàn thành" : purchase.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(purchase.created_at)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showFavorites && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 pb-20">
          <div className="w-full max-w-lg mx-4 bg-white rounded-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-500" />
                <h2 className="text-lg font-semibold text-gray-800">Sản phẩm yêu thích</h2>
              </div>
              <button
                onClick={() => setShowFavorites(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Favorites List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingFavorites ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              ) : favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Heart className="h-12 w-12 mb-3 text-gray-300" />
                  <p>Bạn chưa có sản phẩm yêu thích</p>
                  <Link href="/" className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium">
                    Khám phá sản phẩm
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {favorites.map((favorite) => (
                    <div key={favorite.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                      <Link href={`/product/${favorite.product_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                          <Image
                            src={getProductImage(favorite.product) || "/placeholder.svg"}
                            alt={favorite.product?.name || "Product"}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{favorite.product?.name || "Sản phẩm"}</p>
                          <p className="text-sm font-semibold text-pink-600 mt-1">
                            {(favorite.product?.price || 0).toLocaleString("vi-VN")} PITD
                          </p>
                          <p className="text-xs text-gray-400 mt-1">Đã lưu: {formatDate(favorite.created_at)}</p>
                        </div>
                      </Link>
                      <button
                        onClick={() => removeFavorite(favorite.id)}
                        className="p-2 hover:bg-red-100 rounded-full transition-colors"
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <PitdTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        currentBalance={pitdBalance}
        walletAddress={walletData?.address || ""}
        onTransferComplete={() => {
          if (currentUserId) {
            loadWallet(currentUserId, true)
          }
          loadTransactions()
        }}
      />

      <BottomNav />

      {dbgEnabled && (walletError || pageError) && (
        <div className="fixed inset-x-2 bottom-24 z-50 rounded-xl border border-amber-200 bg-amber-50/95 backdrop-blur p-3 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-amber-700">DBG snapshot (account)</div>
            <button
              className="p-1 rounded-md hover:bg-amber-100"
              onClick={() => {
                try {
                  setDbgEnabled(false)
                } catch {}
              }}
              aria-label="Close debug"
            >
              <X className="h-4 w-4 text-amber-700" />
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {walletError && <div className="text-xs text-amber-900">walletError: {walletError}</div>}
            {walletErrStack && (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-[10px] leading-snug text-amber-900 bg-white/60 rounded-lg p-2">{walletErrStack}</pre>
            )}
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-[10px] leading-snug text-gray-800 bg-white/60 rounded-lg p-2">{dbgLines.join("\n")}</pre>
          </div>
        </div>
      )}

    </div>
  )
}
