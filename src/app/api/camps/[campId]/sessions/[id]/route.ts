import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { effectiveCapacity } from "@/lib/capacity";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  if (!await prisma.campMember.findFirst({ where: { campId, userId: session.userId } })) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await req.json();
  const existing = await prisma.session.findFirst({ where: { id, campId }, include: { course: true } });
  if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const safeData: Record<string, unknown> = {};
  for (const key of ["status", "date", "startTime", "endTime"]) if (key in data) safeData[key] = data[key];
  if ("roomId" in data) {
    const room = data.roomId ? await prisma.room.findFirst({ where: { id: data.roomId, campId }, select: { name: true, capacity: true } }) : null;
    if (!room || room.capacity === null) return NextResponse.json({ error: "Choose a room with a capacity." }, { status: 409 });
    const capacity = existing.course ? effectiveCapacity(existing.course, room) : room.capacity;
    if (existing.course?.cap !== null && existing.course?.cap !== undefined && existing.course.cap > room.capacity) return NextResponse.json({ error: `${existing.course.name} allows ${existing.course.cap}, but ${room.name} holds ${room.capacity}.` }, { status: 409 });
    if (existing.enrolledCount > capacity) return NextResponse.json({ error: `This session has ${existing.enrolledCount} enrolled. ${room.name} only permits ${capacity}; move participants first.`, code: "capacity_reduction_blocked" }, { status: 409 });
    safeData.roomId = data.roomId;
    safeData.capacity = capacity;
  }
  const item = await prisma.session.update({ where: { id }, data: safeData });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.session.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
