"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { toast } from "sonner"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/request/status-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type RequestStatus = "PENDING" | "PAID" | "DECLINED" | "EXPIRED" | "CANCELLED"

type RequestDetails = {
  id: string
  amount: string
  note: string | null
  status: RequestStatus
  shareableLink: string
  senderId: string
  recipientEmail: string
  createdAt: string
  expiresAt: string
  paidAt: string | null
  declinedAt: string | null
  cancelledAt: string | null
  sender: { id: string; email: string | null }
}

function formatMoney(amount: string) {
  const n = Number.parseFloat(amount)
  if (!Number.isFinite(n)) return `$${amount}`
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" })
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const json = (await res.json().catch(() => ({}))) as unknown
  if (!res.ok) {
    const err =
      json && typeof json === "object" && "error" in json ? (json as { error?: unknown }).error : undefined
    throw new Error(typeof err === "string" ? err : "Request failed")
  }
  return json as T
}

export function RequestDetailClient({
  id,
  viewerEmail,
  viewerId,
}: {
  id: string
  viewerEmail: string
  viewerId: string
}) {
  const queryClient = useQueryClient()

  const requestQuery = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const data = await fetchJson<{ request: RequestDetails }>(`/api/requests/${id}`)
      return data.request
    },
  })

  const payMutation = useMutation({
    mutationFn: async () => fetchJson<{ request: RequestDetails }>(`/api/requests/${id}/pay`, { method: "PATCH" }),
    onSuccess: async () => {
      toast.success("Payment successful")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
        queryClient.invalidateQueries({ queryKey: ["request", id] }),
      ])
    },
    onError: (e) => toast.error(e.message || "Payment failed"),
  })

  const declineMutation = useMutation({
    mutationFn: async () =>
      fetchJson<{ request: RequestDetails }>(`/api/requests/${id}/decline`, { method: "PATCH" }),
    onSuccess: async () => {
      toast.success("Request declined")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
        queryClient.invalidateQueries({ queryKey: ["request", id] }),
      ])
    },
    onError: (e) => toast.error(e.message || "Decline failed"),
  })

  const cancelMutation = useMutation({
    mutationFn: async () =>
      fetchJson<{ request: RequestDetails }>(`/api/requests/${id}/cancel`, { method: "PATCH" }),
    onSuccess: async () => {
      toast.success("Request cancelled")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
        queryClient.invalidateQueries({ queryKey: ["request", id] }),
      ])
    },
    onError: (e) => toast.error(e.message || "Cancel failed"),
  })

  if (requestQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    )
  }

  if (requestQuery.isError || !requestQuery.data) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-sm font-medium">Couldn’t load request</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {requestQuery.isError ? requestQuery.error.message : "Unknown error"}
          </p>
        </CardContent>
      </Card>
    )
  }

  const req = requestQuery.data
  const viewerEmailLc = viewerEmail.trim().toLowerCase()
  const isSender = req.senderId === viewerId
  const isRecipient = req.recipientEmail.toLowerCase() === viewerEmailLc
  const isPending = req.status === "PENDING"

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Request details</h1>
        <p className="text-sm text-muted-foreground">ID: {req.id}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{formatMoney(req.amount)}</CardTitle>
              <CardDescription>
                Created {format(new Date(req.createdAt), "PP p")} • Expires{" "}
                {format(new Date(req.expiresAt), "PP p")}
              </CardDescription>
            </div>
            <StatusBadge status={req.status} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Sender</span>
              <span className="font-medium">{req.sender.email ?? "Unknown"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Recipient</span>
              <span className="font-medium">{req.recipientEmail}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Shareable link</span>
              <span className="font-mono text-xs">/request/{req.shareableLink}</span>
            </div>
            {req.note ? (
              <div className="grid gap-1">
                <span className="text-muted-foreground">Note</span>
                <p className="text-sm">{req.note}</p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {isRecipient && isPending ? (
              <>
                <AlertDialog>
                  <AlertDialogTrigger render={<Button disabled={payMutation.isPending} />}>
                    {payMutation.isPending ? (
                      <>
                        <Loader2Icon className="size-4 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      "Pay"
                    )}
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm payment</AlertDialogTitle>
                      <AlertDialogDescription>
                        Pay {formatMoney(req.amount)} to {req.sender.email ?? "the sender"}?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => payMutation.mutate()}>
                        Confirm Payment
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="outline"
                        disabled={declineMutation.isPending || payMutation.isPending}
                      />
                    }
                  >
                    Decline
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Decline request?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will mark the request as declined.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Back</AlertDialogCancel>
                      <AlertDialogAction onClick={() => declineMutation.mutate()}>
                        Decline
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : null}

            {isSender && isPending ? (
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="destructive" disabled={cancelMutation.isPending} />}
                >
                  Cancel request
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel request?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The recipient will no longer be able to pay this request.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Back</AlertDialogCancel>
                    <AlertDialogAction onClick={() => cancelMutation.mutate()}>
                      Cancel Request
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}

            {!isPending ? (
              <p className="text-sm text-muted-foreground">
                This request is {req.status.toLowerCase()}.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

