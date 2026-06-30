import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getResend, FROM_EMAIL } from "@/lib/email";
import { getBaseUrl, getStripe } from "@/lib/billing";
import { calculateRegistrationTotal, couponAllowsEmail, normalizeCouponCode, type PricingCoupon } from "@/lib/registration-pricing";

interface StudentPayload {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  ageGroupId?: string;
  emergencyPhone?: string;
  tshirtSize?: string;
  medicalNotes?: string;
  dietaryNotes?: string;
  photoConsent?: boolean;
  selectedCourseIds?: string[];
  selectedSessionCourseIds?: Record<string, string>;
  customData?: Record<string, unknown>;
}

interface RegistrationPayload extends StudentPayload {
  guardianName?: string;
  guardianEmail?: string;
  guardianPhone?: string;
  formRef?: string;
  couponCode?: string;
  updateExisting?: boolean;
  existingCamperId?: string;
  campers?: StudentPayload[];
}

type ConfirmationSettings = {
  confirmationEmailSubject?: string | null;
  confirmationEmailIntro?: string | null;
  adminNotificationEmails?: string | null;
  confirmationIncludeGuardian?: boolean;
  confirmationIncludeStudents?: boolean;
  confirmationIncludeClasses?: boolean;
  confirmationIncludeEmergency?: boolean;
  confirmationIncludePayment?: boolean;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseNotificationEmails(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const seen = new Set<string>();
  return value
    .split(/[\n,;]+/)
    .map(email => email.trim().toLowerCase())
    .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    .filter(email => {
      if (seen.has(email)) return false;
      seen.add(email);
      return true;
    });
}

function slugRef(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function ageMatches(course: { ageGroupId: string | null; courseAgeGroups: { ageGroupId: string }[] }, ageGroupId: string) {
  return course.ageGroupId === ageGroupId || course.courseAgeGroups.some(ag => ag.ageGroupId === ageGroupId);
}

function weeklySessionKey(template: { label: string | null; startTime: string | null; endTime: string | null; mandatory?: boolean | null }) {
  return `${template.label || "Session"}|${template.startTime || ""}|${template.endTime || ""}|${template.mandatory ? "required" : "optional"}`;
}

type MandatoryClassRule = { ageGroupId: string; courseId: string };

function parseMandatoryClassRules(value: unknown): MandatoryClassRule[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(rule => ({
        ageGroupId: typeof rule?.ageGroupId === "string" ? rule.ageGroupId.trim() : "",
        courseId: typeof rule?.courseId === "string" ? rule.courseId.trim() : "",
      }))
      .filter(rule => rule.ageGroupId && rule.courseId);
  } catch {
    return [];
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] || char));
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function formatSessionTime(startTime?: string | null, endTime?: string | null) {
  const formatOne = (value?: string | null) => {
    if (!value) return "";
    const [rawHour, rawMinute = "00"] = value.split(":");
    const hour = Number(rawHour);
    if (!Number.isFinite(hour)) return value;
    const minute = rawMinute.padStart(2, "0").slice(0, 2);
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute} ${suffix}`;
  };
  const start = formatOne(startTime);
  const end = formatOne(endTime);
  return start && end ? `${start} – ${end}` : start || end || "Time TBA";
}

function sessionSortValue(row: { dayOfWeek?: number | null; startTime?: string | null; label?: string }) {
  const day = typeof row.dayOfWeek === "number" ? row.dayOfWeek : 0;
  return `${String(day).padStart(2, "0")}|${row.startTime || "99:99"}|${row.label || ""}`;
}

type ConfirmationScheduleRow = {
  label: string;
  className: string;
  startTime?: string | null;
  endTime?: string | null;
  dayOfWeek?: number | null;
  mandatory?: boolean;
};

function renderClassGrid(rows: ConfirmationScheduleRow[]) {
  if (rows.length === 0) return `<p style="margin:0;color:#64748b;font-size:15px;">No classes selected.</p>`;
  const uniqueRows = Array.from(new Map(rows.map(row => [`${row.startTime || ""}|${row.endTime || ""}|${row.label || ""}|${row.className}|${row.mandatory ? "1" : "0"}`, row])).values());
  const sortedRows = [...uniqueRows].sort((a, b) => sessionSortValue(a).localeCompare(sessionSortValue(b)));
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:0;border:1px solid #dbeafe;border-radius:18px;overflow:hidden;background:#ffffff;box-shadow:0 12px 28px rgba(37,99,235,0.08);">
    <thead>
      <tr style="background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">
        <th align="left" style="padding:12px 14px;border-right:1px solid #dbeafe;width:150px;">Time</th>
        <th align="left" style="padding:12px 14px;">Session / Class</th>
      </tr>
    </thead>
    <tbody>
      ${sortedRows.map((row, index) => `<tr style="background:${index % 2 === 0 ? "#ffffff" : "#f8fafc"};">
        <td valign="top" style="padding:14px;border-top:1px solid #e2e8f0;border-right:1px solid #e2e8f0;font-size:17px;font-weight:900;color:#0f172a;white-space:nowrap;">${escapeHtml(formatSessionTime(row.startTime, row.endTime))}</td>
        <td valign="top" style="padding:14px;border-top:1px solid #e2e8f0;">
          <div style="font-size:18px;font-weight:900;color:#0f172a;line-height:1.25;">${escapeHtml(row.className)}</div>
          <div style="font-size:13px;font-weight:700;color:#64748b;margin-top:3px;">${escapeHtml(row.label || "Session")}${row.mandatory ? ` <span style="display:inline-block;margin-left:8px;padding:2px 7px;border-radius:999px;background:#dcfce7;color:#166534;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;">Included</span>` : ""}</div>
        </td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}

