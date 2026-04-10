import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function PATCH(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await context.params

    if (!user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const email = user.email.trim().toLowerCase()

    const request = await prisma.paymentRequest.findUnique({
      where: { id },
      include: { sender: { select: { email: true } } },
    })

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (request.recipientEmail.toLowerCase() !== email) {
      return NextResponse.json({ error: "You are not authorized to perform this action" }, { status: 403 })
    }

    const now = new Date()
    if (request.status !== "PENDING") {
      return NextResponse.json({ error: "Request already processed" }, { status: 400 })
    }

    if (now > request.expiresAt) {
      await prisma.paymentRequest.updateMany({
        where: { id, status: "PENDING", expiresAt: { lt: now } },
        data: { status: "EXPIRED" },
      })
      return NextResponse.json({ error: "Request expired" }, { status: 400 })
    }

    // Simulate payment processing delay (2-3 seconds)
    await sleep(2000 + Math.floor(Math.random() * 1000))

    const paidAt = new Date()
    const updated = await prisma.paymentRequest.updateMany({
      where: { id, status: "PENDING", recipientEmail: email, expiresAt: { gt: paidAt } },
      data: { status: "PAID", paidAt },
    })

    if (updated.count === 0) {
      const latest = await prisma.paymentRequest.findUnique({
        where: { id },
        include: { sender: { select: { email: true } } },
      })
      if (!latest) return NextResponse.json({ error: "Request not found" }, { status: 404 })
      if (latest.status !== "PENDING") {
        return NextResponse.json({ error: "Request already processed" }, { status: 400 })
      }
      if (paidAt > latest.expiresAt) {
        await prisma.paymentRequest.updateMany({
          where: { id, status: "PENDING", expiresAt: { lt: paidAt } },
          data: { status: "EXPIRED" },
        })
        return NextResponse.json({ error: "Request expired" }, { status: 400 })
      }
      return NextResponse.json({ error: "Unable to pay request" }, { status: 400 })
    }

    const result = await prisma.paymentRequest.findUnique({
      where: { id },
      include: { sender: { select: { email: true } } },
    })

    return NextResponse.json({ request: result })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

