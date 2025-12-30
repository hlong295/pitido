import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import { Geist_Mono } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import { LanguageProvider } from "@/lib/language-context"
import { AuthProvider } from "@/lib/auth-context"
import PiDebugOverlay from "@/components/pi-debug-overlay"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "PITODO - Nền tảng trao đổi Pi",
  description: "PITODO - Nền tảng trao đổi Pi minh bạch và an toàn",
  generator: "v0.app",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#9333ea",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} bg-background`}>
      <head />
      <body className="font-sans bg-background">
        {/* Pi SDK (required for Pi Browser auth & payments) */}
        <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="afterInteractive" />
        <LanguageProvider>
          <AuthProvider>
            {children}
            <PiDebugOverlay />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
