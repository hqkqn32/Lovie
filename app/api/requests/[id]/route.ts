import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await context.params

    if (!user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const email = user.email.trim().toLowerCase()
    const now = new Date()

    // Lazy expiration: PENDING -> EXPIRED when now > expiresAt
    await prisma.paymentRequest.updateMany({
      where: { id, status: "PENDING", expiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    })

    const request = await prisma.paymentRequest.findUnique({
      where: { id },
      include: { sender: { select: { id: true, email: true } } },
    })

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    const isSender = request.senderId === user.id
    const isRecipient = request.recipientEmail.toLowerCase() === email

    if (!isSender && !isRecipient) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    return NextResponse.json({ request })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

