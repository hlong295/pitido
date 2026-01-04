import { Suspense } from "react";
import LoginClient from "./LoginClient";

// Next.js requires useSearchParams() to be used within a Suspense boundary.
// We keep the existing UI by rendering the original client component inside Suspense.

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
