import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkSchedulingConflicts } from "@/lib/scheduling-conflicts";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;

  const { ageGroupIds, teacherIds, sessionTemplateIds, ...data } = await req.json();

  // ── Conflict check (exclude self) ────────────────────────────────────────
  const conflicts = await checkSchedulingConflicts({
    campId,
    excludeCourseId: id,
    roomId: data.roomId || undefined,
    teacherIds: Array.isArray(teacherIds) ? teacherIds : [],
    sessionTemplateIds: Array.isArray(sessionTemplateIds) ? sessionTemplateIds : [],
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
      ageGroup: true,
      courseAgeGroups: { include: { ageGroup: true } },
      room: true,
      courseTeachers: { include: { person: true } },
      courseSessionTemplates: { include: { sessionTemplate: true } },
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
