import { prisma } from "./db";

export interface SchedulingConflict {
  type: "room" | "teacher" | "ageGroup";
  /** Formatted day + time e.g. "Mon 9:00 AM – 10:00 AM" */
  slotLabel: string;
  /** The other activity that owns this slot */
  activityName: string;
  /** For room conflicts: the room name. For teacher conflicts: the teacher's full name. For age group conflicts: the group name. */
  detail: string;
  /** For teacher conflicts: the room the teacher is already in (if any) */
  locationNote?: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatSlot(dayOfWeek: number | null, startTime: string, endTime: string, label?: string | null): string {
  const day = dayOfWeek != null ? DAYS[dayOfWeek] + " " : "";
  const prefix = label ? `${label} — ` : "";
  return `${prefix}${day}${startTime} – ${endTime}`;
}

/**
 * Check for scheduling conflicts before creating or updating a course.
 * Returns an array of conflicts (empty = no conflicts, safe to save).
 */
export async function checkSchedulingConflicts({
  campId,
  excludeCourseId,
  roomId,
  teacherIds,
  sessionTemplateIds,
  ageGroupIds = [],
  excludeMandatorySessionId,
}: {
  campId: string;
  excludeCourseId?: string;   // when editing, exclude self
  excludeMandatorySessionId?: string; // when editing a required assembly, exclude self
  roomId?: string;
  teacherIds: string[];
  sessionTemplateIds: string[];
  ageGroupIds?: string[];
}): Promise<SchedulingConflict[]> {
  if (sessionTemplateIds.length === 0) return [];

  const conflicts: SchedulingConflict[] = [];

  // Load the session template details for formatting
  const templates = await prisma.sessionTemplate.findMany({
    where: { id: { in: sessionTemplateIds } },
  });
  const templateMap = new Map(templates.map(t => [t.id, t]));

  // Find all OTHER courses in this camp that share any of these session template slots
  const conflictingLinks = await prisma.courseSessionTemplate.findMany({
    where: {
      sessionTemplateId: { in: sessionTemplateIds },
      course: {
        campId,
        ...(excludeCourseId ? { id: { not: excludeCourseId } } : {}),
      },
    },
    select: {
      sessionTemplateId: true,
      course: {
        select: {
          id: true,
          name: true,
          roomId: true,
          room: { select: { name: true } },
          ageGroup: { select: { id: true, name: true } },
          courseAgeGroups: { select: { ageGroup: { select: { id: true, name: true } } } },
          courseTeachers: {
            select: {
              person: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  // Deduplicate: one conflict entry per (type, courseId, slotId)
  const seen = new Set<string>();

  for (const link of conflictingLinks) {
    const tmpl = templateMap.get(link.sessionTemplateId);
    if (!tmpl) continue;
    const slotLabel = formatSlot(tmpl.dayOfWeek ?? null, tmpl.startTime, tmpl.endTime, tmpl.label);
    const { course } = link;

    // ── Room conflict ──────────────────────────────────────────────────────
    if (roomId && course.roomId === roomId) {
      const key = `room|${course.id}|${link.sessionTemplateId}`;
      if (!seen.has(key)) {
        seen.add(key);
        conflicts.push({
          type: "room",
          slotLabel,
          activityName: course.name,
          detail: course.room?.name || "this room",
        });
      }
    }

    // Normal elective activities may share an age group in the same time slot.
    // That is how registration offers choices like Art vs Soccer vs Music for one group.
    // Required/default sessions are still checked below against ageGroupIds.

    // ── Teacher conflicts ──────────────────────────────────────────────────
    for (const ct of course.courseTeachers) {
      if (teacherIds.includes(ct.person.id)) {
        const key = `teacher|${ct.person.id}|${link.sessionTemplateId}`;
        if (!seen.has(key)) {
          seen.add(key);
          conflicts.push({
            type: "teacher",
            slotLabel,
            activityName: course.name,
            detail: `${ct.person.firstName} ${ct.person.lastName}`,
            locationNote: course.room?.name,
          });
        }
      }
    }
  }

  const mandatoryBlocks = await prisma.mandatorySession.findMany({
    where: {
      campId,
      sessionTemplateId: { in: sessionTemplateIds },
      ...(excludeMandatorySessionId ? { id: { not: excludeMandatorySessionId } } : {}),
    },
    select: {
      id: true,
      title: true,
      sessionTemplateId: true,
      roomId: true,
      room: { select: { name: true } },
      ageGroup: { select: { id: true, name: true } },
      leader: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  for (const block of mandatoryBlocks) {
    const tmpl = templateMap.get(block.sessionTemplateId);
    if (!tmpl) continue;
    const slotLabel = formatSlot(tmpl.dayOfWeek ?? null, tmpl.startTime, tmpl.endTime, tmpl.label);

    if (roomId && block.roomId === roomId) {
      const key = `mandatory-room|${block.id}|${block.sessionTemplateId}`;
      if (!seen.has(key)) {
        seen.add(key);
        conflicts.push({ type: "room", slotLabel, activityName: block.title, detail: block.room?.name || "this room" });
      }
    }

    if (block.leader?.id && teacherIds.includes(block.leader.id)) {
      const key = `mandatory-teacher|${block.leader.id}|${block.sessionTemplateId}`;
      if (!seen.has(key)) {
        seen.add(key);
        conflicts.push({
          type: "teacher",
          slotLabel,
          activityName: block.title,
          detail: `${block.leader.firstName} ${block.leader.lastName}`,
          locationNote: block.room?.name,
        });
      }
    }

    if (ageGroupIds.includes(block.ageGroup.id)) {
      const key = `mandatory-ageGroup|${block.ageGroup.id}|${block.sessionTemplateId}`;
      if (!seen.has(key)) {
        seen.add(key);
        conflicts.push({ type: "ageGroup", slotLabel, activityName: block.title, detail: block.ageGroup.name });
      }
    }
  }

  return conflicts;
}
