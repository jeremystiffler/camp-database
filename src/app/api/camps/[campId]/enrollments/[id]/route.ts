import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { releaseEnrollment } from "@/lib/capacity";
import { requireCampRole } from "@/lib/camp-write-guards";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const denied = await requireCampRole(session.userId, campId);
  if (denied) return denied;
  const existing = await prisma.enrollment.findFirst({ where: { id, campId } });
  if (!existing) return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  const data: unknown = await req.json();
  if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).some(key => key !== "status") ||
    !["enrolled", "waitlisted", "cancelled"].includes((data as Record<string, unknown>).status as string)) {
    return NextResponse.json({ error: "Invalid enrollment status" }, { status: 400 });
  }
  // Moving an enrollment must use DELETE + POST so the destination seat is
  // claimed atomically. This endpoint may only change non-capacity metadata.
  const item = await prisma.enrollment.update({ where: { id, campId }, data: { status: (data as { status: string }).status } });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const denied = await requireCampRole(session.userId, campId);
  if (denied) return denied;
  const released = await releaseEnrollment(id, campId);
  if (!released) return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
