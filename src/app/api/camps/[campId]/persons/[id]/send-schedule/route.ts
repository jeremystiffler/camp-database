import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getResend, FROM_EMAIL } from "@/lib/email";

async function checkAccess(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

// GET — preview what would be sent (no email actually sent)
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ campId: string; id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await buildScheduleData(campId, id);
  if (!data) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  return NextResponse.json(data);
}

// POST — actually send the email
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campId: string; id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, id } = await params;
  if (!await checkAccess(session.userId, campId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await buildScheduleData(campId, id);
  if (!data) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

  if (!data.person.email) {
    return NextResponse.json({ error: "Teacher has no email address on file" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email not configured (RESEND_API_KEY missing)" }, { status: 503 });
  }

  const body = req.body ? await req.json().catch(() => ({})) : {};
  const customNote = (body as { note?: string }).note || "";

  const html = buildEmailHtml(data, customNote);

  const resend = getResend();
  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.person.email,
    subject: `Your Schedule — ${data.camp.name}`,
    html,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, emailId: result.data?.id });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

interface ScheduleData {
  person: { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null; role: string };
  camp: { name: string; startDate?: Date | null; endDate?: Date | null };
  courses: Array<{
    id: string;
    name: string;
    description?: string | null;
    color: string;
    room?: string | null;
    ageGroups: string[];
    timeSlots: Array<{ label?: string | null; dayOfWeek?: number | null; startTime: string; endTime: string }>;
    campers: Array<{ firstName: string; lastName: string; ageGroup?: string | null; guardianName?: string | null; guardianEmail?: string | null; medicalNotes?: string | null }>;
  }>;
}

async function buildScheduleData(campId: string, personId: string): Promise<ScheduleData | null> {
  const person = await prisma.person.findFirst({ where: { id: personId, campId } });
  if (!person) return null;

  const camp = await prisma.camp.findUnique({ where: { id: campId }, select: { name: true, startDate: true, endDate: true } });
  if (!camp) return null;

  // All courses this teacher is assigned to
  const courseTeachers = await prisma.courseTeacher.findMany({
    where: { personId, course: { campId } },
    select: { courseId: true },
  });
  const courseIds = courseTeachers.map(ct => ct.courseId);

  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      room: { select: { name: true } },
      courseAgeGroups: { select: { ageGroup: { select: { name: true, color: true } } } },
      courseSessionTemplates: {
        select: {
          sessionTemplate: { select: { label: true, dayOfWeek: true, startTime: true, endTime: true } },
        },
      },
    },
  });

  // For each course get enrolled campers via sessions
  const result: ScheduleData["courses"] = [];
  for (const course of courses) {
    // Get all sessions for this course
    const sessions = await prisma.session.findMany({
      where: { courseId: course.id, campId },
      select: { id: true },
    });
    const sessionIds = sessions.map(s => s.id);

    // Get enrollments with camper details
    const enrollments = await prisma.enrollment.findMany({
      where: { sessionId: { in: sessionIds }, status: "enrolled" },
      select: {
        camper: {
          select: {
            firstName: true,
            lastName: true,
            ageGroup: { select: { name: true } },
            guardianName: true,
            guardianEmail: true,
            medicalNotes: true,
          },
        },
      },
    });

    // Dedupe campers (same camper enrolled in multiple sessions of same course)
    const seenNames = new Set<string>();
    const campers: ScheduleData["courses"][0]["campers"] = [];
    for (const e of enrollments) {
      const key = `${e.camper.firstName}_${e.camper.lastName}`;
      if (!seenNames.has(key)) {
        seenNames.add(key);
        campers.push({
          firstName: e.camper.firstName,
          lastName: e.camper.lastName,
          ageGroup: e.camper.ageGroup?.name ?? null,
          guardianName: e.camper.guardianName ?? null,
          guardianEmail: e.camper.guardianEmail ?? null,
          medicalNotes: e.camper.medicalNotes ?? null,
        });
      }
    }

    result.push({
      id: course.id,
      name: course.name,
      description: course.description,
      color: course.color,
      room: course.room?.name ?? null,
      ageGroups: course.courseAgeGroups.map(ag => ag.ageGroup.name),
      timeSlots: course.courseSessionTemplates.map(cst => ({
        label: cst.sessionTemplate.label,
        dayOfWeek: cst.sessionTemplate.dayOfWeek,
        startTime: cst.sessionTemplate.startTime,
        endTime: cst.sessionTemplate.endTime,
      })),
      campers,
    });
  }

  return { person, camp, courses: result };
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildEmailHtml(data: ScheduleData, customNote: string): string {
  const { person, camp, courses } = data;
  const campDateRange = camp.startDate
    ? `${new Date(camp.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}${camp.endDate ? ` – ${new Date(camp.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}`
    : "";

  const totalCampers = courses.reduce((sum, c) => sum + c.campers.length, 0);

  const courseBlocks = courses.map(course => {
    const slotsHtml = course.timeSlots.length
      ? course.timeSlots.map(ts => {
          const day = ts.dayOfWeek != null ? DAYS[ts.dayOfWeek] + " " : "";
          return `<span style="display:inline-block;background:#f0f4ff;border:1px solid #c7d2fe;border-radius:6px;padding:3px 10px;font-size:13px;margin:2px 3px 2px 0;color:#4338ca;">⏰ ${ts.label ? ts.label + " — " : ""}${day}${ts.startTime} – ${ts.endTime}</span>`;
        }).join("")
      : `<span style="color:#9ca3af;font-size:13px;">No time slots assigned</span>`;

    const ageGroupsHtml = course.ageGroups.length
      ? course.ageGroups.map(ag => `<span style="display:inline-block;background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:3px 10px;font-size:12px;margin:2px 3px 2px 0;color:#92400e;">${ag}</span>`).join("")
      : "";

    const campersHtml = course.campers.length === 0
      ? `<p style="color:#9ca3af;font-size:13px;margin:8px 0 0;">No students enrolled yet.</p>`
      : `<table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="text-align:left;padding:7px 10px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Student</th>
              <th style="text-align:left;padding:7px 10px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Age Group</th>
              <th style="text-align:left;padding:7px 10px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Guardian</th>
              <th style="text-align:left;padding:7px 10px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Medical Notes</th>
            </tr>
          </thead>
          <tbody>
            ${course.campers.map((c, i) => `
            <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
              <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-weight:500;color:#1e293b;">${c.firstName} ${c.lastName}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#64748b;">${c.ageGroup || "—"}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#64748b;">${c.guardianName || "—"}${c.guardianEmail ? `<br/><span style="font-size:12px;">${c.guardianEmail}</span>` : ""}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:${c.medicalNotes ? "#dc2626" : "#9ca3af"};">${c.medicalNotes || "None"}</td>
            </tr>`).join("")}
          </tbody>
        </table>`;

    return `
      <div style="border:1px solid #e2e8f0;border-left:4px solid ${course.color};border-radius:12px;padding:20px;margin-bottom:20px;background:#ffffff;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <h3 style="margin:0;font-size:17px;font-weight:700;color:#1e293b;">${course.name}</h3>
          <span style="font-size:12px;color:#64748b;">${course.campers.length} student${course.campers.length !== 1 ? "s" : ""}</span>
        </div>
        ${course.description ? `<p style="margin:0 0 10px;font-size:13px;color:#64748b;">${course.description}</p>` : ""}
        ${course.room ? `<p style="margin:0 0 8px;font-size:13px;color:#475569;">📍 Room: <strong>${course.room}</strong></p>` : ""}
        <div style="margin-bottom:8px;">${ageGroupsHtml}${slotsHtml}</div>
        <h4 style="margin:14px 0 0;font-size:14px;font-weight:600;color:#374151;">Student Roster</h4>
        ${campersHtml}
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#22c55e 0%,#0ea5e9 100%);border-radius:16px;padding:28px 32px;margin-bottom:24px;color:#fff;">
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;">📋 Your Camp Schedule</h1>
      <p style="margin:0;font-size:16px;opacity:0.9;">${camp.name}${campDateRange ? ` · ${campDateRange}` : ""}</p>
    </div>

    <!-- Greeting -->
    <div style="background:#ffffff;border-radius:12px;padding:20px 24px;margin-bottom:20px;border:1px solid #e2e8f0;">
      <p style="margin:0 0 8px;font-size:15px;color:#1e293b;">Hi <strong>${person.firstName}</strong>,</p>
      <p style="margin:0;font-size:14px;color:#64748b;">Here's your complete teaching schedule for ${camp.name}. You're assigned to <strong>${courses.length} ${courses.length === 1 ? "activity" : "activities"}</strong> with <strong>${totalCampers} total student${totalCampers !== 1 ? "s" : ""}</strong> enrolled.</p>
      ${customNote ? `<div style="margin-top:12px;padding:12px 16px;background:#fef9c3;border:1px solid #fde047;border-radius:8px;font-size:13px;color:#713f12;">${customNote}</div>` : ""}
    </div>

    <!-- Course blocks -->
    ${courses.length > 0 ? courseBlocks : `<div style="background:#fff;border-radius:12px;padding:32px;text-align:center;color:#9ca3af;border:1px solid #e2e8f0;">No activities assigned yet.</div>`}

    <!-- Footer -->
    <div style="text-align:center;padding:20px 0 8px;font-size:12px;color:#94a3b8;">
      Sent via Camp Manager · If you have questions, reply directly to this email.
    </div>
  </div>
</body>
</html>`;
}
