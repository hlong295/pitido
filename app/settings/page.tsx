import { Suspense } from "react"
import SettingsClient from "./SettingsClient"

// Next.js requires useSearchParams() to be wrapped in a Suspense boundary.
// We keep the existing Settings UI in a client component and render it here.

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsClient />
    </Suspense>
  )
}
