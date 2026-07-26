import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [camp, paidPayments, pendingPayments, courses] = await Promise.all([
    prisma.camp.findUnique({
      where: { id: campId },
      select: {
        id: true,
        name: true,
        status: true,
        registrationOpen: true,
        startDate: true,
        endDate: true,
        _count: { select: { campers: true, courses: true, persons: true, rooms: true, ageGroups: true, sessionTemplates: true } },
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
      select: {
        id: true,
        name: true,
        cap: true,
        attentionDismissals: true,
        courseTeachers: { select: { personId: true } },
        courseSessionTemplates: { select: { sessionTemplateId: true } },
        sessions: { select: { id: true, enrolledCount: true } },
      },
    }),
  ]);

  if (!camp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isDismissed = (course: typeof courses[number], warning: string) => course.attentionDismissals.includes(warning);
  const classesWithoutTeachers = courses.filter((course) => course.courseTeachers.length === 0 && !isDismissed(course, "teacher")).length;
  const unscheduledClasses = courses.filter((course) => course.courseSessionTemplates.length === 0 && course.sessions.length === 0 && !isDismissed(course, "schedule")).length;
  const fullOrOverCapacityClasses = courses.filter((course) => {
    if (!course.cap || course.cap <= 0) return false;
    // Capacity is per scheduled instance of the activity. Summing enrollment
    // across every time block made a five-session activity look full at 5× its
    // actual per-session roster.
    return course.sessions.some((session) => (session.enrolledCount || 0) >= course.cap!) && !isDismissed(course, "capacity");
  }).length;
  const classesWithNoEnrollment = courses.filter((course) => course.sessions.reduce((sum, s) => sum + (s.enrolledCount || 0), 0) === 0).length;

  return NextResponse.json({
    camp: { ...camp, myRole: member.role },
    stats: {
      registeredStudents: camp._count.campers,
      classes: camp._count.courses,
      teachers: camp._count.persons,
      ageGroups: camp._count.ageGroups,
      rooms: camp._count.rooms,
      scheduleBlocks: camp._count.sessionTemplates,
      paymentCollectedCents: paidPayments._sum.amountCents || 0,
      paidPaymentCount: paidPayments._count,
      pendingPaymentCount: pendingPayments,
    },
    attention: {
      classesWithoutTeachers,
      unscheduledClasses,
      fullOrOverCapacityClasses,
      classesWithNoEnrollment,
    },
  });
}
