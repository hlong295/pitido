"use client"

import type React from "react"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HelpCircle, Mail, Phone, MessageCircle, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/language-context"

type FAQItem = {
  question: string
  answer: string
  icon: React.ReactNode
}

export default function HelpPage() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const { language } = useLanguage()

  const copy = {
    vi: {
      title: "Trợ giúp & Hỗ trợ",
      contactTitle: "Liên hệ hỗ trợ",
      contactIntro: "Nếu bạn cần hỗ trợ, vui lòng liên hệ với chúng tôi qua các kênh sau:",
      piUsername: "Pi Username",
      email: "Email",
      phone: "Điện thoại",
      supportNote: "Thời gian hỗ trợ: 8:00 - 22:00 (GMT+7) hàng ngày. Chúng tôi sẽ phản hồi trong vòng 24 giờ.",
      faqTitle: "Câu hỏi thường gặp",
      usefulLinks: "Liên kết hữu ích",
      about: "Về PITODO",
      publicWallets: "Ví công khai",
      providerApply: "Đăng ký làm nhà cung cấp",
    },
    en: {
      title: "Help & Support",
      contactTitle: "Contact support",
      contactIntro: "If you need assistance, please reach us via the following channels:",
      piUsername: "Pi Username",
      email: "Email",
      phone: "Phone",
      supportNote: "Support hours: 08:00 – 22:00 (GMT+7) daily. We will respond within 24 hours.",
      faqTitle: "Frequently asked questions",
      usefulLinks: "Useful links",
      about: "About PITODO",
      publicWallets: "Public wallets",
      providerApply: "Apply as a provider",
    },
  } as const

  const t = language === "en" ? copy.en : copy.vi

  const faqs: FAQItem[] =
    language === "en"
      ? [
          {
            question: "What is PITODO?",
            answer:
              "PITODO is an intermediary platform that helps users access and use real goods and services in a clear, convenient way. Using PITODO does not require having a Pi wallet.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
          {
            question: "What is PITD?",
            answer:
              "PITD is an internal credit unit within the PITODO ecosystem, used to record and support usage of goods and services on the platform.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
          {
            question: "Is PITD money?",
            answer: "No. PITD is an internal credit unit. It is not money and does not replace money.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
          {
            question: "Is PITD a cryptocurrency?",
            answer: "No. PITD is not a cryptocurrency and is not designed for investment.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
          {
            question: "Do I need a Pi wallet to use PITODO?",
            answer: "Not required. You can use PITODO without having a Pi wallet.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
          {
            question: "Can PITD be used outside PITODO?",
            answer: "No. PITD is only valid within the PITODO ecosystem.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
          {
            question: "Can I freely transfer PITD to other users?",
            answer:
              "No. PITD is not freely transferable between users. Usage is governed by PITODO’s internal rules and controls.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
          {
            question: "Does PITODO guarantee converting PITD to cash?",
            answer:
              "No. PITODO does not publish or guarantee conversion of PITD into fiat currency. PITD is used as an internal credit unit.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
        ]
      : [
          {
            question: "PITODO là gì?",
            answer:
              "PITODO là nền tảng trung gian hỗ trợ người dùng tiếp cận và sử dụng hàng hóa – dịch vụ một cách rõ ràng, thuận tiện. Sử dụng PITODO không bắt buộc phải có ví Pi.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
          {
            question: "PITD là gì?",
            answer:
              "PITD là điểm tín dụng nội bộ trong hệ sinh thái PITODO, dùng để ghi nhận và hỗ trợ việc sử dụng hàng hóa – dịch vụ trên nền tảng.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
          {
            question: "PITD có phải là tiền không?",
            answer: "Không. PITD là điểm tín dụng nội bộ, không phải tiền và không thay thế tiền.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
          {
            question: "PITD có phải tiền điện tử không?",
            answer: "Không. PITD không phải tiền điện tử và không dùng cho đầu tư.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
          {
            question: "Tôi có cần ví Pi để dùng PITODO không?",
            answer: "Không bắt buộc. Bạn vẫn có thể sử dụng PITODO mà không cần ví Pi.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
          {
            question: "PITD có dùng bên ngoài PITODO được không?",
            answer: "Không. PITD chỉ có giá trị trong hệ PITODO.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
          {
            question: "PITD có chuyển cho người khác được không?",
            answer: "Không. PITD không chuyển nhượng tự do giữa người dùng và được quản lý theo cơ chế nội bộ của PITODO.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
          {
            question: "PITODO có cam kết quy đổi PITD ra tiền không?",
            answer: "Không. PITODO không công bố và không cam kết việc quy đổi PITD ra tiền pháp định.",
            icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
          },
        ]

  const toggleFAQ = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

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

        {/* Contact Support Card */}
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <MessageCircle className="h-6 w-6" />
              {t.contactTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">{t.contactIntro}</p>

            <div className="space-y-3">
              {/* Pi Username */}
              <div className="flex items-center gap-3 p-3 bg-white/80 rounded-lg">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                  π
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">{t.piUsername}</p>
                  <p className="font-semibold text-gray-800">HLong295</p>
                </div>
              </div>

              {/* Email */}
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

              {/* Phone */}
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
            </div>

            <p className="text-xs text-gray-500 mt-4">
              {t.supportNote}
            </p>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <HelpCircle className="h-6 w-6" />
              {t.faqTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {faq.icon}
                    <span className="font-medium text-gray-800">{faq.question}</span>
                  </div>
                  {expandedIndex === index ? (
                    <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {expandedIndex === index && (
                  <div className="px-4 pb-4 pt-0 text-gray-600 bg-gray-50 animate-in slide-in-from-top-2">
                    <p className="text-sm leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-purple-800">{t.usefulLinks}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/about"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-purple-50 transition-colors"
            >
              <span className="text-gray-700">{t.about}</span>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </Link>
            <Link
              href="/wallets"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-purple-50 transition-colors"
            >
              <span className="text-gray-700">{t.publicWallets}</span>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </Link>
            <Link
              href="/provider/apply"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-purple-50 transition-colors"
            >
              <span className="text-gray-700">{t.providerApply}</span>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </Link>
          </CardContent>
        </Card>
      </main>
      <BottomNav />
    </div>
  )
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
