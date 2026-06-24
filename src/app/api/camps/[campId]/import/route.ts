import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const DAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
  wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

const ACTIVITY_COLORS = ["#22C55E","#0EA5E9","#F97316","#A855F7","#EAB308","#EC4899","#14B8A6","#6366F1"];
const AGE_GROUP_COLORS = ["#6366F1","#22C55E","#0EA5E9","#F97316","#A855F7","#EC4899","#EAB308","#14B8A6"];

function randomColor(palette: string[]): string {
  return palette[Math.floor(Math.random() * palette.length)];
}

function parseDay(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const n = parseInt(val);
  if (!isNaN(n) && n >= 0 && n <= 6) return n;
  return DAY_MAP[val.toLowerCase().trim()] ?? undefined;
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
  session_label?: string;
  session_day?: string;
  session_start_time?: string;
  session_end_time?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;

  const member = await prisma.campMember.findFirst({ where: { campId, userId: session.userId } });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { rows } = await req.json() as { rows: ImportRow[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  let coursesCreated = 0, coursesUpdated = 0, teachersCreated = 0;
  let roomsCreated = 0, slotsCreated = 0, ageGroupsCreated = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed, +1 for header row

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
            data: { campId, name: row.age_group_name.trim(), color: randomColor(AGE_GROUP_COLORS) },
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

      // ── e. Session Template ──────────────────────────────────────────────
      let sessionTemplateId: string | undefined;
      if (row.session_start_time?.trim() && row.session_end_time?.trim()) {
        const dayOfWeek = parseDay(row.session_day);
        const existing = await prisma.sessionTemplate.findFirst({
          where: {
            campId,
            startTime: row.session_start_time.trim(),
            endTime: row.session_end_time.trim(),
            ...(dayOfWeek !== undefined ? { dayOfWeek } : {}),
          },
        });
        if (existing) {
          sessionTemplateId = existing.id;
        } else {
          const created = await prisma.sessionTemplate.create({
            data: {
              campId,
              startTime: row.session_start_time.trim(),
              endTime: row.session_end_time.trim(),
              dayOfWeek: dayOfWeek ?? null,
              label: row.session_label?.trim() || undefined,
            },
          });
          sessionTemplateId = created.id;
          slotsCreated++;
        }
      }

      // ── f. Course ────────────────────────────────────────────────────────
      const existing = await prisma.course.findFirst({ where: { campId, name: row.activity_name.trim() } });
      let courseId: string;

      if (existing) {
        await prisma.course.update({
          where: { id: existing.id },
          data: {
            description: row.activity_description?.trim() || existing.description || undefined,
            icon: existing.icon || undefined,
            cap: row.activity_capacity ? parseInt(row.activity_capacity) : existing.cap,
            roomId: roomId ?? existing.roomId,
          },
        });
        courseId = existing.id;
        coursesUpdated++;
      } else {
        const created = await prisma.course.create({
          data: {
            campId,
            name: row.activity_name.trim(),
            description: row.activity_description?.trim() || undefined,
            icon: "🎯",
            color: randomColor(ACTIVITY_COLORS),
            cap: row.activity_capacity ? parseInt(row.activity_capacity) : 20,
            roomId: roomId || undefined,
          },
        });
        courseId = created.id;
        coursesCreated++;
      }

      // ── g–j. Join records (upsert pattern: find or create) ───────────────
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
      if (sessionTemplateId) {
        const exists = await prisma.courseSessionTemplate.findFirst({ where: { courseId, sessionTemplateId } });
        if (!exists) await prisma.courseSessionTemplate.create({ data: { courseId, sessionTemplateId } });
      }

    } catch (err) {
      errors.push(`Row ${rowNum} (${row.activity_name}): ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return NextResponse.json({
    coursesCreated, coursesUpdated, teachersCreated,
    roomsCreated, slotsCreated, ageGroupsCreated, errors,
    total: rows.length,
  });
}
