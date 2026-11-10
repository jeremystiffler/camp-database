import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { storedCapacity } from "@/lib/capacity";
import { allowedBody, requireCampRole } from "@/lib/camp-write-guards";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const denial = await requireCampRole(session.userId, campId);
  if (denial) return denial;
  const data = await req.json();
  if (!allowedBody(data, ["status", "date", "startTime", "endTime", "roomId"])) {
    return NextResponse.json({ error: "Invalid session fields" }, { status: 400 });
  }
  if (("status" in data && (typeof data.status !== "string" || data.status.length > 64)) ||
      (["startTime", "endTime"].some((field) => field in data && data[field] !== null && (typeof data[field] !== "string" || data[field].length > 32))) ||
      ("roomId" in data && data.roomId !== null && (typeof data.roomId !== "string" || data.roomId.length > 128)) ||
      ("date" in data && data.date !== null && (typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || Number.isNaN(new Date(data.date).getTime())))) {
    return NextResponse.json({ error: "Invalid session values" }, { status: 400 });
  }
  const existing = await prisma.session.findFirst({ where: { id, campId }, include: { course: true } });
  if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const safeData: Record<string, unknown> = {};
  for (const key of ["status", "date", "startTime", "endTime"]) if (key in data) safeData[key] = data[key];
  if ("roomId" in data) {
    const room = data.roomId ? await prisma.room.findFirst({ where: { id: data.roomId, campId }, select: { name: true, capacity: true } }) : null;
    if (data.roomId && !room) return NextResponse.json({ error: "Selected room does not belong to this event." }, { status: 400 });
    safeData.roomId = data.roomId || null;
    safeData.capacity = existing.course ? storedCapacity(existing.course) : null;
  }
  const item = await prisma.session.update({ where: { id, campId }, data: safeData });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const denial = await requireCampRole(session.userId, campId);
  if (denial) return denial;
  const existing = await prisma.session.findFirst({ where: { id, campId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  await prisma.session.delete({ where: { id, campId } });
  return NextResponse.json({ success: true });
}
