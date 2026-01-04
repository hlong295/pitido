"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Search, SlidersHorizontal, X, Zap, BadgeCheck, Coins } from "lucide-react"
import { CATEGORIES, getCategoryStars } from "@/lib/constants"
import { ProductCard } from "@/components/product-card"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { getProducts } from "@/lib/supabase/queries"

export default function SearchPage() {
  const { t } = useLanguage()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [showFlashSaleOnly, setShowFlashSaleOnly] = useState(false)
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false)
  const [currencyFilter, setCurrencyFilter] = useState<"all" | "pi" | "pitd">("all")
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const [allProducts, setAllProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true)
        const products = await getProducts({ limit: 50 })
        setAllProducts(products)
      } catch (error) {
        console.error("[v0] Error fetching products:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  const filteredProducts = allProducts.filter((product) => {
    // Search query filter
    const matchesSearch =
      searchQuery === "" ||
      product.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase())

    // Category filter
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory

    // Flash sale filter
    const matchesFlashSale =
      !showFlashSaleOnly ||
      (product.flashSaleEnabled && product.flashSaleEndDate && product.flashSaleEndDate > new Date())

    // Verified provider filter
    const matchesVerified = !showVerifiedOnly || product.providerVerified

    // Currency filter
    const matchesCurrency =
      currencyFilter === "all" ||
      (currencyFilter === "pi" && product.piAmount) ||
      (currencyFilter === "pitd" && product.pitdAmount)

    return matchesSearch && matchesCategory && matchesFlashSale && matchesVerified && matchesCurrency
  })

  const clearFilters = () => {
    setSelectedCategory("all")
    setShowFlashSaleOnly(false)
    setShowVerifiedOnly(false)
    setCurrencyFilter("all")
  }

  const activeFiltersCount = [
    selectedCategory !== "all",
    showFlashSaleOnly,
    showVerifiedOnly,
    currencyFilter !== "all",
  ].filter(Boolean).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 pb-20">
        <Header />
        <main className="container px-4 py-4">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-purple-600">{t("loading")}</p>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 pb-20">
      <Header />
      <main className="container px-4 py-4">
        <h1 className="text-3xl font-bold mb-6">{t("searchPage")}</h1>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-500" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-2xl border-purple-200 bg-white/95 backdrop-blur-sm shadow-md focus-visible:ring-purple-500 text-base"
            />
          </div>
          <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <SheetTrigger asChild>
              <Button
                size="icon"
                className="h-12 w-12 rounded-2xl bg-white hover:bg-purple-50 shadow-md border border-purple-200 relative"
              >
                <SlidersHorizontal className="h-5 w-5 text-purple-600" />
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-xs text-white flex items-center justify-center font-semibold shadow">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>{t("filters")}</SheetTitle>
                <SheetDescription>
                  {t("filterByCategory")}, {t("filterByFlashSale")}, {t("filterByVerified")}
                </SheetDescription>
              </SheetHeader>
              <div className="py-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-base font-semibold">{t("filterByCategory")}</Label>
                  <RadioGroup value={selectedCategory} onValueChange={setSelectedCategory}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="cat-all" />
                      <Label htmlFor="cat-all" className="font-normal cursor-pointer">
                        {t("allCategories")}
                      </Label>
                    </div>
                    {CATEGORIES.map((cat) => (
                      <div key={cat.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={cat.id} id={`cat-${cat.id}`} />
                        <Label htmlFor={`cat-${cat.id}`} className="font-normal cursor-pointer">
                          {t(`category-${cat.id}` as any)} {getCategoryStars(cat.id)}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">{t("filterByCurrency")}</Label>
                  <RadioGroup value={currencyFilter} onValueChange={(v) => setCurrencyFilter(v as any)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="curr-all" />
                      <Label htmlFor="curr-all" className="font-normal cursor-pointer">
                        {t("bothCurrencies")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pi" id="curr-pi" />
                      <Label htmlFor="curr-pi" className="font-normal cursor-pointer">
                        {t("piCurrency")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pitd" id="curr-pitd" />
                      <Label htmlFor="curr-pitd" className="font-normal cursor-pointer">
                        {t("pitdCurrency")}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">{t("filterByFlashSale")}</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="flash-sale"
                      checked={showFlashSaleOnly}
                      onCheckedChange={(checked) => setShowFlashSaleOnly(checked as boolean)}
                    />
                    <Label htmlFor="flash-sale" className="font-normal cursor-pointer">
                      {t("showFlashSaleOnly")}
                    </Label>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">{t("filterByVerified")}</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="verified"
                      checked={showVerifiedOnly}
                      onCheckedChange={(checked) => setShowVerifiedOnly(checked as boolean)}
                    />
                    <Label htmlFor="verified" className="font-normal cursor-pointer">
                      {t("verifiedProvidersOnly")}
                    </Label>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <Button onClick={() => setIsFilterOpen(false)} className="w-full">
                    {t("applyFilters")}
                  </Button>
                  {activeFiltersCount > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        clearFilters()
                        setIsFilterOpen(false)
                      }}
                      className="w-full"
                    >
                      <X className="mr-2 h-4 w-4" />
                      {t("clearFilters")}
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          <Badge
            variant={showFlashSaleOnly ? "default" : "outline"}
            className={`px-3 py-2 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
              showFlashSaleOnly
                ? "bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 shadow-md"
                : "bg-white hover:bg-purple-50 border-purple-200"
            }`}
            onClick={() => setShowFlashSaleOnly(!showFlashSaleOnly)}
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            {t("filterByFlashSale")}
          </Badge>
          <Badge
            variant={showVerifiedOnly ? "default" : "outline"}
            className={`px-3 py-2 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
              showVerifiedOnly
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 shadow-md"
                : "bg-white hover:bg-purple-50 border-purple-200"
            }`}
            onClick={() => setShowVerifiedOnly(!showVerifiedOnly)}
          >
            <BadgeCheck className="w-3.5 h-3.5 mr-1.5" />
            {t("filterByVerified")}
          </Badge>
          <Badge
            variant={currencyFilter === "pi" ? "default" : "outline"}
            className={`px-3 py-2 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
              currencyFilter === "pi"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 shadow-md"
                : "bg-white hover:bg-purple-50 border-purple-200"
            }`}
            onClick={() => setCurrencyFilter(currencyFilter === "pi" ? "all" : "pi")}
          >
            <Coins className="w-3.5 h-3.5 mr-1.5" />π Pi
          </Badge>
          <Badge
            variant={currencyFilter === "pitd" ? "default" : "outline"}
            className={`px-3 py-2 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
              currencyFilter === "pitd"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 shadow-md"
                : "bg-white hover:bg-purple-50 border-purple-200"
            }`}
            onClick={() => setCurrencyFilter(currencyFilter === "pitd" ? "all" : "pitd")}
          >
            <Coins className="w-3.5 h-3.5 mr-1.5" />
            PITD
          </Badge>
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-purple-900">
            {filteredProducts.length} {t("results")}
          </p>
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-purple-600 hover:text-purple-700 hover:bg-purple-100 rounded-xl"
            >
              <X className="mr-1.5 h-4 w-4" />
              {t("clearFilters")}
            </Button>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <Card className="p-12 rounded-2xl bg-white/90 backdrop-blur-sm border-purple-100 shadow-md">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">{t("noResults")}</h3>
              <p className="text-muted-foreground">{t("noResultsDesc")}</p>
              {activeFiltersCount > 0 && (
                <Button
                  onClick={clearFilters}
                  className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl shadow-md"
                >
                  <X className="mr-2 h-4 w-4" />
                  {t("clearFilters")}
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                title={product.title}
                description={product.description}
                piAmount={product.piAmount}
                pitdAmount={product.pitdAmount}
                category={product.category}
                imageUrl={product.images?.[0]}
                providerName={product.providerName}
                providerLocation={product.providerLocation}
                rating={product.rating}
                reviewCount={product.reviewCount}
                quantityExchanged={product.quantityExchanged}
                deliveryTime={product.deliveryTime}
                marketingLabel={product.marketingLabel}
                flashSaleEnabled={product.flashSaleEnabled}
                flashSaleStartDate={product.flashSaleStartDate}
                flashSaleEndDate={product.flashSaleEndDate}
                flashSalePiPrice={product.flashSalePiPrice}
          flashSalePitdPrice={product.flashSalePitdPrice}
                flashSaleDiscountPercent={product.flashSaleDiscountPercent}
                originalPiAmount={product.piAmount}
                originalPitdAmount={product.pitdAmount}
                supportsPi={!!product.piAmount}
                supportsPitd={!!product.pitdAmount}
                isFavorite={false}
              />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
