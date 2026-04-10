import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function PATCH(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await context.params

    if (!user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const email = user.email.trim().toLowerCase()
    const now = new Date()

    const request = await prisma.paymentRequest.findUnique({ where: { id } })
    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 })

    if (request.recipientEmail.toLowerCase() !== email) {
      return NextResponse.json({ error: "You are not authorized to perform this action" }, { status: 403 })
    }

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

    const declinedAt = new Date()
    const updated = await prisma.paymentRequest.updateMany({
      where: { id, status: "PENDING", recipientEmail: email, expiresAt: { gt: declinedAt } },
      data: { status: "DECLINED", declinedAt },
    })

    if (updated.count === 0) {
      return NextResponse.json({ error: "Unable to decline request" }, { status: 400 })
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

