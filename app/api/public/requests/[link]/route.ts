import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { prisma } from "@/lib/prisma"

export async function GET(_req: NextRequest, context: { params: Promise<{ link: string }> }) {
  try {
    const { link } = await context.params
    const now = new Date()

    // Lazy expiration: PENDING -> EXPIRED when now > expiresAt
    await prisma.paymentRequest.updateMany({
      where: { shareableLink: link, status: "PENDING", expiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    })

    const request = await prisma.paymentRequest.findUnique({
      where: { shareableLink: link },
      include: { sender: { select: { email: true } } },
    })

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    // Public response: hide recipient email for privacy
    return NextResponse.json({
      amount: request.amount,
      note: request.note,
      status: request.status,
      senderEmail: request.sender.email,
      expiresAt: request.expiresAt,
      createdAt: request.createdAt,
    })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

