"use client";

import { useEffect, useRef, useState } from "react";
import { effectiveCapacity, formatCapacity } from "@/lib/capacity-rules";

/**
 * The operations grid — dashboard spec Slice 1.
 *
 * Rows are activities, columns are time blocks, cells are sessions. Read-only:
 * Slice 3 adds click targets. One component, two placements (§1.6).
 *
 * Bar LENGTH carries quantity, colour carries status. A full class is a success
 * and must never render as an error (§1.3).
 */

export type GridBlock = {
  id: string;
  label: string;
  dayOfWeek?: number | null;
  startTime: string;
  endTime: string;
};

export type GridSession = {
  id: string;
  sessionTemplateId?: string | null;
  enrolledCount: number;
  sessionTeachers?: { personId: string }[];
};

export type GridCourse = {
  id: string;
  name: string;
  cap: number | null;
  status?: string;
  color?: string;
  room?: { id: string; name: string; capacity: number | null } | null;
  courseTeachers?: { person: { id: string; firstName: string; lastName: string } }[];
  courseAgeGroups?: { ageGroupId: string }[];
  ageGroupId?: string | null;
  sessions?: GridSession[];
};

export type GridAgeGroup = { id: string; name: string; color?: string };

function formatTime(value: string): string {
  const [rawHour, rawMinute] = value.split(":");
  const hour = Number(rawHour);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "pm" : "am";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${rawMinute ?? "00"}${suffix}`;
}

const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function blockLabel(block: GridBlock, showDay: boolean): string {
  const time = formatTime(block.startTime);
  if (!showDay || block.dayOfWeek === null || block.dayOfWeek === undefined) return time;
  return `${DAY_LABEL[block.dayOfWeek] ?? ""} ${time}`.trim();
}

function teacherLabel(course: GridCourse): { text: string; missing: boolean } {
  const names = (course.courseTeachers ?? [])
    .map((entry) => `${entry.person.firstName} ${entry.person.lastName}`.trim())
    .filter(Boolean);
  if (names.length === 0) return { text: "no teacher", missing: true };
  return { text: names.join(", "), missing: false };
}

/**
 * The class limit, labelled. A bare trailing number in the row header reads as
 * ambiguous — "Outside · Brad Farley · 15" could be a room size, a count, or an
 * age. "limit 15" cannot be misread.
 */
function capLabel(cap: number | null): string {
  const capacity = effectiveCapacity({ cap });
  return Number.isFinite(capacity) ? `limit ${capacity}` : "no limit";
}

/**
 * The capacity bar. Over-capacity renders a full danger track plus a nub that
 * reads as spilling past it — length represents overflow, which a colour ramp
 * cannot do (§1.3).
 */
export function CapacityBar({ enrolled, cap }: { enrolled: number; cap: number | null }) {
  const capacity = effectiveCapacity({ cap });
  const unlimited = !Number.isFinite(capacity);

  if (enrolled === 0) {
    return <div className="cap-track cap-track--empty" aria-hidden="true" />;
  }
  if (unlimited || capacity <= 0) {
    // No ceiling to measure against, so show a filled track rather than implying
    // a ratio that does not exist.
    return (
      <div className="cap-track" aria-hidden="true">
        <div className="cap-fill" style={{ width: "100%" }} />
      </div>
    );
  }

  const over = enrolled > capacity;
  if (!over) {
    const ratio = Math.min(1, enrolled / capacity);
    return (
      <div className="cap-track" aria-hidden="true">
        <div className="cap-fill" style={{ width: `${ratio * 100}%` }} />
      </div>
    );
  }

  // Nub width: clamp(4px, overflow ratio x track, 24px) per §1.3.
  const overflowRatio = (enrolled - capacity) / capacity;
  const nub = `clamp(4px, ${(overflowRatio * 100).toFixed(1)}%, 24px)`;
  return (
    <div className="cap-track cap-track--over" aria-hidden="true">
      <div className="cap-fill" />
      <div className="cap-nub" style={{ width: nub, flex: "0 0 auto" }} />
    </div>
  );
}

function CellContent({ session, course }: { session: GridSession | undefined; course: GridCourse }) {
  // Not scheduled in this block: no track, blank cell (§1.3).
  if (!session) return null;

  const enrolled = session.enrolledCount ?? 0;
  const capacity = effectiveCapacity({ cap: course.cap });
  const over = Number.isFinite(capacity) && enrolled > capacity;
  const empty = enrolled === 0;

  const numClass = over ? "ops-num ops-num--over" : empty ? "ops-num ops-num--empty" : "ops-num";
  const capText = formatCapacity({ cap: course.cap });
  const unlimited = !Number.isFinite(capacity);

  return (
    <>
      <span className={numClass}>{enrolled}</span>
      <span className="sr-only">
        {unlimited
          ? ` enrolled, no limit set`
          : ` of ${capText}${over ? " — over capacity" : ""}${empty ? " — nobody enrolled" : ""}`}
      </span>
      <CapacityBar enrolled={enrolled} cap={course.cap} />
    </>
  );
}

/** Mobile (<768px): a time-block list, not a shrunken desktop grid (§1.5). */
function BlockList({
  blocks,
  courses,
  ageGroupById,
  showDay,
}: {
  blocks: GridBlock[];
  courses: GridCourse[];
  ageGroupById: Map<string, GridAgeGroup>;
  showDay: boolean;
}) {
  const [activeBlock, setActiveBlock] = useState(blocks[0]?.id ?? "");
  const block = blocks.find((b) => b.id === activeBlock) ?? blocks[0];
  if (!block) return null;

  const running = courses
    .map((course) => ({
      course,
      session: (course.sessions ?? []).find((s) => s.sessionTemplateId === block.id),
    }))
    .filter((entry) => entry.session);

  return (
    <div className="md:hidden">
      <label className="ops-meta mb-1 block" htmlFor="ops-block-picker">
        Time block
      </label>
      <select
        id="ops-block-picker"
        value={block.id}
        onChange={(event) => setActiveBlock(event.target.value)}
        className="mb-3 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)]"
      >
        {blocks.map((option) => (
          <option key={option.id} value={option.id}>
            {blockLabel(option, showDay)}–{formatTime(option.endTime)}
            {option.label ? ` · ${option.label}` : ""}
          </option>
        ))}
      </select>

      {running.length === 0 ? (
        <p className="ops-meta">Nothing is scheduled in this block yet.</p>
      ) : (
        <ul className="space-y-2">
          {running.map(({ course, session }) => {
            const teacher = teacherLabel(course);
            const group = course.courseAgeGroups?.[0]?.ageGroupId ?? course.ageGroupId ?? "";
            const chip = ageGroupById.get(group);
            return (
              <li
                key={course.id}
                className="rounded-xl border border-[var(--border)] bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="ops-name truncate">
                      {course.name}
                      {chip && (
                        <span
                          className="ops-chip"
                          style={{ background: `${chip.color ?? "#64748b"}1f`, color: chip.color ?? "#475569" }}
                        >
                          {chip.name}
                        </span>
                      )}
                    </p>
                    <p className={`ops-meta truncate ${teacher.missing ? "ops-meta__warn" : ""}`}>
                      {course.room?.name ?? "No room"} · {teacher.text} · {capLabel(course.cap)}
                    </p>
                  </div>
                  <div className="w-16 shrink-0 text-right">
                    <CellContent session={session} course={course} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function OperationsGrid({
  courses,
  blocks,
  ageGroups,
  emptyMessage = "Add an activity and a time block to see your grid.",
}: {
  courses: GridCourse[];
  blocks: GridBlock[];
  ageGroups: GridAgeGroup[];
  emptyMessage?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scrollRight, setScrollRight] = useState(false);
  const [scrollBottom, setScrollBottom] = useState(false);

  // Show that it scrolls (§1.4) — the current /schedule grid overflows with no
  // affordance at all, which is how controls end up clipped and unreachable.
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const update = () => {
      setScrollRight(node.scrollWidth - node.clientWidth - node.scrollLeft > 2);
      setScrollBottom(node.scrollHeight - node.clientHeight - node.scrollTop > 2);
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [courses.length, blocks.length]);

  const ageGroupById = new Map(ageGroups.map((group) => [group.id, group]));
  const showDay = new Set(blocks.map((block) => block.dayOfWeek ?? -1)).size > 1;

  const scheduled = courses.filter((course) => (course.sessions ?? []).length > 0);
  const rows = [...scheduled, ...courses.filter((course) => !scheduled.includes(course))];

  if (blocks.length === 0 || courses.length === 0) {
    return <p className="ops-meta">{emptyMessage}</p>;
  }

  return (
    <>
      <BlockList blocks={blocks} courses={courses} ageGroupById={ageGroupById} showDay={showDay} />

      <div className="relative hidden md:block">
        <div className="ops-grid-wrap" ref={wrapRef}>
          <table className="ops-grid">
            <caption className="sr-only">
              Activities by time block, showing enrollment against each class limit.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="ops-rowhead">
                  Activity
                </th>
                {blocks.map((block) => (
                  <th key={block.id} scope="col" className="ops-cell">
                    {blockLabel(block, showDay)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((course) => {
                const teacher = teacherLabel(course);
                const groupId = course.courseAgeGroups?.[0]?.ageGroupId ?? course.ageGroupId ?? "";
                const chip = ageGroupById.get(groupId);
                const hidden = course.status === "hidden";
                const cancelled = course.status === "cancelled";
                return (
                  <tr key={course.id} style={hidden ? { opacity: 0.55 } : undefined}>
                    <th scope="row" className="ops-rowhead">
                      <p className="ops-name" style={cancelled ? { textDecoration: "line-through" } : undefined}>
                        {course.name}
                        {chip && (
                          <span
                            className="ops-chip"
                            style={{
                              background: `${chip.color ?? "#64748b"}1f`,
                              color: chip.color ?? "#475569",
                            }}
                          >
                            {chip.name}
                          </span>
                        )}
                        {hidden && <span className="ops-chip" style={{ background: "var(--canvas-sunk)" }}>hidden</span>}
                      </p>
                      <p className={`ops-meta ${teacher.missing ? "ops-meta__warn" : ""}`}>
                        {course.room?.name ?? "No room"} · {teacher.text} · {capLabel(course.cap)}
                      </p>
                    </th>
                    {blocks.map((block) => {
                      const session = (course.sessions ?? []).find(
                        (candidate) => candidate.sessionTemplateId === block.id,
                      );
                      return (
                        <td key={block.id} className="ops-cell">
                          <CellContent session={session} course={course} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={`ops-shadow-r ${scrollRight ? "is-on" : ""}`} aria-hidden="true" />
        <div className={`ops-shadow-b ${scrollBottom ? "is-on" : ""}`} aria-hidden="true" />
      </div>
    </>
  );
}
