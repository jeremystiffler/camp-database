import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getResend, FROM_EMAIL } from "@/lib/email";

interface RegistrationPayload {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  ageGroupId?: string;
  guardianName?: string;
  guardianEmail?: string;
  guardianPhone?: string;
  emergencyPhone?: string;
  tshirtSize?: string;
  medicalNotes?: string;
  dietaryNotes?: string;
  photoConsent?: boolean;
  selectedCourseIds?: string[];
  customData?: Record<string, unknown>;
  updateExisting?: boolean;
  existingCamperId?: string;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

async function sendConfirmationEmail({
  campName,
  data,
  courseNames,
  updated,
}: {
  campName: string;
  data: RegistrationPayload;
  courseNames: string[];
  updated: boolean;
}) {
  if (!process.env.RESEND_API_KEY || !data.guardianEmail) return { sent: false };

  const resend = getResend();
  const studentName = `${data.firstName} ${data.lastName}`.trim();
  const coursesHtml = courseNames.length
    ? `<ul>${courseNames.map(name => `<li>${name}</li>`).join("")}</ul>`
    : `<p>No classes selected yet.</p>`;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#1e293b;max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:16px;padding:20px;margin-bottom:18px;">
        <h1 style="margin:0 0 8px;font-size:22px;color:#166534;">${updated ? "Registration updated" : "Registration received"}</h1>
        <p style="margin:0;color:#475569;">Please review the details below for <strong>${studentName}</strong> at <strong>${campName}</strong>.</p>
      </div>
      <h2 style="font-size:16px;margin:18px 0 8px;">Parent / Guardian</h2>
      <p style="margin:0 0 10px;">${data.guardianName || ""}<br>${data.guardianEmail || ""}<br>${data.guardianPhone || ""}</p>
      <h2 style="font-size:16px;margin:18px 0 8px;">Student</h2>
      <p style="margin:0 0 10px;">${studentName}${data.dateOfBirth ? `<br>DOB: ${data.dateOfBirth}` : ""}</p>
      <h2 style="font-size:16px;margin:18px 0 8px;">Classes</h2>
      ${coursesHtml}
      <h2 style="font-size:16px;margin:18px 0 8px;">Emergency / Consent</h2>
      <p style="margin:0;">Emergency phone: ${data.emergencyPhone || ""}<br>Photo consent: ${data.photoConsent ? "Yes" : "No"}</p>
      <p style="margin-top:22px;color:#64748b;font-size:13px;">Need to change something? Return to the registration form and enter the same student information; the system will offer to update the existing registration instead of creating a duplicate.</p>
    </div>`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: data.guardianEmail,
    subject: `${campName} registration ${updated ? "updated" : "confirmation"} — ${studentName}`,
    html,
  });
  return { sent: true };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const { campId } = await params;
  const data = await req.json() as RegistrationPayload;

  const camp = await prisma.camp.findUnique({ where: { id: campId }, select: { id: true, name: true, registrationOpen: true } });
  if (!camp) return NextResponse.json({ error: "Camp not found" }, { status: 404 });
  if (!camp.registrationOpen) return NextResponse.json({ error: "Registration is closed" }, { status: 403 });

  const firstName = clean(data.firstName);
  const lastName = clean(data.lastName);
  const guardianEmail = clean(data.guardianEmail).toLowerCase();
  const dob = normalizedDate(data.dateOfBirth);

  if (!firstName || !lastName || !guardianEmail || !data.ageGroupId) {
    return NextResponse.json({ error: "Missing required registration fields" }, { status: 400 });
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

  if (existing && !data.updateExisting && data.existingCamperId !== existing.id) {
    return NextResponse.json({
      duplicate: true,
      camperId: existing.id,
      message: "This student already appears to be registered. Would you like to update the original registration instead?",
    }, { status: 409 });
  }

  const courseIds = [...new Set((Array.isArray(data.selectedCourseIds) ? data.selectedCourseIds : []).filter(Boolean))];
  const courses = courseIds.length ? await prisma.course.findMany({
    where: {
      id: { in: courseIds },
      campId,
      OR: [
        { ageGroupId: data.ageGroupId || undefined },
        { courseAgeGroups: { some: { ageGroupId: data.ageGroupId || undefined } } },
      ],
    },
    include: { courseSessionTemplates: { include: { sessionTemplate: true } } },
    orderBy: { name: "asc" },
  }) : [];

  if (courses.length !== courseIds.length) {
    return NextResponse.json({ error: "One or more selected classes are not available for this age group" }, { status: 400 });
  }

  const camperData = {
    firstName,
    lastName,
    dateOfBirth: dob,
    ageGroupId: data.ageGroupId || undefined,
    guardianName: clean(data.guardianName) || undefined,
    guardianEmail,
    guardianPhone: clean(data.guardianPhone) || undefined,
    emergencyPhone: clean(data.emergencyPhone) || undefined,
    tshirtSize: clean(data.tshirtSize) || undefined,
    photoConsent: Boolean(data.photoConsent),
    medicalNotes: clean(data.medicalNotes) || undefined,
    dietaryNotes: clean(data.dietaryNotes) || undefined,
    customData: data.customData ? JSON.stringify(data.customData) : undefined,
  };

  const updating = Boolean(existing && (data.updateExisting || data.existingCamperId === existing.id));
  const camper = updating
    ? await prisma.camper.update({ where: { id: existing!.id }, data: camperData })
    : await prisma.camper.create({ data: { ...camperData, campId } });

  if (updating) {
    const oldEnrollments = await prisma.enrollment.findMany({ where: { camperId: camper.id, campId }, select: { sessionId: true } });
    await prisma.enrollment.deleteMany({ where: { camperId: camper.id, campId } });
    for (const old of oldEnrollments) {
      await prisma.session.update({ where: { id: old.sessionId }, data: { enrolledCount: { decrement: 1 } } });
    }
  }

  const enrolledSessionIds = new Set<string>();
  for (const course of courses) {
    const templates = course.courseSessionTemplates.length > 0
      ? course.courseSessionTemplates
      : [{ sessionTemplateId: null, sessionTemplate: null }];

    for (const cst of templates) {
      let session = await prisma.session.findFirst({
        where: {
          campId,
          courseId: course.id,
          sessionTemplateId: cst.sessionTemplateId,
        },
      });

      if (!session) {
        session = await prisma.session.create({
          data: {
            campId,
            courseId: course.id,
            sessionTemplateId: cst.sessionTemplateId,
            roomId: course.roomId,
            startTime: cst.sessionTemplate?.startTime,
            endTime: cst.sessionTemplate?.endTime,
          },
        });
      }

      if (enrolledSessionIds.has(session.id)) continue;
      enrolledSessionIds.add(session.id);

      const already = await prisma.enrollment.findFirst({ where: { camperId: camper.id, sessionId: session.id } });
      if (!already) {
        await prisma.enrollment.create({ data: { campId, camperId: camper.id, sessionId: session.id, status: "enrolled" } });
        await prisma.session.update({ where: { id: session.id }, data: { enrolledCount: { increment: 1 } } });
      }
    }
  }

  let emailSent = false;
  try {
    const result = await sendConfirmationEmail({ campName: camp.name, data: { ...data, firstName, lastName, guardianEmail }, courseNames: courses.map(c => c.name), updated: updating });
    emailSent = result.sent;
  } catch (error) {
    console.error("Registration confirmation email failed", error);
  }

  return NextResponse.json({ success: true, updated: updating, camperId: camper.id, emailSent });
}
