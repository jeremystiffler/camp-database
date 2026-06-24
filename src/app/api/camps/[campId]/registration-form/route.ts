import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

const DEFAULT_FIELDS = JSON.stringify([
  { id: "f1", type: "text",     label: "First Name",         required: true,  system: true },
  { id: "f2", type: "text",     label: "Last Name",          required: true,  system: true },
  { id: "f3", type: "date",     label: "Date of Birth",      required: true,  system: true },
  { id: "f4", type: "select",   label: "Age Group",          required: true,  system: true, source: "ageGroups" },
  { id: "f5", type: "text",     label: "Guardian Name",      required: true,  system: true },
  { id: "f6", type: "email",    label: "Guardian Email",     required: true,  system: true },
  { id: "f7", type: "tel",      label: "Guardian Phone",     required: true,  system: true },
  { id: "f8", type: "tel",      label: "Emergency Phone",    required: false, system: true },
  { id: "f9", type: "select",   label: "T-Shirt Size",       required: false, system: true, options: ["YS","YM","YL","AS","AM","AL","AXL","A2XL"] },
  { id: "f10", type: "textarea", label: "Medical / Allergies", required: false, system: true },
  { id: "f11", type: "textarea", label: "Dietary Restrictions", required: false, system: true },
  { id: "f12", type: "checkbox", label: "Photo Consent",    required: false, system: true },
]);

// GET — public (no auth) — used by the public registration page
export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const { campId } = await params;
  const camp = await prisma.camp.findUnique({
    where: { id: campId },
    select: { id: true, name: true, registrationOpen: true, registrationForm: true, ageGroups: { select: { id: true, name: true, noSchedule: false, minAge: true, maxAge: true } } },
  });
  if (!camp) return NextResponse.json({ error: "Camp not found" }, { status: 404 });

  const fields = camp.registrationForm?.fields || DEFAULT_FIELDS;
  return NextResponse.json({ campName: camp.name, registrationOpen: camp.registrationOpen, fields, ageGroups: camp.ageGroups });
}

// PUT — save form definition (auth required)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fields } = await req.json();
  if (!Array.isArray(fields)) return NextResponse.json({ error: "fields must be an array" }, { status: 400 });

  const existing = await prisma.registrationForm.findUnique({ where: { campId } });
  if (existing) {
    await prisma.registrationForm.update({ where: { campId }, data: { fields: JSON.stringify(fields) } });
  } else {
    await prisma.registrationForm.create({ data: { campId, fields: JSON.stringify(fields) } });
  }
  return NextResponse.json({ success: true });
}
