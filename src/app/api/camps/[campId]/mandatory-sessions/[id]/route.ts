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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.mandatorySession.findFirst({ where: { id, campId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = await req.json();
  const title = "title" in data ? cleanString(data.title) : existing.title;
  const ageGroupId = "ageGroupId" in data ? cleanString(data.ageGroupId) : existing.ageGroupId;
  const sessionTemplateId = "sessionTemplateId" in data ? cleanString(data.sessionTemplateId) : existing.sessionTemplateId;
  const roomId = "roomId" in data ? (cleanString(data.roomId) || undefined) : (existing.roomId || undefined);
  const leaderId = "leaderId" in data ? (cleanString(data.leaderId) || undefined) : (existing.leaderId || undefined);

  if (!title || !ageGroupId || !sessionTemplateId) {
    return NextResponse.json({ error: "Title, age group, and time slot are required" }, { status: 400 });
  }

  const [ageGroup, template, room, leader] = await Promise.all([
    prisma.ageGroup.findFirst({ where: { id: ageGroupId, campId }, select: { id: true, name: true } }),
    prisma.sessionTemplate.findFirst({ where: { id: sessionTemplateId, campId }, select: { id: true } }),
    roomId ? prisma.room.findFirst({ where: { id: roomId, campId }, select: { id: true } }) : Promise.resolve(null),
    leaderId ? prisma.person.findFirst({ where: { id: leaderId, campId }, select: { id: true } }) : Promise.resolve(null),
  ]);
  if (!ageGroup || !template) return NextResponse.json({ error: "Selected age group or time slot is not available" }, { status: 400 });
  if (roomId && !room) return NextResponse.json({ error: "Selected location is not available" }, { status: 400 });
  if (leaderId && !leader) return NextResponse.json({ error: "Selected leader is not available" }, { status: 400 });

  const conflicts = await checkSchedulingConflicts({
    campId,
    excludeMandatorySessionId: id,
    roomId,
    teacherIds: leaderId ? [leaderId] : [],
    sessionTemplateIds: [sessionTemplateId],
    ageGroupIds: [ageGroupId],
  });
  if (conflicts.length > 0) {
    return NextResponse.json({ error: "scheduling_conflict", conflicts }, { status: 409 });
  }

  try {
    const updated = await prisma.mandatorySession.update({
      where: { id },
      data: { title, ageGroupId, sessionTemplateId, roomId: roomId || null, leaderId: leaderId || null },
      include: includeShape(),
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: `${ageGroup.name} already has a mandatory session in that time slot` }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.mandatorySession.deleteMany({ where: { id, campId } });
  return NextResponse.json({ success: true });
}
