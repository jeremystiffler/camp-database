import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

function cleanAgeGroupCreate(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  if (!name) throw new Error("Age group name is required");

  return {
    name,
    minAge: body.minAge === null || body.minAge === undefined || body.minAge === "" ? null : Number(body.minAge),
    maxAge: body.maxAge === null || body.maxAge === undefined || body.maxAge === "" ? null : Number(body.maxAge),
    color: String(body.color || "#6366f1"),
    displayOrder: Number(body.displayOrder) || 0,
    noSchedule: Boolean(body.noSchedule),
  };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await getMember(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const items = await prisma.ageGroup.findMany({ where: { campId }, orderBy: { displayOrder: "asc" } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "editor")) {
    return NextResponse.json({ error: "Editors and above can create age groups" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = cleanAgeGroupCreate(body);
    const item = await prisma.ageGroup.create({ data: { ...data, campId } });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create age group" }, { status: 400 });
  }
}
