import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const camp = await prisma.camp.findFirst({
    where: { id: campId },
    include: { ageGroups: true, rooms: true, persons: true, courses: true },
  });
  if (!camp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...camp, myRole: member.role });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "editor")) {
    return NextResponse.json({ error: "Editors and above can edit programs" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Whitelist all known Camp fields — never spread unknown keys into Prisma
    const allowed: Record<string, unknown> = {};
    const ALLOWED_KEYS = [
      "name", "startDate", "endDate", "status", "registrationOpen",
      "billingMode", "billingStatus", "platformFeeCents", "platformFeePercentBps", "platformFeeMinCents", "platformFeeCapCents", "camperPriceCents", "annualSubscriptionCents",
      "primaryColor", "accentColor", "fontFamily",
    ];
    for (const key of ALLOWED_KEYS) {
      if (key in body) allowed[key] = body[key];
    }

    // Coerce date strings to Date objects
    if (allowed.startDate) allowed.startDate = allowed.startDate ? new Date(allowed.startDate as string) : null;
    if (allowed.endDate)   allowed.endDate   = allowed.endDate   ? new Date(allowed.endDate   as string) : null;
    if (allowed.billingMode && !["campPays", "camperFee"].includes(String(allowed.billingMode))) delete allowed.billingMode;
    if (allowed.billingStatus && !["trial", "active", "past_due", "unpaid", "comped"].includes(String(allowed.billingStatus))) delete allowed.billingStatus;
    // Appearance is rendered on public registration and printable material. Keep these
    // values constrained here so a program setting cannot inject arbitrary CSS.
    const colorValue = /^#[0-9a-fA-F]{6}$/;
    for (const key of ["primaryColor", "accentColor"] as const) {
      if (allowed[key] !== undefined) {
        const value = String(allowed[key]).trim();
        if (!colorValue.test(value)) return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
        allowed[key] = value.toUpperCase();
      }
    }
    if (allowed.fontFamily !== undefined) {
      const value = String(allowed.fontFamily).trim();
      const allowedFonts = ["Inter", "Poppins", "Georgia", "Merriweather", "Courier New", "Trebuchet MS"];
      if (!allowedFonts.includes(value)) return NextResponse.json({ error: "Invalid font family" }, { status: 400 });
      allowed.fontFamily = value;
    }
    if (allowed.platformFeeCents !== undefined) allowed.platformFeeCents = Math.max(0, Number(allowed.platformFeeCents) || 300);
    if (allowed.platformFeePercentBps !== undefined) allowed.platformFeePercentBps = Math.min(10000, Math.max(0, Number(allowed.platformFeePercentBps) || 300));
    if (allowed.platformFeeMinCents !== undefined) allowed.platformFeeMinCents = Math.max(0, Number(allowed.platformFeeMinCents) || 200);
    if (allowed.platformFeeCapCents !== undefined) allowed.platformFeeCapCents = Math.max(0, Number(allowed.platformFeeCapCents) || 2500);
    if (allowed.camperPriceCents !== undefined) allowed.camperPriceCents = Math.max(0, Number(allowed.camperPriceCents) || 0);
    if (allowed.annualSubscriptionCents !== undefined) allowed.annualSubscriptionCents = Math.max(0, Number(allowed.annualSubscriptionCents) || 29900);

    await prisma.camp.update({ where: { id: campId }, data: allowed });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Camp PATCH error:", err);
    return NextResponse.json({ error: "Failed to update camp", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "admin")) {
    return NextResponse.json({ error: "Only admins and owners can delete programs" }, { status: 403 });
  }
  await prisma.camp.deleteMany({ where: { id: campId } });
  return NextResponse.json({ success: true });
}
