"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

export function Hero() {
  const { t } = useLanguage()

  return (
    <section className="container px-4 pt-8 pb-12">
      <div className="flex flex-col items-center text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          {t("heroSubtitle")}
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-balance">{t("heroTitle")}</h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl text-pretty leading-relaxed">
          {t("heroDescription")}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button size="lg" className="text-base font-semibold h-12 px-8">
            {t("startExchange")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="text-base font-semibold h-12 px-8 bg-transparent">
            {t("browseOffers")}
          </Button>
        </div>
      </div>
    </section>
  )
}
