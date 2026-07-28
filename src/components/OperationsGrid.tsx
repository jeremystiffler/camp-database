"use client";

import { useEffect, useRef, useState } from "react";
import { effectiveCapacity, formatCapacity } from "@/lib/capacity-rules";
import { detectIssues, type IssueCourse } from "@/lib/issues";

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

/** A column in the rendered grid. May stand for several days' worth of blocks. */
export type GridColumn = {
  key: string;
  label: string;
  startTime: string;
  endTime: string;
  /** Every SessionTemplate id this column stands for. */
  blockIds: string[];
  days: number[];
};

function dayRangeLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return DAY_LABEL[sorted[0]] ?? "";
  const consecutive = sorted.every((day, index) => index === 0 || day === sorted[index - 1] + 1);
  if (consecutive) return `${DAY_LABEL[sorted[0]]}–${DAY_LABEL[sorted[sorted.length - 1]]}`;
  return sorted.map((day) => DAY_LABEL[day] ?? "").join(", ");
}

/**
 * Collapse repeating days into one set of time columns.
 *
 * A week-long camp that runs the same eight periods every weekday produces forty
 * SessionTemplates, and forty columns is not a grid anyone can read. When every
 * period runs on every active day the schedule is a perfect repeat, so the days
 * carry no information and are folded away — eight columns, labelled by time.
 *
 * Folding is deliberately strict: if any period is missing on any day the days
 * genuinely differ, and the grid keeps day-prefixed columns rather than quietly
 * flattening a difference the organiser needs to see.
 */
export function foldBlocks(blocks: GridBlock[]): {
  columns: GridColumn[];
  folded: boolean;
  dayLabel: string;
  hiddenDayCount: number;
} {
  const byTime = new Map<string, GridBlock[]>();
  for (const block of blocks) {
    const key = `${block.startTime}|${block.endTime}`;
    const list = byTime.get(key) ?? [];
    list.push(block);
    byTime.set(key, list);
  }

  const activeDays = [
    ...new Set(
      blocks
        .map((block) => block.dayOfWeek)
        .filter((day): day is number => day !== null && day !== undefined),
    ),
  ].sort((a, b) => a - b);

  // Every period must run on every active day for the days to be redundant.
  const everyPeriodRunsEveryDay =
    activeDays.length > 1 &&
    [...byTime.values()].every((group) => {
      const days = new Set(
        group
          .map((block) => block.dayOfWeek)
          .filter((day): day is number => day !== null && day !== undefined),
      );
      return days.size === activeDays.length;
    });

  if (!everyPeriodRunsEveryDay) {
    const showDay = new Set(blocks.map((block) => block.dayOfWeek ?? -1)).size > 1;
    return {
      columns: blocks.map((block) => ({
        key: block.id,
        label: blockLabel(block, showDay),
        startTime: block.startTime,
        endTime: block.endTime,
        blockIds: [block.id],
        days: block.dayOfWeek === null || block.dayOfWeek === undefined ? [] : [block.dayOfWeek],
      })),
      folded: false,
      dayLabel: dayRangeLabel(activeDays),
      hiddenDayCount: 0,
    };
  }

  const columns = [...byTime.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, group]) => ({
      key,
      label: formatTime(group[0].startTime),
      startTime: group[0].startTime,
      endTime: group[0].endTime,
      blockIds: group.map((block) => block.id),
      days: activeDays,
    }));

  return {
    columns,
    folded: true,
    dayLabel: dayRangeLabel(activeDays),
    hiddenDayCount: activeDays.length - 1,
  };
}

/**
 * The occupancy a folded column should display.
 *
 * When a column stands for five identical days the count is the same on each and
 * is shown plainly. When the days disagree the highest is shown and flagged: for
 * a capacity tool the fullest day is the one that can breach the limit, and a
 * quiet average would hide exactly the day that matters.
 */
export function foldCell(
  course: GridCourse,
  column: GridColumn,
): { enrolled: number; scheduled: boolean; varies: boolean; perDay: string } | null {
  const sessions = (course.sessions ?? []).filter(
    (session) => session.sessionTemplateId && column.blockIds.includes(session.sessionTemplateId),
  );
  if (sessions.length === 0) return null;

  const counts = sessions.map((session) => session.enrolledCount ?? 0);
  const enrolled = Math.max(...counts);
  const varies = new Set(counts).size > 1;
  return {
    enrolled,
    scheduled: true,
    varies,
    perDay: varies ? counts.join(", ") : String(enrolled),
  };
}

