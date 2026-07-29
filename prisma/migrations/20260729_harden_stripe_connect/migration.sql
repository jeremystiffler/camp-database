ALTER TABLE "Organization"
  ADD COLUMN "stripeConnectCardPaymentsActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripeConnectDisabledReason" TEXT;

ALTER TABLE "RegistrationPayment"
  ADD COLUMN "checkoutExpiresAt" TIMESTAMP(3),
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "failureMessage" TEXT,
  ADD COLUMN "couponReservedAt" TIMESTAMP(3),
  ADD COLUMN "couponRedeemedAt" TIMESTAMP(3);

CREATE TABLE "RegistrationPaymentCamper" (
  "paymentId" TEXT NOT NULL,
  "camperId" TEXT NOT NULL,
  "allocatedAmountCents" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "RegistrationPaymentCamper_pkey" PRIMARY KEY ("paymentId", "camperId"),
  CONSTRAINT "RegistrationPaymentCamper_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "RegistrationPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RegistrationPaymentCamper_camperId_fkey" FOREIGN KEY ("camperId") REFERENCES "Camper"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "RegistrationPaymentCamper_camperId_idx" ON "RegistrationPaymentCamper"("camperId");

CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "stripeAccountId" TEXT,
  "payloadCreatedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);
