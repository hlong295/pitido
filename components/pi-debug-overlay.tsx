"use client"

import { useEffect, useMemo, useState } from "react"

type LogEntry = {
  t: number
  msg: string
  data?: any
}

declare global {
  interface Window {
    __PITODO_DBG?: LogEntry[]
  }
}

function isDbgEnabled(): boolean {
  try {
    if (typeof window === "undefined") return false
    const sp = new URLSearchParams(window.location.search)
    if (sp.get("dbg") === "1") return true
    if (localStorage.getItem("pitodo_dbg") === "1") return true
    return false
  } catch {
    return false
  }
}

export default function PiDebugOverlay() {
  const [enabled, setEnabled] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    // Determine debug mode once on mount.
    // Important for performance: do NOT keep a polling interval running when debug is off.
    const on = isDbgEnabled()
    setEnabled(on)

    if (!on) return

    const id = setInterval(() => setTick((x) => x + 1), 400)
    return () => clearInterval(id)
  }, [])

  const logs = useMemo(() => {
    if (typeof window === "undefined") return [] as LogEntry[]
    return (window.__PITODO_DBG || []).slice(-30)
  }, [tick])

  if (!enabled) return null

  return (
    <div
      className="fixed bottom-2 left-2 right-2 z-[9999] rounded-xl border border-black/10 bg-white/90 p-3 text-[12px] shadow-lg backdrop-blur"
      style={{ maxHeight: "38vh", overflow: "auto" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold text-[#8a348e]">PITODO DBG</div>
        <button
          className="rounded-lg bg-black/80 px-3 py-1 text-white"
          onClick={() => {
            try {
              localStorage.setItem("pitodo_dbg", "1")
              setEnabled(true)
            } catch {}
          }}
        >
          Keep ON
        </button>
      </div>

      <div className="space-y-1">
        {logs.length === 0 ? (
          <div className="text-gray-600">(no logs yet)</div>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="rounded-lg bg-black/5 px-2 py-1">
              <div className="text-gray-800">
                <span className="mr-2 text-gray-500">
                  {new Date(l.t).toLocaleTimeString()}
                </span>
                {l.msg}
              </div>
              {typeof l.data !== "undefined" ? (
                <pre className="mt-1 whitespace-pre-wrap break-words text-gray-600">
                  {safeStringify(l.data)}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function safeStringify(x: any) {
  try {
    return JSON.stringify(x, null, 2)
  } catch {
    try {
      return String(x)
    } catch {
      return "(unserializable)"
    }
  }
}
