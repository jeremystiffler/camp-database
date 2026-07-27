import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { releaseEnrollment } from "@/lib/capacity";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const data = await req.json();
  const existing = await prisma.enrollment.findFirst({ where: { id, campId } });
  if (!existing) return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  // Moving an enrollment must use DELETE + POST so the destination seat is
  // claimed atomically. This endpoint may only change non-capacity metadata.
  const item = await prisma.enrollment.update({ where: { id }, data: { status: typeof data.status === "string" ? data.status : existing.status } });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const released = await releaseEnrollment(id, campId);
  if (!released) return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
