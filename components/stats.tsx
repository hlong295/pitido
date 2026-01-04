"use client"

import { useLanguage } from "@/lib/language-context"

export function Stats() {
  const { t } = useLanguage()

  const stats = [
    { value: "50K+", label: t("totalExchanges") },
    { value: "10K+", label: t("activeUsers") },
    { value: "500+", label: t("partners") },
    { value: "99%", label: t("successRate") },
  ]

  return (
    <section className="container px-4 py-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="flex flex-col items-center justify-center p-6 rounded-2xl bg-card border border-border"
          >
            <div className="text-3xl md:text-4xl font-bold text-primary mb-1">{stat.value}</div>
            <div className="text-sm text-muted-foreground text-center">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
