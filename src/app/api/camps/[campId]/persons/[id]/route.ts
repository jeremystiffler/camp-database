import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

function normalizeAgeGroupIds(value: unknown) {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.person.findFirst({ where: { id, campId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

  const data = await req.json();
  const { ageGroupIds: rawAgeGroupIds, ...personData } = data;
  const ageGroupIds = normalizeAgeGroupIds(rawAgeGroupIds);

  const validAgeGroups = ageGroupIds.length
    ? await prisma.ageGroup.findMany({ where: { campId, id: { in: ageGroupIds } }, select: { id: true } })
    : [];

  const item = await prisma.person.update({
    where: { id },
    data: {
      ...personData,
      ...(rawAgeGroupIds !== undefined ? {
        personAgeGroups: {
          deleteMany: {},
          create: validAgeGroups.map((ageGroup) => ({ ageGroupId: ageGroup.id })),
        },
      } : {}),
    },
    include: { personAgeGroups: { include: { ageGroup: true } } },
  });
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.person.findFirst({ where: { id, campId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

  await prisma.person.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
