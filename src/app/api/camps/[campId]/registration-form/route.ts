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

function slugify(value: string) {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || `form-${Date.now()}`;
}

function ageMatches(course: { ageGroupId: string | null; courseAgeGroups: { ageGroupId: string }[] }, ageGroupId: string) {
  return course.ageGroupId === ageGroupId || course.courseAgeGroups.some(ag => ag.ageGroupId === ageGroupId);
}

type RegistrationOption = {
  courseId: string;
  name: string;
  description: string | null;
  cap: number | null;
  enrolledCount: number;
  seatsLeft: number | null;
};

type MandatoryClassRule = { ageGroupId: string; courseId: string };

function parseMandatoryClassRules(value: unknown): MandatoryClassRule[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed
      .map(rule => ({
        ageGroupId: typeof rule?.ageGroupId === "string" ? rule.ageGroupId.trim() : "",
        courseId: typeof rule?.courseId === "string" ? rule.courseId.trim() : "",
      }))
      .filter(rule => rule.ageGroupId && rule.courseId)
      .filter(rule => {
        const key = `${rule.ageGroupId}:${rule.courseId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  } catch {
    return [];
  }
}

async function ensureDefaultForm(campId: string) {
  const forms = await prisma.registrationForm.findMany({ where: { campId }, orderBy: { createdAt: "asc" } });
  if (forms.length > 0) {
    if (!forms.some(form => form.isDefault)) {
      await prisma.registrationForm.update({ where: { id: forms[0].id }, data: { isDefault: true } });
      return { ...forms[0], isDefault: true };
    }
    return forms.find(form => form.isDefault) || forms[0];
  }
  return prisma.registrationForm.create({
    data: { campId, title: "Main Registration Form", slug: "main", status: "public", isDefault: true, classChoicesEnabled: true, fields: DEFAULT_FIELDS },
  });
}

function compactForm(form: {
  id: string;
  title: string;
  slug: string;
  status: string;
  isDefault: boolean;
  classChoicesEnabled?: boolean;
  familyRegistrationEnabled?: boolean;
  confirmationEmailSubject?: string | null;
  confirmationEmailIntro?: string | null;
  confirmationEmailTemplate?: string | null;
  adminNotificationEmails?: string | null;
  confirmationIncludeGuardian?: boolean;
  confirmationIncludeStudents?: boolean;
  confirmationIncludeClasses?: boolean;
  confirmationIncludeEmergency?: boolean;
  confirmationIncludePayment?: boolean;
  mandatoryClassRules?: string | null;
  updatedAt: Date;
  createdAt: Date;
}, includePrivate = false) {
  return {
    id: form.id,
    title: form.title,
    slug: form.slug,
    status: form.status,
    isDefault: form.isDefault,
    classChoicesEnabled: form.classChoicesEnabled !== false,
    familyRegistrationEnabled: Boolean(form.familyRegistrationEnabled),
    confirmationEmailSubject: form.confirmationEmailSubject || "",
    confirmationEmailIntro: form.confirmationEmailIntro || "",
    confirmationEmailTemplate: form.confirmationEmailTemplate || "",
    ...(includePrivate ? { adminNotificationEmails: form.adminNotificationEmails || "" } : {}),
    confirmationIncludeGuardian: form.confirmationIncludeGuardian !== false,
    confirmationIncludeStudents: form.confirmationIncludeStudents !== false,
    confirmationIncludeClasses: form.confirmationIncludeClasses !== false,
    confirmationIncludeEmergency: form.confirmationIncludeEmergency !== false,
    confirmationIncludePayment: form.confirmationIncludePayment !== false,
    mandatoryClassRules: parseMandatoryClassRules(form.mandatoryClassRules),
    updatedAt: form.updatedAt,
    createdAt: form.createdAt,
  };
}

// GET — public can read public/link-only forms. Authenticated camp members can also read drafts.
export async function GET(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const { campId } = await params;
  const session = await getSession();
  const member = session ? await checkAccess(session.userId, campId) : null;
  const formRef = req.nextUrl.searchParams.get("form") || req.nextUrl.searchParams.get("formId") || "";

  const camp = await prisma.camp.findUnique({
    where: { id: campId },
    select: {
      id: true,
      name: true,
      registrationOpen: true,
      billingMode: true,
      billingStatus: true,
      platformFeeCents: true,
      platformFeePercentBps: true,
      platformFeeMinCents: true,
      platformFeeCapCents: true,
      camperPriceCents: true,
      annualSubscriptionCents: true,
      registrationForms: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      ageGroups: { select: { id: true, name: true, minAge: true, maxAge: true, noSchedule: true } },
      sessionTemplates: {
        select: {
          id: true,
          label: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          mandatory: true,
          mandatorySessions: {
            select: {
              id: true,
              title: true,
              ageGroupId: true,
              room: { select: { name: true } },
              leader: { select: { firstName: true, lastName: true } },
            },
          },
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
  if (!camp) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  let forms = camp.registrationForms;
  if (member && forms.length === 0) {
    const created = await ensureDefaultForm(campId);
    forms = [created];
  }

  const visibleForms = member ? forms : forms.filter(form => form.status === "public" || form.status === "linkOnly");
  const selectedForm = formRef
    ? visibleForms.find(form => form.id === formRef || form.slug === formRef)
    : visibleForms.find(form => form.isDefault && form.status === "public") || visibleForms.find(form => form.status === "public") || (member ? visibleForms.find(form => form.isDefault) || visibleForms[0] : undefined);

  const registrationSessions = camp.sessionTemplates.map(session => {
    const mandatoryAgeGroupIds = new Set(session.mandatorySessions.map(ms => ms.ageGroupId));
    return {
      ...session,
      mandatorySessions: session.mandatorySessions,
      optionCountsByAgeGroup: camp.ageGroups.reduce<Record<string, number>>((acc, ageGroup) => {
        if (session.mandatory || mandatoryAgeGroupIds.has(ageGroup.id)) {
          acc[ageGroup.id] = 0;
          return acc;
        }
        acc[ageGroup.id] = camp.courses
          .filter(course => ageMatches(course, ageGroup.id))
          .filter(course => course.courseSessionTemplates.some(cst => cst.sessionTemplateId === session.id))
          .length;
        return acc;
      }, {}),
      optionsByAgeGroup: camp.ageGroups.reduce<Record<string, RegistrationOption[]>>((acc, ageGroup) => {
        if (session.mandatory || mandatoryAgeGroupIds.has(ageGroup.id)) {
          acc[ageGroup.id] = [];
          return acc;
        }
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
    };
  });

  const formOpen = selectedForm ? camp.registrationOpen && selectedForm.status !== "draft" : false;
  return NextResponse.json({
    campName: camp.name,
    registrationOpen: formOpen,
    billingMode: camp.billingMode,
    billingStatus: camp.billingStatus,
    platformFeeCents: camp.platformFeeCents,
    platformFeePercentBps: camp.platformFeePercentBps,
    platformFeeMinCents: camp.platformFeeMinCents,
    platformFeeCapCents: camp.platformFeeCapCents,
    camperPriceCents: camp.camperPriceCents,
    annualSubscriptionCents: camp.annualSubscriptionCents,
    fields: selectedForm?.fields || DEFAULT_FIELDS,
    form: selectedForm ? compactForm(selectedForm, Boolean(member)) : null,
    forms: (member ? forms : visibleForms.filter((form: Parameters<typeof compactForm>[0]) => form.status === "public")).map((form: Parameters<typeof compactForm>[0]) => compactForm(form, Boolean(member))),
    ageGroups: camp.ageGroups,
    courses: camp.courses,
    registrationSessions,
  });
}

// POST — create a new form (auth required)
export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New Registration Form";
  const slug = slugify(typeof body.slug === "string" && body.slug.trim() ? body.slug : title);
  const existingCount = await prisma.registrationForm.count({ where: { campId } });
  const form = await prisma.registrationForm.create({
    data: {
      campId,
      title,
      slug: existingCount === 0 ? slug : `${slug}-${Date.now().toString().slice(-5)}`,
      status: "draft",
      isDefault: existingCount === 0,
      classChoicesEnabled: true,
      fields: DEFAULT_FIELDS,
    },
  });
  return NextResponse.json({ success: true, form: compactForm(form, true), fields: form.fields });
}

// PUT — save form definition + metadata (auth required)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { formId, fields, title, slug, status, isDefault, classChoicesEnabled, familyRegistrationEnabled, confirmationEmailSubject, confirmationEmailIntro, confirmationEmailTemplate, adminNotificationEmails, confirmationIncludeGuardian, confirmationIncludeStudents, confirmationIncludeClasses, confirmationIncludeEmergency, confirmationIncludePayment, mandatoryClassRules } = await req.json();
  if (!Array.isArray(fields)) return NextResponse.json({ error: "fields must be an array" }, { status: 400 });

  const cleanedRules = parseMandatoryClassRules(mandatoryClassRules);
  if (cleanedRules.length > 0) {
    const uniqueAgeGroupIds = [...new Set(cleanedRules.map(rule => rule.ageGroupId))];
    const uniqueCourseIds = [...new Set(cleanedRules.map(rule => rule.courseId))];
    const [ageGroupCount, courseCount] = await Promise.all([
      prisma.ageGroup.count({ where: { campId, id: { in: uniqueAgeGroupIds } } }),
      prisma.course.count({ where: { campId, id: { in: uniqueCourseIds } } }),
    ]);
    if (ageGroupCount !== uniqueAgeGroupIds.length || courseCount !== uniqueCourseIds.length) {
      return NextResponse.json({ error: "One or more required class rules references an age group or class that no longer exists." }, { status: 400 });
    }
  }

  const existing = formId
    ? await prisma.registrationForm.findFirst({ where: { id: formId, campId } })
    : await ensureDefaultForm(campId);
  if (!existing) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const safeStatus = ["draft", "public", "linkOnly"].includes(status) ? status : existing.status;
  const nextSlug = slugify(typeof slug === "string" && slug.trim() ? slug : existing.slug || title || existing.title);

  try {
    if (isDefault) {
      const otherDefaultForms = await prisma.registrationForm.findMany({
        where: { campId, NOT: { id: existing.id }, isDefault: true },
        select: { id: true },
      });
      await Promise.all(otherDefaultForms.map(form =>
        prisma.registrationForm.update({ where: { id: form.id }, data: { isDefault: false } })
      ));
    }

    const updated = await prisma.registrationForm.update({
      where: { id: existing.id },
      data: {
        fields: JSON.stringify(fields),
        title: typeof title === "string" && title.trim() ? title.trim() : existing.title,
        slug: nextSlug,
        status: safeStatus,
        isDefault: Boolean(isDefault) || existing.isDefault,
        classChoicesEnabled: classChoicesEnabled !== false,
        familyRegistrationEnabled: Boolean(familyRegistrationEnabled),
        confirmationEmailSubject: typeof confirmationEmailSubject === "string" ? confirmationEmailSubject.trim() || null : existing.confirmationEmailSubject,
        confirmationEmailIntro: typeof confirmationEmailIntro === "string" ? confirmationEmailIntro.trim() || null : existing.confirmationEmailIntro,
        confirmationEmailTemplate: typeof confirmationEmailTemplate === "string" ? confirmationEmailTemplate.trim() || null : existing.confirmationEmailTemplate,
        adminNotificationEmails: typeof adminNotificationEmails === "string" ? adminNotificationEmails.trim() || null : existing.adminNotificationEmails,
        confirmationIncludeGuardian: confirmationIncludeGuardian !== false,
        confirmationIncludeStudents: confirmationIncludeStudents !== false,
        confirmationIncludeClasses: confirmationIncludeClasses !== false,
        confirmationIncludeEmergency: confirmationIncludeEmergency !== false,
        confirmationIncludePayment: confirmationIncludePayment !== false,
        mandatoryClassRules: JSON.stringify(cleanedRules),
      },
    });
    return NextResponse.json({ success: true, form: compactForm(updated, true), fields: updated.fields });
  } catch (error) {
    console.error("Failed to save registration form", error);
    const duplicateSlug = error instanceof Error && error.message.includes("Unique constraint");
    const message = duplicateSlug
      ? "That form link slug is already in use for this program."
      : error instanceof Error
        ? error.message
        : "Could not save this form.";
    return NextResponse.json({ error: message }, { status: duplicateSlug ? 409 : 500 });
  }
}
