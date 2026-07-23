import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkSchedulingConflicts } from "@/lib/scheduling-conflicts";

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function includeShape() {
  return {
    ageGroup: true,
    room: true,
    leader: true,
    sessionTemplate: true,
  };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const items = await prisma.mandatorySession.findMany({
    where: { campId },
    include: includeShape(),
    orderBy: [{ sessionTemplate: { startTime: "asc" } }, { title: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await req.json();
  const title = cleanString(data.title);
  const ageGroupId = cleanString(data.ageGroupId);
  const sessionTemplateId = cleanString(data.sessionTemplateId);
  const roomId = cleanString(data.roomId) || undefined;
  const leaderId = cleanString(data.leaderId) || undefined;

  if (!title || !ageGroupId || !sessionTemplateId) {
    return NextResponse.json({ error: "Title, age group, and time block are required" }, { status: 400 });
  }

  const [ageGroup, template, room, leader] = await Promise.all([
    prisma.ageGroup.findFirst({ where: { id: ageGroupId, campId }, select: { id: true, name: true } }),
    prisma.sessionTemplate.findFirst({ where: { id: sessionTemplateId, campId }, select: { id: true } }),
    roomId ? prisma.room.findFirst({ where: { id: roomId, campId }, select: { id: true } }) : Promise.resolve(null),
    leaderId ? prisma.person.findFirst({ where: { id: leaderId, campId }, select: { id: true } }) : Promise.resolve(null),
  ]);

  if (!ageGroup || !template) return NextResponse.json({ error: "Selected age group or time block is not available" }, { status: 400 });
  if (roomId && !room) return NextResponse.json({ error: "Selected location is not available" }, { status: 400 });
  if (leaderId && !leader) return NextResponse.json({ error: "Selected leader is not available" }, { status: 400 });

  const conflicts = (await checkSchedulingConflicts({
    campId,
    roomId,
    teacherIds: leaderId ? [leaderId] : [],
    sessionTemplateIds: [sessionTemplateId],
    ageGroupIds: [ageGroupId],
  })).filter(conflict => !(conflict.type === "room" && conflict.activityName === title));
  if (conflicts.length > 0) {
    return NextResponse.json({ error: "scheduling_conflict", conflicts }, { status: 409 });
  }

  try {
    const item = await prisma.mandatorySession.create({
      data: { campId, title, ageGroupId, sessionTemplateId, roomId, leaderId },
      include: includeShape(),
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: `${ageGroup.name} already has a mandatory session in that time block` }, { status: 409 });
    }
    throw error;
  }
}
