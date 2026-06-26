import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkSchedulingConflicts } from "@/lib/scheduling-conflicts";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;

  const { ageGroupIds, teacherIds, sessionTemplateIds, ...data } = await req.json();

  // ── Load current course state for conflict check ───────────────────────────
  // The caller may only send ONE of {roomId, teacherIds, sessionTemplateIds}.
  // We must merge the incoming partial update with the existing values so the
  // conflict engine always sees the full picture (room + all teachers + all slots).
  const existing = await prisma.course.findUnique({
    where: { id },
    include: {
      courseTeachers:         { select: { personId: true } },
      courseSessionTemplates: { select: { sessionTemplateId: true } },
      courseAgeGroups:        { select: { ageGroupId: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Resolved values: prefer what was sent, fall back to what already exists
  const resolvedRoomId = "roomId" in data
    ? (data.roomId || undefined)
    : (existing.roomId || undefined);

  const resolvedTeacherIds = Array.isArray(teacherIds)
    ? teacherIds
    : existing.courseTeachers.map(ct => ct.personId);

  const existingSlotIds = existing.courseSessionTemplates.map((cst: { sessionTemplateId: string }) => cst.sessionTemplateId);
  const existingAgeGroupIds = existing.courseAgeGroups.map((cag: { ageGroupId: string }) => cag.ageGroupId);
  const resolvedSlotIds = Array.isArray(sessionTemplateIds)
    ? sessionTemplateIds
    : existingSlotIds;

  // When the assignment grid toggles a single session group, it sends the full
  // replacement list of sessionTemplateIds. If we check the full list, a
  // pre-existing conflict elsewhere causes a giant unrelated error list and
  // blocks the one checkbox the user actually clicked. For slot-only updates,
  // check only newly-added slots. Room/teacher changes still check every slot.
  const isSlotOnlyUpdate = Array.isArray(sessionTemplateIds)
    && !("roomId" in data)
    && !Array.isArray(teacherIds)
    && !Array.isArray(ageGroupIds);
  const conflictSlotIds = isSlotOnlyUpdate
    ? sessionTemplateIds.filter((slotId: string) => !existingSlotIds.includes(slotId))
    : resolvedSlotIds;
  const resolvedAgeGroupIds = Array.isArray(ageGroupIds) ? ageGroupIds : existingAgeGroupIds;

  // ── Conflict check (exclude self) ────────────────────────────────────────
  const conflicts = await checkSchedulingConflicts({
    campId,
    excludeCourseId: id,
    roomId:              resolvedRoomId,
    teacherIds:          resolvedTeacherIds,
    sessionTemplateIds:  conflictSlotIds,
    ageGroupIds:         resolvedAgeGroupIds,
  });
  if (conflicts.length > 0) {
    return NextResponse.json({ error: "scheduling_conflict", conflicts }, { status: 409 });
  }
  // ─────────────────────────────────────────────────────────────────────────

  await prisma.course.update({ where: { id }, data });

  if (Array.isArray(ageGroupIds)) {
    await prisma.courseAgeGroup.deleteMany({ where: { courseId: id } });
    for (const ageGroupId of ageGroupIds) {
      await prisma.courseAgeGroup.create({ data: { courseId: id, ageGroupId } });
    }
  }
  if (Array.isArray(teacherIds)) {
    await prisma.courseTeacher.deleteMany({ where: { courseId: id } });
    for (const personId of teacherIds) {
      await prisma.courseTeacher.create({ data: { courseId: id, personId } });
    }
  }
  if (Array.isArray(sessionTemplateIds)) {
    await prisma.courseSessionTemplate.deleteMany({ where: { courseId: id } });
    for (const sessionTemplateId of sessionTemplateIds) {
      await prisma.courseSessionTemplate.create({ data: { courseId: id, sessionTemplateId } });
    }
  }

  const full = await prisma.course.findUnique({
    where: { id },
    include: {
      ageGroup:               true,
      courseAgeGroups:        { include: { ageGroup: true } },
      room:                   true,
      courseTeachers:         { include: { person: true } },
      courseSessionTemplates: { include: { sessionTemplate: true } },
      sessions:               { select: { id: true, sessionTemplateId: true, enrolledCount: true } },
    },
  });
  return NextResponse.json(full);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.course.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
