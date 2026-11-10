import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkSchedulingConflicts } from "@/lib/scheduling-conflicts";
import { effectiveCapacity } from "@/lib/capacity";
import { allowedBody, COURSE_FIELDS, courseFields, requireCampRole, validCourseReferences } from "@/lib/camp-write-guards";

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}


export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const denied = await requireCampRole(session.userId, campId);
  if (denied) return denied;
  const body: unknown = await req.json();
  if (!allowedBody(body, COURSE_FIELDS)) return NextResponse.json({ error: "Invalid activity fields" }, { status: 400 });
  const { ageGroupIds, teacherIds, sessionTemplateIds } = body;
  const data = courseFields(body);
  if (!data || !data.name) return NextResponse.json({ error: "Activity name is required" }, { status: 400 });
  if (!await validCourseReferences(campId, body)) return NextResponse.json({ error: "Invalid or foreign activity references" }, { status: 400 });
  if (body.attentionDismissals !== undefined) return NextResponse.json({ error: "Attention dismissals cannot be set during creation" }, { status: 400 });

  if (data.roomId) {
    const room = await prisma.room.findFirst({ where: { id: data.roomId, campId }, select: { name: true, capacity: true } });
    if (!room) return NextResponse.json({ error: "Selected room does not belong to this event." }, { status: 400 });
  }

  // Cap validation runs whether or not a room is assigned. The class cap is the
  // only limit on enrollment; room capacity is advisory and never blocks a class.
  {
    const cap = data.cap ?? null;
    const heldSeats = data.heldSeats === undefined ? 0 : Number(data.heldSeats);
    if (cap !== null && (!Number.isInteger(cap) || cap < 1)) return NextResponse.json({ error: "Class limit must be a positive whole number." }, { status: 400 });
    const capacity = effectiveCapacity({ cap, heldSeats });
    if (!Number.isInteger(heldSeats) || heldSeats < 0) return NextResponse.json({ error: "Held seats must be zero or a positive whole number." }, { status: 400 });
    if (Number.isFinite(capacity) && heldSeats > capacity) return NextResponse.json({ error: `Held seats must be between 0 and ${capacity}.` }, { status: 400 });
    data.cap = cap;
    data.heldSeats = heldSeats;
  }

  // ── Conflict check before any write ──────────────────────────────────────
  const conflicts = await checkSchedulingConflicts({
    campId,
    roomId: data.roomId || undefined,
    teacherIds: Array.isArray(teacherIds) ? teacherIds : [],
    sessionTemplateIds: Array.isArray(sessionTemplateIds) ? sessionTemplateIds : [],
    ageGroupIds: Array.isArray(ageGroupIds) ? ageGroupIds : [],
  });
  if (conflicts.length > 0) {
    return NextResponse.json({ error: "scheduling_conflict", conflicts }, { status: 409 });
  }
  // ─────────────────────────────────────────────────────────────────────────

  const course = await prisma.course.create({ data: { ...data, name: data.name, campId } });

  if (Array.isArray(ageGroupIds) && ageGroupIds.length > 0) {
    for (const ageGroupId of ageGroupIds) {
      await prisma.courseAgeGroup.create({ data: { courseId: course.id, ageGroupId } });
    }
  }
  if (Array.isArray(teacherIds) && teacherIds.length > 0) {
    for (const personId of teacherIds) {
      await prisma.courseTeacher.create({ data: { courseId: course.id, personId } });
    }
  }
  if (Array.isArray(sessionTemplateIds) && sessionTemplateIds.length > 0) {
    for (const sessionTemplateId of sessionTemplateIds) {
      await prisma.courseSessionTemplate.create({ data: { courseId: course.id, sessionTemplateId } });
    }
  }

  const full = await prisma.course.findUnique({
    where: { id: course.id },
    include: {
      ageGroup: true,
      courseAgeGroups: { include: { ageGroup: true } },
      room: true,
      courseTeachers: { include: { person: true } },
      courseSessionTemplates: { include: { sessionTemplate: true } },
      sessions: { select: { id: true, sessionTemplateId: true, enrolledCount: true, enrollments: { select: { participantId: true } } } },
    },
  });
  return NextResponse.json(full, { status: 201 });
}
