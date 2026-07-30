import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_PROGRAM_PALETTE, PROGRAM_PALETTES } from "@/lib/programPalettes";
import { parseProgramDate } from "@/lib/programDates";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const camps = await prisma.camp.findMany({
    where: { members: { some: { userId: session.userId } } },
    include: {
      ageGroups: true,
      members: { where: { userId: session.userId }, select: { role: true } },
      _count: { select: { participants: true, courses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(camps.map((camp) => {
    const { members, ...rest } = camp;
    return { ...rest, myRole: members[0]?.role || "viewer" };
  }));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, startDate, endDate, primaryColor, accentColor, themePreset } = await req.json();
  // Preset name first; fall back to matching the hex pair for older clients.
  const palette =
    PROGRAM_PALETTES.find((option) => option.id === String(themePreset || "").toLowerCase()) ||
    PROGRAM_PALETTES.find((option) => option.primaryColor === primaryColor && option.accentColor === accentColor) ||
    DEFAULT_PROGRAM_PALETTE;
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const parsedStartDate = parseProgramDate(startDate);
  const parsedEndDate = parseProgramDate(endDate);
  if ((startDate && !parsedStartDate) || (endDate && !parsedEndDate)) {
    return NextResponse.json({ error: "Dates must use YYYY-MM-DD format" }, { status: 400 });
  }
  if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
    return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") + "-" + Date.now();
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const camp = await prisma.camp.create({
    data: {
      organizationId: user.organizationId,
      name,
      slug,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      themePreset: palette.id,
      primaryColor: palette.primaryColor,
      accentColor: palette.accentColor,
      billingStatus: "trial",
      trialEndsAt,
    },
  });

  // Separate create to avoid implicit transaction (not supported in HTTP mode)
  // The creator should be the camp owner so the UI and permissions match first-run expectations.
  await prisma.campMember.create({
    data: { campId: camp.id, userId: session.userId, role: "owner" },
  });

  return NextResponse.json(camp, { status: 201 });
}
