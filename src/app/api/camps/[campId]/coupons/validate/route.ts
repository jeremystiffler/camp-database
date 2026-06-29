import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateRegistrationTotal, couponAllowsEmail, normalizeCouponCode } from "@/lib/registration-pricing";

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const { campId } = await params;
  const body = await req.json().catch(() => ({}));
  const code = normalizeCouponCode(body.code);
  const guardianEmail = typeof body.guardianEmail === "string" ? body.guardianEmail.trim().toLowerCase() : "";
  const camp = await prisma.camp.findUnique({
    where: { id: campId },
    select: { camperPriceCents: true, platformFeeCents: true, platformFeePercentBps: true, platformFeeMinCents: true, platformFeeCapCents: true },
  });
  if (!camp) return NextResponse.json({ error: "Camp not found" }, { status: 404 });
  if (!code) return NextResponse.json({ valid: false, error: "Enter a coupon code" }, { status: 400 });
  const coupon = await prisma.campCoupon.findFirst({ where: { campId, code, active: true } });
  if (!coupon) return NextResponse.json({ valid: false, error: "Coupon code not found" }, { status: 404 });
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return NextResponse.json({ valid: false, error: "Coupon code has expired" }, { status: 400 });
  if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) return NextResponse.json({ valid: false, error: "Coupon code has reached its limit" }, { status: 400 });
  if (!couponAllowsEmail(coupon.restrictedEmails, guardianEmail)) return NextResponse.json({ valid: false, error: "This code is reserved for a specific family email" }, { status: 403 });
  const totals = calculateRegistrationTotal(camp, coupon);
  return NextResponse.json({
    valid: true,
    coupon: { code: coupon.code, description: coupon.description, discountType: coupon.discountType },
    totals,
  });
}
