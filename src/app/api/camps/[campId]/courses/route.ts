import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkSchedulingConflicts } from "@/lib/scheduling-conflicts";
import { effectiveCapacity } from "@/lib/capacity";

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}


export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { ageGroupIds, teacherIds, sessionTemplateIds, ...data } = await req.json();

  if (data.roomId) {
    const room = await prisma.room.findFirst({ where: { id: data.roomId, campId }, select: { name: true, capacity: true } });
    if (!room) return NextResponse.json({ error: "Selected room does not belong to this event." }, { status: 400 });
  }

  // Cap validation runs whether or not a room is assigned. The class cap is the
  // only limit on enrollment; room capacity is advisory and never blocks a class.
  {
    const cap = data.cap === null || data.cap === undefined || data.cap === "" ? null : Number(data.cap);
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

  const course = await prisma.course.create({ data: { ...data, campId } });

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
