"use client"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Info, Target, Users, Shield, TrendingUp, Heart, Zap, CheckCircle2, Mail, Phone, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/language-context"

export default function AboutPage() {
  const { language } = useLanguage()

  const copy = {
    vi: {
      title: "Về PITODO",
      heroTagline: "Nền tảng trung gian hỗ trợ sử dụng hàng hóa & dịch vụ",
      sectionMainTitle: "PITODO không chỉ là một ứng dụng trao đổi",
      mainP1:
        "PITODO là nền tảng trung gian hỗ trợ người dùng tiếp cận và sử dụng hàng hóa – dịch vụ một cách linh hoạt, rõ ràng và thuận tiện.",
      mainP2:
        "PITODO không bắt buộc bạn phải có ví Pi, không yêu cầu hiểu sâu về blockchain và không yêu cầu giữ bất kỳ tài sản số nào.",
      boxTitle: "PITODO cho phép:",
      boxItem1: "Người dùng xem hàng hóa/dịch vụ (guest xem tự do)",
      boxItem2: "Người dùng đủ điều kiện có thể đăng hàng hóa/dịch vụ theo quy định", 
      boxItem3: "Sử dụng PITD (điểm tín dụng nội bộ) để ghi nhận và hỗ trợ việc sử dụng trong hệ PITODO",
      rolesTitle: "Vai trò của PITODO",
      role1Title: "Điều phối – Xác thực – Kiểm soát",
      role1Desc:
        "PITODO cung cấp cơ chế kiểm soát và hỗ trợ xác thực thông tin nhằm bảo vệ quyền lợi của người dùng và nhà cung cấp.",
      role2Title: "Minh bạch phụ thu & thuế",
      role2Desc:
        "Các khoản phụ thu/thuế (nếu áp dụng) được hiển thị rõ ràng trước khi bạn xác nhận.",
      role3Title: "Không giữ tài sản số hộ người dùng",
      role3Desc:
        "PITODO không vận hành theo mô hình “giữ hộ” tài sản số của người dùng.",
      philosophyTitle: "Triết lý cốt lõi",
      quote1: "Pi để dùng – không để trưng",
      quote2: "Dùng cho cuộc sống mỗi ngày",
      quote3: "Minh bạch – Kiểm soát – An toàn",
      feature1Title: "Cộng đồng",
      feature1Desc: "Kết nối người dùng và nhà cung cấp theo cơ chế rõ ràng",
      feature2Title: "Bảo mật",
      feature2Desc: "Hệ thống xác thực và kiểm soát chặt chẽ",
      feature3Title: "Xác nhận nhanh",
      feature3Desc: "Các bước thao tác được tối ưu để dễ dùng",
      feature4Title: "Minh bạch",
      feature4Desc: "Thông tin hiển thị rõ ràng trước khi bạn xác nhận",
      contactTitle: "Liên hệ với chúng tôi",
      piAdmin: "Pi Username Admin",
      email: "Email",
      phone: "Điện thoại",
    },
    en: {
      title: "About PITODO",
      heroTagline: "An intermediary platform for accessing real goods & services",
      sectionMainTitle: "PITODO is more than an exchange app",
      mainP1:
        "PITODO is an intermediary platform that helps users access and use real goods and services in a flexible, clear, and convenient way.",
      mainP2:
        "Using PITODO does not require a Pi wallet, deep blockchain knowledge, or holding any digital assets.",
      boxTitle: "PITODO enables:",
      boxItem1: "Browsing goods/services (guests can browse freely)",
      boxItem2: "Eligible users can list goods/services under platform rules",
      boxItem3: "Using PITD (an internal credit unit) to record and support usage within PITODO",
      rolesTitle: "PITODO’s role",
      role1Title: "Coordination – Verification – Control",
      role1Desc:
        "PITODO provides control mechanisms and supports verification to protect both users and providers.",
      role2Title: "Transparent fees & taxes",
      role2Desc:
        "Any fees/taxes (if applicable) are displayed clearly before you confirm.",
      role3Title: "No custody of users’ digital assets",
      role3Desc: "PITODO does not operate as a custodian of users’ digital assets.",
      philosophyTitle: "Core philosophy",
      quote1: "Use Pi in real life — not for display",
      quote2: "Use it for everyday life",
      quote3: "Transparency – Control – Safety",
      feature1Title: "Community",
      feature1Desc: "Connect users and providers with clear rules",
      feature2Title: "Security",
      feature2Desc: "Strong verification and control mechanisms",
      feature3Title: "Quick confirmation",
      feature3Desc: "Optimized steps for a smoother experience",
      feature4Title: "Transparency",
      feature4Desc: "Key information is shown clearly before you confirm",
      contactTitle: "Contact us",
      piAdmin: "Admin Pi Username",
      email: "Email",
      phone: "Phone",
    },
  } as const

  const t = language === "en" ? copy.en : copy.vi

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
      <Header />
      <main className="container px-4 py-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/account">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-purple-800">{t.title}</h1>
        </div>

        {/* Hero Section */}
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                π
              </div>
              <h2 className="text-2xl font-bold text-purple-800">PITODO</h2>
              <p className="text-lg text-gray-700 font-medium">{t.heroTagline}</p>
            </div>
          </CardContent>
        </Card>

        {/* Main Description */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Info className="h-6 w-6" />
              {t.sectionMainTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-700">
            <p className="leading-relaxed">{t.mainP1}</p>
            <p className="leading-relaxed">{t.mainP2}</p>

            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <p className="font-semibold text-purple-800 mb-2">{t.boxTitle}</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <span>{t.boxItem1}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <span>{t.boxItem2}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <span>{t.boxItem3}</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Roles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Target className="h-6 w-6" />
              {t.rolesTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-800 mb-1">{t.role1Title}</h3>
                <p className="text-sm text-gray-700">{t.role1Desc}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-800 mb-1">{t.role2Title}</h3>
                <p className="text-sm text-gray-700">{t.role2Desc}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
              <Zap className="h-6 w-6 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-purple-800 mb-1">{t.role3Title}</h3>
                <p className="text-sm text-gray-700">{t.role3Desc}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Core Philosophy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Heart className="h-6 w-6" />
              {t.philosophyTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg border-l-4 border-purple-500">
                <p className="text-lg font-bold text-purple-900">"{t.quote1}"</p>
              </div>
              <div className="p-4 bg-gradient-to-r from-pink-100 to-purple-100 rounded-lg border-l-4 border-pink-500">
                <p className="text-lg font-bold text-pink-900">"{t.quote2}"</p>
              </div>
              <div className="p-4 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg border-l-4 border-blue-500">
                <p className="text-lg font-bold text-blue-900">"{t.quote3}"</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">{t.feature1Title}</h3>
                  <p className="text-sm text-gray-600">{t.feature1Desc}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-6 w-6 text-pink-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">{t.feature2Title}</h3>
                  <p className="text-sm text-gray-600">{t.feature2Desc}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">{t.feature3Title}</h3>
                  <p className="text-sm text-gray-600">{t.feature3Desc}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">{t.feature4Title}</h3>
                  <p className="text-sm text-gray-600">{t.feature4Desc}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact Section */}
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader>
            <CardTitle className="text-purple-800">{t.contactTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-white/80 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                π
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">{t.piAdmin}</p>
                <p className="font-semibold text-gray-800">HLong295</p>
              </div>
            </div>

            <a
              href="mailto:thepitodo@gmail.com"
              className="flex items-center gap-3 p-3 bg-white/80 rounded-lg hover:bg-white transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">{t.email}</p>
                <p className="font-semibold text-blue-600">thepitodo@gmail.com</p>
              </div>
            </a>

            <a
              href="tel:+84938290578"
              className="flex items-center gap-3 p-3 bg-white/80 rounded-lg hover:bg-white transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Phone className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">{t.phone}</p>
                <p className="font-semibold text-green-600">+84 938 290 578</p>
              </div>
            </a>
          </CardContent>
        </Card>

        {/* Version/Footer */}
        <div className="text-center text-sm text-gray-500 py-4">
          <p>PITODO Platform v1.0</p>
          <p className="mt-1">© 2025 PITODO. All rights reserved.</p>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
