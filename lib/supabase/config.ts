// Centralized Supabase configuration.
//
// IMPORTANT: In Pi App hosting environments, environment variables are not always
// reliably injected at runtime. We keep a safe hardcoded fallback to prevent
// "Invalid API key" (401) issues.

// IMPORTANT:
// - PITODO deploy environments (Pi hosting / Pi Browser) may inject placeholder or stale env vars.
// - If an invalid key/url is used, Supabase returns 401 "Invalid API key" and the app will keep loading.
// - "Looks valid" is NOT enough; a stale/other-project key can still pass naive validation.
//
// To keep behavior stable, we default to the known-good hard-coded values.
// Env overrides are ONLY allowed when explicitly enabled via:
//   NEXT_PUBLIC_USE_ENV_SUPABASE=1

// IMPORTANT: These must match your Supabase project.
const HARDCODED_SUPABASE_URL = "https://wlewqkcbwbvbbwjfpbck.supabase.co"
const HARDCODED_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZXdxa2Nid2J2YmJ3amZwYmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNjYwODIsImV4cCI6MjA4MDY0MjA4Mn0.gkBIpcBRFn3wzg0koL_m-N2gZyJ76RcbrreghQml-yQ"

function isValidSupabaseUrl(v?: string) {
	if (!v) return false
	if (!/^https?:\/\//i.test(v)) return false
	return v.includes(".supabase.co")
}

function isValidAnonKey(v?: string) {
	// Supabase anon JWT typically starts with eyJ and is fairly long
	if (!v) return false
	if (!v.startsWith("eyJ")) return false
	return v.length > 100
}

const USE_ENV = process.env.NEXT_PUBLIC_USE_ENV_SUPABASE === "1"

export const SUPABASE_URL =
	USE_ENV && isValidSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
		? (process.env.NEXT_PUBLIC_SUPABASE_URL as string)
		: HARDCODED_SUPABASE_URL

export const SUPABASE_ANON_KEY =
	USE_ENV && isValidAnonKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
		? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string)
		: HARDCODED_SUPABASE_ANON_KEY

// Try to decode the Supabase project ref from the anon JWT payload.
// This is used ONLY for debugging (safe to show; does not reveal the secret).
export function getSupabaseProjectRefFromAnonKey(key?: string): string {
	try {
		if (!key) return ""
		const parts = key.split(".")
		if (parts.length < 2) return ""
		const b64 = parts[1]
		// add padding
		const padded = b64 + "===".slice((b64.length + 3) % 4)
		// Decode base64url in both browser and node.
		const base64 = padded.replace(/-/g, "+").replace(/_/g, "/")
		let json = ""
		if (typeof window !== "undefined" && typeof window.atob === "function") {
			json = decodeURIComponent(
				Array.prototype.map
					.call(window.atob(base64), (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
					.join("")
			)
		} else {
			// Node.js / server runtime
			json = Buffer.from(base64, "base64").toString("utf8")
		}
		const payload = JSON.parse(json)
		return typeof payload?.ref === "string" ? payload.ref : ""
	} catch {
		return ""
	}
}

export const SUPABASE_PROJECT_REF = getSupabaseProjectRefFromAnonKey(SUPABASE_ANON_KEY)
