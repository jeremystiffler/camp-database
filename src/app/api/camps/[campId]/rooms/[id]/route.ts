import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

function cleanRoomPatch(body: Record<string, unknown>) {
  const data: { name?: string; capacity?: number | null; description?: string | null } = {};

  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name) throw new Error("Room name is required");
    data.name = name;
  }
  if ("capacity" in body) {
    const capacity = body.capacity === null || body.capacity === undefined || body.capacity === "" ? null : Number(body.capacity);
    data.capacity = capacity && capacity > 0 ? capacity : null;
  }
  if ("description" in body) {
    const description = String(body.description ?? "").trim();
    data.description = description || null;
  }

  return data;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "editor")) {
    return NextResponse.json({ error: "Editors and above can edit rooms" }, { status: 403 });
  }

  try {
    const room = await prisma.room.findFirst({ where: { id, campId } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const body = await req.json();
    const data = cleanRoomPatch(body);
    const item = await prisma.room.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update room" }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "editor")) {
    return NextResponse.json({ error: "Editors and above can delete rooms" }, { status: 403 });
  }

  const room = await prisma.room.findFirst({ where: { id, campId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  await prisma.room.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