function applyTokens(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, value), template);
}

async function sendConfirmationEmail({
  campName,
  guardian,
  students,
  totals,
  paymentRequired,
  settings,
  updated,
}: {
  campName: string;
  guardian: { name: string; email: string; phone?: string };
  students: Array<{ firstName: string; lastName: string; dateOfBirth?: string; ageGroupName?: string; emergencyPhone?: string; photoConsent?: boolean; courseNames: string[]; classScheduleRows: ConfirmationScheduleRow[]; customData?: Record<string, unknown> }>;
  totals: { totalCents: number; campPriceCents: number; discountCents: number; platformFeeCents: number };
  paymentRequired: boolean;
  settings: ConfirmationSettings;
  updated: boolean;
}) {
  if (!process.env.RESEND_API_KEY || !guardian.email) return { sent: false };

  const resend = getResend();
  const studentCount = students.length;
  const firstStudentName = `${students[0]?.firstName || ""} ${students[0]?.lastName || ""}`.trim();
  const tokenValues = {
    campName,
    guardianName: guardian.name,
    guardianEmail: guardian.email,
    studentName: firstStudentName,
    studentCount: String(studentCount),
    totalDue: money(totals.totalCents),
  };
  const subjectTemplate = settings.confirmationEmailSubject?.trim() || `${campName} registration ${updated ? "updated" : "confirmation"}`;
  const subject = applyTokens(subjectTemplate, tokenValues);
  const intro = applyTokens(settings.confirmationEmailIntro?.trim() || `Please review your registration details below for ${campName}.`, tokenValues);

  const studentScheduleHtml = students.map((student, index) => {
    const studentName = `${student.firstName} ${student.lastName}`.trim();
    const detailParts = [
      student.dateOfBirth ? `DOB: ${escapeHtml(student.dateOfBirth)}` : "",
      student.ageGroupName ? `Age group: ${escapeHtml(student.ageGroupName)}` : "",
    ].filter(Boolean).join(" • ");
    const classesHtml = settings.confirmationIncludeClasses !== false
      ? `<h3 style="font-size:16px;margin:16px 0 8px;color:#1e3a8a;">Class Schedule</h3>${renderClassGrid(student.classScheduleRows)}`
      : "";
    return `<div style="border:1px solid #bfdbfe;border-radius:18px;padding:16px;margin:14px 0;background:#f8fbff;">
      <div style="font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#2563eb;margin-bottom:4px;">Student ${index + 1}</div>
      <h2 style="font-size:22px;margin:0;color:#0f172a;line-height:1.2;">${escapeHtml(studentName)}</h2>
      ${detailParts ? `<p style="margin:6px 0 0;color:#475569;font-size:15px;font-weight:700;">${detailParts}</p>` : ""}
      ${classesHtml}
    </div>`;
  }).join("");

  const emergencyHtml = settings.confirmationIncludeEmergency !== false
    ? students.map((student, index) => {
        const studentName = `${student.firstName} ${student.lastName}`.trim() || `Student ${index + 1}`;
        return `<div style="border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin:10px 0;background:#ffffff;">
          <h3 style="font-size:15px;margin:0 0 6px;color:#0f172a;">${escapeHtml(studentName)}</h3>
          <p style="margin:0;color:#475569;">Emergency phone: ${escapeHtml(student.emergencyPhone || "") || "—"}<br>Photo consent: ${student.photoConsent ? "Yes" : "No"}</p>
        </div>`;
      }).join("")
    : "";

  const additionalInfoHtml = settings.confirmationIncludeStudents !== false
    ? students.map((student, index) => {
        const studentName = `${student.firstName} ${student.lastName}`.trim() || `Student ${index + 1}`;
        const rows = student.customData && Object.keys(student.customData).length
          ? Object.entries(student.customData).filter(([, v]) => String(v ?? "").trim()).map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(Array.isArray(value) ? value.join(", ") : value)}</li>`).join("")
          : "";
        return rows ? `<div style="margin:8px 0;"><h3 style="font-size:15px;margin:0 0 4px;color:#0f172a;">${escapeHtml(studentName)}</h3><ul style="margin:0;padding-left:18px;color:#475569;">${rows}</ul></div>` : "";
      }).filter(Boolean).join("")
    : "";

  const paymentHtml = settings.confirmationIncludePayment !== false && paymentRequired
    ? `<h2 style="font-size:16px;margin:18px 0 8px;">Payment Summary</h2><p style="margin:0;">Camp price: ${money(totals.campPriceCents)}<br>Discount: ${money(totals.discountCents)}<br>Platform fee: ${money(totals.platformFeeCents)}<br><strong>Total due: ${money(totals.totalCents)}</strong></p>`
    : "";

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#1e293b;max-width:680px;margin:0 auto;padding:24px;">
      <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:16px;padding:20px;margin-bottom:18px;">
        <h1 style="margin:0 0 8px;font-size:22px;color:#166534;">${updated ? "Registration updated" : "Registration received"}</h1>
        <p style="margin:0;color:#475569;">${escapeHtml(intro)}</p>
      </div>
      ${settings.confirmationIncludeStudents !== false ? studentScheduleHtml : ""}
      ${settings.confirmationIncludeGuardian !== false ? `<h2 style="font-size:16px;margin:20px 0 8px;">Parent / Guardian</h2><p style="margin:0 0 10px;">${escapeHtml(guardian.name)}<br>${escapeHtml(guardian.email)}<br>${escapeHtml(guardian.phone || "")}</p>` : ""}
      ${emergencyHtml ? `<h2 style="font-size:16px;margin:18px 0 8px;">Emergency Information</h2>${emergencyHtml}` : ""}
      ${additionalInfoHtml ? `<h2 style="font-size:16px;margin:18px 0 8px;">Additional Student Information</h2>${additionalInfoHtml}` : ""}
      ${paymentHtml}
      <p style="margin-top:22px;color:#64748b;font-size:13px;">Need to change something? Contact the camp office, or return to the registration form and submit updated information.</p>
    </div>`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: guardian.email,
    subject,
    html,
  });
  return { sent: true };
}

