import { redirect } from "next/navigation"

import { getUser } from "@/lib/auth"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage() {
  const user = await getUser()
  if (!user?.email) redirect("/login")

  return <DashboardClient email={user.email} />
}

