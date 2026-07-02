import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { generateCamperScanCode, normalizePickupNumber } from "@/lib/camper-identity";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function familyKey(camper: { lastName: string; guardianEmail?: string | null; guardianPhone?: string | null; guardianName?: string | null }) {
  const contact = (camper.guardianEmail || camper.guardianPhone || camper.guardianName || "").trim().toLowerCase().replace(/\D/g, "") || (camper.guardianEmail || camper.guardianName || "").trim().toLowerCase();
  return `${camper.lastName.trim().toLowerCase()}|${contact}`;
}

async function nextPickupNumber(campId: string) {
  const campers = await prisma.camper.findMany({ where: { campId, pickupNumber: { not: null } }, select: { pickupNumber: true } });
  const used = new Set(
    campers
      .map((camper) => camper.pickupNumber?.trim())
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
  if (!member || !hasPermission(member.role, "editor")) return NextResponse.json({ error: "Editors and above can manage camper codes" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const camperId = clean(body.camperId);
    const action = clean(body.action);
    if (!action) return NextResponse.json({ error: "Action is required" }, { status: 400 });

    if (action === "assign_missing_pickup_numbers") {
      const campers = await prisma.camper.findMany({ where: { campId }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
      let next = Number(body.startAt) || 101;
      const used = new Set(campers.map(c => c.pickupNumber).filter(Boolean) as string[]);
      const familyNumbers = new Map<string, string>();
      for (const c of campers) {
        if (c.pickupNumber) familyNumbers.set(familyKey(c), c.pickupNumber);
      }
      let updated = 0;
      for (const camper of campers) {
        const patch: { pickupNumber?: string; scanCode?: string; scanCodeGeneratedAt?: Date } = {};
        const key = familyKey(camper);
        if (!camper.pickupNumber) {
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
        if (!camper.scanCode) {
          patch.scanCode = generateCamperScanCode();
          patch.scanCodeGeneratedAt = new Date();
        }
        if (Object.keys(patch).length) {
          await prisma.camper.update({ where: { id: camper.id }, data: patch });
          updated += 1;
        }
      }
      const items = await prisma.camper.findMany({ where: { campId }, include: { ageGroup: true, enrollments: { include: { session: { include: { course: true, mandatorySession: true, room: true, sessionTemplate: true } } }, orderBy: { createdAt: "asc" } } }, orderBy: { lastName: "asc" } });
      return NextResponse.json({ success: true, updated, campers: items });
    }

    if (!camperId) return NextResponse.json({ error: "camperId is required" }, { status: 400 });
    const camper = await prisma.camper.findFirst({ where: { id: camperId, campId } });
    if (!camper) return NextResponse.json({ error: "Camper not found" }, { status: 404 });

    if (action === "regenerate_scan_code") {
      const updated = await prisma.camper.update({ where: { id: camper.id }, data: { scanCode: generateCamperScanCode(), scanCodeGeneratedAt: new Date() }, include: { ageGroup: true, enrollments: { include: { session: { include: { course: true, mandatorySession: true, room: true, sessionTemplate: true } } }, orderBy: { createdAt: "asc" } } } });
      return NextResponse.json({ success: true, camper: updated });
    }

    if (action === "set_pickup_number") {
      const pickupNumber = normalizePickupNumber(body.pickupNumber);
      const updated = await prisma.camper.update({ where: { id: camper.id }, data: { pickupNumber }, include: { ageGroup: true, enrollments: { include: { session: { include: { course: true, mandatorySession: true, room: true, sessionTemplate: true } } }, orderBy: { createdAt: "asc" } } } });
      return NextResponse.json({ success: true, camper: updated });
    }

    if (action === "ensure_identity") {
      const patch: { pickupNumber?: string; scanCode?: string; scanCodeGeneratedAt?: Date } = {};
      if (!camper.pickupNumber) patch.pickupNumber = await nextPickupNumber(campId);
      if (!camper.scanCode) {
        patch.scanCode = generateCamperScanCode();
        patch.scanCodeGeneratedAt = new Date();
      }
      const updated = Object.keys(patch).length
        ? await prisma.camper.update({ where: { id: camper.id }, data: patch, include: { ageGroup: true, enrollments: { include: { session: { include: { course: true, mandatorySession: true, room: true, sessionTemplate: true } } }, orderBy: { createdAt: "asc" } } } })
        : await prisma.camper.findFirst({ where: { id: camper.id, campId }, include: { ageGroup: true, enrollments: { include: { session: { include: { course: true, mandatorySession: true, room: true, sessionTemplate: true } } }, orderBy: { createdAt: "asc" } } } });
      return NextResponse.json({ success: true, camper: updated });
    }

    if (action === "mark_pickup_card_printed" || action === "mark_badge_printed") {
      const updated = await prisma.camper.update({
        where: { id: camper.id },
        data: action === "mark_pickup_card_printed" ? { pickupCardPrintedAt: new Date() } : { badgePrintedAt: new Date() },
        include: { ageGroup: true, enrollments: { include: { session: { include: { course: true, mandatorySession: true, room: true, sessionTemplate: true } } }, orderBy: { createdAt: "asc" } } },
      });
      return NextResponse.json({ success: true, camper: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Camper identity error:", err);
    return NextResponse.json({ error: "Failed to manage camper identity", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
