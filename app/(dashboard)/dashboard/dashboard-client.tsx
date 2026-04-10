"use client"

import * as React from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

const createRequestSchema = z.object({
  recipientEmail: z.string().email("Please enter a valid email address"),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount cannot have more than 2 decimal places")
    .refine((v) => Number.parseFloat(v) > 0, "Amount must be greater than $0.00")
    .refine((v) => Number.parseFloat(v) >= 0.01, "Amount must be greater than $0.00"),
  note: z.string().max(500, "Note cannot exceed 500 characters").optional(),
})

type CreateRequestValues = z.infer<typeof createRequestSchema>

export function DashboardClient({ email }: { email: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)

  const form = useForm<CreateRequestValues>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: { recipientEmail: "", amount: "", note: "" },
  })

  const noteValue = useWatch({ control: form.control, name: "note" })

  const createRequestMutation = useMutation({
    mutationFn: async (values: CreateRequestValues) => {
      const senderEmail = email.trim().toLowerCase()
      const recipientEmail = values.recipientEmail.trim().toLowerCase()
      if (recipientEmail === senderEmail) {
        throw new Error("You cannot request payment from yourself")
      }

      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipientEmail: values.recipientEmail,
          amount: values.amount,
          note: values.note?.trim() ? values.note : undefined,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          typeof json?.error === "string"
            ? json.error
            : Array.isArray(json?.error) && json.error.length > 0
              ? json.error[0]?.message ?? "Failed to create request"
            : "Failed to create request"
        throw new Error(message)
      }
      return json
    },
    onSuccess: async () => {
      toast.success("Request created")
      setOpen(false)
      form.reset()
      await queryClient.invalidateQueries({ queryKey: ["requests"] })
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create request")
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome, {email}</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>New Request</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Payment Request</DialogTitle>
              <DialogDescription>Create a request that expires in 7 days.</DialogDescription>
            </DialogHeader>

            <form
              className="grid gap-4"
              onSubmit={form.handleSubmit((values) => createRequestMutation.mutate(values))}
            >
              <div className="grid gap-2">
                <Label htmlFor="recipientEmail">Recipient email</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  placeholder="friend@example.com"
                  autoComplete="email"
                  aria-invalid={Boolean(form.formState.errors.recipientEmail)}
                  {...form.register("recipientEmail")}
                />
                {form.formState.errors.recipientEmail ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.recipientEmail.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="100.00"
                  aria-invalid={Boolean(form.formState.errors.amount)}
                  {...form.register("amount", {
                    setValueAs: (v) => (v === "" ? "" : String(v)),
                  })}
                />
                {form.formState.errors.amount ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.amount.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea
                  id="note"
                  maxLength={500}
                  placeholder="Dinner last night"
                  aria-invalid={Boolean(form.formState.errors.note)}
                  {...form.register("note")}
                />
                {form.formState.errors.note ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.note.message}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {(noteValue?.length ?? 0)}/500
                  </p>
                )}
              </div>

              <DialogFooter showCloseButton>
                <Button type="submit" disabled={createRequestMutation.isPending}>
                  {createRequestMutation.isPending ? "Creating…" : "Create Request"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="sent" className="w-full">
        <TabsList>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="received">Received</TabsTrigger>
        </TabsList>

        <TabsContent value="sent" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sent Requests</CardTitle>
              <CardDescription>Requests you’ve sent to others.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm font-medium">No sent requests yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Click “New Request” to request a payment.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="received" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Received Requests</CardTitle>
              <CardDescription>Requests sent to your email.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm font-medium">No received requests yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  When someone requests money from you, it’ll show up here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

