"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { HelpCopy } from "@/components/HelpMode";
import { EmptyState } from "@/components/OperationalUI";
import { RowDeleteButton } from "@/components/InlineEditing";

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
  ageGroup?: AgeGroup | null;
  courseAgeGroups?: { ageGroup: AgeGroup }[];
  courseTeachers?: { person: Person }[];
}

interface Room {
  id: string;
  name: string;
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

type ScheduleView = "dayGrid" | "roomPivot" | "teacherPivot" | "coursePivot" | "capacity" | "list";
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
  { id: "coursePivot", label: "Course Matrix", description: "Courses with times, rooms, teachers, and counts." },
  { id: "capacity", label: "Capacity Heatmap", description: "Enrollment load by room, class, and time." },
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
function ageGroupNames(course?: Course | null) {
  return course?.courseAgeGroups?.map((cag) => cag.ageGroup.name).join(", ") || course?.ageGroup?.name || "All groups";
}
function capacityPercent(session: Session) {
  const cap = session.course?.cap || 0;
  return cap > 0 ? Math.round((session.enrolledCount / cap) * 100) : 0;
}
function capacityTone(percent: number) {
  if (percent >= 100) return "bg-rose-100 text-rose-800 border-rose-200";
  if (percent >= 85) return "bg-clay-100 text-clay-800 border-clay-200";
  if (percent >= 60) return "bg-butter-100 text-amber-800 border-amber-200";
  if (percent > 0) return "bg-sage-100 text-sage-800 border-sage-200";
  return "bg-slate-50 text-slate-400 border-slate-200";
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
  const titleNode = session.course ? (
    <Link
      href={activityHref(campId, session.course.id)}
      className="truncate text-xs font-black text-slate-900 underline-offset-2 hover:underline"
      title={`Edit ${session.course.name}`}
    >
      {title}
    </Link>
  ) : (
    <p className="truncate text-xs font-black text-slate-900">{title}</p>
  );
  return (
    <div key={session.id} className={`rounded-xl border p-2 ${capacityTone(percent)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {titleNode}
          {!compact && <p className="mt-0.5 text-[11px] font-semibold opacity-80">{session.room?.name || "No room"}</p>}
        </div>
        <span className="rounded-full bg-white/65 px-1.5 py-0.5 text-[10px] font-black">{session.enrolledCount}/{session.course?.cap || "?"}</span>
      </div>
      {!compact && session.course && <p className="mt-1 text-[10px] leading-tight opacity-75">{teacherNames(session.course)}</p>}
    </div>
  );
}

function ScheduleContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  const [sessions, setSessions] = useState<Session[]>([]);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ScheduleView>("dayGrid");
  const [filterDay, setFilterDay] = useState<number | "">("");
  const [showHealth, setShowHealth] = useState(false);

  useEffect(() => {
    if (!campId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/camps/${campId}/sessions`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/session-templates`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/courses`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/rooms`).then((r) => r.json()),
    ]).then(([s, t, c, r]) => {
      setSessions(Array.isArray(s) ? s : []);
      setTemplates(Array.isArray(t) ? t : []);
      setCourses(Array.isArray(c) ? c : []);
      setRooms(Array.isArray(r) ? r : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [campId]);

  if (!campId) return <EmptyState title="Choose a program first" description="Schedules are built for one program at a time." actionHref="/dashboard" actionLabel="Go to dashboard" />;

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
  const timeSlots = uniqueBy(dayDisplaySessions, (s) => `${s.startTime}|${s.endTime}`)
    .map((s) => ({ key: `${s.startTime}|${s.endTime}`, start: s.startTime, end: s.endTime, label: timeRange(s) }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const roomRows = uniqueBy([...rooms, ...filteredSessions.map((s) => s.room).filter((room): room is Room => Boolean(room))], (room) => room.id).sort((a, b) => a.name.localeCompare(b.name));
  const teacherRows = uniqueBy(filteredSessions.flatMap((s) => s.course?.courseTeachers?.map((ct) => ct.person) || []), (p) => p.id).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const totalCapacity = displaySessions.reduce((sum, session) => sum + (session.course?.cap || 0), 0);
  const totalEnrolled = displaySessions.reduce((sum, session) => sum + session.enrolledCount, 0);
  const averageFill = displaySessions.length ? Math.round(displaySessions.reduce((sum, session) => sum + capacityPercent(session), 0) / displaySessions.length) : 0;
  const overloaded = displaySessions.filter((session) => capacityPercent(session) >= 100).length;
  const unassignedRooms = displaySessions.filter((session) => !session.room).length;
  const unassignedTeachers = displaySessions.filter((session) => !session.course?.courseTeachers?.length).length;
  const busiest = [...displaySessions].sort((a, b) => capacityPercent(b) - capacityPercent(a))[0];
  const scheduleSummary = activeDays.length > 0
    ? `${dayRangeLabel(activeDays)} · ${timeSlots.length} time block${timeSlots.length === 1 ? "" : "s"}${duplicateDayCount > 0 ? ` · ${duplicateDayCount} duplicate day${duplicateDayCount === 1 ? "" : "s"} hidden` : ""}`
    : `${timeSlots.length} time block${timeSlots.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Schedule</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Schedule</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">{scheduleSummary}</p>
          <HelpCopy title="Schedule views" className="mt-1 text-sm text-slate-500">Use the view buttons below to switch between the schedule grid, room, teacher, course, capacity, and list views.</HelpCopy>
        </div>
        <div className="flex flex-col gap-2 xl:items-end">
          <button onClick={() => setShowHealth((value) => !value)} className="w-fit rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50">
            {showHealth ? "Hide schedule health" : "Show schedule health"}
          </button>
          {activeDays.length > 1 && (
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <button onClick={() => setFilterDay("")} className={`rounded-xl px-3 py-2 text-xs font-black transition ${filterDay === "" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>All Days</button>
              {activeDays.map((day) => (
                <button key={day} onClick={() => setFilterDay(day)} className={`rounded-xl px-3 py-2 text-xs font-black transition ${filterDay === day ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{DAYS[day]}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sunset-500 border-t-transparent" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="camp-card p-12 text-center">
          <span className="mb-4 block text-5xl">Date</span>
          <h3 className="mb-2 font-bold text-slate-700">No activities scheduled yet</h3>
          <p className="mb-5 text-sm text-slate-400">Create Time Blocks in Setup, then assign activities in the Schedule Builder.</p>
          <Link href={`/setup?campId=${campId}&step=times`} className="minimal-button-primary inline-flex">Set up Time Blocks</Link>
        </div>
      ) : (
        <>
          {showHealth && (
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="Sessions" value={displaySessions.length} sub={`${activeDays.length} active day${activeDays.length === 1 ? "" : "s"}`} tone="tile-aqua" />
                <MetricCard label="Classes" value={courses.length} sub={`${templates.length} time templates`} tone="tile-sage" />
                <MetricCard label="Enrollment" value={`${totalEnrolled}/${totalCapacity || "?"}`} sub={`${averageFill}% avg fill`} tone="tile-butter" />
                <MetricCard label="Full / over" value={overloaded} sub="sessions at capacity" tone="tile-clay" />
                <MetricCard label="No room" value={unassignedRooms} sub="needs placement" tone="tile-lavender" />
                <MetricCard label="No teacher" value={unassignedTeachers} sub="needs staffing" tone="tile-berry" />
              </div>
              {busiest && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400">Highest load</p>
                      <p className="text-sm font-bold text-slate-800">{sessionTitle(busiest)} · {DAYS[sessionDay(busiest)]} {timeRange(busiest)} · {busiest.room?.name || "No room"}</p>
                    </div>
                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${capacityTone(capacityPercent(busiest))}`}>{capacityPercent(busiest)}% full · {busiest.enrolledCount}/{busiest.course?.cap || "?"}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
            <label className="flex items-center gap-2 text-sm font-black text-slate-700">
              View:
              <select value={view} onChange={(event) => setView(event.target.value as ScheduleView)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400/30">
                {VIEW_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <p className="text-xs font-semibold text-slate-500">{VIEW_OPTIONS.find((option) => option.id === view)?.description}</p>
          </div>

          {view === "dayGrid" && <DayTimeGrid sessions={filteredDaySessions} displayDayGroups={displayDayGroups} duplicateDayCount={filterDay === "" ? duplicateDayCount : 0} timeSlots={timeSlots} campId={campId} />}
          {view === "roomPivot" && <RoomPivot sessions={filteredSessions} rooms={roomRows} timeSlots={timeSlots} campId={campId} />}
          {view === "teacherPivot" && <TeacherPivot sessions={filteredSessions} teachers={teacherRows} timeSlots={timeSlots} campId={campId} />}
          {view === "coursePivot" && <CoursePivot sessions={filteredSessions} courses={courses} campId={campId} />}
          {view === "capacity" && <CapacityHeatmap sessions={filteredSessions} campId={campId} />}
          {view === "list" && <ListView sessions={filteredSessions} campId={campId} />}
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone: string }) {
  return (
    <div className={`tile-button ${tone} p-4`}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{sub}</p>
    </div>
  );
}

function PivotShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h2 className="text-sm font-black text-slate-900">{title}</h2>
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
        <thead><tr className="bg-slate-50"><th className="sticky left-0 z-10 w-36 border-b border-r border-slate-200 bg-slate-50 p-3 text-xs font-black uppercase text-slate-500">Day</th>{timeSlots.map((slot) => <th key={slot.key} className="min-w-56 border-b border-slate-200 p-3 text-xs font-black uppercase text-slate-500">{slot.label}</th>)}</tr></thead>
        <tbody>{displayDayGroups.map((group) => <tr key={group.key}><th className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 text-sm font-black text-slate-800"><div>{group.label}</div>{group.days.length > 1 && <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">shown once</div>}</th>{timeSlots.map((slot) => <td key={slot.key} className="border-b border-slate-100 p-2 align-top"><div className="space-y-2">{dedupeSessions(sessions.filter((s) => group.days.includes(sessionDay(s)) && s.startTime === slot.start && s.endTime === slot.end)).map((s) => sessionCell(s, campId))}</div></td>)}</tr>)}</tbody>
      </table>
    </PivotShell>
  );
}

function RoomPivot({ sessions, rooms, timeSlots, campId }: { sessions: Session[]; rooms: Room[]; timeSlots: { key: string; start: string; end: string; label: string }[]; campId: string }) {
  return (
    <PivotShell title="Room × Time pivot" subtitle="A facilities view: scan room usage, empty rooms, and possible overlaps.">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead><tr className="bg-slate-50"><th className="sticky left-0 z-10 w-40 border-b border-r border-slate-200 bg-slate-50 p-3 text-xs font-black uppercase text-slate-500">Room</th>{timeSlots.map((slot) => <th key={slot.key} className="min-w-52 border-b border-slate-200 p-3 text-xs font-black uppercase text-slate-500">{slot.label}</th>)}</tr></thead>
        <tbody>{rooms.map((room) => <tr key={room.id}><th className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 text-sm font-black text-slate-800">{room.name}</th>{timeSlots.map((slot) => <td key={slot.key} className="border-b border-slate-100 p-2 align-top"><div className="space-y-2">{sessions.filter((s) => s.room?.id === room.id && s.startTime === slot.start && s.endTime === slot.end).map((s) => sessionCell(s, campId, true))}</div></td>)}</tr>)}</tbody>
      </table>
    </PivotShell>
  );
}

function TeacherPivot({ sessions, teachers, timeSlots, campId }: { sessions: Session[]; teachers: Person[]; timeSlots: { key: string; start: string; end: string; label: string }[]; campId: string }) {
  return (
    <PivotShell title="Teacher × Time pivot" subtitle="Staffing view: every teacher's assigned classes across the day.">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead><tr className="bg-slate-50"><th className="sticky left-0 z-10 w-44 border-b border-r border-slate-200 bg-slate-50 p-3 text-xs font-black uppercase text-slate-500">Teacher</th>{timeSlots.map((slot) => <th key={slot.key} className="min-w-52 border-b border-slate-200 p-3 text-xs font-black uppercase text-slate-500">{slot.label}</th>)}</tr></thead>
        <tbody>{teachers.map((teacher) => <tr key={teacher.id}><th className="sticky left-0 z-10 border-r border-slate-200 bg-white p-3 text-sm font-black text-slate-800">{fullName(teacher)}</th>{timeSlots.map((slot) => <td key={slot.key} className="border-b border-slate-100 p-2 align-top"><div className="space-y-2">{sessions.filter((s) => s.startTime === slot.start && s.endTime === slot.end && s.course?.courseTeachers?.some((ct) => ct.person.id === teacher.id)).map((s) => sessionCell(s, campId, true))}</div></td>)}</tr>)}</tbody>
      </table>
    </PivotShell>
  );
}

function CoursePivot({ sessions, courses, campId }: { sessions: Session[]; courses: Course[]; campId: string }) {
  const rows = courses.map((course) => ({ course, sessions: sessions.filter((s) => s.course?.id === course.id).sort(sessionSort) })).filter((row) => row.sessions.length > 0);
  return (
    <PivotShell title="Course matrix" subtitle="One row per course with its schedule footprint and operational metadata.">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead><tr className="bg-slate-50"><th className="border-b border-slate-200 p-3 text-xs font-black uppercase text-slate-500">Course</th><th className="border-b border-slate-200 p-3 text-xs font-black uppercase text-slate-500">Times</th><th className="border-b border-slate-200 p-3 text-xs font-black uppercase text-slate-500">Rooms</th><th className="border-b border-slate-200 p-3 text-xs font-black uppercase text-slate-500">Teachers</th><th className="border-b border-slate-200 p-3 text-xs font-black uppercase text-slate-500">Groups</th><th className="border-b border-slate-200 p-3 text-xs font-black uppercase text-slate-500">Load</th></tr></thead>
        <tbody>{rows.map(({ course, sessions: courseSessions }) => { const uniqueTimes = uniqueBy(courseSessions, (s) => `${sessionDay(s)}|${s.startTime}|${s.endTime}`); const rooms = uniqueBy(courseSessions.map((s) => s.room).filter((room): room is Room => Boolean(room)), (room) => room.id); const enrolled = courseSessions.reduce((sum, s) => sum + s.enrolledCount, 0); const cap = courseSessions.reduce((sum, s) => sum + (s.course?.cap || 0), 0); return <tr key={course.id} className="border-b border-slate-100"><td className="p-3 font-black text-slate-900"><Link href={activityHref(campId, course.id)} className="underline-offset-2 hover:underline">{course.name}</Link></td><td className="p-3 text-xs text-slate-600">{uniqueTimes.map((s) => `${DAYS[sessionDay(s)]} ${timeRange(s)}`).join("\n")}</td><td className="p-3 text-xs text-slate-600">{rooms.map((room) => room.name).join("\n") || "—"}</td><td className="p-3 text-xs text-slate-600">{teacherNames(course)}</td><td className="p-3 text-xs text-slate-600">{ageGroupNames(course)}</td><td className="p-3"><span className={`rounded-full border px-2 py-1 text-xs font-black ${capacityTone(cap ? Math.round((enrolled / cap) * 100) : 0)}`}>{enrolled}/{cap || "?"}</span></td></tr>; })}</tbody>
      </table>
    </PivotShell>
  );
}

function CapacityHeatmap({ sessions, campId }: { sessions: Session[]; campId: string }) {
  return (
    <PivotShell title="Capacity heatmap" subtitle="Sorted by fullness so the pressure points float to the top.">
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {[...sessions].sort((a, b) => capacityPercent(b) - capacityPercent(a)).map((session) => {
          const percent = capacityPercent(session);
          return <div key={session.id} className={`rounded-2xl border p-4 ${capacityTone(percent)}`}><div className="flex items-start justify-between gap-3"><div>{session.course ? <Link href={activityHref(campId, session.course.id)} className="font-black text-slate-900 underline-offset-2 hover:underline">{sessionTitle(session)}</Link> : <p className="font-black text-slate-900">{sessionTitle(session)}</p>}<p className="mt-1 text-xs font-semibold opacity-80">{DAYS[sessionDay(session)]} · {timeRange(session)} · {session.room?.name || "No room"}</p></div><span className="rounded-full bg-white/65 px-2 py-1 text-xs font-black">{percent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full bg-slate-900/60" style={{ width: `${Math.min(percent, 100)}%` }} /></div><p className="mt-2 text-xs font-bold opacity-80">{session.enrolledCount}/{session.course?.cap || "?"} enrolled{session.course ? ` · ${teacherNames(session.course)}` : ""}</p></div>;
        })}
      </div>
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
          <div className="flex-shrink-0 text-right"><div className="text-sm font-semibold text-slate-700">{session.enrolledCount}/{session.course?.cap || "?"}</div><div className="text-xs text-slate-400">enrolled</div></div>
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
