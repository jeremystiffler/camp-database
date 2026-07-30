"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { PageBanner } from "@/components/PageBanner";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { HelpCopy } from "@/components/HelpMode";
import { EmptyState } from "@/components/OperationalUI";
import { RowDeleteButton } from "@/components/InlineEditing";
import { OperationsGrid, foldBlocks, type GridBlock, type GridCourse } from "@/components/OperationsGrid";
import { CoverageMatrixView } from "@/components/CoverageMatrixView";
import { buildCoverage } from "@/lib/coverage";
import { hueVars, normalizeActivityName, resolveActivityHue } from "@/lib/activity-color";
import { effectiveCapacity } from "@/lib/capacity-rules";

interface SessionTemplate {
  id: string;
  label: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Person {
  id: string;
  firstName: string;
  lastName: string;
}

interface AgeGroup {
  id?: string;
  name: string;
  color?: string;
}

interface Course {
  id: string;
  name: string;
  color: string;
  icon?: string;
  cap: number;
  heldSeats?: number;
  /** The activity's own room. The courses endpoint includes it. */
  room?: Room | null;
  ageGroup?: AgeGroup | null;
  courseAgeGroups?: { ageGroup: AgeGroup }[];
  courseTeachers?: { person: Person }[];
}

interface Room {
  id: string;
  name: string;
  capacity: number | null;
}

interface MandatorySession {
  id: string;
  title: string;
}

interface Session {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  enrolledCount: number;
  course?: Course | null;
  mandatorySession?: MandatorySession | null;
  room?: Room | null;
  sessionTemplate?: SessionTemplate | null;
}

type ScheduleView = "dayGrid" | "roomPivot" | "teacherPivot" | "grid" | "list";
type DisplayDayGroup = { key: string; label: string; days: number[] };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-700",
  active: "bg-forest-100 text-forest-700",
  completed: "bg-slate-100 text-slate-500",
  cancelled: "bg-red-100 text-red-600",
};

const VIEW_OPTIONS: { id: ScheduleView; label: string; description: string }[] = [
  { id: "dayGrid", label: "Day × Time", description: "Pivot grid of each day by time block." },
  { id: "roomPivot", label: "Room × Time", description: "See room usage and collisions by time." },
  { id: "teacherPivot", label: "Teacher × Time", description: "Teacher assignments across the schedule." },
  // Replaces the two capacity views this supersedes (build order 18d).
  { id: "grid", label: "Activities by time block", description: "Enrollment against each class limit, by time block." },
  { id: "list", label: "List", description: "Clean operational list of sessions." },
];

