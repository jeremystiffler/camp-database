import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const items = await prisma.course.findMany({
    where: { campId },
    include: {
      ageGroup: true,
      courseAgeGroups: { include: { ageGroup: true } },
      room: true,
      courseTeachers: { include: { person: true } },
      courseSessionTemplates: { include: { sessionTemplate: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { ageGroupIds, teacherIds, sessionTemplateIds, ...data } = await req.json();

  const course = await prisma.course.create({ data: { ...data, campId } });

  // Age groups (many-to-many)
  if (Array.isArray(ageGroupIds) && ageGroupIds.length > 0) {
    for (const ageGroupId of ageGroupIds) {
      await prisma.courseAgeGroup.create({ data: { courseId: course.id, ageGroupId } });
    }
  }

  // Teachers
  if (Array.isArray(teacherIds) && teacherIds.length > 0) {
    for (const personId of teacherIds) {
      await prisma.courseTeacher.create({ data: { courseId: course.id, personId } });
    }
  }

  // Session templates (time slots)
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
    },
  });
  return NextResponse.json(full, { status: 201 });
}
