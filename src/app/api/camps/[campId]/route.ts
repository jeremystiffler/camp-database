import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const camp = await prisma.camp.findFirst({
    where: { id: campId, members: { some: { userId: session.userId } } },
    include: { ageGroups: true, rooms: true, persons: true, courses: true },
  });
  if (!camp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(camp);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const data = await req.json();
  const camp = await prisma.camp.updateMany({
    where: { id: campId, members: { some: { userId: session.userId } } },
    data,
  });
  return NextResponse.json(camp);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  await prisma.camp.deleteMany({
    where: { id: campId, members: { some: { userId: session.userId } } },
  });
  return NextResponse.json({ success: true });
}
