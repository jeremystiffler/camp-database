ALTER TABLE "Organization"
  ADD COLUMN "stripeConnectAccountId" TEXT,
  ADD COLUMN "stripeConnectDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripeConnectChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripeConnectPayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripeConnectCountry" TEXT,
  ADD COLUMN "stripeConnectUpdatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Organization_stripeConnectAccountId_key"
  ON "Organization"("stripeConnectAccountId");

ALTER TABLE "RegistrationPayment"
  ADD COLUMN "stripeConnectAccountId" TEXT;
