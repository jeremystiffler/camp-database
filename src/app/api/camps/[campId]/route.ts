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
    return NextResponse.json({ error: "Editors and above can edit camps" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Whitelist all known Camp fields — never spread unknown keys into Prisma
    const allowed: Record<string, unknown> = {};
    const ALLOWED_KEYS = [
      "name", "startDate", "endDate", "status", "registrationOpen",
      "billingMode", "billingStatus", "platformFeeCents", "annualSubscriptionCents",
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
    if (allowed.platformFeeCents !== undefined) allowed.platformFeeCents = Math.max(0, Number(allowed.platformFeeCents) || 300);
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
    return NextResponse.json({ error: "Only admins and owners can delete camps" }, { status: 403 });
  }
  await prisma.camp.deleteMany({ where: { id: campId } });
  return NextResponse.json({ success: true });
}
