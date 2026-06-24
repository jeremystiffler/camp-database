import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { ageGroupIds, teacherIds, sessionTemplateIds, ...data } = await req.json();

  // Update base course fields
  await prisma.course.update({ where: { id }, data });

  // Replace age groups
  if (Array.isArray(ageGroupIds)) {
    await prisma.courseAgeGroup.deleteMany({ where: { courseId: id } });
    for (const ageGroupId of ageGroupIds) {
      await prisma.courseAgeGroup.create({ data: { courseId: id, ageGroupId } });
    }
  }

  // Replace teachers
  if (Array.isArray(teacherIds)) {
    await prisma.courseTeacher.deleteMany({ where: { courseId: id } });
    for (const personId of teacherIds) {
      await prisma.courseTeacher.create({ data: { courseId: id, personId } });
    }
  }

  // Replace session templates
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
