import { redirect } from "next/navigation"

import { getUser } from "@/lib/auth"
import { RequestDetailClient } from "./request-detail-client"

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getUser()
  if (!user?.email) redirect("/login")

  const { id } = await params
  return <RequestDetailClient id={id} viewerEmail={user.email} viewerId={user.id} />
}

