"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { useState } from "react"

export function Header() {
  const { language, setLanguage, t } = useLanguage()
  const { user, logout, isAdmin } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")

  const handleAuth = async () => {
    if (user) {
      logout()
      router.push("/")
    } else {
      router.push("/login")
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/exchange?search=${encodeURIComponent(searchQuery)}`)
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/20 bg-gradient-to-r from-purple-400 via-purple-300 to-pink-300 shadow-[0_4px_20px_rgba(168,85,247,0.2)]">
      <div className="container mx-auto px-3">
        <div className="flex h-11 items-center justify-between gap-3">
          {/* Left: PITODO title */}
          <button onClick={() => router.push("/")} className="flex items-center gap-1.5 flex-shrink-0">
            <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <span className="text-base font-bold text-white">π</span>
            </div>
            <span className="font-bold text-base text-white drop-shadow-sm">{t("appName")}</span>
          </button>

          {/* Center: Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-purple-500" />
              <Input
                type="search"
                placeholder={t("search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-sm rounded-full border-white/40 bg-white/60 backdrop-blur-md focus-visible:ring-white/50 focus-visible:border-white/60 shadow-sm placeholder:text-purple-400/70 text-purple-900"
              />
            </div>
          </form>

          {/* Right: Language switcher */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center border border-white/40 rounded-full overflow-hidden shadow-sm bg-white/30 backdrop-blur-md">
              <button
                onClick={() => setLanguage("vi")}
                className={`px-3 py-1 text-xs font-medium transition-all duration-300 rounded-full ${
                  language === "vi"
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                    : "hover:bg-white/20 text-white"
                }`}
              >
                VI
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={`px-3 py-1 text-xs font-medium transition-all duration-300 rounded-full ${
                  language === "en"
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                    : "hover:bg-white/20 text-white"
                }`}
              >
                EN
              </button>
            </div>

            {user && (
              <Button
                onClick={handleAuth}
                size="sm"
                variant="ghost"
                className="hidden md:flex hover:bg-white/20 text-white text-xs h-8"
              >
					{(user as any).type === "pi" || (user as any).authType === "pi"
						? user.username
						: user?.email
							? user.email.split("@")[0]
							: user.username}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile search */}
        <form onSubmit={handleSearch} className="pb-2 sm:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-purple-500" />
            <Input
              type="search"
              placeholder={t("search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm rounded-full border-white/40 bg-white/60 backdrop-blur-md focus-visible:ring-white/50 focus-visible:border-white/60 shadow-sm placeholder:text-purple-400/70 text-purple-900"
            />
          </div>
        </form>
      </div>
    </header>
  )
}
