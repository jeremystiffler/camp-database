import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Map between day name strings (used in UI) and dayOfWeek ints (stored in DB)
const DAY_NAME_TO_INT: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};
const DAY_INT_TO_NAME: Record<number, string> = {
  0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday",
  4: "Thursday", 5: "Friday", 6: "Saturday",
};

function toSlotShape(s: { id: string; campId: string; dayOfWeek: number | null; startTime: string; endTime: string; label: string | null; mandatory: boolean; createdAt: Date }) {
  return { ...s, day: s.dayOfWeek !== null ? DAY_INT_TO_NAME[s.dayOfWeek] ?? null : null };
}

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const items = await prisma.sessionTemplate.findMany({ where: { campId }, orderBy: { startTime: "asc" } });
  return NextResponse.json(items.map(toSlotShape));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { day, label, startTime, endTime, mandatory } = await req.json();
  const dayOfWeek = day !== undefined ? (DAY_NAME_TO_INT[String(day).toLowerCase()] ?? null) : null;
  const item = await prisma.sessionTemplate.create({ data: { campId, label, startTime, endTime, dayOfWeek, mandatory: Boolean(mandatory) } });
  return NextResponse.json(toSlotShape(item), { status: 201 });
}
