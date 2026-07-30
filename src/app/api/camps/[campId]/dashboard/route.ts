import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { effectiveCapacity } from "@/lib/capacity-rules";
import { canOpenRegistration, countsByCode, detectIssues, issueCounts } from "@/lib/issues";
import { countTimeBlockGroups } from "@/lib/timeBlocks";
import { teacherCoverageDone } from "@/lib/setupPhases";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [camp, paidPayments, pendingPayments, courses, timeBlocks, ageGroups, participantCounts] = await Promise.all([
    prisma.camp.findUnique({
      where: { id: campId },
      select: {
        id: true,
        name: true,
        status: true,
        registrationOpen: true,
        startDate: true,
        endDate: true,
        _count: { select: { participants: true, courses: true, persons: true, rooms: true, ageGroups: true, sessionTemplates: true } },
      },
    }),
    prisma.registrationPayment.aggregate({
      where: { campId, status: "paid" },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.registrationPayment.count({ where: { campId, status: "pending" } }),
    prisma.course.findMany({
      where: { campId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        cap: true,
        heldSeats: true,
        status: true,
        color: true,
        ageGroupId: true,
        room: { select: { id: true, name: true, capacity: true } },
        attentionDismissals: true,
        courseTeachers: {
          select: { personId: true, person: { select: { id: true, firstName: true, lastName: true } } },
        },
        courseAgeGroups: { select: { ageGroupId: true } },
        courseSessionTemplates: { select: { sessionTemplateId: true } },
        sessions: {
          select: {
            id: true,
            sessionTemplateId: true,
            enrolledCount: true,
            sessionTeachers: { select: { personId: true } },
          },
        },
      },
    }),
    // Grid axes: time blocks are the columns, age groups drive the row chips.
    prisma.sessionTemplate.findMany({
      where: { campId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      select: { id: true, label: true, dayOfWeek: true, startTime: true, endTime: true, mandatory: true },
    }),
    prisma.ageGroup.findMany({
      where: { campId },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, color: true, noSchedule: true },
    }),
    // Demand per age group, for the seat-shortfall rule.
    prisma.participant.groupBy({
      by: ["ageGroupId"],
      where: { campId },
      _count: { _all: true },
    }),
  ]);

  if (!camp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Every issue string in the product originates in one module (phase 18b). This
  // route reports what the engine found; it does not decide anything itself.
  const participantsByAgeGroup = Object.fromEntries(
    participantCounts
      .filter((row) => row.ageGroupId)
      .map((row) => [row.ageGroupId as string, row._count._all]),
  );
  const issues = detectIssues({
    courses,
    blocks: timeBlocks,
    ageGroups,
    persons: courses.flatMap((course) => course.courseTeachers.map((entry) => entry.person)),
    participantsByAgeGroup,
  });
  const byCode = countsByCode(issues);
  const severity = issueCounts(issues);
  const detailsReady = Boolean(camp.name.trim() && camp.startDate && camp.endDate);
  const activitiesReady = courses.length > 0;
  const teachersReady = teacherCoverageDone(
    camp._count.persons,
    courses.map((course) => ({
      scheduled: course.courseSessionTemplates.length > 0,
      teacherCount: course.courseTeachers.length,
    })),
  );
  const scheduleReady = activitiesReady && courses.every((course) => course.courseSessionTemplates.length > 0);
  const registrationReady = Boolean(
    detailsReady &&
    camp._count.ageGroups > 0 &&
    camp._count.rooms > 0 &&
    countTimeBlockGroups(timeBlocks) > 0 &&
    teachersReady &&
    activitiesReady &&
    scheduleReady
  );
  const reviewReady = Boolean(camp.registrationOpen && registrationReady);

  const withMessages = (code: string) =>
    issues
      .filter((issue) => issue.code === code)
      .map((issue) => ({ courseId: issue.courseId, message: issue.message }));

  return NextResponse.json({
    camp: { ...camp, myRole: member.role },
    stats: {
      registeredStudents: camp._count.participants,
      classes: camp._count.courses,
      teachers: camp._count.persons,
      ageGroups: camp._count.ageGroups,
      rooms: camp._count.rooms,
      scheduleBlocks: countTimeBlockGroups(timeBlocks),
      detailsReady,
      teachersReady,
      activitiesReady,
      scheduleReady,
      registrationReady,
      reviewReady,
      paymentCollectedCents: paidPayments._sum.amountCents || 0,
      paidPaymentCount: paidPayments._count,
      pendingPaymentCount: pendingPayments,
    },
    // The full issue list, plus the shapes the existing tiles already consume.
    // Both are derived from the same detectIssues() call, so they cannot disagree.
    issues,
    issueSummary: { ...severity, canOpenRegistration: canOpenRegistration(issues) },
    attention: {
      classesWithoutTeachers: byCode["no-teacher"] ?? 0,
      unscheduledClasses: byCode["unscheduled"] ?? 0,
      // Historically this tile counted full-or-over. Full is not a problem, so it
      // now reports genuine overflow only — the count may legitimately drop.
      fullOrOverCapacityClasses: byCode["over-capacity"] ?? 0,
      classesWithNoEnrollment: byCode["empty"] ?? 0,
      capsAboveRoomCapacity: withMessages("cap-above-room"),
      classesWithNoRoom: withMessages("roomless"),
      classesWithNoLimit: withMessages("no-limit-set"),
      roomClashes: withMessages("room-clash"),
      teacherClashes: withMessages("teacher-clash"),
      seatShortfalls: withMessages("seat-shortfall"),
      ageGroupGaps: withMessages("age-group-gap"),
    },
    // Operations grid (dashboard spec Slice 1). Rows are activities, columns are
    // time blocks, cells are sessions.
    grid: {
      courses: courses.map((course) => ({
        id: course.id,
        name: course.name,
        cap: course.cap,
        status: course.status,
        color: course.color,
        ageGroupId: course.ageGroupId,
        room: course.room,
        courseTeachers: course.courseTeachers.map((entry) => ({ person: entry.person })),
        courseAgeGroups: course.courseAgeGroups,
        sessions: course.sessions,
      })),
      blocks: timeBlocks.map((block) => ({
        id: block.id,
        label: block.label ?? "",
        dayOfWeek: block.dayOfWeek,
        startTime: block.startTime,
        endTime: block.endTime,
        mandatory: block.mandatory,
      })),
      ageGroups,
    },
  });
}
