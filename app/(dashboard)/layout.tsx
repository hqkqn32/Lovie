import { redirect } from "next/navigation"

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
      <header className="border-b border-primary/20 bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium">P2P Payment Requests</span>
            <span className="text-xs text-primary-foreground/80">{user.email}</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        {children}
      </main>
    </div>
  )
}

