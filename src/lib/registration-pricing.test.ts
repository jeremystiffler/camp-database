import { describe, expect, it } from "vitest";
import { calculatePlatformFee, calculateRegistrationTotal } from "@/lib/registration-pricing";

const feeSchedule = { platformFeePercentBps: 300, platformFeeMinCents: 200, platformFeeCapCents: 2500 };

describe("registration pricing integrity", () => {
  it("applies the minimum, percentage, and cap", () => {
    expect(calculatePlatformFee(100, feeSchedule)).toBe(200);
    expect(calculatePlatformFee(10_000, feeSchedule)).toBe(300);
    expect(calculatePlatformFee(200_000, feeSchedule)).toBe(2_500);
  });

  it("never charges a platform fee on zero or fully discounted registrations", () => {
    expect(calculatePlatformFee(0, feeSchedule)).toBe(0);
    expect(calculateRegistrationTotal({ participantPriceCents: 0, ...feeSchedule })).toMatchObject({ subtotalCents: 0, platformFeeCents: 0, totalCents: 0 });
    expect(calculateRegistrationTotal({ participantPriceCents: 5_000, ...feeSchedule }, { code: "FREE", discountType: "free" })).toMatchObject({ subtotalCents: 0, platformFeeCents: 0, totalCents: 0 });
  });

  it("prices a family from the discounted family subtotal", () => {
    expect(calculateRegistrationTotal({ participantPriceCents: 10_000, ...feeSchedule }, { code: "HALF", discountType: "percent", percentOff: 50 }, 3)).toMatchObject({
      campPriceCents: 30_000,
      discountCents: 15_000,
      subtotalCents: 15_000,
      platformFeeCents: 450,
      totalCents: 15_450,
      quantity: 3,
    });
  });
});
