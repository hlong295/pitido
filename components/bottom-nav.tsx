"use client"

import { Home, ArrowLeftRight, History, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/language-context"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function BottomNav() {
  const { t } = useLanguage()
  const pathname = usePathname()

  const navItems = [
    { id: "home", href: "/", icon: Home, labelKey: "navHome" as const },
    { id: "exchange", href: "/exchange", icon: ArrowLeftRight, labelKey: "navExchange" as const },
    { id: "activity", href: "/activity", icon: History, labelKey: "navActivity" as const },
    { id: "profile", href: "/account", icon: User, labelKey: "navProfile" as const },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl rounded-t-3xl shadow-[0_-4px_24px_rgba(168,85,247,0.15)] border-t border-purple-100/50">
      <div className="container px-4">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.id === "profile" && pathname === "/profile")
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300",
                  isActive
                    ? "bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl mx-1 shadow-lg shadow-purple-500/40"
                    : "text-gray-400 hover:text-gray-600",
                )}
              >
                <item.icon
                  className={cn(
                    "h-6 w-6 transition-all duration-300",
                    isActive ? "stroke-[2.5] text-white" : "stroke-[2]",
                  )}
                />
                <span
                  className={cn(
                    "text-[11px] transition-all duration-300",
                    isActive ? "font-bold text-white" : "font-medium opacity-70",
                  )}
                >
                  {t(item.labelKey)}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
