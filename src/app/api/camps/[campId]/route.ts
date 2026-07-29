import { NextRequest, NextResponse } from "next/server";
import { PROGRAM_PALETTES, paletteForColors } from "@/lib/programPalettes";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getStripe } from "@/lib/billing";
import { connectReady, connectStateFromOrganization } from "@/lib/stripe-connect";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const camp = await prisma.camp.findFirst({
    where: { id: campId },
    include: {
      ageGroups: { orderBy: [{ displayOrder: "asc" }, { name: "asc" }] },
      rooms: true,
      persons: true,
      // The operations grid needs each course's sessions with their block and
      // occupancy. Extended here rather than behind a new endpoint so the grid
      // has one source of truth (dashboard spec §1.1).
      courses: {
        include: {
          courseTeachers: { include: { person: { select: { id: true, firstName: true, lastName: true, role: true } } } },
          courseAgeGroups: { select: { ageGroupId: true } },
          courseSessionTemplates: { select: { sessionTemplateId: true } },
          room: { select: { id: true, name: true, capacity: true } },
          sessions: {
            select: {
              id: true,
              sessionTemplateId: true,
              roomId: true,
              startTime: true,
              endTime: true,
              status: true,
              enrolledCount: true,
              capacity: true,
              sessionTeachers: { select: { personId: true } },
            },
          },
        },
      },
      sessionTemplates: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
  });
  if (!camp) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...camp, myRole: member.role });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "editor")) {
    return NextResponse.json({ error: "Editors and above can edit events" }, { status: 403 });
  }

  try {
    const body = await req.json();

    const billingKeys = ["billingMode", "billingStatus", "platformFeeCents", "platformFeePercentBps", "platformFeeMinCents", "platformFeeCapCents", "camperPriceCents", "annualSubscriptionCents"];
    if (billingKeys.some(key => key in body) && !hasPermission(member.role, "admin")) {
      return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
    }

    // Whitelist all known Camp fields — never spread unknown keys into Prisma
    const allowed: Record<string, unknown> = {};
    const ALLOWED_KEYS = [
      "name", "startDate", "endDate", "status", "registrationOpen",
      "billingMode", "camperPriceCents",
      "themePreset", "primaryColor", "accentColor", "fontFamily",
    ];
    for (const key of ALLOWED_KEYS) {
      if (key in body) allowed[key] = body[key];
    }

    // Coerce date strings to Date objects
    if (allowed.startDate) allowed.startDate = allowed.startDate ? new Date(allowed.startDate as string) : null;
    if (allowed.endDate)   allowed.endDate   = allowed.endDate   ? new Date(allowed.endDate   as string) : null;
    if (allowed.billingMode && !["campPays", "camperFee"].includes(String(allowed.billingMode))) delete allowed.billingMode;

    // Appearance is rendered on public registration and printable material.
    // Phase 23: colours come from the six presets only. Free hex entry is gone
    // from the UI, but the API is the actual boundary — an arbitrary colour
    // cannot guarantee the measured contrast ratios the presets exist to
    // provide, and #FFFF00 with white text is unreadable no matter which screen
    // chose it.
    if (allowed.themePreset !== undefined) {
      const preset = PROGRAM_PALETTES.find(
        (palette) => palette.id === String(allowed.themePreset).trim().toLowerCase(),
      );
      if (!preset) return NextResponse.json({ error: "Unknown theme preset" }, { status: 400 });
      allowed.themePreset = preset.id;
      // The hex columns are the rendered output of the preset, kept in step so
      // registration and print never show a colour outside the six.
      allowed.primaryColor = preset.primaryColor;
      allowed.accentColor = preset.accentColor;
    } else {
      for (const key of ["primaryColor", "accentColor"] as const) {
        if (allowed[key] === undefined) continue;
        const value = String(allowed[key]).trim().toUpperCase();
        const known = PROGRAM_PALETTES.some(
          (palette) =>
            palette.primaryColor.toUpperCase() === value ||
            palette.accentColor.toUpperCase() === value,
        );
        if (!known) {
          return NextResponse.json(
            { error: `${key} must come from a theme preset` },
            { status: 400 },
          );
        }
        allowed[key] = value;
      }
      // A colour pair implies its preset; keep the stored name truthful.
      if (allowed.primaryColor !== undefined) {
        allowed.themePreset = paletteForColors(String(allowed.primaryColor)).id;
      }
    }
    if (allowed.fontFamily !== undefined) {
      const value = String(allowed.fontFamily).trim();
      const allowedFonts = ["Inter", "Poppins", "Georgia", "Merriweather", "Courier New", "Trebuchet MS"];
      if (!allowedFonts.includes(value)) return NextResponse.json({ error: "Invalid font family" }, { status: 400 });
      allowed.fontFamily = value;
    }
    if (allowed.camperPriceCents !== undefined) allowed.camperPriceCents = Math.max(0, Number(allowed.camperPriceCents) || 0);

    if (allowed.registrationOpen === true || allowed.billingMode !== undefined || allowed.camperPriceCents !== undefined) {
      const current = await prisma.camp.findUnique({
        where: { id: campId },
        select: {
          registrationOpen: true,
          billingMode: true,
          camperPriceCents: true,
          organization: { select: { stripeConnectAccountId: true, stripeConnectDetailsSubmitted: true, stripeConnectChargesEnabled: true, stripeConnectPayoutsEnabled: true, stripeConnectCardPaymentsActive: true, stripeConnectDisabledReason: true, stripeConnectCountry: true } },
        },
      });
      if (!current) return NextResponse.json({ error: "Event not found" }, { status: 404 });
      const nextOpen = allowed.registrationOpen === undefined ? current.registrationOpen : Boolean(allowed.registrationOpen);
      const nextMode = allowed.billingMode === undefined ? current.billingMode : String(allowed.billingMode);
      const nextPrice = allowed.camperPriceCents === undefined ? current.camperPriceCents : Number(allowed.camperPriceCents);
      const connect = current.organization;
      const paidRegistrationReady = Boolean(getStripe() && connectReady(connectStateFromOrganization(connect)));
      if (nextMode === "camperFee" && nextPrice > 0 && !paidRegistrationReady && (nextOpen || allowed.billingMode === "camperFee")) {
        return NextResponse.json({ error: "Connect a verified Stripe payout account before selecting paid registration or opening it to families." }, { status: 409 });
      }
    }

    await prisma.camp.update({ where: { id: campId }, data: allowed });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Camp PATCH error:", err);
    return NextResponse.json({ error: "Failed to update camp", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "admin")) {
    return NextResponse.json({ error: "Only admins and owners can delete events" }, { status: 403 });
  }
  await prisma.camp.deleteMany({ where: { id: campId } });
  return NextResponse.json({ success: true });
}
