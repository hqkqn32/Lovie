import { headers } from "next/headers"
import Link from "next/link"
import { format } from "date-fns"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/request/status-badge"

type PublicRequest = {
  amount: string
  note: string | null
  status: "PENDING" | "PAID" | "DECLINED" | "EXPIRED" | "CANCELLED"
  senderEmail: string | null
  expiresAt: string
  createdAt: string
}

function formatMoney(amount: string) {
  const n = Number.parseFloat(amount)
  if (!Number.isFinite(n)) return `$${amount}`
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" })
}

async function getOrigin() {
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "http"
  const host = h.get("x-forwarded-host") ?? h.get("host")
  return `${proto}://${host}`
}

export default async function PublicRequestPage({
  params,
}: {
  params: Promise<{ link: string }>
}) {
  const { link } = await params

  const res = await fetch(`${await getOrigin()}/api/public/requests/${link}`, {
    cache: "no-store",
  })

  if (!res.ok) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Request not found</CardTitle>
            <CardDescription>This link may be invalid or the request was removed.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const request = (await res.json()) as PublicRequest

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-12">
      <Card className="ring-1 ring-primary/10">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <CardTitle className="text-3xl font-semibold tracking-tight">
                {formatMoney(request.amount)}
              </CardTitle>
              <CardDescription>
                from <span className="font-medium text-foreground">{request.senderEmail ?? "Unknown"}</span>
              </CardDescription>
            </div>
            <StatusBadge status={request.status} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {request.note ? (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="text-xs font-medium text-muted-foreground">Note</div>
              <div className="mt-1 whitespace-pre-wrap">{request.note}</div>
            </div>
          ) : null}

          <div className="grid gap-1 text-sm text-muted-foreground">
            <div>Created {format(new Date(request.createdAt), "PP p")}</div>
            <div>Expires {format(new Date(request.expiresAt), "PP p")}</div>
          </div>

          {request.status === "PENDING" ? (
            <Button className="w-full" render={<Link href="/login" />}>
              Log In to Pay
            </Button>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              This request is {request.status.toLowerCase()}.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

