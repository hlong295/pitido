"use client"

import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/lib/language-context"

export function HowItWorks() {
  const { t } = useLanguage()

  const steps = [
    {
      step: "01",
      titleKey: "step1Title" as const,
      descKey: "step1Desc" as const,
    },
    {
      step: "02",
      titleKey: "step2Title" as const,
      descKey: "step2Desc" as const,
    },
    {
      step: "03",
      titleKey: "step3Title" as const,
      descKey: "step3Desc" as const,
    },
  ]

  return (
    <section className="container px-4 py-12">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-3 text-balance">{t("howItWorksTitle")}</h2>
      </div>

      <div className="grid gap-4 max-w-3xl mx-auto">
        {steps.map((item, index) => (
          <Card key={index} className="border-border">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-xl font-bold text-primary-foreground">{item.step}</span>
                  </div>
                </div>
                <div className="flex flex-col justify-center space-y-1">
                  <h3 className="text-xl font-semibold">{t(item.titleKey)}</h3>
                  <p className="text-muted-foreground leading-relaxed">{t(item.descKey)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
