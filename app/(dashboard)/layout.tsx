import { redirect } from "next/navigation"
import { Wallet } from "lucide-react"

import { getUser } from "@/lib/auth"
import { LogoutButton } from "@/components/auth/logout-button"

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getUser()
  if (!user) redirect("/login")

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-gradient-to-r from-blue-950 to-blue-900 shadow-lg">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/10 p-2 backdrop-blur-sm">
              <Wallet className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold text-white">Payment Requests</span>
              <span className="text-xs text-white/60">{user.email}</span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
        {children}
      </main>
    </div>
  )
}