import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { capacityForCourse } from "@/lib/capacity";
import { allowedBody, requireCampRole } from "@/lib/camp-write-guards";

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const items = await prisma.session.findMany({
    where: { campId },
    include: {
      course: {
        include: {
          ageGroup: true,
          courseAgeGroups: { include: { ageGroup: true } },
          courseTeachers: { include: { person: true } },
        },
      },
      mandatorySession: true,
      room: true,
      sessionTemplate: true,
      sessionTeachers: { include: { person: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const denied = await requireCampRole(session.userId, campId);
  if (denied) return denied;
  const data: unknown = await req.json();
  if (!allowedBody(data, ["courseId", "sessionTemplateId", "mandatorySessionId", "roomId", "date", "startTime", "endTime", "status"])) {
    return NextResponse.json({ error: "Invalid session fields" }, { status: 400 });
  }
  for (const field of ["courseId", "sessionTemplateId", "mandatorySessionId", "roomId", "startTime", "endTime", "status"] as const) {
    if (data[field] !== undefined && data[field] !== null && (typeof data[field] !== "string" || !(data[field] as string).length || (data[field] as string).length > 128)) {
      return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
    }
  }
  const date = data.date === undefined || data.date === null ? null : typeof data.date === "string" ? new Date(data.date) : new Date(NaN);
  if (date && Number.isNaN(date.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  if (data.courseId && !await prisma.course.findFirst({ where: { id: data.courseId as string, campId }, select: { id: true } })) return NextResponse.json({ error: "Invalid course" }, { status: 400 });
  if (data.sessionTemplateId && !await prisma.sessionTemplate.findFirst({ where: { id: data.sessionTemplateId as string, campId }, select: { id: true } })) return NextResponse.json({ error: "Invalid time block" }, { status: 400 });
  if (data.mandatorySessionId && !await prisma.mandatorySession.findFirst({ where: { id: data.mandatorySessionId as string, campId }, select: { id: true } })) return NextResponse.json({ error: "Invalid required session" }, { status: 400 });
  if (data.roomId && !await prisma.room.findFirst({ where: { id: data.roomId as string, campId }, select: { id: true } })) return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  if (data.courseId && data.mandatorySessionId) return NextResponse.json({ error: "An activity cannot be a required session" }, { status: 400 });
  if (data?.courseId && !data?.sessionTemplateId) {
    return NextResponse.json({ error: "Activity sessions must be tied to a schedule template." }, { status: 400 });
  }
  if (data?.courseId && data?.sessionTemplateId) {
    const lockedTemplate = await prisma.sessionTemplate.findFirst({
      where: { id: data.sessionTemplateId, campId, mandatory: true },
      select: { label: true },
    });
    if (lockedTemplate) {
      return NextResponse.json({ error: `${lockedTemplate.label || "This time block"} is locked to everyone’s schedule and cannot be assigned to an activity.` }, { status: 409 });
    }
  }
  if (data?.courseId && data?.startTime && data?.endTime) {
    const lockedByTime = await prisma.sessionTemplate.findFirst({
      where: { campId, startTime: data.startTime, endTime: data.endTime, mandatory: true },
      select: { label: true },
    });
    if (lockedByTime) {
      return NextResponse.json({ error: `${lockedByTime.label || "This time block"} is locked to everyone’s schedule and cannot be assigned to an activity.` }, { status: 409 });
    }
  }
  let capacity: number | null = null;
  if (data?.courseId) {
    capacity = await capacityForCourse(data.courseId as string);
  }
  const item = await prisma.session.create({ data: {
    campId, courseId: (data.courseId as string | null) || null,
    sessionTemplateId: (data.sessionTemplateId as string | null) || null,
    mandatorySessionId: (data.mandatorySessionId as string | null) || null,
    roomId: (data.roomId as string | null) || null,
    date, startTime: (data.startTime as string | null) || null,
    endTime: (data.endTime as string | null) || null,
    status: (data.status as string | null) || "scheduled", capacity,
  } });
  return NextResponse.json(item, { status: 201 });
}
