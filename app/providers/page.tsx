"use client"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Star, MapPin, TrendingUp, Shield, Award } from "lucide-react"
import { useState } from "react"
import type { Provider, TrustLevel } from "@/lib/types"
import Link from "next/link"

export default function ProvidersPage() {
  const { t } = useLanguage()
  const [sortBy, setSortBy] = useState<"trust" | "rating" | "activity">("trust")

  // Mock providers data
  const providers: Provider[] = [
    {
      id: "1",
      userId: "user-1",
      businessName: "Tech Store Vietnam",
      contactPerson: "Nguyen Van A",
      email: "contact@techstore.vn",
      phone: "+84901234567",
      address: "123 Le Loi, District 1, HCMC",
      description: "Official electronics retailer",
      piWallet: "PI_WALLET_TECH_001",
      pitdWallet: "PITD_WALLET_TECH_001",
      trustLevel: "admin-verified",
      rating: 4.8,
      totalExchanges: 1250,
      isApproved: true,
      isActive: true,
      location: "Ho Chi Minh City",
      createdAt: new Date("2024-01-15"),
      approvedBy: "HLong295",
      approvedAt: new Date("2024-01-16"),
    },
    {
      id: "2",
      userId: "user-2",
      businessName: "Fashion Hub",
      contactPerson: "Tran Thi B",
      email: "info@fashionhub.vn",
      phone: "+84912345678",
      address: "456 Nguyen Hue, District 1, HCMC",
      description: "Trendy fashion and accessories",
      piWallet: "PI_WALLET_FASHION_001",
      pitdWallet: "PITD_WALLET_FASHION_001",
      trustLevel: "user-rated",
      rating: 4.5,
      totalExchanges: 850,
      isApproved: true,
      isActive: true,
      location: "Ho Chi Minh City",
      createdAt: new Date("2024-02-01"),
    },
    {
      id: "3",
      userId: "user-3",
      businessName: "Fresh Food Market",
      contactPerson: "Le Van C",
      email: "contact@freshfood.vn",
      phone: "+84923456789",
      address: "789 Hai Ba Trung, Hanoi",
      description: "Fresh groceries and food delivery",
      piWallet: "PI_WALLET_FOOD_001",
      pitdWallet: "PITD_WALLET_FOOD_001",
      trustLevel: "admin-verified",
      rating: 4.9,
      totalExchanges: 2100,
      isApproved: true,
      isActive: true,
      location: "Hanoi",
      createdAt: new Date("2024-01-10"),
      approvedBy: "HLong295",
      approvedAt: new Date("2024-01-11"),
    },
    {
      id: "4",
      userId: "user-4",
      businessName: "Quick Services",
      contactPerson: "Pham Thi D",
      email: "support@quickservices.vn",
      phone: "+84934567890",
      address: "321 Tran Hung Dao, Da Nang",
      description: "Digital services and subscriptions",
      piWallet: "PI_WALLET_SERVICE_001",
      trustLevel: "unverified",
      rating: 4.2,
      totalExchanges: 320,
      isApproved: true,
      isActive: true,
      location: "Da Nang",
      createdAt: new Date("2024-03-01"),
    },
  ]

  const getTrustLevelBadge = (level: TrustLevel) => {
    switch (level) {
      case "admin-verified":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <Shield className="mr-1 h-3 w-3" />
            {t("adminVerified")}
          </Badge>
        )
      case "user-rated":
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600">
            <Award className="mr-1 h-3 w-3" />
            {t("userRated")}
          </Badge>
        )
      case "unverified":
        return <Badge variant="outline">{t("unverified")}</Badge>
    }
  }

  const sortedProviders = [...providers].sort((a, b) => {
    if (sortBy === "trust") {
      const trustOrder = { "admin-verified": 0, "user-rated": 1, unverified: 2 }
      return trustOrder[a.trustLevel] - trustOrder[b.trustLevel]
    } else if (sortBy === "rating") {
      return b.rating - a.rating
    } else {
      return b.totalExchanges - a.totalExchanges
    }
  })

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main className="container px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">{t("providerListing")}</h1>
          <Link href="/provider/apply">
            <Button size="sm">{t("becomeProvider")}</Button>
          </Link>
        </div>

        <div className="flex gap-2 mb-6">
          <span className="text-sm text-muted-foreground self-center">{t("sortBy")}:</span>
          <Button variant={sortBy === "trust" ? "default" : "outline"} size="sm" onClick={() => setSortBy("trust")}>
            {t("sortByTrust")}
          </Button>
          <Button variant={sortBy === "rating" ? "default" : "outline"} size="sm" onClick={() => setSortBy("rating")}>
            {t("sortByRating")}
          </Button>
          <Button
            variant={sortBy === "activity" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("activity")}
          >
            {t("sortByActivity")}
          </Button>
        </div>

        <div className="grid gap-4">
          {sortedProviders.map((provider) => (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl mb-2">{provider.businessName}</CardTitle>
                    {getTrustLevelBadge(provider.trustLevel)}
                  </div>
                  <Link href={`/providers/${provider.id}`}>
                    <Button size="sm" variant="outline">
                      {t("viewProfile")}
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{provider.description}</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <div>
                      <div className="text-sm font-semibold">{provider.rating.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">{t("rating")}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-sm font-semibold">{provider.totalExchanges.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{t("exchanges")}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-semibold">{provider.location}</div>
                      <div className="text-xs text-muted-foreground">{t("location")}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
