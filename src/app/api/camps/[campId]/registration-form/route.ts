import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

const DEFAULT_FIELDS = JSON.stringify([
  { id: "section_parent", type: "heading",  label: "Parent / Guardian Info", required: false },
  { id: "f5", type: "text",     label: "Guardian Name",      required: true,  system: true },
  { id: "f6", type: "email",    label: "Guardian Email",     required: true,  system: true },
  { id: "f7", type: "tel",      label: "Guardian Phone",     required: true,  system: true },
  { id: "section_student", type: "heading", label: "Student Info", required: false },
  { id: "f1", type: "text",     label: "First Name",         required: true,  system: true },
  { id: "f2", type: "text",     label: "Last Name",          required: true,  system: true },
  { id: "f3", type: "date",     label: "Date of Birth",      required: true,  system: true },
  { id: "f4", type: "select",   label: "Age Group",          required: true,  system: true, source: "ageGroups" },
  { id: "section_consent", type: "heading", label: "Consent & Emergency Info", required: false },
  { id: "f12", type: "checkbox", label: "Photo Consent",    required: false, system: true },
  { id: "f8", type: "tel",      label: "Emergency Phone",    required: true, system: true },
  { id: "f9", type: "select",   label: "T-Shirt Size",       required: false, system: true, options: ["YS","YM","YL","AS","AM","AL","AXL","A2XL"] },
  { id: "f10", type: "textarea", label: "Medical / Allergies", required: false, system: true },
  { id: "f11", type: "textarea", label: "Dietary Restrictions", required: false, system: true },
]);

function ageMatches(course: { ageGroupId: string | null; courseAgeGroups: { ageGroupId: string }[] }, ageGroupId: string) {
  return course.ageGroupId === ageGroupId || course.courseAgeGroups.some(ag => ag.ageGroupId === ageGroupId);
}

// GET — public (no auth) — used by the public registration page
export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const { campId } = await params;
  const camp = await prisma.camp.findUnique({
    where: { id: campId },
    select: {
      id: true,
      name: true,
      registrationOpen: true,
      registrationForm: true,
      ageGroups: { select: { id: true, name: true, minAge: true, maxAge: true, noSchedule: true } },
      sessionTemplates: {
        select: {
          id: true,
          label: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          mandatory: true,
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
      courses: {
        select: {
          id: true,
          name: true,
          description: true,
          cap: true,
          ageGroupId: true,
          courseAgeGroups: { select: { ageGroupId: true } },
          courseSessionTemplates: { select: { sessionTemplateId: true } },
          sessions: { select: { id: true, sessionTemplateId: true, enrolledCount: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!camp) return NextResponse.json({ error: "Camp not found" }, { status: 404 });

  const registrationSessions = camp.sessionTemplates.map(session => ({
    ...session,
    optionCountsByAgeGroup: camp.ageGroups.reduce<Record<string, number>>((acc, ageGroup) => {
      acc[ageGroup.id] = camp.courses
        .filter(course => ageMatches(course, ageGroup.id))
        .filter(course => course.courseSessionTemplates.some(cst => cst.sessionTemplateId === session.id))
        .length;
      return acc;
    }, {}),
    optionsByAgeGroup: camp.ageGroups.reduce<Record<string, Array<{
      courseId: string;
      name: string;
      description: string | null;
      cap: number | null;
      enrolledCount: number;
      seatsLeft: number | null;
    }>>>((acc, ageGroup) => {
      acc[ageGroup.id] = camp.courses
        .filter(course => ageMatches(course, ageGroup.id))
        .filter(course => course.courseSessionTemplates.some(cst => cst.sessionTemplateId === session.id))
        .map(course => {
          const existing = course.sessions.find(s => s.sessionTemplateId === session.id);
          const enrolledCount = existing?.enrolledCount ?? 0;
          const seatsLeft = course.cap === null ? null : Math.max((course.cap ?? 0) - enrolledCount, 0);
          return { courseId: course.id, name: course.name, description: course.description, cap: course.cap, enrolledCount, seatsLeft };
        })
        .filter(option => option.seatsLeft === null || option.seatsLeft > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      return acc;
    }, {}),
  }));

  const fields = camp.registrationForm?.fields || DEFAULT_FIELDS;
  return NextResponse.json({
    campName: camp.name,
    registrationOpen: camp.registrationOpen,
    fields,
    ageGroups: camp.ageGroups,
    courses: camp.courses,
    registrationSessions,
  });
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
