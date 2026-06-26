import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await req.json();
  const allowed = {
    ...(typeof data.label === "string" ? { label: data.label } : {}),
    ...(typeof data.startTime === "string" ? { startTime: data.startTime } : {}),
    ...(typeof data.endTime === "string" ? { endTime: data.endTime } : {}),
    ...(typeof data.dayOfWeek === "number" || data.dayOfWeek === null ? { dayOfWeek: data.dayOfWeek } : {}),
    ...(typeof data.mandatory === "boolean" ? { mandatory: data.mandatory } : {}),
  };
  const updated = await prisma.sessionTemplate.updateMany({ where: { id, campId }, data: allowed });
  if (updated.count === 0) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const item = await prisma.sessionTemplate.findUnique({ where: { id } });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const deleted = await prisma.sessionTemplate.deleteMany({ where: { id, campId } });
  if (deleted.count === 0) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