async function sendAdminNotificationEmail({
  campName,
  guardian,
  students,
  totals,
  paymentRequired,
  recipients,
  updated,
}: {
  campName: string;
  guardian: { name: string; email: string; phone?: string };
  students: Array<{ firstName: string; lastName: string; dateOfBirth?: string; ageGroupName?: string; emergencyPhone?: string; photoConsent?: boolean; courseNames: string[]; classScheduleRows: ConfirmationScheduleRow[]; customData?: Record<string, unknown> }>;
  totals: { totalCents: number; campPriceCents: number; discountCents: number; platformFeeCents: number };
  paymentRequired: boolean;
  recipients: string[];
  updated: boolean;
}) {
  if (!process.env.RESEND_API_KEY || recipients.length === 0) return { sent: false, count: 0 };

  const resend = getResend();
  const studentNames = students.map(student => `${student.firstName} ${student.lastName}`.trim()).filter(Boolean).join(", ");
  const studentBlocks = students.map((student, index) => {
    const studentName = `${student.firstName} ${student.lastName}`.trim() || `Student ${index + 1}`;
    const detailParts = [
      student.dateOfBirth ? `DOB: ${escapeHtml(student.dateOfBirth)}` : "",
      student.ageGroupName ? `Age group: ${escapeHtml(student.ageGroupName)}` : "",
    ].filter(Boolean).join(" • ");
    const customRows = student.customData && Object.keys(student.customData).length
      ? Object.entries(student.customData).filter(([, v]) => String(v ?? "").trim()).map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(Array.isArray(value) ? value.join(", ") : value)}</li>`).join("")
      : "";
    return `<div style="border:1px solid #bfdbfe;border-radius:18px;padding:16px;margin:14px 0;background:#f8fbff;">
      <div style="font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#2563eb;margin-bottom:4px;">Student ${index + 1}</div>
      <h2 style="font-size:22px;margin:0;color:#0f172a;line-height:1.2;">${escapeHtml(studentName)}</h2>
      ${detailParts ? `<p style="margin:6px 0 0;color:#475569;font-size:15px;font-weight:700;">${detailParts}</p>` : ""}
      <h3 style="font-size:16px;margin:16px 0 8px;color:#1e3a8a;">Class Schedule</h3>
      ${renderClassGrid(student.classScheduleRows)}
      <p style="margin:12px 0 0;color:#475569;">Emergency phone: ${escapeHtml(student.emergencyPhone || "") || "—"}<br>Photo consent: ${student.photoConsent ? "Yes" : "No"}</p>
      ${customRows ? `<h3 style="font-size:15px;margin:12px 0 4px;color:#0f172a;">Additional information</h3><ul style="margin:0;padding-left:18px;color:#475569;">${customRows}</ul>` : ""}
    </div>`;
  }).join("");

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#1e293b;max-width:680px;margin:0 auto;padding:24px;">
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:16px;padding:20px;margin-bottom:18px;">
        <h1 style="margin:0 0 8px;font-size:22px;color:#92400e;">${updated ? "Registration updated" : "New registration received"}</h1>
        <p style="margin:0;color:#475569;">${escapeHtml(guardian.name)} submitted ${students.length} student${students.length === 1 ? "" : "s"} for ${escapeHtml(campName)}.</p>
      </div>
      <h2 style="font-size:16px;margin:0 0 8px;">Parent / Guardian</h2>
      <p style="margin:0 0 10px;">${escapeHtml(guardian.name)}<br>${escapeHtml(guardian.email)}<br>${escapeHtml(guardian.phone || "")}</p>
      ${studentBlocks}
      <h2 style="font-size:16px;margin:18px 0 8px;">Payment</h2>
      <p style="margin:0;">${paymentRequired ? `Payment required: <strong>${money(totals.totalCents)}</strong>` : "No payment required at submission."}<br>Camp price: ${money(totals.campPriceCents)}<br>Discount: ${money(totals.discountCents)}<br>Platform fee: ${money(totals.platformFeeCents)}</p>
    </div>`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: recipients,
    subject: `${updated ? "Updated" : "New"} ${campName} registration${studentNames ? `: ${studentNames}` : ""}`,
    html,
  });
  return { sent: true, count: recipients.length };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const { campId } = await params;
  const data = await req.json() as RegistrationPayload;

  const camp = await prisma.camp.findUnique({
    where: { id: campId },
    select: {
      id: true,
      name: true,
      registrationOpen: true,
      billingMode: true,
      platformFeeCents: true,
      platformFeePercentBps: true,
      platformFeeMinCents: true,
      platformFeeCapCents: true,
      camperPriceCents: true,
    },
  });
  if (!camp) return NextResponse.json({ error: "Camp not found" }, { status: 404 });
  if (!camp.registrationOpen) return NextResponse.json({ error: "Registration is closed" }, { status: 403 });

  const ref = slugRef(data.formRef);
  const selectedForm = ref
    ? await prisma.registrationForm.findFirst({
        where: { campId, OR: [{ id: ref }, { slug: ref }], status: { in: ["public", "linkOnly"] } },
        select: { classChoicesEnabled: true, familyRegistrationEnabled: true, mandatoryClassRules: true, confirmationEmailSubject: true, confirmationEmailIntro: true, adminNotificationEmails: true, confirmationIncludeGuardian: true, confirmationIncludeStudents: true, confirmationIncludeClasses: true, confirmationIncludeEmergency: true, confirmationIncludePayment: true },
      })
    : await prisma.registrationForm.findFirst({
        where: { campId, isDefault: true, status: "public" },
        select: { classChoicesEnabled: true, familyRegistrationEnabled: true, mandatoryClassRules: true, confirmationEmailSubject: true, confirmationEmailIntro: true, adminNotificationEmails: true, confirmationIncludeGuardian: true, confirmationIncludeStudents: true, confirmationIncludeClasses: true, confirmationIncludeEmergency: true, confirmationIncludePayment: true },
      });
  const classChoicesEnabled = selectedForm?.classChoicesEnabled !== false;
  const familyRegistrationEnabled = Boolean(selectedForm?.familyRegistrationEnabled);
  const mandatoryClassRules = parseMandatoryClassRules(selectedForm?.mandatoryClassRules);

  const guardianEmail = clean(data.guardianEmail).toLowerCase();
  const guardianName = clean(data.guardianName);
  const guardianPhone = clean(data.guardianPhone);
  const rawCampers = familyRegistrationEnabled && Array.isArray(data.campers) && data.campers.length > 0 ? data.campers : [data];
  const campers = rawCampers.slice(0, 12);
  if (!guardianEmail || !guardianName) return NextResponse.json({ error: "Guardian name and email are required" }, { status: 400 });

  const couponCode = normalizeCouponCode(data.couponCode);
  let coupon: PricingCoupon | null = null;
  if (couponCode) {
    const dbCoupon = await prisma.campCoupon.findFirst({ where: { campId, code: couponCode, active: true } });
    if (!dbCoupon) return NextResponse.json({ error: "Coupon code not found" }, { status: 400 });
    if (dbCoupon.expiresAt && dbCoupon.expiresAt < new Date()) return NextResponse.json({ error: "Coupon code has expired" }, { status: 400 });
    if (dbCoupon.maxRedemptions !== null && dbCoupon.redeemedCount >= dbCoupon.maxRedemptions) return NextResponse.json({ error: "Coupon code has reached its limit" }, { status: 400 });
    if (!couponAllowsEmail(dbCoupon.restrictedEmails, guardianEmail)) return NextResponse.json({ error: "This coupon code is reserved for a specific family email" }, { status: 400 });
    coupon = dbCoupon;
  }

  const seenStudents = new Set<string>();
  for (const student of campers) {
    const firstName = clean(student.firstName);
    const lastName = clean(student.lastName);
    const dob = normalizedDate(student.dateOfBirth);
    if (!firstName || !lastName || !student.ageGroupId) {
      return NextResponse.json({ error: "Each student needs first name, last name, and age group" }, { status: 400 });
    }
    const familyKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${student.dateOfBirth || ""}`;
    if (seenStudents.has(familyKey)) {
      return NextResponse.json({ error: `${firstName} ${lastName} is listed more than once in this family registration.` }, { status: 400 });
    }
    seenStudents.add(familyKey);
    const existing = await prisma.camper.findFirst({
      where: {
        campId,
        guardianEmail,
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
        ...(dob ? { dateOfBirth: dob } : {}),
      },
      select: { id: true },
    });
    if (existing && (!data.updateExisting || data.existingCamperId !== existing.id || familyRegistrationEnabled)) {
      return NextResponse.json({
        duplicate: true,
        camperId: existing.id,
        message: `${firstName} ${lastName} already appears to be registered. Please edit that existing registration or contact the camp before submitting this family registration.`,
      }, { status: 409 });
    }
  }

  const familyTotals = calculateRegistrationTotal(camp, coupon, campers.length);
  const perCamperTotals = calculateRegistrationTotal(camp, null, 1);
  const createdStudents: Array<{ camperId: string; firstName: string; lastName: string; dateOfBirth?: string; ageGroupName?: string; emergencyPhone?: string; photoConsent?: boolean; courseNames: string[]; classScheduleRows: ConfirmationScheduleRow[]; customData?: Record<string, unknown> }> = [];
  const createdCamperIds: string[] = [];
  let anyUpdating = false;

  for (const student of campers) {
    const firstName = clean(student.firstName);
    const lastName = clean(student.lastName);
    const dob = normalizedDate(student.dateOfBirth);
    if (!firstName || !lastName || !student.ageGroupId) {
      return NextResponse.json({ error: "Each student needs first name, last name, and age group" }, { status: 400 });
    }

    const existing = await prisma.camper.findFirst({
      where: {
        campId,
        guardianEmail,
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
        ...(dob ? { dateOfBirth: dob } : {}),
      },
    });

    if (existing && (!data.updateExisting || data.existingCamperId !== existing.id || familyRegistrationEnabled)) {
      return NextResponse.json({
        duplicate: true,
        camperId: existing.id,
        message: `${firstName} ${lastName} already appears to be registered. Please edit that existing registration or contact the camp before submitting this family registration.`,
      }, { status: 409 });
    }

    const selectedBySession = Object.fromEntries(Object.entries(student.selectedSessionCourseIds || {}).filter(([sessionTemplateId, courseId]) => sessionTemplateId && courseId));
    const fallbackCourseIds = [...new Set((Array.isArray(student.selectedCourseIds) ? student.selectedCourseIds : []).filter(Boolean))];
    const ageGroup = await prisma.ageGroup.findFirst({ where: { id: student.ageGroupId, campId }, select: { id: true, name: true, noSchedule: true } });
    if (!ageGroup) return NextResponse.json({ error: `Selected age group is not available for ${firstName}` }, { status: 400 });

    const sessionTemplates = await prisma.sessionTemplate.findMany({
      where: { campId },
      include: {
        courseSessionTemplates: {
          include: {
            course: {
              include: {
                courseAgeGroups: true,
                sessions: { where: { campId }, select: { id: true, sessionTemplateId: true, enrolledCount: true } },
              },
            },
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    const selections: Array<{ sessionTemplateId: string; course: any; template?: { label: string | null; startTime: string | null; endTime: string | null; dayOfWeek?: number | null } }> = [];
    const mandatoryAssignments = !classChoicesEnabled || ageGroup.noSchedule ? [] : await prisma.mandatorySession.findMany({
      where: { campId, ageGroupId: ageGroup.id },
      include: { sessionTemplate: true, room: true, leader: true, sessions: { where: { campId }, select: { id: true } } },
      orderBy: [{ sessionTemplate: { startTime: "asc" } }, { title: "asc" }],
    });
    const mandatoryTemplateIds = new Set(mandatoryAssignments.map(ms => ms.sessionTemplateId));
    const selectedCourseWeeklySlots = new Map<string, Set<string>>();
    const selectedWeeklySlotCourse = new Map<string, string>();

    if (classChoicesEnabled && !ageGroup.noSchedule && sessionTemplates.length > 0) {
      for (const template of sessionTemplates) {
        if (template.mandatory || mandatoryTemplateIds.has(template.id)) continue;
        const eligibleCourses = template.courseSessionTemplates.map(cst => cst.course).filter(course => ageMatches(course, ageGroup.id));
        if (eligibleCourses.length === 0) continue;
        const openCourses = eligibleCourses.filter(course => {
          const existingSession = course.sessions.find(s => s.sessionTemplateId === template.id);
          if (course.cap === null) return true;
          return (course.cap ?? 0) > (existingSession?.enrolledCount ?? 0);
        });
        if (openCourses.length === 0) return NextResponse.json({ error: `No open classes remain for ${template.label || "a required session"}` }, { status: 400 });
        const selectedCourseId = selectedBySession[template.id];
        if (!selectedCourseId) return NextResponse.json({ error: `Please choose one class for each session for ${firstName}` }, { status: 400 });
        const selectedCourse = template.courseSessionTemplates.map(cst => cst.course).find(course => course.id === selectedCourseId);
        if (!selectedCourse || !ageMatches(selectedCourse, ageGroup.id)) return NextResponse.json({ error: `One or more selected classes are not available for ${firstName}` }, { status: 400 });
        const slotKey = weeklySessionKey(template);
        const existingCourseForSlot = selectedWeeklySlotCourse.get(slotKey);
        if (existingCourseForSlot && existingCourseForSlot !== selectedCourse.id) return NextResponse.json({ error: "Please choose one class for each weekly session; the same weekly session cannot have different class choices on different days" }, { status: 400 });
        selectedWeeklySlotCourse.set(slotKey, selectedCourse.id);
        const courseSlots = selectedCourseWeeklySlots.get(selectedCourse.id) || new Set<string>();
        courseSlots.add(slotKey);
        selectedCourseWeeklySlots.set(selectedCourse.id, courseSlots);
        if (courseSlots.size > 1) return NextResponse.json({ error: `Each class can only be chosen once for ${firstName}.` }, { status: 400 });
        selections.push({ sessionTemplateId: template.id, course: selectedCourse, template });
      }
    } else if (classChoicesEnabled && fallbackCourseIds.length > 0) {
      const courses = await prisma.course.findMany({
        where: { id: { in: fallbackCourseIds }, campId, OR: [{ ageGroupId: student.ageGroupId || undefined }, { courseAgeGroups: { some: { ageGroupId: student.ageGroupId || undefined } } }] },
        include: { courseAgeGroups: true, courseSessionTemplates: true, sessions: { where: { campId }, select: { id: true, sessionTemplateId: true, enrolledCount: true } } },
        orderBy: { name: "asc" },
      });
      if (courses.length !== fallbackCourseIds.length) return NextResponse.json({ error: `One or more selected classes are not available for ${firstName}` }, { status: 400 });
      for (const course of courses) {
        for (const cst of course.courseSessionTemplates) {
          const template = sessionTemplates.find(t => t.id === cst.sessionTemplateId);
          selections.push({ sessionTemplateId: cst.sessionTemplateId, course, template });
        }
      }
    }

    if (classChoicesEnabled && !ageGroup.noSchedule) {
      const requiredRules = mandatoryClassRules.filter(rule => rule.ageGroupId === ageGroup.id);
      if (requiredRules.length > 0) {
        const selectedCourseIds = new Set(selections.map(selection => selection.course.id));
        const missingRules = requiredRules.filter(rule => !selectedCourseIds.has(rule.courseId));
        if (missingRules.length > 0) {
          const missingCourses = await prisma.course.findMany({ where: { campId, id: { in: missingRules.map(rule => rule.courseId) } }, select: { name: true } });
          const missingNames = missingCourses.map(course => course.name).join(", ") || "the required class";
          return NextResponse.json({ error: `${firstName} must choose ${missingNames} before registering.` }, { status: 400 });
        }
      }
    }

    const updating = Boolean(existing && data.updateExisting && data.existingCamperId === existing.id && !familyRegistrationEnabled);
    anyUpdating = anyUpdating || updating;
    const camperData = {
      firstName,
      lastName,
      dateOfBirth: dob,
      ageGroupId: student.ageGroupId || undefined,
      guardianName: guardianName || undefined,
      guardianEmail,
      guardianPhone: guardianPhone || undefined,
      emergencyPhone: clean(student.emergencyPhone) || undefined,
      tshirtSize: clean(student.tshirtSize) || undefined,
      photoConsent: Boolean(student.photoConsent),
      medicalNotes: clean(student.medicalNotes) || undefined,
      dietaryNotes: clean(student.dietaryNotes) || undefined,
      customData: student.customData ? JSON.stringify({ ...student.customData, familyRegistration: familyRegistrationEnabled ? true : undefined }) : undefined,
      couponCode: coupon?.code,
      campPriceCents: perCamperTotals.campPriceCents,
      discountCents: familyRegistrationEnabled ? 0 : familyTotals.discountCents,
      platformFeeCents: familyRegistrationEnabled ? 0 : familyTotals.platformFeeCents,
      totalPaidCents: familyRegistrationEnabled ? 0 : familyTotals.totalCents,
      paymentStatus: familyTotals.totalCents > 0 && !updating ? "pending" : "not_required",
    };

    const camper = updating ? await prisma.camper.update({ where: { id: existing!.id }, data: camperData }) : await prisma.camper.create({ data: { ...camperData, campId } });
    createdCamperIds.push(camper.id);

    if (updating) {
      const oldEnrollments = await prisma.enrollment.findMany({ where: { camperId: camper.id, campId }, select: { sessionId: true } });
      await prisma.enrollment.deleteMany({ where: { camperId: camper.id, campId } });
      for (const old of oldEnrollments) await prisma.session.update({ where: { id: old.sessionId }, data: { enrolledCount: { decrement: 1 } } });
    }

    const enrolledSessionIds = new Set<string>();
    for (const selection of selections) {
      let session = await prisma.session.findFirst({ where: { campId, courseId: selection.course.id, sessionTemplateId: selection.sessionTemplateId } });
      if (!session) {
        const template = sessionTemplates.find(t => t.id === selection.sessionTemplateId);
        session = await prisma.session.create({ data: { campId, courseId: selection.course.id, sessionTemplateId: selection.sessionTemplateId, roomId: selection.course.roomId, startTime: template?.startTime, endTime: template?.endTime } });
      }
      if (enrolledSessionIds.has(session.id)) continue;
      if (selection.course.cap !== null && session.enrolledCount >= (selection.course.cap ?? 0)) return NextResponse.json({ error: `${selection.course.name} just filled up. Please choose a different class for ${firstName}.` }, { status: 409 });
      enrolledSessionIds.add(session.id);
      const already = await prisma.enrollment.findFirst({ where: { camperId: camper.id, sessionId: session.id } });
      if (!already) {
        await prisma.enrollment.create({ data: { campId, camperId: camper.id, sessionId: session.id, status: "enrolled" } });
        await prisma.session.update({ where: { id: session.id }, data: { enrolledCount: { increment: 1 } } });
      }
    }

    for (const assignment of mandatoryAssignments) {
      let session = assignment.sessions[0] ? await prisma.session.findUnique({ where: { id: assignment.sessions[0].id } }) : null;
      if (!session) {
        session = await prisma.session.create({ data: { campId, courseId: null, mandatorySessionId: assignment.id, sessionTemplateId: assignment.sessionTemplateId, roomId: assignment.roomId, startTime: assignment.sessionTemplate.startTime, endTime: assignment.sessionTemplate.endTime } });
      }
      if (enrolledSessionIds.has(session.id)) continue;
      enrolledSessionIds.add(session.id);
      const already = await prisma.enrollment.findFirst({ where: { camperId: camper.id, sessionId: session.id } });
      if (!already) {
        await prisma.enrollment.create({ data: { campId, camperId: camper.id, sessionId: session.id, status: "enrolled" } });
        await prisma.session.update({ where: { id: session.id }, data: { enrolledCount: { increment: 1 } } });
      }
    }

    const classScheduleRows: ConfirmationScheduleRow[] = [
      ...mandatoryAssignments.map(assignment => ({
        label: assignment.sessionTemplate.label || "Required session",
        className: assignment.title,
        startTime: assignment.sessionTemplate.startTime,
        endTime: assignment.sessionTemplate.endTime,
        dayOfWeek: assignment.sessionTemplate.dayOfWeek,
        mandatory: true,
      })),
      ...selections.map(selection => ({
        label: selection.template?.label || "Session",
        className: selection.course.name,
        startTime: selection.template?.startTime,
        endTime: selection.template?.endTime,
        dayOfWeek: selection.template?.dayOfWeek,
        mandatory: false,
      })),
    ];

    createdStudents.push({
      camperId: camper.id,
      firstName,
      lastName,
      dateOfBirth: student.dateOfBirth,
      ageGroupName: ageGroup.name,
      emergencyPhone: student.emergencyPhone,
      photoConsent: Boolean(student.photoConsent),
      courseNames: classScheduleRows.map(row => row.mandatory ? `${row.className} (included)` : row.className),
      classScheduleRows,
      customData: student.customData,
    });
  }

  const emailPaymentRequired = camp.billingMode === "camperFee" && !anyUpdating && familyTotals.totalCents > 0;

  let emailSent = false;
  try {
    const result = await sendConfirmationEmail({ campName: camp.name, guardian: { name: guardianName, email: guardianEmail, phone: guardianPhone }, students: createdStudents, totals: familyTotals, paymentRequired: emailPaymentRequired, settings: selectedForm || {}, updated: anyUpdating });
    emailSent = result.sent;
  } catch (error) {
    console.error("Registration confirmation email failed", error);
  }

  let adminEmailSent = false;
  let adminEmailCount = 0;
  const adminRecipients = parseNotificationEmails(selectedForm?.adminNotificationEmails);
  try {
    const result = await sendAdminNotificationEmail({ campName: camp.name, guardian: { name: guardianName, email: guardianEmail, phone: guardianPhone }, students: createdStudents, totals: familyTotals, paymentRequired: emailPaymentRequired, recipients: adminRecipients, updated: anyUpdating });
    adminEmailSent = result.sent;
    adminEmailCount = result.count;
  } catch (error) {
    console.error("Registration admin notification email failed", error);
  }

  if (coupon?.id && !anyUpdating) {
    await prisma.campCoupon.update({ where: { id: coupon.id }, data: { redeemedCount: { increment: 1 } } });
  }

  if (camp.billingMode === "camperFee" && !anyUpdating && familyTotals.totalCents > 0) {
    const stripe = getStripe();
    if (stripe) {
      const checkout = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: guardianEmail,
        line_items: [{ price_data: { currency: "usd", unit_amount: familyTotals.totalCents, product_data: { name: `${camp.name} registration${createdStudents.length > 1 ? ` (${createdStudents.length} students)` : ""}` } }, quantity: 1 }],
        success_url: `${getBaseUrl()}/register/${campId}?payment=success`,
        cancel_url: `${getBaseUrl()}/register/${campId}?payment=cancelled`,
        metadata: { campId, camperId: createdCamperIds[0] || "", camperIds: createdCamperIds.join(","), type: "camper_registration", couponCode: coupon?.code || "" },
      });
      await prisma.registrationPayment.create({
        data: { campId, camperId: createdCamperIds[0] || undefined, guardianEmail, amountCents: familyTotals.totalCents, campPriceCents: familyTotals.campPriceCents, discountCents: familyTotals.discountCents, platformFeeCents: familyTotals.platformFeeCents, couponCode: coupon?.code, status: "pending", stripeCheckoutSession: checkout.id, type: createdStudents.length > 1 ? "family_registration" : "registration" },
      });
      return NextResponse.json({ success: true, updated: anyUpdating, camperIds: createdCamperIds, studentCount: createdStudents.length, emailSent, adminEmailSent, adminEmailCount, paymentRequired: true, checkoutUrl: checkout.url, totals: familyTotals });
    }
    return NextResponse.json({ success: true, updated: anyUpdating, camperIds: createdCamperIds, studentCount: createdStudents.length, emailSent, adminEmailSent, adminEmailCount, paymentRequired: true, paymentUnavailable: true, totals: familyTotals });
  }

  return NextResponse.json({ success: true, updated: anyUpdating, camperIds: createdCamperIds, studentCount: createdStudents.length, emailSent, adminEmailSent, adminEmailCount, paymentRequired: false, totals: familyTotals });
}
