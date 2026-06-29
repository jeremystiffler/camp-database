import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function labelWhere(label: string) {
  return label ? { label } : { OR: [{ label: null }, { label: "" }] };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await req.json().catch(() => ({}));
  const mandatory = Boolean(data.mandatory);
  const label = cleanString(data.label);
  const startTime = cleanString(data.startTime);
  const endTime = cleanString(data.endTime);
  const roomId = cleanString(data.roomId);
  const providedIds = Array.isArray(data.sessionTemplateIds)
    ? data.sessionTemplateIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
    : [];

  if (!startTime || !endTime) {
    return NextResponse.json({ error: "A time block needs a start and end time before it can be locked." }, { status: 400 });
  }
  if (mandatory && !roomId) {
    return NextResponse.json({ error: "Choose a location before locking this time block to every schedule." }, { status: 400 });
  }

  const [slotsByIdentity, slotsById] = await Promise.all([
    prisma.sessionTemplate.findMany({
      where: { campId, startTime, endTime, ...labelWhere(label) },
      select: { id: true, label: true, startTime: true, endTime: true },
    }),
    providedIds.length > 0
      ? prisma.sessionTemplate.findMany({
          where: { campId, id: { in: providedIds } },
          select: { id: true, label: true, startTime: true, endTime: true },
        })
      : Promise.resolve([]),
  ]);

  const slotMap = new Map([...slotsByIdentity, ...slotsById].map(slot => [slot.id, slot]));
  const slotIds = [...slotMap.keys()];
  if (slotIds.length === 0) {
    return NextResponse.json({ error: "That time block no longer exists. Refresh the setup page and try again." }, { status: 404 });
  }

  let stage = "start";
  try {
    if (!mandatory) {
      stage = "unlock templates";
      for (const id of slotIds) {
        const existingTemplate = await prisma.sessionTemplate.findFirst({ where: { campId, id }, select: { id: true } });
        if (existingTemplate) await prisma.sessionTemplate.update({ where: { id }, data: { mandatory: false } });
      }
      stage = "delete required sessions";
      let deletedRequired = 0;
      for (const sessionTemplateId of slotIds) {
        const deleted = await prisma.mandatorySession.deleteMany({ where: { campId, sessionTemplateId } });
        deletedRequired += deleted.count;
      }
      return NextResponse.json({ success: true, mandatory: false, slotIds, deletedRequired });
    }

    stage = "load room";
    const room = await prisma.room.findFirst({ where: { id: roomId, campId }, select: { id: true } });
    stage = "load age groups";
    const ageGroups = await prisma.ageGroup.findMany({ where: { campId, noSchedule: false }, select: { id: true, name: true } });
    if (!room) {
      return NextResponse.json({ error: "Choose a valid location before locking this time block to every schedule." }, { status: 400 });
    }

    stage = "remove activity links";
    for (const sessionTemplateId of slotIds) {
      await prisma.courseSessionTemplate.deleteMany({ where: { sessionTemplateId } });
    }
    stage = "mark templates locked";
    for (const id of slotIds) {
      const existingTemplate = await prisma.sessionTemplate.findFirst({ where: { campId, id }, select: { id: true } });
      if (existingTemplate) await prisma.sessionTemplate.update({ where: { id }, data: { mandatory: true } });
    }

    stage = "load existing required sessions";
    const existingRequiredByKey = new Map(
      (await prisma.mandatorySession.findMany({
        where: { campId, sessionTemplateId: { in: slotIds } },
        select: { id: true, ageGroupId: true, sessionTemplateId: true },
      })).map(ms => [`${ms.ageGroupId}:${ms.sessionTemplateId}`, ms])
    );

    stage = "save required sessions";
    const desiredKeys = new Set<string>();
    for (const sessionTemplateId of slotIds) {
      for (const ageGroup of ageGroups) {
        const key = `${ageGroup.id}:${sessionTemplateId}`;
        desiredKeys.add(key);
        const existing = existingRequiredByKey.get(key);
        if (existing) {
          await prisma.mandatorySession.update({
            where: { id: existing.id },
            data: { title: label || "All Schedule Lock", roomId },
          });
        } else {
          await prisma.mandatorySession.create({
            data: { campId, title: label || "All Schedule Lock", ageGroupId: ageGroup.id, sessionTemplateId, roomId },
          });
        }
      }
    }

    stage = "remove stale required sessions";
    const staleIds = [...existingRequiredByKey.entries()]
      .filter(([key]) => !desiredKeys.has(key))
      .map(([, ms]) => ms.id);
    for (const id of staleIds) {
      await prisma.mandatorySession.deleteMany({ where: { campId, id } });
    }

    return NextResponse.json({
      success: true,
      mandatory: true,
      slotIds,
      ageGroupCount: ageGroups.length,
      requiredCount: desiredKeys.size,
      removedStaleRequired: staleIds.length,
    });
  } catch (error) {
    console.error("All Schedule Lock save failed", { campId, stage, error });
    return NextResponse.json({ error: `Could not save the All Schedule Lock while trying to ${stage}.` }, { status: 500 });
  }
}
