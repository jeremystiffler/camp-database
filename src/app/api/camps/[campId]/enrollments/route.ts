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
  const items = await prisma.enrollment.findMany({
    where: { campId },
    include: { camper: true, session: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await req.json();
  const { camperId, sessionId, status } = data;

  // Check session cap
  const sess = await prisma.session.findUnique({ where: { id: sessionId }, include: { course: true } });
  if (sess?.course?.cap) {
    if (sess.enrolledCount >= sess.course.cap) {
      return NextResponse.json({ error: "Session is full" }, { status: 409 });
    }
  }

  // Prisma HTTP mode does not support transactions. Keep this as two
  // single-statement writes instead of prisma.$transaction().
  const item = await prisma.enrollment.create({ data: { campId, camperId, sessionId, status: status || "enrolled" } });
  await prisma.session.update({ where: { id: sessionId }, data: { enrolledCount: { increment: 1 } } });
  return NextResponse.json(item, { status: 201 });
}
