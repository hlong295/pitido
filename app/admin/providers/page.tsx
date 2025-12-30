"use client"

import { Header } from "@/components/header"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, XCircle, Shield, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminProvidersPage() {
  const { t } = useLanguage()
  const { user, isAdmin, approveProviderApplication, getPendingProviderApplications } = useAuth()
  const router = useRouter()
  const [pendingProviders, setPendingProviders] = useState<any[]>([])
  const [approvedProviders, setApprovedProviders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && isAdmin()) {
      loadProviders()
    }
  }, [user])

  const loadProviders = async () => {
    try {
      setLoading(true)
      const pending = await getPendingProviderApplications()
      setPendingProviders(pending)

      // Load approved providers from localStorage for demo
      const stored = localStorage.getItem("pitodo-approved-providers")
      if (stored) {
        setApprovedProviders(JSON.parse(stored))
      }
    } catch (err) {
      console.error("[v0] Failed to load providers:", err)
    } finally {
      setLoading(false)
    }
  }

  if (!user || !isAdmin()) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t("adminOnlyDesc")}</AlertDescription>
          </Alert>
        </main>
      </div>
    )
  }

  const handleApprove = async (providerId: string) => {
    try {
      await approveProviderApplication(providerId, "approve")

      // Move to approved list (demo only)
      const provider = pendingProviders.find((p) => p.id === providerId)
      if (provider) {
        const updated = [...approvedProviders, { ...provider, isApproved: true, trustLevel: "unverified" }]
        setApprovedProviders(updated)
        localStorage.setItem("pitodo-approved-providers", JSON.stringify(updated))
        setPendingProviders(pendingProviders.filter((p) => p.id !== providerId))
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleReject = async (providerId: string, reason?: string) => {
    try {
      await approveProviderApplication(providerId, "reject", reason)
      setPendingProviders(pendingProviders.filter((p) => p.id !== providerId))
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleVerify = (index: number) => {
    const updated = [...approvedProviders]
    updated[index].verification_status = updated[index].verification_status === "verified" ? "unverified" : "verified"
    setApprovedProviders(updated)
    localStorage.setItem("pitodo-approved-providers", JSON.stringify(updated))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-purple-50 pb-20">
        <Header />
        <main className="container px-4 py-6">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-purple-600">{t("loading")}</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-purple-50 pb-20">
      <Header />
      <main className="container px-4 py-6">
        <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          {t("providerManagement")}
        </h1>

        <Tabs defaultValue="pending">
          <TabsList className="grid w-full grid-cols-2 backdrop-blur-sm bg-white/40 rounded-2xl p-1 shadow-[0_4px_12px_rgb(147,51,234,0.08)] border border-white/60">
            <TabsTrigger
              value="pending"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white"
            >
              {t("pendingProviders")} ({pendingProviders.length})
            </TabsTrigger>
            <TabsTrigger
              value="approved"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white"
            >
              {t("approvedProviders")} ({approvedProviders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-4">
            {pendingProviders.length === 0 ? (
              <Card className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60">
                <CardContent className="pt-6 text-center text-gray-600">{t("noProvidersFound")}</CardContent>
              </Card>
            ) : (
              pendingProviders.map((provider) => (
                <Card
                  key={provider.id}
                  className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{provider.provider_business_name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{provider.full_name || provider.email}</p>
                      </div>
                      <Badge variant="outline">{t("pendingApproval")}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <p className="text-sm">
                        <strong>{t("email")}:</strong> {provider.email}
                      </p>
                      <p className="text-sm">
                        <strong>{t("phone")}:</strong> {provider.phone || "N/A"}
                      </p>
                      <p className="text-sm">
                        <strong>{t("description")}:</strong> {provider.provider_description}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("memberSince")}: {new Date(provider.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(provider.id)}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl"
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        {t("approveProvider")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(provider.id)}
                        className="rounded-xl"
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        {t("rejectProvider")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4 mt-4">
            {approvedProviders.length === 0 ? (
              <Card className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60">
                <CardContent className="pt-6 text-center text-gray-600">{t("noProvidersFound")}</CardContent>
              </Card>
            ) : (
              approvedProviders.map((provider, index) => (
                <Card
                  key={provider.id}
                  className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{provider.provider_business_name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{provider.full_name || provider.email}</p>
                      </div>
                      <Badge className={provider.verification_status === "verified" ? "bg-green-500" : "bg-blue-500"}>
                        {provider.verification_status === "verified" ? t("verified") : t("unverified")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <p className="text-sm">
                        <strong>{t("email")}:</strong> {provider.email}
                      </p>
                      <p className="text-sm">
                        <strong>{t("description")}:</strong> {provider.provider_description}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerify(index)}
                      className="rounded-xl border-purple-200 hover:bg-purple-50/50"
                    >
                      <Shield className="mr-1 h-4 w-4" />
                      {provider.verification_status === "verified" ? t("unverifyProvider") : t("verifyProvider")}
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
