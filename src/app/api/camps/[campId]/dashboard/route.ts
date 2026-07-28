import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { effectiveCapacity, exceedsRoom, hasUnsetLimit, formatCapacity } from "@/lib/capacity-rules";

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
        heldSeats: true,
        room: { select: { name: true, capacity: true } },
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
    const effective = effectiveCapacity(course);
    if (!Number.isFinite(effective) || effective <= 0) return false;
    // Capacity is per scheduled instance of the activity. Summing enrollment
    // across every time block made a five-session activity look full at 5× its
    // actual per-session roster.
    return course.sessions.some((session) => (session.enrolledCount || 0) >= effective) && !isDismissed(course, "capacity");
  }).length;
  // Advisory: the class limit exceeds what the room fits. This does NOT block
  // enrollment — the class limit is the only gate. It flags a space mismatch.
  const capsAboveRoomCapacity = courses
    .filter((course) => exceedsRoom(course, course.room) && course.room?.capacity != null)
    .map((course) => ({
      courseId: course.id,
      message: `${course.name} allows ${formatCapacity(course)} but ${course.room!.name} holds ${course.room!.capacity}`,
    }));
  // Loud flag: no class limit set means unlimited registration.
  const classesWithNoLimit = courses
    .filter((course) => hasUnsetLimit(course) && !isDismissed(course, "limit"))
    .map((course) => ({
      courseId: course.id,
      message: `${course.name} has no limit set and will accept unlimited registration`,
    }));
  const classesWithNoRoom = courses
    .filter((course) => !course.room)
    .map((course) => ({
      courseId: course.id,
      message: `${course.name} has no room assigned`,
    }));
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
      capsAboveRoomCapacity,
      classesWithNoRoom,
      classesWithNoLimit,
    },
  });
}
