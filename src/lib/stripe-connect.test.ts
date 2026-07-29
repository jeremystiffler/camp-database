import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { connectReady, publicConnectState } from "@/lib/stripe-connect";

const registrationRoute = fs.readFileSync("src/app/api/camps/[campId]/public-registration/route.ts", "utf8");
const campRoute = fs.readFileSync("src/app/api/camps/[campId]/route.ts", "utf8");
const platformWebhook = fs.readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
const connectWebhook = fs.readFileSync("src/app/api/stripe/connect-webhook/route.ts", "utf8");
const connectRoute = fs.readFileSync("src/app/api/camps/[campId]/payments/connect/route.ts", "utf8");
const settings = fs.readFileSync("src/app/(protected)/settings/page.tsx", "utf8");
const lifecycle = fs.readFileSync("src/lib/registration-payment-lifecycle.ts", "utf8");
const webhookEvents = fs.readFileSync("src/lib/stripe-webhook-events.ts", "utf8");

describe("Stripe Connect payout readiness", () => {
  const base = {
    accountId: "acct_test",
    detailsSubmitted: true,
    chargesEnabled: true,
    payoutsEnabled: true,
    cardPaymentsActive: true,
    disabledReason: null,
  };

  it("requires an account plus every Stripe readiness flag", () => {
    expect(connectReady(base)).toBe(true);
    expect(connectReady({ ...base, accountId: null })).toBe(false);
    expect(connectReady({ ...base, detailsSubmitted: false })).toBe(false);
    expect(connectReady({ ...base, chargesEnabled: false })).toBe(false);
    expect(connectReady({ ...base, payoutsEnabled: false })).toBe(false);
    expect(connectReady({ ...base, cardPaymentsActive: false })).toBe(false);
    expect(connectReady({ ...base, disabledReason: "requirements.past_due" })).toBe(false);
  });

  it("does not expose the connected account id to the browser", () => {
    const state = publicConnectState({ ...base, country: "US", currentlyDue: [] }, true);
    expect(state).toMatchObject({ configured: true, connected: true, ready: true, country: "US" });
    expect(state).not.toHaveProperty("accountId");
  });
});

describe("connected registration checkout wiring", () => {
  it("uses the Stripe-compatible Express controller liability configuration", () => {
    expect(connectRoute).toContain('stripe_dashboard: { type: "express" }');
    expect(connectRoute).toContain('fees: { payer: "application" }');
    expect(connectRoute).toContain('losses: { payments: "application" }');
    expect(connectRoute).toContain('connect-organization-${context.organization.id}:express-app-liability-v1');
    expect(settings).toContain('role="alert"');
    expect(settings).toContain("setConnectError");
  });

  it("creates the Checkout Session on the organizer account", () => {
    expect(registrationRoute).toContain("stripeAccount: connectAccountId");
    expect(registrationRoute).toContain("idempotencyKey: `registration-checkout:${payment.id}:v1`");
    expect(registrationRoute).toContain('payment_method_types: ["card"]');
    expect(registrationRoute).toContain("client_reference_id: payment.id");
    expect(registrationRoute).toContain("application_fee_amount: familyTotals.platformFeeCents");
    expect(registrationRoute).toContain("stripeConnectPayoutsEnabled");
    expect(registrationRoute).toContain("not ready to accept online payments");
  });

  it("reserves locally before Checkout and unwinds abandoned payments", () => {
    expect(registrationRoute.indexOf("prisma.registrationPayment.create")).toBeLessThan(registrationRoute.indexOf("checkout.sessions.create"));
    expect(registrationRoute).not.toContain("participantIds: createdParticipantIds.join");
    expect(registrationRoute).toContain("couponReservedAt");
    expect(registrationRoute).toContain("checkoutExpiresAt");
    expect(registrationRoute).toContain("failPendingRegistrationPayment");
    expect(lifecycle).toContain('DELETE FROM "Enrollment"');
    expect(lifecycle).toContain('"redeemedCount" = GREATEST');
    expect(lifecycle).toContain('DELETE FROM "Participant"');
  });

  it("fulfills webhooks idempotently and only for the matching account", () => {
    expect(webhookEvents).toContain("stripeWebhookEvent.create");
    expect(webhookEvents).toContain('error.code === "P2002"');
    expect(lifecycle).toContain('"stripeConnectAccountId" = $2');
    expect(lifecycle).toContain('"status" = \'pending\'');
    expect(lifecycle).toContain('"totalPaidCents" = rpc."allocatedAmountCents"');
  });

  it("keeps platform fee controls out of organizer writes", () => {
    expect(campRoute).toContain('"billingMode", "participantPriceCents"');
    expect(campRoute).not.toContain('"billingMode", "billingStatus", "platformFeeCents", "platformFeePercentBps", "platformFeeMinCents", "platformFeeCapCents", "participantPriceCents", "annualSubscriptionCents",\n      "themePreset"');
    expect(settings).not.toContain("Our percentage");
    expect(settings).toContain("Organizers control only their event price.");
  });

  it("requires signed platform and connected-account webhooks", () => {
    expect(platformWebhook).toContain("Missing Stripe signature");
    expect(platformWebhook).not.toContain("JSON.parse(body)");
    expect(connectWebhook).toContain("STRIPE_CONNECT_WEBHOOK_SECRET");
    expect(connectWebhook).toContain("constructEvent");
  });
});
