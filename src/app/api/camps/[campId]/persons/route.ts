import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

function normalizeAgeGroupIds(value: unknown) {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
}

const VALID_ROLES = new Set(["teacher", "assistant", "director", "staff"]);

function normalizePersonPayload(data: Record<string, unknown>) {
  const firstName = typeof data.firstName === "string" ? data.firstName.trim() : "";
  const lastName = typeof data.lastName === "string" ? data.lastName.trim() : "";
  const role = typeof data.role === "string" && VALID_ROLES.has(data.role) ? data.role : "teacher";
  if (!firstName || !lastName) return { error: "First name and last name are required" } as const;
  return {
    person: {
      firstName,
      lastName,
      role,
      email: typeof data.email === "string" && data.email.trim() ? data.email.trim() : null,
      phone: typeof data.phone === "string" && data.phone.trim() ? data.phone.trim() : null,
      bio: typeof data.bio === "string" && data.bio.trim() ? data.bio.trim() : null,
    },
  } as const;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const items = await prisma.person.findMany({
    where: { campId },
    orderBy: { lastName: "asc" },
    include: { personAgeGroups: { include: { ageGroup: true } } },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const data = await req.json();
    const { ageGroupIds: rawAgeGroupIds } = data;
    const normalized = normalizePersonPayload(data);
    if ("error" in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 });
    const ageGroupIds = normalizeAgeGroupIds(rawAgeGroupIds);

    const validAgeGroups = ageGroupIds.length
      ? await prisma.ageGroup.findMany({ where: { campId, id: { in: ageGroupIds } }, select: { id: true } })
      : [];

    const item = await prisma.person.create({
      data: {
        ...normalized.person,
        campId,
        personAgeGroups: {
          create: validAgeGroups.map((ageGroup) => ({ ageGroupId: ageGroup.id })),
        },
      },
      include: { personAgeGroups: { include: { ageGroup: true } } },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("Person POST error:", err);
    return NextResponse.json({ error: "Failed to save teacher", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
