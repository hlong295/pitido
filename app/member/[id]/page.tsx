import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, BadgeCheck, BadgeX, Store, User } from "lucide-react"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

async function fetchProfile(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/members/${id}`, {
    cache: "no-store",
  })
  // In some deployments NEXT_PUBLIC_SITE_URL isn't set; fallback to relative fetch on server.
  if (!res.ok) {
    const res2 = await fetch(`/api/members/${id}`, { cache: "no-store" })
    return res2.json()
  }
  return res.json()
}

function pick<T = any>(obj: any, keys: string[], fallback: T = "" as any): T {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k]
  }
  return fallback
}

export default async function MemberProfilePage({ params }: { params: { id: string } }) {
  const id = params.id
  const json = await fetchProfile(id)
  const profile = json?.profile || {}

  const fullName = pick(profile, ["full_name", "name"], "")
  const avatarUrl = pick(profile, ["avatar_url"], "")
  const userType = pick(profile, ["user_type", "type"], "")
  const userRole = pick(profile, ["user_role", "role"], "")
  const verificationStatus = pick(profile, ["verification_status"], "unverified")
  const emailVerified = !!pick(profile, ["email_verified"], false)
  const providerApproved = !!pick(profile, ["provider_approved"], false)
  const providerBiz = pick(profile, ["provider_business_name"], "")
  const providerDesc = pick(profile, ["provider_description"], "")

  const isVerified =
    String(verificationStatus).toLowerCase() === "verified" ||
    String(verificationStatus).toLowerCase() === "approved" ||
    emailVerified === true

  const groupLabel = providerApproved || String(userType).toLowerCase() === "provider" ? "provider" : "redeemer"

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/account">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </Button>
          </Link>

          <div className="text-sm text-gray-600">ID: {id}</div>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="relative h-14 w-14 rounded-full overflow-hidden bg-gray-200">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="avatar" fill className="object-cover" sizes="56px" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <User className="h-7 w-7 text-gray-500" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="text-lg font-bold text-purple-900">{fullName || "(Chưa cập nhật họ tên)"}</div>
                <div className="text-sm text-gray-600">
                  Nhóm: <span className="font-medium">{groupLabel}</span> · Role: <span className="font-medium">{userRole || "redeemer"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-md text-sm">
                    <BadgeCheck className="h-4 w-4" /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-gray-700 bg-gray-100 border border-gray-200 px-2 py-1 rounded-md text-sm">
                    <BadgeX className="h-4 w-4" /> Unverified
                  </span>
                )}
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        {groupLabel === "provider" ? (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Thông tin provider
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Trạng thái:</span>{" "}
                <span className="font-medium">{providerApproved ? "Đã duyệt" : "Chưa duyệt"}</span>
              </div>
              <div>
                <span className="text-gray-600">Tên kinh doanh:</span>{" "}
                <span className="font-medium">{providerBiz || "(Chưa cập nhật)"}</span>
              </div>
              <div>
                <span className="text-gray-600">Mô tả:</span>
                <div className="mt-1 whitespace-pre-wrap">{providerDesc || "(Chưa cập nhật)"}</div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
