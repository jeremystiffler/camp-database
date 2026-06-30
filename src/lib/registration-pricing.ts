export type PricingCamp = {
  camperPriceCents?: number | null;
  platformFeeCents?: number | null;
  platformFeePercentBps?: number | null;
  platformFeeMinCents?: number | null;
  platformFeeCapCents?: number | null;
};

export type PricingCoupon = {
  id?: string;
  code: string;
  discountType: string;
  percentOff?: number | null;
  amountOffCents?: number | null;
};

export function calculatePlatformFee(priceAfterDiscountCents: number, camp: PricingCamp) {
  if (priceAfterDiscountCents <= 0) return 0;
  const percentBps = camp.platformFeePercentBps ?? 300;
  const minCents = camp.platformFeeMinCents ?? 200;
  const capCents = camp.platformFeeCapCents ?? 2500;
  const percentFee = Math.round(priceAfterDiscountCents * percentBps / 10000);
  return Math.max(0, Math.min(capCents, Math.max(minCents, percentFee)));
}

export function calculateDiscount(priceCents: number, coupon?: PricingCoupon | null) {
  if (!coupon || priceCents <= 0) return 0;
  if (coupon.discountType === "free") return priceCents;
  if (coupon.discountType === "bogo") return Math.floor(priceCents / 2);
  if (coupon.discountType === "amount") return Math.min(priceCents, Math.max(0, coupon.amountOffCents ?? 0));
  if (coupon.discountType === "percent") return Math.min(priceCents, Math.round(priceCents * Math.max(0, coupon.percentOff ?? 0) / 100));
  return 0;
}

export function calculateRegistrationTotal(camp: PricingCamp, coupon?: PricingCoupon | null, quantity = 1) {
  const safeQuantity = Math.max(1, Math.floor(quantity || 1));
  const perCamperPriceCents = Math.max(0, camp.camperPriceCents ?? 0);
  const campPriceCents = perCamperPriceCents * safeQuantity;
  const discountCents = calculateDiscount(campPriceCents, coupon);
  const subtotalCents = Math.max(0, campPriceCents - discountCents);
  const platformFeeCents = perCamperPriceCents > 0 ? calculatePlatformFee(subtotalCents, camp) : Math.max(0, camp.platformFeeCents ?? 0);
  const totalCents = subtotalCents + platformFeeCents;
  return { campPriceCents, discountCents, subtotalCents, platformFeeCents, totalCents, quantity: safeQuantity, perCamperPriceCents };
}

export function normalizeCouponCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : "";
}

export function couponAllowsEmail(restrictedEmails: string | null | undefined, guardianEmail: string) {
  const raw = (restrictedEmails || "").trim().toLowerCase();
  if (!raw) return true;
  const email = guardianEmail.trim().toLowerCase();
  return raw.split(/[\n,;]+/).map(part => part.trim()).filter(Boolean).includes(email);
}