function fullName(person: Person) { return `${person.firstName} ${person.lastName}`.trim(); }
function sessionDay(session: Session) { return session.sessionTemplate?.dayOfWeek ?? new Date(session.date).getDay(); }
function timeRange(session: Session) { return `${formatTime(session.startTime)}–${formatTime(session.endTime)}`; }
function formatTime(value?: string | null) {
  if (!value) return "";
  const [rawHour, rawMinute = "00"] = value.split(":");
  const hour = Number(rawHour);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${rawMinute.padStart(2, "0").slice(0, 2)} ${suffix}`;
}
function teacherNames(course?: Course | null) {
  return course?.courseTeachers?.map((ct) => fullName(ct.person)).filter(Boolean).join(", ") || "No teacher";
}
function sessionTitle(session: Session) {
  return session.course?.name || session.mandatorySession?.title || session.sessionTemplate?.label || "Unassigned";
}
function sessionCapacity(session: Session) {
  return session.course ? effectiveCapacity(session.course) : Number.POSITIVE_INFINITY;
}
function capacityPercent(session: Session) {
  const cap = sessionCapacity(session);
  return Number.isFinite(cap) && cap > 0 ? Math.round((session.enrolledCount / cap) * 100) : 0;
}
/**
 * Capacity badge styling. Uses the status token layer, not the legacy warm
 * palette: the old sage/clay/butter Tailwind classes were never defined as
 * colour scales, so those branches rendered unstyled. Full is a success
 * state, not an error (F §8) — only genuine overflow reads as danger.
 */
function capacityTone(percent: number) {
  if (percent > 100) return "border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,white)] text-[var(--danger)]";
  if (percent === 100) return "border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,white)] text-[var(--success)]";
  if (percent >= 85) return "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,white)] text-[var(--warning)]";
  if (percent >= 60) return "border-[color-mix(in_srgb,var(--warning)_25%,transparent)] bg-[color-mix(in_srgb,var(--warning)_6%,white)] text-[var(--text)]";
  if (percent > 0) return "border-[var(--border)] bg-white text-[var(--text)]";
  return "border-[var(--border)] bg-[var(--canvas-sunk)] text-[var(--text-faint)]";
}
/** Class limit for display. A blank limit is unlimited, not unknown. */
function capLabel(cap?: number | null) {
  return typeof cap === "number" && Number.isFinite(cap) ? String(cap) : "No limit";
}
function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const map = new Map<string, T>();
  for (const item of items) if (!map.has(keyFn(item))) map.set(keyFn(item), item);
  return [...map.values()];
}
function sessionDisplayKey(session: Session, includeDay = false) {
  const courseKey = session.course?.id || session.course?.name || session.mandatorySession?.title || session.sessionTemplate?.label || "unassigned";
  const roomKey = session.room?.id || session.room?.name || "no-room";
  const dayKey = includeDay ? `${sessionDay(session)}|` : "";
  return `${dayKey}${courseKey}|${session.startTime}|${session.endTime}|${roomKey}`;
}
function dedupeSessions(sessions: Session[], includeDay = false) {
  return uniqueBy(sessions, (session) => sessionDisplayKey(session, includeDay));
}
function daySignature(sessions: Session[], day: number) {
  return sessions
    .filter((session) => sessionDay(session) === day)
    .map((session) => sessionDisplayKey(session, false))
    .sort()
    .join("||");
}
function dayRangeLabel(days: number[]) {
  const sorted = [...days].sort((a, b) => a - b);
  const isConsecutive = sorted.every((day, index) => index === 0 || day === sorted[index - 1] + 1);
  if (sorted.length === 1) return DAYS[sorted[0]];
  if (isConsecutive) return `${DAYS[sorted[0]]}–${DAYS[sorted[sorted.length - 1]]}`;
  return sorted.map((day) => DAYS[day]).join(", ");
}
function groupIdenticalDays(sessions: Session[], activeDays: number[]): DisplayDayGroup[] {
  const groups: DisplayDayGroup[] = [];
  const bySignature = new Map<string, number[]>();
  for (const day of activeDays) {
    const signature = daySignature(sessions, day);
    if (!signature) continue;
    const days = bySignature.get(signature) || [];
    days.push(day);
    bySignature.set(signature, days);
  }
  for (const days of bySignature.values()) {
    const sorted = days.sort((a, b) => a - b);
    const range = dayRangeLabel(sorted);
    groups.push({
      key: sorted.join("-"),
      label: sorted.length === activeDays.length && activeDays.length > 1 ? `Daily (${range})` : range,
      days: sorted,
    });
  }
  return groups.sort((a, b) => a.days[0] - b.days[0]);
}
function sessionSort(a: Session, b: Session) {
  return sessionDay(a) - sessionDay(b) || a.startTime.localeCompare(b.startTime) || (a.room?.name || "").localeCompare(b.room?.name || "") || sessionTitle(a).localeCompare(sessionTitle(b));
}
function activityHref(campId: string, courseId: string) {
  return `/activities?campId=${campId}&activityId=${courseId}`;
}
function sessionCell(session: Session, campId: string, compact = false) {
  const percent = capacityPercent(session);
  const title = sessionTitle(session);
  const hue = session.course ? resolveActivityHue(session.course.name) : null;
  const vars = hue ? hueVars(hue) : undefined;
  const isFixed = !session.course;
  const cap = sessionCapacity(session);
  const held = session.course?.heldSeats || 0;
  const countLabel = cap ? `${session.enrolledCount} of ${cap}${held ? ` · ${held} held` : ""}${session.enrolledCount === cap ? " · Full" : ""}` : "—";
  const capacityClass = percent > 100 ? "act-block__count is-over" : percent === 100 ? "act-block__count is-full" : percent >= 80 ? "act-block__count is-filling" : "act-block__count";
  const titleNode = session.course ? (
    <Link
      href={activityHref(campId, session.course.id)}
      className="act-block__title truncate underline-offset-2 hover:underline"
      title={`Edit ${session.course.name}`}
    >
      {session.course.icon && <span aria-hidden>{session.course.icon} </span>}{title}
    </Link>
  ) : (
    <p className="truncate text-xs font-semibold text-[var(--text-muted)]">{title}</p>
  );
  return (
    <div
      key={session.id}
      className={isFixed ? "act-block act-block--fixed" : "act-block"}
      style={vars ? {
        ["--act-rail" as string]: vars.rail,
        ["--act-wash" as string]: vars.wash,
        ["--act-ink" as string]: vars.ink,
      } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {titleNode}
          {!compact && <p className="act-block__meta mt-0.5">{session.room?.name || "No room"}</p>}
        </div>
        {session.course && <span className={capacityClass}>{percent >= 80 && <span className="capacity-dot" />} {countLabel}</span>}
      </div>
      {!compact && session.course && <p className="act-block__meta mt-1 truncate">{teacherNames(session.course)}</p>}
    </div>
  );
}

function ScheduleContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const campId = searchParams.get("campId") || "";

  const [sessions, setSessions] = useState<Session[]>([]);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [ageGroups, setAgeGroups] = useState<{ id: string; name: string; color?: string }[]>([]);
  const [participantsByAgeGroup, setParticipantsByAgeGroup] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ScheduleView>("grid");
  const [filterDay, setFilterDay] = useState<number | "">("");
  const [showHealth, setShowHealth] = useState(false);

  const loadSchedule = useCallback(async () => {
    if (!campId) return;
    setLoading(true);
    try {
      const [s, camp, dashboard] = await Promise.all([
      fetch(`/api/camps/${campId}/sessions`).then((r) => r.json()),
      fetch(`/api/camps/${campId}`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/dashboard`).then((r) => r.ok ? r.json() : null),
      ]);
      const t = camp?.sessionTemplates, c = camp?.courses, r = camp?.rooms, g = camp?.ageGroups;
      setSessions(Array.isArray(s) ? s : []);
      setTemplates(Array.isArray(t) ? t : []);
      setCourses(Array.isArray(c) ? c : []);
      setRooms(Array.isArray(r) ? r : []);
      setAgeGroups(Array.isArray(g) ? g : []);
      setParticipantsByAgeGroup(dashboard?.participantsByAgeGroup ?? {});
    } catch {
      // Keep the current view in place if one endpoint fails.
    } finally {
      setLoading(false);
    }
  }, [campId]);

  useEffect(() => { void loadSchedule(); }, [loadSchedule]);

  const removeSession = useCallback(async ({ sessionId }: { courseId: string; sessionId: string }) => {
    if (!campId) return false;
    const response = await fetch(`/api/camps/${campId}/sessions/${sessionId}`, { method: "DELETE" });
    if (!response.ok) return false;
    await loadSchedule();
    return true;
  }, [campId, loadSchedule]);

  const addSession = useCallback(async ({ courseId, blockId, startTime, endTime }: { courseId: string; blockId: string; startTime: string; endTime: string }) => {
    if (!campId) return false;
    const response = await fetch(`/api/camps/${campId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, sessionTemplateId: blockId, startTime, endTime }),
    });
    if (!response.ok) return false;
    await loadSchedule();
    return true;
  }, [campId, loadSchedule]);

  if (!campId) return <EmptyState title="Choose an event first" description="Schedules are built for one event at a time." actionHref="/dashboard" actionLabel="Go to dashboard" />;

  const sortedSessions = [...sessions].sort(sessionSort);
  const displaySessions = dedupeSessions(sortedSessions);
  const dayDisplaySessions = dedupeSessions(sortedSessions, true);
  const activeDays = uniqueBy(dayDisplaySessions, (s) => String(sessionDay(s))).map(sessionDay).sort((a, b) => a - b);
  const dayGroups = groupIdenticalDays(dayDisplaySessions, activeDays);
  const displayDayGroups = filterDay === ""
    ? dayGroups
    : [{ key: String(filterDay), label: DAYS[Number(filterDay)], days: [Number(filterDay)] }];
  const duplicateDayCount = Math.max(activeDays.length - dayGroups.length, 0);
  const filteredDaySessions = dayDisplaySessions.filter((session) => filterDay === "" || sessionDay(session) === Number(filterDay));
  const filteredSessions = filterDay === "" ? displaySessions : filteredDaySessions;
  const timeBlockCount = uniqueBy(templates, (template) => `${template.label || ""}|${template.startTime}|${template.endTime}`).length;
  const timeSlots = uniqueBy(dayDisplaySessions, (s) => `${s.startTime}|${s.endTime}`)
    .map((s) => ({ key: `${s.startTime}|${s.endTime}`, start: s.startTime, end: s.endTime, label: timeRange(s) }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const roomRows = uniqueBy([...rooms, ...filteredSessions.map((s) => s.room).filter((room): room is Room => Boolean(room))], (room) => room.id).sort((a, b) => a.name.localeCompare(b.name));
  const teacherRows = uniqueBy(filteredSessions.flatMap((s) => s.course?.courseTeachers?.map((ct) => ct.person) || []), (p) => p.id).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const totalCapacity = displaySessions.reduce((sum, session) => sum + sessionCapacity(session), 0);
  const totalEnrolled = displaySessions.reduce((sum, session) => sum + session.enrolledCount, 0);
  const averageFill = displaySessions.length ? Math.round(displaySessions.reduce((sum, session) => sum + capacityPercent(session), 0) / displaySessions.length) : 0;
  const overloaded = displaySessions.filter((session) => capacityPercent(session) >= 100).length;
  const unassignedRooms = displaySessions.filter((session) => !session.room).length;
  const unassignedTeachers = displaySessions.filter((session) => !session.course?.courseTeachers?.length).length;
  const courseSessions = displaySessions.filter((session) => Boolean(session.course));
  const busiest = [...courseSessions].sort((a, b) => capacityPercent(b) - capacityPercent(a))[0];
  const lowestAttended = [...courseSessions]
    .sort((a, b) => a.enrolledCount - b.enrolledCount || capacityPercent(a) - capacityPercent(b) || sessionTitle(a).localeCompare(sessionTitle(b)))
    .slice(0, 3);
  const scheduleSummary = activeDays.length > 0
    ? `${dayRangeLabel(activeDays)} · ${timeSlots.length} time block${timeSlots.length === 1 ? "" : "s"}${duplicateDayCount > 0 ? ` · ${duplicateDayCount} duplicate day${duplicateDayCount === 1 ? "" : "s"} hidden` : ""}`
    : `${timeSlots.length} time block${timeSlots.length === 1 ? "" : "s"}`;

  // Operations grid input (build order 18d). Built from the RAW sessions, not the
  // deduped display list: the grid folds repeating days itself, and feeding it
  // pre-deduped data would hide days twice over. The day filter is deliberately
  // not applied either — folding is the grid's own answer to a repeating week.
  const gridBlocks: GridBlock[] = templates
    .map((template) => ({
      id: template.id,
      label: template.label ?? "",
      dayOfWeek: template.dayOfWeek,
      startTime: template.startTime,
      endTime: template.endTime,
    }))
    .sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0) || a.startTime.localeCompare(b.startTime));
  const gridCourses: GridCourse[] = courses.map((course) => ({
    id: course.id,
    name: course.name,
    cap: course.cap ?? null,
    color: course.color,
    room: course.room ?? null,
    courseTeachers: course.courseTeachers,
    // The grid filters by age-group id; this page's payload carries nested
    // objects, so map them down to ids.
    courseAgeGroups: (course.courseAgeGroups ?? [])
      .map((entry) => ({ ageGroupId: entry.ageGroup?.id ?? "" }))
      .filter((entry) => entry.ageGroupId),
    sessions: sessions
      .filter((session) => session.course?.id === course.id && session.sessionTemplate?.id)
      .map((session) => ({
        id: session.id,
        sessionTemplateId: session.sessionTemplate!.id,
        enrolledCount: session.enrolledCount,
      })),
  }));
  const coverage = buildCoverage({
    courses: gridCourses,
    blocks: gridBlocks,
    columns: foldBlocks(gridBlocks).columns,
    ageGroups,
    participantsByAgeGroup,
  });

  return (
    <div className="space-y-6">
      <PageBanner
        eyebrow="Planning"
        title="Schedule"
        description={scheduleSummary}
        actions={<div className="flex flex-col gap-2 xl:items-end">
          <button onClick={() => setShowHealth((value) => !value)} className="w-fit rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-600 transition hover:bg-slate-50">
            {showHealth ? "Hide schedule health" : "Show schedule health"}
          </button>
          {activeDays.length > 1 && (
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <button onClick={() => setFilterDay("")} className={`rounded-xl px-3 py-2 text-xs font-extrabold transition ${filterDay === "" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>All Days</button>
              {activeDays.map((day) => (
                <button key={day} onClick={() => setFilterDay(day)} className={`rounded-xl px-3 py-2 text-xs font-extrabold transition ${filterDay === day ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{DAYS[day]}</button>
              ))}
            </div>
          )}
        </div>}
      >
        <HelpCopy title="Schedule views" className="mt-2 text-sm">Start with activities by time block, then switch to the day, room, teacher, or list view when you need a different angle.</HelpCopy>
      </PageBanner>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sunset-500 border-t-transparent" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="camp-card p-12 text-center">
          <span className="mb-4 block text-5xl">Date</span>
          <h3 className="mb-2 font-bold text-slate-700">No activities scheduled yet</h3>
          <p className="mb-5 text-sm text-slate-500">Create Time Blocks in Setup, then assign activities in the Schedule Builder.</p>
          <Link href={`/setup?campId=${campId}&step=times`} className="minimal-button-primary inline-flex">Set up Time Blocks</Link>
        </div>
      ) : (
        <>
          {showHealth && (
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="Sessions" value={displaySessions.length} sub={`${activeDays.length} active day${activeDays.length === 1 ? "" : "s"}`} tone="tile-aqua" />
                <MetricCard label="Classes" value={courses.length} sub={`${timeBlockCount} time block${timeBlockCount === 1 ? "" : "s"}`} tone="tile-sage" />
                <MetricCard label="Enrollment" value={`${totalEnrolled}/${totalCapacity || "?"}`} sub={`${averageFill}% avg fill`} tone="tile-butter" />
                <MetricCard label="Full / over" value={overloaded} sub="sessions at capacity" tone="tile-clay" />
                <MetricCard label="No room" value={unassignedRooms} sub="needs placement" tone="tile-lavender" />
                <MetricCard label="No teacher" value={unassignedTeachers} sub="needs staffing" tone="tile-berry" />
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {busiest && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Highest load</p>
                      <p className="text-sm font-bold text-slate-800">{sessionTitle(busiest)} · {DAYS[sessionDay(busiest)]} {timeRange(busiest)} · {busiest.room?.name || "No room"}</p>
                    </div>
                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-extrabold ${capacityTone(capacityPercent(busiest))}`}>{capacityPercent(busiest)}% full · {busiest.enrolledCount}/{capLabel(busiest.course?.cap)}</span>
                  </div>
                </div>}
                {lowestAttended.length > 0 && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Lowest attendance</p>
                  <div className="mt-2 divide-y divide-slate-200">
                    {lowestAttended.map((session) => (
                      <div key={session.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                        <p className="min-w-0 truncate text-sm font-bold text-slate-800">{sessionTitle(session)} · {DAYS[sessionDay(session)]} {timeRange(session)}</p>
                        <span className="flex-none rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-extrabold text-slate-700">{session.enrolledCount} enrolled</span>
                      </div>
                    ))}
                  </div>
                </div>}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--brand-primary)] bg-[var(--brand-strong)] p-4 shadow-md">
            <label className="flex items-center gap-3 text-sm font-extrabold uppercase tracking-[0.12em] text-white">
              View:
              <select value={view} onChange={(event) => setView(event.target.value as ScheduleView)} className="min-w-64 rounded-xl border-2 border-white bg-white px-4 py-3 text-base font-extrabold normal-case tracking-normal text-slate-900 shadow-sm focus:outline-none focus:ring-4 focus:ring-white/40">
                {VIEW_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <p className="max-w-xl text-sm font-semibold text-white/85">{VIEW_OPTIONS.find((option) => option.id === view)?.description}</p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.1em] text-[var(--text-muted)]">Activities</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {uniqueBy(courses, (course) => normalizeActivityName(course.name)).sort((a, b) => a.name.localeCompare(b.name)).map((course) => {
                const hue = resolveActivityHue(course.name);
                const vars = hueVars(hue);
                return <span key={course.id} className="inline-flex items-center gap-1.5 text-xs text-[var(--text)]"><span className="h-2 w-2 rounded-full" style={{ background: vars.rail }} />{course.icon && <span aria-hidden>{course.icon}</span>}{course.name}</span>;
              })}
            </div>
          </div>

          {view === "dayGrid" && <DayTimeGrid sessions={filteredDaySessions} displayDayGroups={displayDayGroups} duplicateDayCount={filterDay === "" ? duplicateDayCount : 0} timeSlots={timeSlots} campId={campId} />}
          {view === "roomPivot" && <RoomPivot sessions={filteredSessions} rooms={roomRows} timeSlots={timeSlots} campId={campId} />}
          {view === "teacherPivot" && <TeacherPivot sessions={filteredSessions} teachers={teacherRows} timeSlots={timeSlots} campId={campId} />}
          {view === "grid" && (
            <PivotShell title="Activities by time block" subtitle="Enrollment against each class limit. Bar length is the load; a full class is not an error.">
              <div className="p-4">
                <OperationsGrid
                  courses={gridCourses}
                  blocks={gridBlocks}
                  ageGroups={ageGroups}
                  interactive
                  onRemoveSession={removeSession}
                  onAddSession={addSession}
                  footer={<CoverageMatrixView
                    matrix={coverage}
                    courses={gridCourses}
                    variant="band"
                    onAddClass={(columnKey, groupId) => {
                      const column = coverage.columns.find((entry) => entry.key === columnKey);
                      const blockId = column?.blockIds[0] ?? "";
                      router.push(`/activities?new=1&blockId=${blockId}&ageGroupId=${groupId}`);
                    }}
                    onRaiseCap={(courseId) => router.push(`/activities?activityId=${courseId}`)}
                    onUnhide={(courseId) => router.push(`/activities?activityId=${courseId}`)}
                  />}
                />
              </div>
            </PivotShell>
          )}
          {view === "list" && <ListView sessions={filteredSessions} campId={campId} />}
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone: string }) {
  return (
    <div className={`tile-button ${tone} p-4`}>
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{sub}</p>
    </div>
  );
}

function PivotShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h2 className="text-sm font-extrabold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function DayTimeGrid({ sessions, displayDayGroups, duplicateDayCount, timeSlots, campId }: { sessions: Session[]; displayDayGroups: DisplayDayGroup[]; duplicateDayCount: number; timeSlots: { key: string; start: string; end: string; label: string }[]; campId: string }) {
  return (
    <PivotShell
      title="Day × Time grid"
      subtitle={duplicateDayCount > 0 ? `${duplicateDayCount} duplicate day${duplicateDayCount === 1 ? "" : "s"} hidden because the daily schedule is identical.` : "Each cell shows the classes happening during that day and time block."}
    >
      <table className="min-w-full border-collapse text-left text-sm">
        <thead><tr className="bg-slate-50"><th className="sticky left-0 z-10 w-36 border-b border-r border-slate-200 bg-slate-50 p-3 text-xs font-extrabold uppercase text-slate-500">Day</th>{timeSlots.map((slot) => <th key={slot.key} className="min-w-56 border-b border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-500">{slot.label}</th>)}</tr></thead>
        <tbody>{displayDayGroups.map((group) => <tr key={group.key}><th className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 text-sm font-extrabold text-slate-800"><div>{group.label}</div>{group.days.length > 1 && <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">shown once</div>}</th>{timeSlots.map((slot) => <td key={slot.key} className="border-b border-slate-100 p-2 align-top"><div className="space-y-2">{dedupeSessions(sessions.filter((s) => group.days.includes(sessionDay(s)) && s.startTime === slot.start && s.endTime === slot.end)).map((s) => sessionCell(s, campId))}</div></td>)}</tr>)}</tbody>
      </table>
    </PivotShell>
  );
}

