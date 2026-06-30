import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "editor")) return NextResponse.json({ error: "Editors and above can edit registration submissions" }, { status: 403 });

  const existing = await prisma.camper.findFirst({ where: { id, campId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Registration submission not found" }, { status: 404 });

  try {
    const data = await req.json();
    const firstName = nullableString(data.firstName);
    const lastName = nullableString(data.lastName);
    if (!firstName || !lastName) return NextResponse.json({ error: "Student first and last name are required" }, { status: 400 });

    const ageGroupId = nullableString(data.ageGroupId);
    if (ageGroupId) {
      const ageGroup = await prisma.ageGroup.findFirst({ where: { id: ageGroupId, campId }, select: { id: true } });
      if (!ageGroup) return NextResponse.json({ error: "Selected age group does not belong to this camp" }, { status: 400 });
    }

    const item = await prisma.camper.update({
      where: { id },
      data: {
        firstName,
        lastName,
        dateOfBirth: data.dateOfBirth ? new Date(String(data.dateOfBirth)) : null,
        ageGroupId,
        guardianName: nullableString(data.guardianName),
        guardianEmail: nullableString(data.guardianEmail),
        guardianPhone: nullableString(data.guardianPhone),
        emergencyPhone: nullableString(data.emergencyPhone),
        tshirtSize: nullableString(data.tshirtSize),
        photoConsent: Boolean(data.photoConsent),
        medicalNotes: nullableString(data.medicalNotes),
        dietaryNotes: nullableString(data.dietaryNotes),
      },
      include: { ageGroup: true },
    });
    return NextResponse.json(item);
  } catch (err) {
    console.error("Camper PATCH error:", err);
    return NextResponse.json({ error: "Failed to update registration submission", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "admin")) return NextResponse.json({ error: "Only admins and owners can delete registration submissions" }, { status: 403 });

  const existing = await prisma.camper.findFirst({ where: { id, campId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Registration submission not found" }, { status: 404 });

  await prisma.camper.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
