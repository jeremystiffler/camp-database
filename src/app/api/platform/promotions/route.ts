import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/billing";
import { requireSuperAdmin } from "@/lib/platform-admin";

const active = (value: unknown) => value !== false;

export async function GET() {
  const gate = await requireSuperAdmin();
  if (!gate.session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!gate.authorized) return NextResponse.json({ error: "Platform Super Admin access required" }, { status: 403 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  const list = await stripe.promotionCodes.list({ limit: 100, active: true, expand: ["data.coupon"] });
  return NextResponse.json({ promotions: list.data.map((promotion) => ({
    id: promotion.id,
    code: promotion.code,
    active: promotion.active,
    timesRedeemed: promotion.times_redeemed,
    maxRedemptions: promotion.max_redemptions,
    expiresAt: promotion.expires_at ? new Date(promotion.expires_at * 1000).toISOString() : null,
    firstTimeTransaction: promotion.restrictions?.first_time_transaction || false,
    percentOff: promotion.promotion.coupon && typeof promotion.promotion.coupon !== "string" ? promotion.promotion.coupon.percent_off : null,
    amountOff: promotion.promotion.coupon && typeof promotion.promotion.coupon !== "string" ? promotion.promotion.coupon.amount_off : null,
    currency: promotion.promotion.coupon && typeof promotion.promotion.coupon !== "string" ? promotion.promotion.coupon.currency : null,
    duration: promotion.promotion.coupon && typeof promotion.promotion.coupon !== "string" ? promotion.promotion.coupon.duration : "once",
  })) });
}

export async function POST(req: NextRequest) {
  const gate = await requireSuperAdmin();
  if (!gate.session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!gate.authorized) return NextResponse.json({ error: "Platform Super Admin access required" }, { status: 403 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const discountType = body.discountType === "amount" ? "amount" : "percent";
  const percentOff = Math.min(100, Math.max(1, Math.round(Number(body.percentOff) || 0)));
  const amountOff = Math.max(50, Math.round(Number(body.amountOffCents) || 0));
  const duration = body.duration === "repeating" ? "repeating" : "once";
  const durationInMonths = Math.min(24, Math.max(1, Math.round(Number(body.durationInMonths) || 1)));
  const maxRedemptions = body.maxRedemptions ? Math.max(1, Math.round(Number(body.maxRedemptions))) : undefined;
  const expiresAt = body.expiresAt ? Math.floor(new Date(`${body.expiresAt}T23:59:59Z`).getTime() / 1000) : undefined;
  if (!code) return NextResponse.json({ error: "A promotion code is required" }, { status: 400 });
  if (discountType === "percent" && !percentOff) return NextResponse.json({ error: "Enter a percentage discount" }, { status: 400 });
  if (discountType === "amount" && !amountOff) return NextResponse.json({ error: "Enter a dollar discount" }, { status: 400 });

  const coupon = await stripe.coupons.create({
    name: `Simple Schedule Pro — ${code}`,
    duration,
    ...(duration === "repeating" ? { duration_in_months: durationInMonths } : {}),
    ...(discountType === "percent" ? { percent_off: percentOff } : { amount_off: amountOff, currency: "usd" }),
    metadata: { platform: "simple-schedule-pro", createdBy: gate.user?.email || "super-admin" },
  });
  const promotion = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code,
    max_redemptions: maxRedemptions,
    expires_at: expiresAt,
    restrictions: body.firstTimeOnly ? { first_time_transaction: true } : undefined,
    metadata: { platform: "simple-schedule-pro", createdBy: gate.user?.email || "super-admin" },
  });
  return NextResponse.json({ success: true, promotion: { id: promotion.id, code: promotion.code } });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireSuperAdmin();
  if (!gate.session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!gate.authorized) return NextResponse.json({ error: "Platform Super Admin access required" }, { status: 403 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Promotion ID is required" }, { status: 400 });
  const promotion = await stripe.promotionCodes.update(id, { active: false });
  return NextResponse.json({ success: true, id: promotion.id });
}
