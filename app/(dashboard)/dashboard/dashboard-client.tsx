"use client"

import * as React from "react"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function DashboardClient({ email }: { email: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome, {email}</p>
        </div>

        <Dialog>
          <DialogTrigger render={<Button />}>New Request</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Payment Request</DialogTitle>
              <DialogDescription>
                Phase 3 placeholder. We’ll add the request form in Phase 2/4 tasks.
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm text-muted-foreground">
              This dialog is wired and ready for the “Create Request” form.
            </div>
            <DialogFooter showCloseButton />
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

