import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

const createRequestSchema = z.object({
  recipientEmail: z.string().email(),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount cannot have more than 2 decimal places")
    .refine((v) => {
      const amount = Number.parseFloat(v)
      return Number.isFinite(amount) && amount > 0
    }, "Amount must be greater than $0.00")
    .refine((v) => Number.parseFloat(v) >= 0.01, "Amount must be greater than $0.00"),
  note: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const validated = createRequestSchema.parse(body)

    const senderEmail = (user.email ?? "").trim().toLowerCase()
    const recipientEmail = validated.recipientEmail.trim().toLowerCase()

    if (senderEmail && recipientEmail === senderEmail) {
      return NextResponse.json(
        { error: "You cannot request payment from yourself" },
        { status: 400 }
      )
    }

    if (!user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    await prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, email: user.email },
      update: { email: user.email },
    })

    const request = await prisma.paymentRequest.create({
      data: {
        amount: validated.amount,
        note: validated.note,
        senderId: user.id,
        recipientEmail: recipientEmail,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    return NextResponse.json({
      ...request,
      shareableUrl: `/request/${request.shareableLink}`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await requireAuth()
    if (!user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const email = user.email.trim().toLowerCase()

    const [sent, received] = await Promise.all([
      prisma.paymentRequest.findMany({
        where: { senderId: user.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.paymentRequest.findMany({
        where: { recipientEmail: email },
        include: { sender: { select: { email: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ])

    return NextResponse.json({ sent, received })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