function teacherLabel(course: GridCourse): { text: string; missing: boolean } {
  const names = (course.courseTeachers ?? [])
    .map((entry) => `${entry.person.firstName} ${entry.person.lastName}`.trim())
    .filter(Boolean);
  if (names.length === 0) return { text: "no teacher", missing: true };
  return { text: names.join(", "), missing: false };
}

export type SortKey = "default" | "name" | "fullest" | "emptiest" | "attention";

/**
 * What is wrong with this activity, counted for the attention sort.
 *
 * Delegates to the issue engine (phase 18b) so the grid's ordering cannot
 * disagree with the warnings shown anywhere else. Severity drives the weight:
 * a blocking overflow outranks every warning, which outranks every advisory.
 */
export function attentionScore(course: GridCourse, columns: GridColumn[]): number {
  // The engine works in real SessionTemplate ids; a folded column stands for
  // several, so expand back to the underlying blocks.
  const blocks = columns.flatMap((column) =>
    column.blockIds.map((id) => ({ id, startTime: column.startTime, endTime: column.endTime })),
  );
  const issues = detectIssues({ courses: [course as unknown as IssueCourse], blocks });
  const weight: Record<string, number> = { blocking: 100, warning: 10, advisory: 2 };
  return issues.reduce((total: number, issue) => total + (weight[issue.severity] ?? 0), 0);
}

/** Peak fill ratio across every block. Over-capacity exceeds 1 and sorts first. */
export function peakFill(course: GridCourse, columns: GridColumn[]): number {
  const capacity = effectiveCapacity({ cap: course.cap });
  if (!Number.isFinite(capacity) || capacity <= 0) return 0;
  const ratios = columns
    .map((column) => foldCell(course, column))
    .filter(Boolean)
    .map((cell) => cell!.enrolled / capacity);
  return ratios.length === 0 ? 0 : Math.max(...ratios);
}

export type GridFilter = {
  query: string;
  ageGroupId: string;
  attentionOnly: boolean;
};

export const EMPTY_FILTER: GridFilter = { query: "", ageGroupId: "", attentionOnly: false };

function courseAgeGroupIds(course: GridCourse): string[] {
  const ids = (course.courseAgeGroups ?? []).map((entry) => entry.ageGroupId);
  if (ids.length > 0) return ids;
  return course.ageGroupId ? [course.ageGroupId] : [];
}

/**
 * Filter and sort the activity rows.
 *
 * Rows only — the time columns are never touched. Folding and column alignment
 * must stay stable while filtering, both so the header does not jump around and
 * so the Slice 4 coverage band can keep sharing these columns.
 */
