"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeftRight, Eye, Shield, Sliders } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

export function Features() {
  const { t } = useLanguage()

  const features = [
    {
      icon: ArrowLeftRight,
      titleKey: "feature1Title" as const,
      descKey: "feature1Desc" as const,
    },
    {
      icon: Eye,
      titleKey: "feature2Title" as const,
      descKey: "feature2Desc" as const,
    },
    {
      icon: Shield,
      titleKey: "feature3Title" as const,
      descKey: "feature3Desc" as const,
    },
    {
      icon: Sliders,
      titleKey: "feature4Title" as const,
      descKey: "feature4Desc" as const,
    },
  ]

  return (
    <section className="container px-4 py-12">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-3 text-balance">{t("featuresTitle")}</h2>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {features.map((feature, index) => (
          <Card key={index} className="border-border">
            <CardContent className="p-6">
              <div className="flex flex-col space-y-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{t(feature.titleKey)}</h3>
                <p className="text-muted-foreground leading-relaxed">{t(feature.descKey)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
