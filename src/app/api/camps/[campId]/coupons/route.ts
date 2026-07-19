import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { normalizeCouponCode } from "@/lib/registration-pricing";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

function compactCoupon(coupon: {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  percentOff: number | null;
  amountOffCents: number | null;
  restrictedEmails: string | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  active: boolean;
  expiresAt: Date | null;
}) {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description || "",
    discountType: coupon.discountType,
    percentOff: coupon.percentOff,
    amountOffCents: coupon.amountOffCents,
    restrictedEmails: coupon.restrictedEmails || "",
    maxRedemptions: coupon.maxRedemptions,
    redeemedCount: coupon.redeemedCount,
    active: coupon.active,
    expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString().slice(0, 10) : "",
  };
}

function safeCouponInput(body: Record<string, unknown>) {
  const code = normalizeCouponCode(body.code);
  const discountType = ["percent", "amount", "free", "bogo"].includes(String(body.discountType)) ? String(body.discountType) : "percent";
  const percentOff = discountType === "percent" ? Math.min(100, Math.max(1, Number(body.percentOff) || 0)) : null;
  const amountOffCents = discountType === "amount" ? Math.max(0, Math.round(Number(body.amountOffCents) || 0)) : null;
  const maxRedemptions = body.maxRedemptions === null || body.maxRedemptions === "" || body.maxRedemptions === undefined ? null : Math.max(1, Math.round(Number(body.maxRedemptions) || 1));
  const expiresAt = typeof body.expiresAt === "string" && body.expiresAt ? new Date(`${body.expiresAt}T23:59:59.999Z`) : null;
  return {
    code,
    description: typeof body.description === "string" ? body.description.trim() : null,
    discountType,
    percentOff,
    amountOffCents,
    restrictedEmails: typeof body.restrictedEmails === "string" ? body.restrictedEmails.toLowerCase().trim() || null : null,
    maxRedemptions,
    active: body.active !== false,
    expiresAt,
  };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const coupons = await prisma.campCoupon.findMany({ where: { campId }, orderBy: [{ active: "desc" }, { createdAt: "desc" }] });
  return NextResponse.json({ coupons: coupons.map(compactCoupon) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "admin")) return NextResponse.json({ error: "Only camp admins can manage registration coupons" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const data = safeCouponInput(body);
  if (!data.code) return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
  try {
    const coupon = await prisma.campCoupon.upsert({
      where: { campId_code: { campId, code: data.code } },
      update: data,
      create: { ...data, campId },
    });
    return NextResponse.json({ success: true, coupon: compactCoupon(coupon) });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save coupon", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
