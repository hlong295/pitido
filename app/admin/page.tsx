"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Settings, Gift, Shield, TrendingUp, Users, DollarSign, CheckCircle } from "lucide-react"
import Link from "next/link"
import { SERVICE_FEE_PERCENTAGE, TAX_PERCENTAGE } from "@/lib/constants"
import { Textarea } from "@/components/ui/textarea"

export default function AdminPage() {
  const { t } = useLanguage()
  const { user, isAdmin } = useAuth()
  const [serviceFee, setServiceFee] = useState(SERVICE_FEE_PERCENTAGE.toString())
  const [tax, setTax] = useState(TAX_PERCENTAGE.toString())
  const [configSaved, setConfigSaved] = useState(false)

  const [rewardRecipient, setRewardRecipient] = useState("")
  const [rewardAmount, setRewardAmount] = useState("")
  const [rewardReason, setRewardReason] = useState("")
  const [rewardSent, setRewardSent] = useState(false)

  const mockRewards = [
    {
      id: "1",
      recipient: "user@example.com",
      amount: 100,
      reason: "Welcome bonus",
      date: new Date("2024-01-15"),
    },
    {
      id: "2",
      recipient: "PiUser123",
      amount: 50,
      reason: "Referral reward",
      date: new Date("2024-01-14"),
    },
  ]

  if (!user || !isAdmin()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 pb-20">
        <Header />
        <main className="container px-4 py-6">
          <Card className="p-12 rounded-2xl shadow-md border-purple-100">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Shield className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {t("adminOnly")}
              </h3>
              <p className="text-gray-600">{t("adminOnlyDesc")}</p>
              <Link href="/">
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl">
                  {t("navHome")}
                </Button>
              </Link>
            </div>
          </Card>
        </main>
        <BottomNav />
      </div>
    )
  }

  const handleSaveConfiguration = () => {
    setConfigSaved(true)
    setTimeout(() => setConfigSaved(false), 3000)
  }

  const handleSendReward = () => {
    setRewardSent(true)
    setTimeout(() => {
      setRewardSent(false)
      setRewardRecipient("")
      setRewardAmount("")
      setRewardReason("")
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-purple-50 pb-20">
      <Header />
      <main className="container px-4 py-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {t("adminPanel")}
            </h1>
          </div>
          <p className="text-gray-600 ml-15">{t("adminDashboard")}</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <Card className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                {t("totalExchanges")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-700">1,234</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                {t("activatedProviders")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-700">45</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-purple-600" />
                {t("totalRevenue")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-700">12,500 π</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="providers" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 backdrop-blur-sm bg-white/40 rounded-2xl p-1 shadow-[0_4px_12px_rgb(147,51,234,0.08)] border border-white/60">
            <TabsTrigger
              value="providers"
              className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white"
            >
              {t("providerManagement")}
            </TabsTrigger>
            <TabsTrigger
              value="config"
              className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white"
            >
              {t("configureFeesAndTax")}
            </TabsTrigger>
            <TabsTrigger
              value="rewards"
              className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white"
            >
              {t("rewardPrograms")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="providers">
            <Card className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{t("providerManagement")}</CardTitle>
                    <CardDescription className="text-sm">
                      {t("approveProvider")}, {t("verifyProvider")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Link href="/admin/providers">
                  <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl h-11">
                    <Users className="mr-2 h-5 w-5" />
                    {t("providerManagement")}
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-md border-0 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-3 rounded-xl">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Ví hệ thống</CardTitle>
                    <CardDescription className="text-sm">
                      Quản trị địa chỉ ví phí dịch vụ/thuế và xem lịch sử giao dịch
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/admin/settings">
                  <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl h-11">
                    <Settings className="h-4 w-4 mr-2" />
                    Cài đặt phí & thuế
                  </Button>
                </Link>
                <Link href="/admin/system-wallets">
                  <Button variant="outline" className="w-full rounded-xl h-11">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Thống kê ví hệ thống
                  </Button>
                </Link>
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="config">
            <Card className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Settings className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{t("feeConfiguration")}</CardTitle>
                    <CardDescription className="text-sm">{t("configureFeesAndTax")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {configSaved && (
                  <Alert className="bg-green-50 border-green-200 rounded-xl">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700 font-medium">
                      {t("configurationSaved")}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="serviceFee" className="text-gray-700 font-medium">
                    {t("serviceFeePercent")}
                  </Label>
                  <Input
                    id="serviceFee"
                    type="number"
                    step="0.1"
                    value={serviceFee}
                    onChange={(e) => setServiceFee(e.target.value)}
                    placeholder="2.5"
                    className="rounded-xl border-gray-200"
                  />
                  <p className="text-xs text-gray-500">Current: {SERVICE_FEE_PERCENTAGE}%</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax" className="text-gray-700 font-medium">
                    {t("taxPercent")}
                  </Label>
                  <Input
                    id="tax"
                    type="number"
                    step="0.1"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    placeholder="1.0"
                    className="rounded-xl border-gray-200"
                  />
                  <p className="text-xs text-gray-500">Current: {TAX_PERCENTAGE}%</p>
                </div>

                <Button
                  onClick={handleSaveConfiguration}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl h-11"
                >
                  <Settings className="mr-2 h-5 w-5" />
                  {t("saveConfiguration")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rewards">
            <div className="space-y-4">
              <Card className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Gift className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{t("rewardPitd")}</CardTitle>
                      <CardDescription className="text-sm">{t("rewardPrograms")}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {rewardSent && (
                    <Alert className="bg-green-50 border-green-200 rounded-xl">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700 font-medium">{t("rewardSent")}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="recipient" className="text-gray-700 font-medium">
                      {t("recipientEmail")} / {t("recipientPiUsername")}
                    </Label>
                    <Input
                      id="recipient"
                      value={rewardRecipient}
                      onChange={(e) => setRewardRecipient(e.target.value)}
                      placeholder="user@example.com or PiUser123"
                      className="rounded-xl border-gray-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-gray-700 font-medium">
                      {t("rewardAmount")} (PITD)
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.000001"
                      value={rewardAmount}
                      onChange={(e) => setRewardAmount(e.target.value)}
                      placeholder="100.000000"
                      className="rounded-xl border-gray-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason" className="text-gray-700 font-medium">
                      {t("rewardReason")}
                    </Label>
                    <Textarea
                      id="reason"
                      value={rewardReason}
                      onChange={(e) => setRewardReason(e.target.value)}
                      placeholder={t("rewardReason")}
                      rows={3}
                      className="rounded-xl border-gray-200"
                    />
                  </div>

                  <Button
                    onClick={handleSendReward}
                    disabled={!rewardRecipient || !rewardAmount || !rewardReason}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl h-11 disabled:opacity-50"
                  >
                    <Gift className="mr-2 h-5 w-5" />
                    {t("sendReward")}
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60">
                <CardHeader>
                  <CardTitle className="text-lg">{t("recentRewards")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockRewards.map((reward) => (
                      <div
                        key={reward.id}
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50/80 to-pink-50/80 rounded-2xl border border-purple-200/50 backdrop-blur-sm"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{reward.recipient}</p>
                          <p className="text-sm text-gray-600">{reward.reason}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-pink-600">{reward.amount} PITD</p>
                          <p className="text-xs text-gray-500">{reward.date.toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <BottomNav />
    </div>
  )
}
