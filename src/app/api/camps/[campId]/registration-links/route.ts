import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { allowedBody, requireCampRole } from "@/lib/camp-write-guards";

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const items = await prisma.registrationLink.findMany({ where: { campId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const denied = await requireCampRole(session.userId, campId);
  if (denied) return denied;
  const data: unknown = await req.json();
  if (!allowedBody(data, ["parentEmail", "expiresAt", "maxStudents"])) return NextResponse.json({ error: "Invalid registration link fields" }, { status: 400 });
  if (data.parentEmail !== undefined && data.parentEmail !== null && (typeof data.parentEmail !== "string" || data.parentEmail.length > 320)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  const expiresAt = data.expiresAt === undefined || data.expiresAt === null ? null : typeof data.expiresAt === "string" ? new Date(data.expiresAt) : new Date(NaN);
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return NextResponse.json({ error: "Invalid expiration" }, { status: 400 });
  const maxStudents = data.maxStudents === undefined ? 1 : data.maxStudents;
  if (typeof maxStudents !== "number" || !Number.isInteger(maxStudents) || maxStudents < 1 || maxStudents > 10000) return NextResponse.json({ error: "Invalid participant limit" }, { status: 400 });
  const item = await prisma.registrationLink.create({ data: {
    campId, token: randomBytes(32).toString("base64url"),
    parentEmail: typeof data.parentEmail === "string" ? data.parentEmail.trim().toLowerCase() || null : null,
    expiresAt, maxStudents,
  } });
  return NextResponse.json(item, { status: 201 });
}
