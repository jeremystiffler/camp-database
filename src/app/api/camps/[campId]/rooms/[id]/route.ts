import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { syncCourseSessionCapacities } from "@/lib/capacity";

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
  if (!member) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (!hasPermission(member.role, "editor")) {
    return NextResponse.json({ error: "Editors and above can edit rooms" }, { status: 403 });
  }

  try {
    const room = await prisma.room.findFirst({ where: { id, campId } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const body = await req.json();
    const data = cleanRoomPatch(body);
    if ("capacity" in data) {
      const nextCapacity = data.capacity;
      const courses = await prisma.course.findMany({
        where: { campId, roomId: id },
        select: { id: true, name: true, cap: true, sessions: { select: { id: true, enrolledCount: true, sessionTemplateId: true } } },
      });
      if (nextCapacity === null && courses.length) {
        return NextResponse.json({ error: `${room.name} is assigned to ${courses.length} class${courses.length === 1 ? "" : "es"}. Give it a capacity before saving.` }, { status: 409 });
      }
      if (nextCapacity !== null && nextCapacity !== undefined) {
        const capConflict = courses.find(course => course.cap !== null && course.cap > nextCapacity);
        if (capConflict) return NextResponse.json({ error: `${capConflict.name} allows ${capConflict.cap}, but ${room.name} would hold ${nextCapacity}. Lower the class cap or choose a different room first.` }, { status: 409 });
        const affected = courses.flatMap(course => course.sessions.filter(item => item.enrolledCount > nextCapacity).map(item => ({ courseId: course.id, courseName: course.name, ...item })));
        if (affected.length) {
          const worst = affected.reduce((a, b) => a.enrolledCount > b.enrolledCount ? a : b);
          return NextResponse.json({
            error: `${worst.courseName} currently holds ${worst.enrolledCount}. Lowering ${room.name} to ${nextCapacity} would leave ${worst.enrolledCount - nextCapacity} participant${worst.enrolledCount - nextCapacity === 1 ? "" : "s"} without a place. Move participants or choose another room first.`,
            code: "capacity_reduction_blocked",
            affectedSessions: affected,
          }, { status: 409 });
        }
      }
    }
    const item = await prisma.room.update({ where: { id }, data });
    const courseIds = await prisma.course.findMany({ where: { campId, roomId: id }, select: { id: true } });
    for (const course of courseIds) await syncCourseSessionCapacities(course.id);
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
  if (!member) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (!hasPermission(member.role, "editor")) {
    return NextResponse.json({ error: "Editors and above can delete rooms" }, { status: 403 });
  }

  const room = await prisma.room.findFirst({ where: { id, campId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  await prisma.room.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
