import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

function dayStart(value?: string | null) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const camperInclude = {
  ageGroup: true,
  enrollments: {
    include: { session: { include: { course: true, mandatorySession: true, room: true, sessionTemplate: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

async function attendanceForCampDate(campId: string, campDate: Date) {
  const [campers, attendances] = await Promise.all([
    prisma.camper.findMany({ where: { campId }, include: camperInclude, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.camperAttendance.findMany({ where: { campId, campDate } }),
  ]);
  const attendanceByCamper = new Map(attendances.map((attendance) => [attendance.camperId, attendance]));
  return campers.map((camper) => ({
    ...camper,
    attendance: attendanceByCamper.get(camper.id) || null,
  }));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const campDate = dayStart(req.nextUrl.searchParams.get("date"));
  if (!campDate) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const campers = await attendanceForCampDate(campId, campDate);
  return NextResponse.json({ campDate: campDate.toISOString().slice(0, 10), campers });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "editor")) return NextResponse.json({ error: "Editors and above can update attendance" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const camperId = clean(body.camperId);
    const action = clean(body.action);
    const campDate = dayStart(clean(body.date));
    if (!camperId || !action || !campDate) return NextResponse.json({ error: "camperId, action, and date are required" }, { status: 400 });

    const camper = await prisma.camper.findFirst({ where: { id: camperId, campId }, select: { id: true, firstName: true, lastName: true } });
    if (!camper) return NextResponse.json({ error: "Camper not found" }, { status: 404 });

    const now = new Date();
    const note = clean(body.note);
    const pickupPersonName = clean(body.pickupPersonName);
    const pickupRelationship = clean(body.pickupRelationship);
    const pickupCodeVerified = Boolean(body.pickupCodeVerified);

    let data: Record<string, unknown> = {};
    let eventType = action;

    if (action === "check_in") {
      data = { status: "checked_in", checkedInAt: now, checkedInByUserId: session.userId, notes: note, walkUp: Boolean(body.walkUp) };
    } else if (action === "check_out") {
      data = { status: "checked_out", checkedOutAt: now, checkedOutByUserId: session.userId, pickupPersonName, pickupRelationship, pickupCodeVerified, notes: note };
    } else if (action === "no_show") {
      data = { status: "no_show", notes: note };
    } else if (action === "reset") {
      data = { status: "not_arrived", checkedInAt: null, checkedInByUserId: null, checkedOutAt: null, checkedOutByUserId: null, pickupPersonName: null, pickupRelationship: null, pickupCodeVerified: false, notes: note };
    } else if (action === "badge_printed") {
      data = { badgePrintedAt: now, notes: note };
    } else if (action === "shirt_picked_up") {
      data = { shirtPickedUpAt: now, notes: note };
    } else if (action === "mark_paid" || action === "mark_comped") {
      await prisma.camper.update({ where: { id: camperId }, data: { paymentStatus: action === "mark_paid" ? "paid" : "comped" } });
      data = { notes: note };
      eventType = "payment_collected";
    } else {
      return NextResponse.json({ error: "Unknown attendance action" }, { status: 400 });
    }

    await prisma.camperAttendance.upsert({
      where: { campId_camperId_campDate: { campId, camperId, campDate } },
      create: { campId, camperId, campDate, ...data },
      update: data,
    });
    await prisma.checkInEvent.create({ data: { campId, camperId, type: eventType, note, pickupPersonName, createdByUserId: session.userId } });

    const campers = await attendanceForCampDate(campId, campDate);
    const updated = campers.find((item) => item.id === camperId);
    return NextResponse.json({ success: true, camper: updated });
  } catch (err) {
    console.error("Attendance update error:", err);
    return NextResponse.json({ error: "Failed to update attendance", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
