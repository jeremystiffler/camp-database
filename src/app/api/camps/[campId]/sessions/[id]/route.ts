import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { storedCapacity } from "@/lib/capacity";

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
    if (data.roomId && !room) return NextResponse.json({ error: "Selected room does not belong to this event." }, { status: 400 });
    // Room is a location, not a limit. Moving a class to a smaller room (or to no
    // room at all) never blocks or reduces enrollment; the class limit governs.
    safeData.roomId = data.roomId || null;
    safeData.capacity = existing.course ? storedCapacity(existing.course) : null;
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
