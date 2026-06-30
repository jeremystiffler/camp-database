import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

function cleanAgeGroupPatch(body: Record<string, unknown>) {
  const data: {
    name?: string;
    minAge?: number | null;
    maxAge?: number | null;
    displayOrder?: number;
    color?: string;
    noSchedule?: boolean;
  } = {};

  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name) throw new Error("Age group name is required");
    data.name = name;
  }
  if ("minAge" in body) data.minAge = body.minAge === null || body.minAge === undefined || body.minAge === "" ? null : Number(body.minAge);
  if ("maxAge" in body) data.maxAge = body.maxAge === null || body.maxAge === undefined || body.maxAge === "" ? null : Number(body.maxAge);
  if ("displayOrder" in body) data.displayOrder = Number(body.displayOrder) || 0;
  if ("color" in body) data.color = String(body.color || "#6366f1");
  if ("noSchedule" in body) data.noSchedule = Boolean(body.noSchedule);

  return data;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "editor")) {
    return NextResponse.json({ error: "Editors and above can edit age groups" }, { status: 403 });
  }

  try {
    const ageGroup = await prisma.ageGroup.findFirst({ where: { id, campId } });
    if (!ageGroup) return NextResponse.json({ error: "Age group not found" }, { status: 404 });

    const body = await req.json();
    const data = cleanAgeGroupPatch(body);
    const item = await prisma.ageGroup.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update age group" }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "editor")) {
    return NextResponse.json({ error: "Editors and above can delete age groups" }, { status: 403 });
  }

  const ageGroup = await prisma.ageGroup.findFirst({ where: { id, campId } });
  if (!ageGroup) return NextResponse.json({ error: "Age group not found" }, { status: 404 });

  await prisma.ageGroup.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
