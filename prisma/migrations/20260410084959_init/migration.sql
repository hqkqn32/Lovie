-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'PAID', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" VARCHAR(500),
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "shareableLink" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_shareableLink_key" ON "PaymentRequest"("shareableLink");

-- CreateIndex
CREATE INDEX "PaymentRequest_senderId_idx" ON "PaymentRequest"("senderId");

-- CreateIndex
CREATE INDEX "PaymentRequest_recipientEmail_idx" ON "PaymentRequest"("recipientEmail");

-- CreateIndex
CREATE INDEX "PaymentRequest_status_idx" ON "PaymentRequest"("status");

-- CreateIndex
CREATE INDEX "PaymentRequest_shareableLink_idx" ON "PaymentRequest"("shareableLink");

-- CreateIndex
CREATE INDEX "PaymentRequest_expiresAt_idx" ON "PaymentRequest"("expiresAt");

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
