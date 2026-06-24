import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campId: sourceCampId } = await params;

  // Verify user has access to source camp
  const member = await prisma.campMember.findFirst({ where: { campId: sourceCampId, userId: session.userId } });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const {
    name,
    startDate,
    endDate,
    includeAgeGroups    = true,
    includeRooms        = true,
    includeTeachers     = true,
    includeTimeSlots    = true,
    includeActivities   = true,
    includeRegForm      = true,
  } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: "New camp name is required" }, { status: 400 });

  // Load the source camp
  const source = await prisma.camp.findUnique({
    where: { id: sourceCampId },
    include: {
      ageGroups:        true,
      rooms:            true,
      persons:          true,
      sessionTemplates: true,
      courses: {
        include: {
          courseAgeGroups:        { include: { ageGroup: true } },
          courseTeachers:         { include: { person: true } },
          courseSessionTemplates: { include: { sessionTemplate: true } },
        },
      },
      registrationForm: true,
    },
  });
  if (!source) return NextResponse.json({ error: "Source camp not found" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  // Create the new camp
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") + "-" + Date.now();
  const newCamp = await prisma.camp.create({
    data: {
      organizationId: user.organizationId,
      name:           name.trim(),
      slug,
      status:         "draft",
      primaryColor:   source.primaryColor,
      accentColor:    source.accentColor,
      fontFamily:     source.fontFamily,
      startDate:      startDate ? new Date(startDate) : undefined,
      endDate:        endDate   ? new Date(endDate)   : undefined,
    },
  });

  // Add creator as admin member
  await prisma.campMember.create({ data: { campId: newCamp.id, userId: session.userId, role: "admin" } });

  // ID maps: old id → new id
  const ageGroupMap:     Map<string, string> = new Map();
  const roomMap:         Map<string, string> = new Map();
  const personMap:       Map<string, string> = new Map();
  const sessionTmplMap:  Map<string, string> = new Map();

  // ── Age Groups ────────────────────────────────────────────────────────────
  if (includeAgeGroups) {
    for (const ag of source.ageGroups) {
      const created = await prisma.ageGroup.create({
        data: {
          campId:       newCamp.id,
          name:         ag.name,
          minAge:       ag.minAge ?? undefined,
          maxAge:       ag.maxAge ?? undefined,
          color:        ag.color,
          displayOrder: ag.displayOrder,
          noSchedule:   ag.noSchedule,
        },
      });
      ageGroupMap.set(ag.id, created.id);
    }
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────
  if (includeRooms) {
    for (const room of source.rooms) {
      const created = await prisma.room.create({
        data: {
          campId:      newCamp.id,
          name:        room.name,
          capacity:    room.capacity ?? undefined,
          description: room.description ?? undefined,
        },
      });
      roomMap.set(room.id, created.id);
    }
  }

  // ── Teachers / Staff ──────────────────────────────────────────────────────
  if (includeTeachers) {
    for (const person of source.persons) {
      const created = await prisma.person.create({
        data: {
          campId:    newCamp.id,
          firstName: person.firstName,
          lastName:  person.lastName,
          email:     person.email   ?? undefined,
          phone:     person.phone   ?? undefined,
          role:      person.role,
          bio:       person.bio     ?? undefined,
        },
      });
      personMap.set(person.id, created.id);
    }
  }

  // ── Session Templates (time slots) ────────────────────────────────────────
  if (includeTimeSlots) {
    for (const st of source.sessionTemplates) {
      const created = await prisma.sessionTemplate.create({
        data: {
          campId:    newCamp.id,
          label:     st.label     ?? undefined,
          dayOfWeek: st.dayOfWeek ?? undefined,
          startTime: st.startTime,
          endTime:   st.endTime,
        },
      });
      sessionTmplMap.set(st.id, created.id);
    }
  }

  // ── Courses (activities) ─────────────────────────────────────────────────
  if (includeActivities) {
    for (const course of source.courses) {
      const newRoomId = course.roomId ? (roomMap.get(course.roomId) ?? undefined) : undefined;

      const newCourse = await prisma.course.create({
        data: {
          campId:      newCamp.id,
          name:        course.name,
          description: course.description ?? undefined,
          color:       course.color,
          icon:        course.icon        ?? undefined,
          cap:         course.cap         ?? undefined,
          roomId:      newRoomId,
        },
      });

      // Age group join records
      if (includeAgeGroups) {
        for (const cag of course.courseAgeGroups) {
          const newAgeGroupId = ageGroupMap.get(cag.ageGroupId);
          if (newAgeGroupId) {
            await prisma.courseAgeGroup.create({ data: { courseId: newCourse.id, ageGroupId: newAgeGroupId } });
          }
        }
      }

      // Teacher join records
      if (includeTeachers) {
        for (const ct of course.courseTeachers) {
          const newPersonId = personMap.get(ct.personId);
          if (newPersonId) {
            await prisma.courseTeacher.create({ data: { courseId: newCourse.id, personId: newPersonId } });
          }
        }
      }

      // Session template join records
      if (includeTimeSlots) {
        for (const cst of course.courseSessionTemplates) {
          const newStId = sessionTmplMap.get(cst.sessionTemplateId);
          if (newStId) {
            await prisma.courseSessionTemplate.create({ data: { courseId: newCourse.id, sessionTemplateId: newStId } });
          }
        }
      }
    }
  }

  // ── Registration Form ─────────────────────────────────────────────────────
  if (includeRegForm && source.registrationForm) {
    await prisma.registrationForm.create({
      data: { campId: newCamp.id, fields: source.registrationForm.fields },
    });
  }

  // Summary counts
  const counts = {
    ageGroups:    ageGroupMap.size,
    rooms:        roomMap.size,
    teachers:     personMap.size,
    timeSlots:    sessionTmplMap.size,
    activities:   includeActivities ? source.courses.length : 0,
  };

  return NextResponse.json({ success: true, campId: newCamp.id, campName: newCamp.name, counts });
}
