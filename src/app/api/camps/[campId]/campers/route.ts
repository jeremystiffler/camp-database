import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { generateCamperScanCode, normalizePickupNumber } from "@/lib/camper-identity";

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
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim()))] : [];
}
type SessionChoiceInput = { courseId: string; sessionTemplateId: string };
function parseSessionChoices(value: unknown): SessionChoiceInput[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map(choice => ({
      courseId: typeof choice?.courseId === "string" ? choice.courseId.trim() : "",
      sessionTemplateId: typeof choice?.sessionTemplateId === "string" ? choice.sessionTemplateId.trim() : "",
    }))
    .filter(choice => choice.courseId && choice.sessionTemplateId)
    .filter(choice => {
      const key = `${choice.courseId}:${choice.sessionTemplateId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
async function resolveSessionChoices(campId: string, choices: SessionChoiceInput[]) {
  const sessionIds: string[] = [];
  for (const choice of choices) {
    const course = await prisma.course.findFirst({
      where: { id: choice.courseId, campId, courseSessionTemplates: { some: { sessionTemplateId: choice.sessionTemplateId } } },
      include: { sessions: { where: { campId, sessionTemplateId: choice.sessionTemplateId }, select: { id: true, enrolledCount: true } } },
    }).catch(() => null);
    if (!course) throw new Error("One or more selected classes are not available for this camp");
    let session = course.sessions[0] || null;
    if (!session) {
      const template = await prisma.sessionTemplate.findFirst({ where: { id: choice.sessionTemplateId, campId }, select: { id: true, startTime: true, endTime: true } });
      if (!template) throw new Error("One or more selected time slots are not available for this camp");
      const created = await prisma.session.create({ data: { campId, courseId: course.id, sessionTemplateId: template.id, roomId: course.roomId, startTime: template.startTime, endTime: template.endTime }, select: { id: true, enrolledCount: true } });
      session = created;
    }
    if (course.cap !== null && session.enrolledCount >= (course.cap ?? 0)) throw new Error(`${course.name} is full. Choose a different class.`);
    sessionIds.push(session.id);
  }
  return sessionIds;
}
async function replaceEnrollments(campId: string, camperId: string, nextSessionIds: string[], sessionChoices: SessionChoiceInput[] = []) {
  const resolvedChoiceSessionIds = await resolveSessionChoices(campId, sessionChoices);
  nextSessionIds = [...new Set([...nextSessionIds, ...resolvedChoiceSessionIds])];
  const existing = await prisma.enrollment.findMany({ where: { campId, camperId }, select: { id: true, sessionId: true } });
  const existingIds = new Set(existing.map((e) => e.sessionId));
  const nextIds = new Set(nextSessionIds);
  const toAdd = nextSessionIds.filter((id) => !existingIds.has(id));
  const toRemove = existing.filter((e) => !nextIds.has(e.sessionId));

  if (toAdd.length) {
    const validSessions = await prisma.session.findMany({ where: { campId, id: { in: toAdd } }, select: { id: true, enrolledCount: true, course: { select: { name: true, cap: true } } } });
    const validIds = new Set(validSessions.map((s) => s.id));
    const invalid = toAdd.filter((id) => !validIds.has(id));
    if (invalid.length) throw new Error("One or more selected sessions do not belong to this camp");
    for (const session of validSessions) {
      if (session.course?.cap !== null && session.course?.cap !== undefined && session.enrolledCount >= session.course.cap) throw new Error(`${session.course.name} is full. Choose a different class.`);
    }
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
    include: { session: { include: { course: true, mandatorySession: true, room: true, sessionTemplate: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const items = await prisma.camper.findMany({ where: { campId }, include: camperInclude, orderBy: { lastName: "asc" } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "editor")) return NextResponse.json({ error: "Editors and above can add campers" }, { status: 403 });

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

    const item = await prisma.camper.create({
      data: {
        campId,
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
        pickupNumber: normalizePickupNumber(data.pickupNumber),
        scanCode: generateCamperScanCode(),
        scanCodeGeneratedAt: new Date(),
      },
      include: camperInclude,
    });
    await replaceEnrollments(campId, item.id, parseSessionIds(data.sessionIds), parseSessionChoices(data.sessionChoices));
    const reloaded = await prisma.camper.findFirst({ where: { id: item.id, campId }, include: camperInclude });
    return NextResponse.json(reloaded, { status: 201 });
  } catch (err) {
    console.error("Camper POST error:", err);
    return NextResponse.json({ error: "Failed to add camper", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
