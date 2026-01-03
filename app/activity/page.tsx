"use client"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { usePiAuth } from "@/lib/pi-auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle, XCircle, History } from "lucide-react"

export default function ActivityPage() {
  const { t } = useLanguage()
  const { user } = usePiAuth()

  const activities = user
    ? [
        {
          id: 1,
          title: "Nike Air Max",
          piAmount: "450",
          status: "completed",
          date: "2024-12-15",
        },
        {
          id: 2,
          title: "Starbucks Gift Card",
          piAmount: "50",
          status: "pending",
          date: "2024-12-14",
        },
        {
          id: 3,
          title: "Netflix Premium",
          piAmount: "180",
          status: "completed",
          date: "2024-12-10",
        },
      ]
    : []

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "completed":
        return {
          label: t("completed"),
          icon: CheckCircle,
          variant: "default" as const,
          className: "bg-green-500/10 text-green-600 border-green-500/20",
        }
      case "pending":
        return {
          label: t("pending"),
          icon: Clock,
          variant: "secondary" as const,
          className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
        }
      case "cancelled":
        return {
          label: t("cancelled"),
          icon: XCircle,
          variant: "destructive" as const,
          className: "bg-red-500/10 text-red-600 border-red-500/20",
        }
      default:
        return {
          label: status,
          icon: Clock,
          variant: "secondary" as const,
          className: "",
        }
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main className="container px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">{t("activityTitle")}</h1>

        {!user || activities.length === 0 ? (
          <Card className="p-12">
            <div className="text-center space-y-2">
              <History className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="text-xl font-semibold">{t("noActivity")}</h3>
              <p className="text-muted-foreground">{t("noActivityDesc")}</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const statusInfo = getStatusInfo(activity.status)
              const StatusIcon = statusInfo.icon
              return (
                <Card key={activity.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{activity.title}</h3>
                        <p className="text-sm text-muted-foreground">{activity.date}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <span className="text-xl font-bold text-primary">{activity.piAmount}</span>
                            <span className="text-sm text-muted-foreground">π</span>
                          </div>
                        </div>
                        <Badge className={statusInfo.className}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