function RoomPivot({ sessions, rooms, timeSlots, campId }: { sessions: Session[]; rooms: Room[]; timeSlots: { key: string; start: string; end: string; label: string }[]; campId: string }) {
  return (
    <PivotShell title="Room × Time pivot" subtitle="A facilities view: scan room usage, empty rooms, and possible overlaps.">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead><tr className="bg-slate-50"><th className="sticky left-0 z-10 w-40 border-b border-r border-slate-200 bg-slate-50 p-3 text-xs font-extrabold uppercase text-slate-500">Room</th>{timeSlots.map((slot) => <th key={slot.key} className="min-w-52 border-b border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-500">{slot.label}</th>)}</tr></thead>
        <tbody>{rooms.map((room) => <tr key={room.id}><th className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 text-sm font-extrabold text-slate-800">{room.name}</th>{timeSlots.map((slot) => <td key={slot.key} className="border-b border-slate-100 p-2 align-top"><div className="space-y-2">{sessions.filter((s) => s.room?.id === room.id && s.startTime === slot.start && s.endTime === slot.end).map((s) => sessionCell(s, campId, true))}</div></td>)}</tr>)}</tbody>
      </table>
    </PivotShell>
  );
}

function TeacherPivot({ sessions, teachers, timeSlots, campId }: { sessions: Session[]; teachers: Person[]; timeSlots: { key: string; start: string; end: string; label: string }[]; campId: string }) {
  return (
    <PivotShell title="Teacher × Time pivot" subtitle="Staffing view: every teacher's assigned classes across the day.">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead><tr className="bg-slate-50"><th className="sticky left-0 z-10 w-44 border-b border-r border-slate-200 bg-slate-50 p-3 text-xs font-extrabold uppercase text-slate-500">Teacher</th>{timeSlots.map((slot) => <th key={slot.key} className="min-w-52 border-b border-slate-200 p-3 text-xs font-extrabold uppercase text-slate-500">{slot.label}</th>)}</tr></thead>
        <tbody>{teachers.map((teacher) => <tr key={teacher.id}><th className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 text-sm font-extrabold text-slate-800">{fullName(teacher)}</th>{timeSlots.map((slot) => <td key={slot.key} className="border-b border-slate-100 p-2 align-top"><div className="space-y-2">{sessions.filter((s) => s.startTime === slot.start && s.endTime === slot.end && s.course?.courseTeachers?.some((ct) => ct.person.id === teacher.id)).map((s) => sessionCell(s, campId, true))}</div></td>)}</tr>)}</tbody>
      </table>
    </PivotShell>
  );
}

function ListView({ sessions, campId }: { sessions: Session[]; campId: string }) {
  const deleteSession = async (session: Session) => {
    const res = await fetch(`/api/camps/${campId}/sessions/${session.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Could not delete session");
    window.location.reload();
  };
  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <div key={session.id} className="camp-card flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: session.course?.color || "#94a3b8" }}>{session.course?.icon || "Sc"}</div>
          <div className="min-w-0 flex-1">{session.course ? <Link href={activityHref(campId, session.course.id)} className="truncate font-semibold text-slate-800 underline-offset-2 hover:underline">{sessionTitle(session)}</Link> : <p className="truncate font-semibold text-slate-800">{sessionTitle(session)}</p>}<p className="text-xs text-slate-500">{DAYS[sessionDay(session)]} · {timeRange(session)} · {session.room?.name || "No room"}{session.course ? ` · ${teacherNames(session.course)}` : ""}</p></div>
          <div className="flex-shrink-0 text-right"><div className="text-sm font-semibold text-slate-700">{session.enrolledCount}/{capLabel(session.course?.cap)}</div><div className="text-xs text-slate-500">enrolled</div></div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[session.status] || "bg-slate-100 text-slate-600"}`}>{session.status}</span>
          <RowDeleteButton onDelete={() => deleteSession(session)} label={sessionTitle(session)} />
        </div>
      ))}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-sunset-500 border-t-transparent" /></div>}>
      <ScheduleContent />
    </Suspense>
  );
}
