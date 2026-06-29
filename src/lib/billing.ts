import Stripe from "stripe";

export const BILLING_MODES = ["campPays", "camperFee"] as const;
export type BillingMode = typeof BILLING_MODES[number];

export const CAMP_ANNUAL_SUBSCRIPTION_CENTS = 29900;
export const CAMPER_PLATFORM_FEE_CENTS = 300;

export function isBillingMode(value: unknown): value is BillingMode {
  return typeof value === "string" && BILLING_MODES.includes(value as BillingMode);
}

export function dollars(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` || "http://localhost:3000";
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}
