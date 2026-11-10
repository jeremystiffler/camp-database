import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { allowedBody, requireCampRole } from "@/lib/camp-write-guards";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const denied = await requireCampRole(session.userId, campId);
  if (denied) return denied;
  const existing = await prisma.registrationLink.findFirst({ where: { id, campId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Registration link not found" }, { status: 404 });
  const body: unknown = await req.json();
  if (!allowedBody(body, ["parentEmail", "expiresAt", "maxStudents"]) || !Object.keys(body).length) {
    return NextResponse.json({ error: "Invalid registration link fields" }, { status: 400 });
  }
  const data: { parentEmail?: string | null; expiresAt?: Date | null; maxStudents?: number } = {};
  if ("parentEmail" in body) {
    if (body.parentEmail !== null && (typeof body.parentEmail !== "string" || body.parentEmail.length > 320)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    data.parentEmail = typeof body.parentEmail === "string" ? body.parentEmail.trim().toLowerCase() || null : null;
  }
  if ("expiresAt" in body) {
    const date = typeof body.expiresAt === "string" ? new Date(body.expiresAt) : null;
    if (body.expiresAt !== null && (!date || Number.isNaN(date.getTime()))) return NextResponse.json({ error: "Invalid expiration" }, { status: 400 });
    data.expiresAt = date;
  }
  if ("maxStudents" in body) {
    if (!Number.isInteger(body.maxStudents) || (body.maxStudents as number) < 1 || (body.maxStudents as number) > 10000) return NextResponse.json({ error: "Invalid participant limit" }, { status: 400 });
    data.maxStudents = body.maxStudents as number;
  }
  // Compound predicate prevents a stale ID from being written under another event.
  const item = await prisma.registrationLink.update({ where: { id, campId }, data });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const denied = await requireCampRole(session.userId, campId);
  if (denied) return denied;
  const existing = await prisma.registrationLink.findFirst({ where: { id, campId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Registration link not found" }, { status: 404 });
  await prisma.registrationLink.delete({ where: { id, campId } });
  return NextResponse.json({ success: true });
}
