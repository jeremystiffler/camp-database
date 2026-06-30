import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}
function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function intValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function parseSessionIds(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim()))] : undefined;
}
async function replaceEnrollments(campId: string, camperId: string, nextSessionIds: string[]) {
  const existing = await prisma.enrollment.findMany({ where: { campId, camperId }, select: { id: true, sessionId: true } });
  const existingIds = new Set(existing.map((e) => e.sessionId));
  const nextIds = new Set(nextSessionIds);
  const toAdd = nextSessionIds.filter((id) => !existingIds.has(id));
  const toRemove = existing.filter((e) => !nextIds.has(e.sessionId));

  if (toAdd.length) {
    const validSessions = await prisma.session.findMany({ where: { campId, id: { in: toAdd } }, select: { id: true } });
    const validIds = new Set(validSessions.map((s) => s.id));
    const invalid = toAdd.filter((id) => !validIds.has(id));
    if (invalid.length) throw new Error("One or more selected sessions do not belong to this camp");
    for (const sessionId of toAdd) {
      await prisma.enrollment.create({ data: { campId, camperId, sessionId, status: "enrolled" } });
      await prisma.session.update({ where: { id: sessionId }, data: { enrolledCount: { increment: 1 } } });
    }
  }
  for (const enrollment of toRemove) {
    await prisma.enrollment.delete({ where: { id: enrollment.id } });
    await prisma.session.update({ where: { id: enrollment.sessionId }, data: { enrolledCount: { decrement: 1 } } });
  }
}
const camperInclude = {
  ageGroup: true,
  enrollments: {
    include: { session: { include: { course: true, room: true, sessionTemplate: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "editor")) return NextResponse.json({ error: "Editors and above can edit campers" }, { status: 403 });

  const existing = await prisma.camper.findFirst({ where: { id, campId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Camper not found" }, { status: 404 });

  try {
    const data = await req.json();
    const firstName = nullableString(data.firstName);
    const lastName = nullableString(data.lastName);
    if (!firstName || !lastName) return NextResponse.json({ error: "Camper first and last name are required" }, { status: 400 });

    const ageGroupId = nullableString(data.ageGroupId);
    if (ageGroupId) {
      const ageGroup = await prisma.ageGroup.findFirst({ where: { id: ageGroupId, campId }, select: { id: true } });
      if (!ageGroup) return NextResponse.json({ error: "Selected age group does not belong to this camp" }, { status: 400 });
    }

    await prisma.camper.update({
      where: { id },
      data: {
        firstName,
        lastName,
        dateOfBirth: data.dateOfBirth ? new Date(String(data.dateOfBirth)) : null,
        ageGroupId,
        guardianName: nullableString(data.guardianName),
        guardianEmail: nullableString(data.guardianEmail),
        guardianPhone: nullableString(data.guardianPhone),
        emergencyPhone: nullableString(data.emergencyPhone),
        tshirtSize: nullableString(data.tshirtSize),
        photoConsent: Boolean(data.photoConsent),
        medicalNotes: nullableString(data.medicalNotes),
        dietaryNotes: nullableString(data.dietaryNotes),
        customData: nullableString(data.customData),
        couponCode: nullableString(data.couponCode),
        campPriceCents: intValue(data.campPriceCents),
        discountCents: intValue(data.discountCents),
        platformFeeCents: intValue(data.platformFeeCents),
        totalPaidCents: intValue(data.totalPaidCents),
        paymentStatus: nullableString(data.paymentStatus) || "not_required",
      },
    });
    const sessionIds = parseSessionIds(data.sessionIds);
    if (sessionIds) await replaceEnrollments(campId, id, sessionIds);
    const item = await prisma.camper.findFirst({ where: { id, campId }, include: camperInclude });
    return NextResponse.json(item);
  } catch (err) {
    console.error("Camper PATCH error:", err);
    return NextResponse.json({ error: "Failed to update camper", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "admin")) return NextResponse.json({ error: "Only admins and owners can delete campers" }, { status: 403 });

  const existing = await prisma.camper.findFirst({ where: { id, campId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Camper not found" }, { status: 404 });

  const enrollments = await prisma.enrollment.findMany({ where: { campId, camperId: id }, select: { sessionId: true } });
  await prisma.camper.delete({ where: { id } });
  for (const enrollment of enrollments) {
    await prisma.session.update({ where: { id: enrollment.sessionId }, data: { enrolledCount: { decrement: 1 } } });
  }
  return NextResponse.json({ success: true });
}
