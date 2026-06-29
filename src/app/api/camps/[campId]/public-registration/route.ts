import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getResend, FROM_EMAIL } from "@/lib/email";
import { getBaseUrl, getStripe } from "@/lib/billing";

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
  selectedSessionCourseIds?: Record<string, string>;
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

function ageMatches(course: { ageGroupId: string | null; courseAgeGroups: { ageGroupId: string }[] }, ageGroupId: string) {
  return course.ageGroupId === ageGroupId || course.courseAgeGroups.some(ag => ag.ageGroupId === ageGroupId);
}

function weeklySessionKey(template: { label: string | null; startTime: string | null; endTime: string | null; mandatory?: boolean | null }) {
  return `${template.label || "Session"}|${template.startTime || ""}|${template.endTime || ""}|${template.mandatory ? "required" : "optional"}`;
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

  const camp = await prisma.camp.findUnique({
    where: { id: campId },
    select: { id: true, name: true, registrationOpen: true, billingMode: true, platformFeeCents: true },
  });
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

  const selectedBySession = Object.fromEntries(
    Object.entries(data.selectedSessionCourseIds || {}).filter(([sessionTemplateId, courseId]) => sessionTemplateId && courseId)
  );
  const fallbackCourseIds = [...new Set((Array.isArray(data.selectedCourseIds) ? data.selectedCourseIds : []).filter(Boolean))];

  const ageGroup = await prisma.ageGroup.findFirst({ where: { id: data.ageGroupId, campId }, select: { id: true, noSchedule: true } });
  if (!ageGroup) return NextResponse.json({ error: "Selected age group is not available for this camp" }, { status: 400 });

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

  const selections: Array<{ sessionTemplateId: string; course: typeof sessionTemplates[number]["courseSessionTemplates"][number]["course"] }> = [];
  const mandatoryAssignments = ageGroup.noSchedule ? [] : await prisma.mandatorySession.findMany({
    where: { campId, ageGroupId: ageGroup.id },
    include: {
      sessionTemplate: true,
      room: true,
      leader: true,
      sessions: { where: { campId }, select: { id: true } },
    },
    orderBy: [{ sessionTemplate: { startTime: "asc" } }, { title: "asc" }],
  });
  const mandatoryTemplateIds = new Set(mandatoryAssignments.map(ms => ms.sessionTemplateId));
  const selectedCourseWeeklySlots = new Map<string, Set<string>>();
  const selectedWeeklySlotCourse = new Map<string, string>();

  if (!ageGroup.noSchedule && sessionTemplates.length > 0) {
    for (const template of sessionTemplates) {
      if (template.mandatory || mandatoryTemplateIds.has(template.id)) continue;
      const eligibleCourses = template.courseSessionTemplates
        .map(cst => cst.course)
        .filter(course => ageMatches(course, ageGroup.id));
      if (eligibleCourses.length === 0) continue;

      const openCourses = eligibleCourses
        .filter(course => {
          const existingSession = course.sessions.find(s => s.sessionTemplateId === template.id);
          if (course.cap === null) return true;
          return (course.cap ?? 0) > (existingSession?.enrolledCount ?? 0);
        });

      if (openCourses.length === 0) {
        return NextResponse.json({ error: `No open classes remain for ${template.label || "a required session"}` }, { status: 400 });
      }

      const selectedCourseId = selectedBySession[template.id];
      if (!selectedCourseId) {
        return NextResponse.json({ error: "Please choose one class for each non-mandatory session" }, { status: 400 });
      }

      const selectedCourse = template.courseSessionTemplates.map(cst => cst.course).find(course => course.id === selectedCourseId);
      if (!selectedCourse || !ageMatches(selectedCourse, ageGroup.id)) {
        return NextResponse.json({ error: "One or more selected classes are not available for this age group/session" }, { status: 400 });
      }

      const slotKey = weeklySessionKey(template);
      const existingCourseForSlot = selectedWeeklySlotCourse.get(slotKey);
      if (existingCourseForSlot && existingCourseForSlot !== selectedCourse.id) {
        return NextResponse.json({ error: "Please choose one class for each weekly session; the same weekly session cannot have different class choices on different days" }, { status: 400 });
      }
      selectedWeeklySlotCourse.set(slotKey, selectedCourse.id);
      const courseSlots = selectedCourseWeeklySlots.get(selectedCourse.id) || new Set<string>();
      courseSlots.add(slotKey);
      selectedCourseWeeklySlots.set(selectedCourse.id, courseSlots);
      if (courseSlots.size > 1) {
        return NextResponse.json({ error: "Each class can only be chosen once. Please pick a different class for one of the sessions." }, { status: 400 });
      }

      selections.push({ sessionTemplateId: template.id, course: selectedCourse });
    }
  } else if (fallbackCourseIds.length > 0) {
    const courses = await prisma.course.findMany({
      where: {
        id: { in: fallbackCourseIds },
        campId,
        OR: [
          { ageGroupId: data.ageGroupId || undefined },
          { courseAgeGroups: { some: { ageGroupId: data.ageGroupId || undefined } } },
        ],
      },
      include: { courseAgeGroups: true, courseSessionTemplates: true, sessions: { where: { campId }, select: { id: true, sessionTemplateId: true, enrolledCount: true } } },
      orderBy: { name: "asc" },
    });
    if (courses.length !== fallbackCourseIds.length) {
      return NextResponse.json({ error: "One or more selected classes are not available for this age group" }, { status: 400 });
    }
    for (const course of courses) {
      for (const cst of course.courseSessionTemplates) selections.push({ sessionTemplateId: cst.sessionTemplateId, course });
    }
  }

  const updating = Boolean(existing && (data.updateExisting || data.existingCamperId === existing.id));
  const existingEnrollmentSessionIds = updating ? new Set((await prisma.enrollment.findMany({
    where: { camperId: existing!.id, campId },
    select: { sessionId: true },
  })).map(e => e.sessionId)) : new Set<string>();

  for (const selection of selections) {
    const currentSession = selection.course.sessions.find(s => s.sessionTemplateId === selection.sessionTemplateId);
    const alreadyInThisSession = currentSession ? existingEnrollmentSessionIds.has(currentSession.id) : false;
    if (!alreadyInThisSession && selection.course.cap !== null && (currentSession?.enrolledCount ?? 0) >= (selection.course.cap ?? 0)) {
      return NextResponse.json({ error: `${selection.course.name} just filled up. Please choose a different class.` }, { status: 409 });
    }
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
  for (const selection of selections) {
    let session = await prisma.session.findFirst({
      where: {
        campId,
        courseId: selection.course.id,
        sessionTemplateId: selection.sessionTemplateId,
      },
    });

    if (!session) {
      const template = sessionTemplates.find(t => t.id === selection.sessionTemplateId);
      session = await prisma.session.create({
        data: {
          campId,
          courseId: selection.course.id,
          sessionTemplateId: selection.sessionTemplateId,
          roomId: selection.course.roomId,
          startTime: template?.startTime,
          endTime: template?.endTime,
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

  for (const assignment of mandatoryAssignments) {
    let session = assignment.sessions[0]
      ? await prisma.session.findUnique({ where: { id: assignment.sessions[0].id } })
      : null;

    if (!session) {
      session = await prisma.session.create({
        data: {
          campId,
          courseId: null,
          mandatorySessionId: assignment.id,
          sessionTemplateId: assignment.sessionTemplateId,
          roomId: assignment.roomId,
          startTime: assignment.sessionTemplate.startTime,
          endTime: assignment.sessionTemplate.endTime,
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

  const courseNames = [
    ...mandatoryAssignments.map(a => `${a.title} (required)`),
    ...selections.map(s => s.course.name),
  ];
  let emailSent = false;
  try {
    const result = await sendConfirmationEmail({ campName: camp.name, data: { ...data, firstName, lastName, guardianEmail }, courseNames, updated: updating });
    emailSent = result.sent;
  } catch (error) {
    console.error("Registration confirmation email failed", error);
  }

  if (camp.billingMode === "camperFee" && !updating) {
    const stripe = getStripe();
    const amountCents = camp.platformFeeCents || 300;
    if (stripe && amountCents > 0) {
      const checkout = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: guardianEmail,
        line_items: [{
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: { name: `${camp.name} platform fee` },
          },
          quantity: 1,
        }],
        success_url: `${getBaseUrl()}/register/${campId}?payment=success`,
        cancel_url: `${getBaseUrl()}/register/${campId}?payment=cancelled`,
        metadata: { campId, camperId: camper.id, type: "camper_platform_fee" },
      });
      await prisma.registrationPayment.create({
        data: {
          campId,
          camperId: camper.id,
          guardianEmail,
          amountCents,
          status: "pending",
          stripeCheckoutSession: checkout.id,
          type: "platform_fee",
        },
      });
      return NextResponse.json({ success: true, updated: updating, camperId: camper.id, emailSent, paymentRequired: true, checkoutUrl: checkout.url });
    }
    return NextResponse.json({ success: true, updated: updating, camperId: camper.id, emailSent, paymentRequired: true, paymentUnavailable: true });
  }

  return NextResponse.json({ success: true, updated: updating, camperId: camper.id, emailSent, paymentRequired: false });
}
