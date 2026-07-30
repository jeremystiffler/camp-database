import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { generateParticipantScanCode, normalizePickupNumber } from "@/lib/participant-identity";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function familyKey(participant: { lastName: string; guardianEmail?: string | null; guardianPhone?: string | null; guardianName?: string | null }) {
  const contact = (participant.guardianEmail || participant.guardianPhone || participant.guardianName || "").trim().toLowerCase().replace(/\D/g, "") || (participant.guardianEmail || participant.guardianName || "").trim().toLowerCase();
  return `${participant.lastName.trim().toLowerCase()}|${contact}`;
}

async function nextPickupNumber(campId: string) {
  const participants = await prisma.participant.findMany({ where: { campId, pickupNumber: { not: null } }, select: { pickupNumber: true } });
  const used = new Set(
    participants
      .map((participant) => participant.pickupNumber?.trim())
      .filter((value): value is string => Boolean(value))
  );
  let next = 101;
  while (used.has(String(next))) next += 1;
  return String(next);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (!hasPermission(member.role, "editor")) return NextResponse.json({ error: "Editors and above can manage participant codes" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const participantId = clean(body.participantId);
    const action = clean(body.action);
    if (!action) return NextResponse.json({ error: "Action is required" }, { status: 400 });

    if (action === "assign_missing_pickup_numbers") {
      const participants = await prisma.participant.findMany({ where: { campId }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
      let next = Number(body.startAt) || 101;
      const used = new Set(participants.map(c => c.pickupNumber).filter(Boolean) as string[]);
      const familyNumbers = new Map<string, string>();
      for (const c of participants) {
        if (c.pickupNumber) familyNumbers.set(familyKey(c), c.pickupNumber);
      }
      let updated = 0;
      for (const participant of participants) {
        const patch: { pickupNumber?: string; scanCode?: string; scanCodeGeneratedAt?: Date } = {};
        const key = familyKey(participant);
        if (!participant.pickupNumber) {
          let pickupNumber = familyNumbers.get(key);
          if (!pickupNumber) {
            while (used.has(String(next))) next += 1;
            pickupNumber = String(next);
            used.add(pickupNumber);
            familyNumbers.set(key, pickupNumber);
            next += 1;
          }
          patch.pickupNumber = pickupNumber;
        }
        if (!participant.scanCode) {
          patch.scanCode = generateParticipantScanCode();
          patch.scanCodeGeneratedAt = new Date();
        }
        if (Object.keys(patch).length) {
          await prisma.participant.update({ where: { id: participant.id }, data: patch });
          updated += 1;
        }
      }
      const items = await prisma.participant.findMany({ where: { campId }, include: { ageGroup: true, enrollments: { include: { session: { include: { course: true, mandatorySession: true, room: true, sessionTemplate: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { lastName: "asc" } });
      return NextResponse.json({ success: true, updated, participants: items });
    }

    if (!participantId) return NextResponse.json({ error: "participantId is required" }, { status: 400 });
    const participant = await prisma.participant.findFirst({ where: { id: participantId, campId } });
    if (!participant) return NextResponse.json({ error: "Participant not found" }, { status: 404 });

    if (action === "regenerate_scan_code") {
      const updated = await prisma.participant.update({ where: { id: participant.id }, data: { scanCode: generateParticipantScanCode(), scanCodeGeneratedAt: new Date() }, include: { ageGroup: true, enrollments: { include: { session: { include: { course: true, mandatorySession: true, room: true, sessionTemplate: true } } }, orderBy: { createdAt: "asc" } } } });
      return NextResponse.json({ success: true, participant: updated });
    }

    if (action === "set_pickup_number") {
      const pickupNumber = normalizePickupNumber(body.pickupNumber);
      const updated = await prisma.participant.update({ where: { id: participant.id }, data: { pickupNumber }, include: { ageGroup: true, enrollments: { include: { session: { include: { course: true, mandatorySession: true, room: true, sessionTemplate: true } } }, orderBy: { createdAt: "asc" } } } });
      return NextResponse.json({ success: true, participant: updated });
    }

    if (action === "ensure_identity") {
      const patch: { pickupNumber?: string; scanCode?: string; scanCodeGeneratedAt?: Date } = {};
      if (!participant.pickupNumber) patch.pickupNumber = await nextPickupNumber(campId);
      if (!participant.scanCode) {
        patch.scanCode = generateParticipantScanCode();
        patch.scanCodeGeneratedAt = new Date();
      }
      const updated = Object.keys(patch).length
        ? await prisma.participant.update({ where: { id: participant.id }, data: patch, include: { ageGroup: true, enrollments: { include: { session: { include: { course: true, mandatorySession: true, room: true, sessionTemplate: true } } }, orderBy: { createdAt: "asc" } } } })
        : await prisma.participant.findFirst({ where: { id: participant.id, campId }, include: { ageGroup: true, enrollments: { include: { session: { include: { course: true, mandatorySession: true, room: true, sessionTemplate: true } } }, orderBy: { createdAt: "asc" } } } });
      return NextResponse.json({ success: true, participant: updated });
    }

    if (action === "mark_pickup_card_printed" || action === "mark_badge_printed") {
      const updated = await prisma.participant.update({
        where: { id: participant.id },
        data: action === "mark_pickup_card_printed" ? { pickupCardPrintedAt: new Date() } : { badgePrintedAt: new Date() },
        include: { ageGroup: true, enrollments: { include: { session: { include: { course: true, mandatorySession: true, room: true, sessionTemplate: true } } }, orderBy: { createdAt: "asc" } } },
      });
      return NextResponse.json({ success: true, participant: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Participant identity error:", err);
    return NextResponse.json({ error: "Failed to manage participant identity", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
