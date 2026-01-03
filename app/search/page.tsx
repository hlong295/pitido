"use client"

import dynamic from "next/dynamic"

// NOTE:
// This wrapper avoids prerender/client-manifest issues on Vercel by loading the
// Search UI as a client-only component. UI/behavior remains unchanged.
const SearchClient = dynamic(() => import("./SearchClient"), { ssr: false })

export default function Page() {
  return <SearchClient />
}
