import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CapacityError, claimSeat } from "@/lib/capacity";

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const items = await prisma.enrollment.findMany({
    where: { campId },
    include: { participant: true, session: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const data = await req.json();
  const { participantId, sessionId, status } = data;

  try {
    const item = await claimSeat({ campId, participantId, sessionId, status, allowHeldSeat: true });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof CapacityError) {
      return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: error.status });
    }
    throw error;
  }
}