export function arrangeRows(
  courses: GridCourse[],
  columns: GridColumn[],
  sort: SortKey,
  filter: GridFilter,
): GridCourse[] {
  const query = filter.query.trim().toLowerCase();

  const visible = courses.filter((course) => {
    if (query) {
      const teacher = (course.courseTeachers ?? [])
        .map((entry) => `${entry.person.firstName} ${entry.person.lastName}`)
        .join(" ")
        .toLowerCase();
      const haystack = `${course.name} ${course.room?.name ?? ""} ${teacher}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filter.ageGroupId) {
      const ids = courseAgeGroupIds(course);
      // An activity with no age group is open to everyone, so it stays visible
      // under any group filter rather than vanishing from all of them.
      if (ids.length > 0 && !ids.includes(filter.ageGroupId)) return false;
    }
    if (filter.attentionOnly && attentionScore(course, columns) === 0) return false;
    return true;
  });

  const byName = (left: GridCourse, right: GridCourse) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base", numeric: true });

  const sorted = [...visible];
  switch (sort) {
    case "name":
      sorted.sort(byName);
      break;
    case "fullest":
      sorted.sort(
        (left, right) => peakFill(right, columns) - peakFill(left, columns) || byName(left, right),
      );
      break;
    case "emptiest":
      sorted.sort(
        (left, right) => peakFill(left, columns) - peakFill(right, columns) || byName(left, right),
      );
      break;
    case "attention":
      sorted.sort(
        (left, right) =>
          attentionScore(right, columns) - attentionScore(left, columns) || byName(left, right),
      );
      break;
    default:
      // Scheduled activities first, then never-scheduled, each alphabetically.
      // Unscheduled rows are all blanks, so floating them to the top would push
      // the real grid off the first screen.
      sorted.sort((left, right) => {
        const leftScheduled = (left.sessions ?? []).length > 0 ? 0 : 1;
        const rightScheduled = (right.sessions ?? []).length > 0 ? 0 : 1;
        return leftScheduled - rightScheduled || byName(left, right);
      });
  }
  return sorted;
}

/**
 * Activities a filter is hiding that carry a blocking problem.
 *
 * A filtered view must not make an over-capacity class disappear silently — the
 * organiser would believe the grid was clean. Hidden blockers are named above
 * the grid instead.
 */
export function hiddenBlockers(
  courses: GridCourse[],
  visible: GridCourse[],
  columns: GridColumn[],
): string[] {
  const shown = new Set(visible.map((course) => course.id));
  return courses
    .filter((course) => {
      if (shown.has(course.id)) return false;
      const capacity = effectiveCapacity({ cap: course.cap });
      if (!Number.isFinite(capacity)) return false;
      return columns.some((column) => {
        const cell = foldCell(course, column);
        return cell ? cell.enrolled > capacity : false;
      });
    })
    .map((course) => course.name);
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

function CellContent({
  cell,
  course,
}: {
  cell: { enrolled: number; varies: boolean; perDay: string } | null;
  course: GridCourse;
}) {
  // Not scheduled in this block: no track, blank cell (§1.3).
  if (!cell) return null;

  const enrolled = cell.enrolled;
  const capacity = effectiveCapacity({ cap: course.cap });
  const over = Number.isFinite(capacity) && enrolled > capacity;
  const empty = enrolled === 0;

  const numClass = over ? "ops-num ops-num--over" : empty ? "ops-num ops-num--empty" : "ops-num";
  const capText = formatCapacity({ cap: course.cap });
  const unlimited = !Number.isFinite(capacity);

  return (
    <>
      <span className={numClass} title={cell.varies ? `Varies by day: ${cell.perDay}` : undefined}>
        {enrolled}
        {cell.varies && <span aria-hidden="true">*</span>}
      </span>
      <span className="sr-only">
        {unlimited
          ? ` enrolled, no limit set`
          : ` of ${capText}${over ? " — over capacity" : ""}${empty ? " — nobody enrolled" : ""}`}
        {cell.varies ? ` — busiest day; varies by day: ${cell.perDay}` : ""}
      </span>
      <CapacityBar enrolled={enrolled} cap={course.cap} />
    </>
  );
}

/** Mobile (<768px): a time-block list, not a shrunken desktop grid (§1.5). */
function BlockList({
  columns,
  courses,
  ageGroupById,
}: {
  columns: GridColumn[];
  courses: GridCourse[];
  ageGroupById: Map<string, GridAgeGroup>;
}) {
  const [activeKey, setActiveKey] = useState(columns[0]?.key ?? "");
  const column = columns.find((candidate) => candidate.key === activeKey) ?? columns[0];
  if (!column) return null;

  const running = courses
    .map((course) => ({ course, cell: foldCell(course, column) }))
    .filter((entry) => entry.cell);

  return (
    <div className="md:hidden">
      <label className="ops-meta mb-1 block" htmlFor="ops-block-picker">
        Time block
      </label>
      <select
        id="ops-block-picker"
        value={column.key}
        onChange={(event) => setActiveKey(event.target.value)}
        className="mb-3 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)]"
      >
        {columns.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}–{formatTime(option.endTime)}
          </option>
        ))}
      </select>

      {running.length === 0 ? (
        <p className="ops-meta">Nothing is scheduled in this block yet.</p>
      ) : (
        <ul className="space-y-2">
          {running.map(({ course, cell }) => {
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
                  <div className="w-[64px] shrink-0 text-right">
                    <CellContent cell={cell} course={course} />
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
  const [sort, setSort] = useState<SortKey>("default");
  const [filter, setFilter] = useState<GridFilter>(EMPTY_FILTER);

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

  // Fold repeating days into one set of time columns. A five-day camp running
  // the same eight periods daily has forty templates but only eight meaningful
  // columns.
  const { columns, folded, dayLabel, hiddenDayCount } = foldBlocks(blocks);

  const rows = arrangeRows(courses, columns, sort, filter);
  const blockers = hiddenBlockers(courses, rows, columns);
  const filtering = filter.query.trim() !== "" || filter.ageGroupId !== "" || filter.attentionOnly;

  // Only mention the variation marker when something actually varies.
  const anyVaries =
    folded &&
    courses.some((course) => columns.some((column) => foldCell(course, column)?.varies));

  if (blocks.length === 0 || courses.length === 0) {
    return <p className="ops-meta">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="ops-toolbar">
        <div className="ops-search">
          <label className="sr-only" htmlFor="ops-filter-query">
            Find an activity, room, or teacher
          </label>
          <input
            id="ops-filter-query"
            type="search"
            className="ops-input"
            placeholder="Find an activity…"
            value={filter.query}
            onChange={(event) => setFilter({ ...filter, query: event.target.value })}
          />
          {filter.query && (
            <button
              type="button"
              className="ops-clear"
              onClick={() => setFilter({ ...filter, query: "" })}
              aria-label="Clear the search"
            >
              ×
            </button>
          )}
        </div>

        <label className="sr-only" htmlFor="ops-sort">
          Sort activities
        </label>
        <select
          id="ops-sort"
          className="ops-select"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
        >
          <option value="default">Scheduled first</option>
          <option value="name">Name A–Z</option>
          <option value="fullest">Fullest first</option>
          <option value="emptiest">Emptiest first</option>
          <option value="attention">Needs attention first</option>
        </select>

        {ageGroups.length > 0 && (
          <>
            <label className="sr-only" htmlFor="ops-age-filter">
              Filter by age group
            </label>
            <select
              id="ops-age-filter"
              className="ops-select"
              value={filter.ageGroupId}
              onChange={(event) => setFilter({ ...filter, ageGroupId: event.target.value })}
            >
              <option value="">All age groups</option>
              {ageGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </>
        )}

        <button
          type="button"
          className="ops-toggle"
          aria-pressed={filter.attentionOnly}
          onClick={() => setFilter({ ...filter, attentionOnly: !filter.attentionOnly })}
        >
          Needs attention
        </button>

        {filtering && (
          <button
            type="button"
            className="ops-toggle"
            onClick={() => setFilter(EMPTY_FILTER)}
          >
            Clear filters
          </button>
        )}

        <span className="ops-count" aria-live="polite">
          {rows.length === courses.length
            ? `${courses.length} activities`
            : `${rows.length} of ${courses.length} activities`}
        </span>
      </div>

      {/* A filter must not make a blocking problem vanish silently. */}
      {blockers.length > 0 && (
        <p className="ops-hidden-warn" role="status">
          {blockers.length === 1
            ? `${blockers[0]} is over capacity but hidden by the current filter.`
            : `${blockers.length} activities are over capacity but hidden by the current filter: ${blockers.join(", ")}.`}
        </p>
      )}

      {folded && (
        <p className="ops-meta mb-2">
          {dayLabel} run the same time blocks, so the {hiddenDayCount + 1} days are shown once.
          {anyVaries ? " A count marked * differs between days — the busiest is shown." : ""}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="ops-meta">
          No activity matches this filter.{" "}
          <button
            type="button"
            className="ops-toggle"
            onClick={() => setFilter(EMPTY_FILTER)}
          >
            Show all {courses.length}
          </button>
        </p>
      ) : (
        <>
      <BlockList columns={columns} courses={rows} ageGroupById={ageGroupById} />

      <div className="relative hidden md:block">
        <div className="ops-grid-wrap" ref={wrapRef}>
          <table className="ops-grid">
            <caption className="sr-only">
              Activities by time block, showing enrollment against each class limit.
              {folded ? ` ${dayLabel} run the same set of time blocks, shown once.` : ""}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="ops-rowhead">
                  Activity
                </th>
                {columns.map((column) => (
                  <th key={column.key} scope="col" className="ops-cell">
                    {column.label}
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
                    {columns.map((column) => (
                      <td key={column.key} className="ops-cell">
                        <CellContent cell={foldCell(course, column)} course={course} />
                      </td>
                    ))}
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
      )}
    </>
  );
}
