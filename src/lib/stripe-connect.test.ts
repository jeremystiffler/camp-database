import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { connectReady, publicConnectState } from "@/lib/stripe-connect";

const registrationRoute = fs.readFileSync("src/app/api/camps/[campId]/public-registration/route.ts", "utf8");
const campRoute = fs.readFileSync("src/app/api/camps/[campId]/route.ts", "utf8");
const platformWebhook = fs.readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
const connectWebhook = fs.readFileSync("src/app/api/stripe/connect-webhook/route.ts", "utf8");
const settings = fs.readFileSync("src/app/(protected)/settings/page.tsx", "utf8");

describe("Stripe Connect payout readiness", () => {
  const base = {
    accountId: "acct_test",
    detailsSubmitted: true,
    chargesEnabled: true,
    payoutsEnabled: true,
  };

  it("requires an account plus every Stripe readiness flag", () => {
    expect(connectReady(base)).toBe(true);
    expect(connectReady({ ...base, accountId: null })).toBe(false);
    expect(connectReady({ ...base, detailsSubmitted: false })).toBe(false);
    expect(connectReady({ ...base, chargesEnabled: false })).toBe(false);
    expect(connectReady({ ...base, payoutsEnabled: false })).toBe(false);
  });

  it("does not expose the connected account id to the browser", () => {
    const state = publicConnectState({ ...base, country: "US", currentlyDue: [] }, true);
    expect(state).toMatchObject({ configured: true, connected: true, ready: true, country: "US" });
    expect(state).not.toHaveProperty("accountId");
  });
});

describe("connected registration checkout wiring", () => {
  it("creates the Checkout Session on the organizer account", () => {
    expect(registrationRoute).toContain("{ stripeAccount: connectAccountId }");
    expect(registrationRoute).toContain("application_fee_amount: familyTotals.platformFeeCents");
    expect(registrationRoute).toContain("stripeConnectPayoutsEnabled");
    expect(registrationRoute).toContain("not ready to accept online payments");
  });

  it("keeps platform fee controls out of organizer writes", () => {
    expect(campRoute).toContain('"billingMode", "camperPriceCents"');
    expect(campRoute).not.toContain('"billingMode", "billingStatus", "platformFeeCents", "platformFeePercentBps", "platformFeeMinCents", "platformFeeCapCents", "camperPriceCents", "annualSubscriptionCents",\n      "themePreset"');
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
