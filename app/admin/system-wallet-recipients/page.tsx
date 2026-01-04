import { redirect } from "next/navigation"

export default function SystemWalletRecipientsRedirect() {
  redirect("/admin/settings")
}
