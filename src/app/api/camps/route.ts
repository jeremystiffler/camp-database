import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const camps = await prisma.camp.findMany({
    where: { members: { some: { userId: session.userId } } },
    include: { ageGroups: true, _count: { select: { campers: true, courses: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(camps);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, startDate, endDate } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") + "-" + Date.now();
  const camp = await prisma.camp.create({
    data: {
      organizationId: user.organizationId,
      name,
      slug,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      members: { create: { userId: session.userId, role: "admin" } },
    },
  });

  return NextResponse.json(camp, { status: 201 });
}
