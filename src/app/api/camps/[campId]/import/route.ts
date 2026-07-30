import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkSchedulingConflicts } from "@/lib/scheduling-conflicts";
import { storedCapacity, syncCourseSessionCapacities } from "@/lib/capacity";

// Age-group swatches. Activities no longer carry a raw hex at all — their
// colour is derived from the name by resolveActivityHue(), so importing the same
// CSV twice produces the same colours instead of reshuffling them.
const AGE_GROUP_COLORS = ["#6366F1","#22C55E","#0891B2","#F97316","#A855F7","#EC4899","#EAB308","#14B8A6"];

/** Deterministic pick: the same name always lands on the same swatch. */
function stableColor(palette: string[], seed: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return palette[hash % palette.length];
}

interface ImportRow {
  activity_name?: string;
  activity_description?: string;
  activity_capacity?: string;
  room_name?: string;
  age_group_name?: string;
  teacher_first_name?: string;
  teacher_last_name?: string;
  teacher_email?: string;
  teacher_role?: string;
  assistant_first_name?: string;
  assistant_last_name?: string;
  assistant_email?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;

  const member = await prisma.campMember.findFirst({ where: { campId, userId: session.userId } });
  if (!member) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { rows } = await req.json() as { rows: ImportRow[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  let coursesCreated = 0, coursesUpdated = 0, teachersCreated = 0;
  let roomsCreated = 0, ageGroupsCreated = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    if (!row.activity_name?.trim()) {
      errors.push(`Row ${rowNum}: activity_name is required — skipped`);
      continue;
    }

    try {
      // ── a. Room ──────────────────────────────────────────────────────────
      let roomId: string | undefined;
      if (row.room_name?.trim()) {
        const existing = await prisma.room.findFirst({ where: { campId, name: row.room_name.trim() } });
        if (existing) {
          roomId = existing.id;
        } else {
          const created = await prisma.room.create({ data: { campId, name: row.room_name.trim() } });
          roomId = created.id;
          roomsCreated++;
        }
      }

      // ── b. Age Group ─────────────────────────────────────────────────────
      let ageGroupId: string | undefined;
      if (row.age_group_name?.trim()) {
        const existing = await prisma.ageGroup.findFirst({ where: { campId, name: row.age_group_name.trim() } });
        if (existing) {
          ageGroupId = existing.id;
        } else {
          const created = await prisma.ageGroup.create({
            data: { campId, name: row.age_group_name.trim(), color: stableColor(AGE_GROUP_COLORS, row.age_group_name.trim().toLowerCase()) },
          });
          ageGroupId = created.id;
          ageGroupsCreated++;
        }
      }

      // ── c. Lead Teacher ──────────────────────────────────────────────────
      let teacherId: string | undefined;
      if (row.teacher_first_name?.trim() && row.teacher_last_name?.trim()) {
        const existing = await prisma.person.findFirst({
          where: { campId, firstName: row.teacher_first_name.trim(), lastName: row.teacher_last_name.trim() },
        });
        if (existing) {
          teacherId = existing.id;
        } else {
          const created = await prisma.person.create({
            data: {
              campId,
              firstName: row.teacher_first_name.trim(),
              lastName: row.teacher_last_name.trim(),
              email: row.teacher_email?.trim() || undefined,
              role: row.teacher_role?.trim() || "teacher",
            },
          });
          teacherId = created.id;
          teachersCreated++;
        }
      }

      // ── d. Assistant ─────────────────────────────────────────────────────
      let assistantId: string | undefined;
      if (row.assistant_first_name?.trim() && row.assistant_last_name?.trim()) {
        const existing = await prisma.person.findFirst({
          where: { campId, firstName: row.assistant_first_name.trim(), lastName: row.assistant_last_name.trim() },
        });
        if (existing) {
          assistantId = existing.id;
        } else {
          const created = await prisma.person.create({
            data: {
              campId,
              firstName: row.assistant_first_name.trim(),
              lastName: row.assistant_last_name.trim(),
              email: row.assistant_email?.trim() || undefined,
              role: "assistant",
            },
          });
          assistantId = created.id;
          teachersCreated++;
        }
      }

      // ── e. Course (unique by name + age group) ──────────────────────────
      // Two courses can share a name if they serve different age groups
      // (e.g. "Arts and Crafts Older" vs "Arts and Crafts Younger"), but we
      // also handle the case where the name alone is used as a differentiator.
      // Composite match: same name AND same first age group (if provided).
      let existing = null;
      if (ageGroupId) {
        // Try exact name + age group match first
        const linked = await prisma.courseAgeGroup.findFirst({
          where: { ageGroupId, course: { campId, name: row.activity_name.trim() } },
          include: { course: true },
        });
        existing = linked?.course ?? null;
      }
      if (!existing) {
        // Fall back to name-only match (no age group specified, or no match above)
        const byName = await prisma.course.findFirst({ where: { campId, name: row.activity_name.trim() } });
        // Only use name-only match if this course has NO age groups yet (avoids merging split classes)
        if (byName) {
          const hasAgeGroups = await prisma.courseAgeGroup.findFirst({ where: { courseId: byName.id } });
          if (!hasAgeGroups || !ageGroupId) existing = byName;
        }
      }
      let courseId: string;
      const targetRoomId = roomId ?? existing?.roomId ?? null;
      const targetRoom = targetRoomId ? await prisma.room.findFirst({ where: { id: targetRoomId, campId }, select: { name: true, capacity: true } }) : null;
      const targetCap = row.activity_capacity ? parseInt(row.activity_capacity, 10) : existing?.cap ?? 20;
      if (!Number.isInteger(targetCap) || targetCap < 1) throw new Error("activity_capacity must be a positive whole number");
      if (existing) {
        const nextCapacity = storedCapacity({ cap: targetCap, heldSeats: existing.heldSeats });
        const overflow = nextCapacity === null ? null : await prisma.session.findFirst({ where: { courseId: existing.id, enrolledCount: { gt: nextCapacity } }, select: { enrolledCount: true } });
        if (overflow) throw new Error(`class limit ${nextCapacity} is below current enrollment ${overflow.enrolledCount}; move participants first`);
      }

      if (existing) {
        await prisma.course.update({
          where: { id: existing.id },
          data: {
            description: row.activity_description?.trim() || existing.description || undefined,
            cap: targetCap,
            roomId: roomId ?? existing.roomId,
          },
        });
        if (roomId && roomId !== existing.roomId) await prisma.session.updateMany({ where: { courseId: existing.id }, data: { roomId } });
        courseId = existing.id;
        coursesUpdated++;
      } else {
        const created = await prisma.course.create({
          data: {
            campId,
            name: row.activity_name.trim(),
            description: row.activity_description?.trim() || undefined,
            // No placeholder icon and no stored hex: the colour is derived from
            // the activity name at render time (resolveActivityHue), so repeated
            // names share an identity and re-importing is stable.
            color: undefined,
            cap: targetCap,
            roomId: roomId || undefined,
          },
        });
        courseId = created.id;
        coursesCreated++;
      }
      await syncCourseSessionCapacities(courseId);

      // ── f. Join records ──────────────────────────────────────────────────
      // Collect the full set of teacher IDs and session template IDs this course
      // will have after this import row, then run the conflict engine before
      // writing anything — same guard as POST/PATCH /courses.
      const existingTeacherIds = (await prisma.courseTeacher.findMany({ where: { courseId } })).map(ct => ct.personId);
      const existingSlotIds    = (await prisma.courseSessionTemplate.findMany({ where: { courseId } })).map(cst => cst.sessionTemplateId);
      const incomingTeacherIds = [...new Set([...existingTeacherIds, ...(teacherId ? [teacherId] : []), ...(assistantId ? [assistantId] : [])])];

      if (incomingTeacherIds.length > 0 || (roomId ?? null)) {
        const conflicts = await checkSchedulingConflicts({
          campId,
          excludeCourseId: courseId,
          roomId: roomId ?? undefined,
          teacherIds: incomingTeacherIds,
          sessionTemplateIds: existingSlotIds,
        });
        if (conflicts.length > 0) {
          const reasons = conflicts.map(c =>
            c.type === "room"
              ? `Room "${c.detail}" already booked by "${c.activityName}" at ${c.slotLabel}`
              : `Teacher "${c.detail}" already teaching "${c.activityName}" at ${c.slotLabel}`
          ).join("; ");
          errors.push(`Row ${rowNum} (${row.activity_name}): scheduling conflict — ${reasons}`);
          continue;
        }
      }

      if (ageGroupId) {
        const exists = await prisma.courseAgeGroup.findFirst({ where: { courseId, ageGroupId } });
        if (!exists) await prisma.courseAgeGroup.create({ data: { courseId, ageGroupId } });
      }
      if (teacherId) {
        const exists = await prisma.courseTeacher.findFirst({ where: { courseId, personId: teacherId } });
        if (!exists) await prisma.courseTeacher.create({ data: { courseId, personId: teacherId } });
      }
      if (assistantId) {
        const exists = await prisma.courseTeacher.findFirst({ where: { courseId, personId: assistantId } });
        if (!exists) await prisma.courseTeacher.create({ data: { courseId, personId: assistantId } });
      }

    } catch (err) {
      errors.push(`Row ${rowNum} (${row.activity_name}): ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return NextResponse.json({
    coursesCreated, coursesUpdated, teachersCreated,
    roomsCreated, ageGroupsCreated, errors,
    total: rows.length,
  });
}
