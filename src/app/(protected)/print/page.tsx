"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { fitName, nameFieldWidthPt } from "@/lib/badgeFit";
import { DEFAULT_PROGRAM_PALETTE } from "@/lib/programPalettes";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/OperationalUI";
import CamperScannableCode from "@/components/CamperScannableCode";

// ─────────────────────────────────────────────────────────────────────────────
// Print center — reduction build. Six hardcoded jobs, one options drawer
// (badges only), a day packet, and a CSV export. There is no template editor.
// ─────────────────────────────────────────────────────────────────────────────

type JobId = "badges" | "teacherPackets" | "emergencyCards" | "pickupCards" | "roomSigns";
type PrintTask = { job: JobId | "dayPacket"; testPage?: boolean };
type BadgeRole = "participant" | "teacher" | "volunteer" | "staff" | "medical" | "visitor" | "media" | "crew";
type BadgeSize = "5x3" | "6x4";
type BadgeTarget = "sheet" | "card";

interface CampSession {
  id: string;
  startTime?: string | null;
  endTime?: string | null;
  course?: { id: string; name: string } | null;
  mandatorySession?: { id: string; title: string } | null;
  room?: { id?: string; name: string } | null;
  sessionTemplate?: { id: string; label?: string | null; startTime: string; endTime: string } | null;
}
interface Enrollment { id: string; sessionId: string; session?: CampSession | null; }
interface Camper {
  id: string;
  firstName: string;
  lastName: string;
  tshirtSize?: string;
  ageGroup?: { id?: string; name: string; color: string } | null;
  guardianName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  emergencyPhone?: string | null;
  pickupNumber?: string | null;
  scanCode?: string | null;
  medicalNotes?: string | null;
  dietaryNotes?: string | null;
  enrollments?: Enrollment[];
}
interface Person { id: string; firstName: string; lastName: string; role: string; email?: string | null; phone?: string | null; }
interface SessionTemplate { id: string; label?: string | null; startTime: string; endTime: string; }
interface Course {
  id: string;
  name: string;
  cap: number;
  ageGroup?: { name: string } | null;
  courseAgeGroups?: { ageGroup: { name: string } }[];
  room?: { id?: string; name: string } | null;
  courseTeachers?: { person: Person }[];
  courseSessionTemplates?: { sessionTemplate: SessionTemplate }[];
}
interface MandatorySession {
  id: string;
  title: string;
  ageGroup?: { name: string } | null;
  room?: { name: string } | null;
  leader?: Person | null;
  sessionTemplate: SessionTemplate;
}
interface Room { id: string; name: string; capacity?: number; description?: string | null; }
interface CampOption { id: string; name: string; primaryColor?: string; accentColor?: string; }

const BADGE_ROLES: { id: BadgeRole; label: string; printedLabel: string; band: string }[] = [
  { id: "participant", label: "Participant", printedLabel: "", band: "" },
  { id: "teacher", label: "Teacher", printedLabel: "TEACHER", band: "#1D4FD8" },
  { id: "volunteer", label: "Volunteer", printedLabel: "VOLUNTEER", band: "#047857" },
  { id: "staff", label: "Staff", printedLabel: "STAFF", band: "#7C3AED" },
  { id: "medical", label: "Medical & safety", printedLabel: "MEDICAL", band: "#C42B2B" },
  { id: "visitor", label: "Parent visitor", printedLabel: "VISITOR", band: "#475569" },
  { id: "media", label: "Photo & media", printedLabel: "MEDIA", band: "#0E7490" },
  { id: "crew", label: "Crew", printedLabel: "CREW", band: "#C2410C" },
];

// Card geometry (inches). 5×3 portrait = 3in wide × 5in tall.
const BADGE_GEOMETRY: Record<BadgeSize, { w: number; h: number; margin: string; perSheet: number; cols: number; rows: number; offsetX: number; offsetY: number }> = {
  "5x3": { w: 3, h: 5, margin: "0.15in", perSheet: 4, cols: 2, rows: 2, offsetX: 1.25, offsetY: 0.5 },
  "6x4": { w: 4, h: 6, margin: "0.18in", perSheet: 2, cols: 2, rows: 1, offsetX: 0.25, offsetY: 2.5 },
};

function fullName(p: { firstName: string; lastName: string }) { return `${p.firstName} ${p.lastName}`.trim(); }

/**
 * Renders a name at the largest size that fits, wrapping to two lines before
 * shrinking small. A printed badge cannot be scrolled or hovered, so losing
 * characters to an ellipsis is never acceptable (doc C §4).
 */
function BadgeName({ name, widthIn }: { name: string; widthIn: number }) {
  const fit = fitName(name, nameFieldWidthPt(widthIn));
  return (
    <span
      className="badge-band-name"
      data-wrapped={fit.wrapped || undefined}
      style={{ fontSize: `${fit.fontSizePt}pt` }}
    >
      {fit.lines.map((line, index) => (
        <span key={index} className="badge-band-line">{line}</span>
      ))}
    </span>
  );
}
function formatTime(value?: string | null) {
  if (!value) return "";
  const [rawHour, rawMinute = "00"] = value.split(":");
  const hour = Number(rawHour);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${rawMinute.padStart(2, "0").slice(0, 2)} ${suffix}`;
}
function formatRange(start?: string | null, end?: string | null) { return `${formatTime(start) || "Time"}${end ? `–${formatTime(end)}` : ""}`; }
function sessionStart(session?: CampSession | null) { return session?.startTime || session?.sessionTemplate?.startTime || ""; }
function sessionEnd(session?: CampSession | null) { return session?.endTime || session?.sessionTemplate?.endTime || ""; }
function scheduleTitle(session?: CampSession | null) { return session?.mandatorySession?.title || session?.course?.name || session?.sessionTemplate?.label || "Session"; }
function sortedCampersList(campers: Camper[]) { return [...campers].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)); }
function courseAgeLabel(course: Course) { return course.courseAgeGroups?.map(cag => cag.ageGroup.name).join(", ") || course.ageGroup?.name || "All groups"; }
function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += Math.max(size, 1)) chunks.push(items.slice(i, i + Math.max(size, 1)));
  return chunks.length ? chunks : [[]];
}

function scheduleRows(camper: Camper) {
  const rows = new Map<string, { time: string; activity: string; room: string; sortValue: string }>();
  for (const enrollment of camper.enrollments || []) {
    const session = enrollment.session;
    if (!session) continue;
    const start = sessionStart(session);
    const key = `${start}|${sessionEnd(session)}|${scheduleTitle(session)}|${session.room?.id || session.room?.name || ""}`;
    if (!rows.has(key)) rows.set(key, {
      time: formatTime(start) || session.sessionTemplate?.label || "Time",
      activity: scheduleTitle(session),
      room: session.room?.name || "",
      sortValue: `${start || "99:99"}|${scheduleTitle(session).toLowerCase()}`,
    });
  }
  return [...rows.values()].sort((a, b) => a.sortValue.localeCompare(b.sortValue));
}

function rosterGroups(campers: Camper[]) {
  const groups = new Map<string, { key: string; courseId: string; title: string; time: string; room: string; campers: Camper[]; sortValue: string }>();
  for (const camper of campers) for (const enrollment of camper.enrollments || []) {
    const session = enrollment.session;
    if (!session?.course?.id) continue;
    const start = sessionStart(session);
    const end = sessionEnd(session);
    const key = `${session.course.id}|${start}|${end}|${session.room?.id || session.room?.name || ""}`;
    const existing = groups.get(key) || { key, courseId: session.course.id, title: session.course.name, time: formatRange(start, end), room: session.room?.name || "—", campers: [], sortValue: `${start || "99:99"}|${session.course.name}` };
    if (!existing.campers.some(c => c.id === camper.id)) existing.campers.push(camper);
    groups.set(key, existing);
  }
  return [...groups.values()].map(group => ({ ...group, campers: sortedCampersList(group.campers) })).sort((a, b) => a.sortValue.localeCompare(b.sortValue));
}

function teacherRows(person: Person, courses: Course[], mandatorySessions: MandatorySession[], campers: Camper[], allSlots: SessionTemplate[] = []) {
  const rows = new Map<string, { time: string; title: string; room: string; age: string; sortValue: string; students: Camper[] }>();
  const campersForCourseSlot = (courseId: string, start: string, end: string, roomName?: string | null) => {
    const matches = new Map<string, Camper>();
    for (const camper of campers) for (const enrollment of camper.enrollments || []) {
      const session = enrollment.session;
      if (!session?.course?.id || session.course.id !== courseId) continue;
      if (sessionStart(session) !== start || sessionEnd(session) !== end) continue;
      if (roomName && session.room?.name && session.room.name !== roomName) continue;
      matches.set(camper.id, camper);
    }
    return sortedCampersList([...matches.values()]);
  };
  for (const course of courses.filter(course => course.courseTeachers?.some(ct => ct.person.id === person.id))) {
    for (const cst of course.courseSessionTemplates || []) {
      const start = cst.sessionTemplate.startTime || "";
      const end = cst.sessionTemplate.endTime || "";
      const room = course.room?.name || "—";
      const key = `${course.id}|${start}|${end}|${room}`;
      if (!rows.has(key)) rows.set(key, { time: formatRange(start, end), title: course.name, room, age: courseAgeLabel(course), sortValue: `${start || "99:99"}|${course.name}`, students: campersForCourseSlot(course.id, start, end, course.room?.name) });
    }
  }
  for (const assignment of mandatorySessions.filter(ms => ms.leader?.id === person.id)) {
    const start = assignment.sessionTemplate.startTime || "";
    const end = assignment.sessionTemplate.endTime || "";
    const key = `mandatory|${assignment.title}|${start}|${end}`;
    if (!rows.has(key)) rows.set(key, { time: formatRange(start, end), title: assignment.title, room: assignment.room?.name || "—", age: assignment.ageGroup?.name || "Required", sortValue: `${start || "99:99"}|${assignment.title}`, students: [] });
  }
  // Fill the rest of the day: any time block where this teacher has nothing
  // assigned appears as "No Assigned Class" so breaks are visible.
  const occupiedStarts = new Set([...rows.values()].map(row => row.sortValue.split("|")[0]));
  const seenSlotTimes = new Set<string>();
  for (const slot of allSlots) {
    const start = slot.startTime || "";
    const end = slot.endTime || "";
    const timeKey = `${start}|${end}`;
    if (!start || seenSlotTimes.has(timeKey)) continue;
    seenSlotTimes.add(timeKey);
    if (occupiedStarts.has(start)) continue;
    rows.set(`free|${timeKey}`, { time: formatRange(start, end), title: "No Assigned Class", room: "—", age: "—", sortValue: `${start}|zzz`, students: [] });
  }
  return [...rows.values()].sort((a, b) => a.sortValue.localeCompare(b.sortValue));
}

function csvEscape(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function readPrintLog(campId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(`printLog:${campId}`) || "{}"); } catch { return {}; }
}

function formatLogTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function PrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campIdFromUrl = searchParams.get("campId") || "";
  const [campId, setCampId] = useState("");
  const [campName, setCampName] = useState("");
  const [eventColor, setEventColor] = useState(DEFAULT_PROGRAM_PALETTE.primaryColor);
  const [campers, setCampers] = useState<Camper[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [mandatorySessions, setMandatorySessions] = useState<MandatorySession[]>([]);
  const [sessionTemplates, setSessionTemplates] = useState<SessionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [task, setTask] = useState<PrintTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [printLog, setPrintLog] = useState<Record<string, string>>({});

  // Badge options — the only configuration in the print center.
  const [badgeRole, setBadgeRole] = useState<BadgeRole>("participant");
  const [badgeSize, setBadgeSize] = useState<BadgeSize>("5x3");
  const [badgeTarget, setBadgeTarget] = useState<BadgeTarget>("sheet");
  const [badgeScopeAgeGroupId, setBadgeScopeAgeGroupId] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/camps")
      .then(r => r.ok ? r.json() : [])
      .then(camps => {
        if (cancelled) return;
        const available: CampOption[] = Array.isArray(camps) ? camps : [];
        const savedCampId = typeof window !== "undefined" ? localStorage.getItem("activeCampId") : "";
        const selected = available.find(camp => camp.id === (campIdFromUrl || savedCampId)) || available[0];
        if (!selected?.id) {
          setAccessError("No event is available to this account. Ask an owner to add you to the event, then return here.");
          return;
        }
        setCampId(selected.id);
        setCampName(selected.name || "");
        setEventColor(selected.primaryColor || DEFAULT_PROGRAM_PALETTE.primaryColor);
        if (typeof window !== "undefined") localStorage.setItem("activeCampId", selected.id);
        if (campIdFromUrl !== selected.id) router.replace(`/print?campId=${selected.id}`);
      })
      .catch(() => !cancelled && setAccessError("We could not confirm which event you can access. Refresh and try again."));
    return () => { cancelled = true; };
  }, [campIdFromUrl, router]);

  useEffect(() => {
    if (!campId) return;
    setLoading(true);
    const getJson = async (path: string) => {
      const response = await fetch(path);
      const data = await response.json().catch(() => null);
      return { response, data };
    };
    Promise.all([
      getJson(`/api/camps/${campId}/campers`),
      getJson(`/api/camps/${campId}/courses`),
      getJson(`/api/camps/${campId}/persons`),
      getJson(`/api/camps/${campId}/mandatory-sessions`),
      getJson(`/api/camps/${campId}/rooms`),
      getJson(`/api/camps/${campId}/session-templates`),
    ]).then(([c, co, p, ms, r, st]) => {
      const denied = [c, co, p, ms, r].find(result => result.response.status === 401 || result.response.status === 403);
      if (denied) {
        setAccessError(denied.response.status === 401
          ? "Your session expired. Sign in again, then return to the print center."
          : "You do not have access to this event's print data.");
        setLoading(false);
        return;
      }
      setCampers(Array.isArray(c.data) ? c.data : []);
      setCourses(Array.isArray(co.data) ? co.data : []);
      setPersons(Array.isArray(p.data) ? p.data : []);
      setMandatorySessions(Array.isArray(ms.data) ? ms.data : []);
      setRooms(Array.isArray(r.data) ? r.data : []);
      setSessionTemplates(Array.isArray(st.data) ? st.data : []);
      setPrintLog(readPrintLog(campId));
      setLoading(false);
    }).catch(() => {
      setAccessError("The print center could not load event data. Check your connection and try again.");
      setLoading(false);
    });
  }, [campId]);

  // Kick off the browser print dialog once a task renders into #print-root.
  useEffect(() => {
    if (!task) return;
    const id = window.setTimeout(() => {
      window.print();
      const key = task.job;
      const nextLog = { ...readPrintLog(campId), [key]: new Date().toISOString() };
      try { localStorage.setItem(`printLog:${campId}`, JSON.stringify(nextLog)); } catch { /* storage unavailable */ }
      setPrintLog(nextLog);
      setTask(null);
    }, 300);
    return () => window.clearTimeout(id);
  }, [task, campId]);

  const sortedCampers = useMemo(() => sortedCampersList(campers), [campers]);
  const rosters = useMemo(() => rosterGroups(campers), [campers]);
  const teachers = useMemo(() => persons.filter(p => ["teacher", "assistant", "director", "staff"].includes(p.role)), [persons]);
  const families = useMemo(() => {
    const byFamily = new Map<string, Camper[]>();
    for (const camper of sortedCampers) {
      const key = camper.pickupNumber || `family-${camper.lastName.toLowerCase()}`;
      byFamily.set(key, [...(byFamily.get(key) || []), camper]);
    }
    return [...byFamily.entries()].map(([key, members]) => ({ key, members }));
  }, [sortedCampers]);
  const roomsWithSchedule = useMemo(() => {
    const list = rooms.length ? rooms : [];
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [rooms]);
  const ageGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const camper of campers) if (camper.ageGroup?.id && !map.has(camper.ageGroup.id)) map.set(camper.ageGroup.id, { id: camper.ageGroup.id, name: camper.ageGroup.name });
    return [...map.values()];
  }, [campers]);

  const badgeRecipients = useMemo(() => {
    if (badgeRole === "participant") {
      return badgeScopeAgeGroupId ? sortedCampers.filter(c => c.ageGroup?.id === badgeScopeAgeGroupId) : sortedCampers;
    }
    return persons.map(person => ({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      scanCode: `staff-${person.id}`,
      ageGroup: null,
      enrollments: [],
    })) as unknown as Camper[];
  }, [badgeRole, badgeScopeAgeGroupId, sortedCampers, persons]);

  const geometry = BADGE_GEOMETRY[badgeSize];
  // Fronts + backs: sheet mode prints a back sheet per front sheet; card mode prints two pages per badge.
  const badgeSheetCount = badgeTarget === "sheet" ? Math.ceil(badgeRecipients.length / geometry.perSheet) * 2 : badgeRecipients.length * 2;
  const badgeMinutes = Math.max(1, Math.round(badgeSheetCount / 6));

  const jobCounts: Record<JobId, { primary: string; sheets: number }> = {
    badges: { primary: `${badgeRecipients.length} badges`, sheets: badgeSheetCount },
    teacherPackets: { primary: `${teachers.length} teachers`, sheets: teachers.length },
    emergencyCards: { primary: `${sortedCampers.length} participants`, sheets: Math.ceil(sortedCampers.length / 22) },
    pickupCards: { primary: `${families.length} families`, sheets: families.length },
    roomSigns: { primary: `${roomsWithSchedule.length} rooms`, sheets: roomsWithSchedule.length },
  };
  const packetSheets = (Object.keys(jobCounts) as JobId[]).reduce((sum, job) => sum + jobCounts[job].sheets, 0) + 5;

  const exportCsv = () => {
    const slotSet = new Map<string, string>();
    for (const camper of sortedCampers) for (const row of scheduleRows(camper)) {
      if (!slotSet.has(row.time)) slotSet.set(row.time, row.time);
    }
    const slots = [...slotSet.keys()];
    const header = ["First name", "Last name", "Age group", "Guardian", "Guardian phone", "Guardian email", "Emergency phone", "Medical notes", "Dietary notes", "Pickup #", "T-shirt", ...slots];
    const lines = [header.map(csvEscape).join(",")];
    for (const camper of sortedCampers) {
      const rows = scheduleRows(camper);
      const bySlot = new Map(rows.map(row => [row.time, `${row.activity}${row.room ? ` (${row.room})` : ""}`]));
      lines.push([
        camper.firstName, camper.lastName, camper.ageGroup?.name || "", camper.guardianName || "",
        camper.guardianPhone || "", camper.guardianEmail || "", camper.emergencyPhone || "",
        camper.medicalNotes || "", camper.dietaryNotes || "", camper.pickupNumber || "", camper.tshirtSize || "",
        ...slots.map(slot => bySlot.get(slot) || ""),
      ].map(value => csvEscape(String(value))).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${campName || "event"}-participants.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Page geometry: exactly one @page rule at any time ──
  const pageRule = useMemo(() => {
    const isBadgeJob = task?.job === "badges";
    if (isBadgeJob && badgeTarget === "card") {
      const g = BADGE_GEOMETRY[badgeSize];
      return `@page { size: ${g.w}in ${g.h}in; margin: ${g.margin}; }`;
    }
    if (task?.job === "pickupCards") return `@page { size: letter landscape; margin: 0.3in; }`;
    return `@page { size: letter; margin: ${isBadgeJob ? "0" : "0.5in"}; }`;
  }, [task, badgeTarget, badgeSize]);

  // ── Render helpers for print output ──
  const roleMeta = BADGE_ROLES.find(role => role.id === badgeRole) || BADGE_ROLES[0];
  const bandColor = badgeRole === "participant" ? eventColor : roleMeta.band;

  const badgeCard = (record: Camper, key: string) => {
    const rows = scheduleRows(record);
    return (
      <div key={key} className="badge-card-v2" style={{ width: `${geometry.w}in`, height: `${geometry.h}in` }}>
        <div className="badge-band" style={{ background: bandColor }}>
          <BadgeName name={fullName(record)} widthIn={geometry.w} />
        </div>
        {roleMeta.printedLabel && <div className="badge-role-strip">{roleMeta.printedLabel}</div>}
        <div className="badge-body badge-body-schedule">
          <div className="badge-schedule">
            {rows.length ? rows.map((row, idx) => (
              <div key={idx} className="badge-schedule-entry">
                {idx > 0 && <hr className="badge-schedule-hr" />}
                <div className="badge-schedule-row">
                  <span className="badge-schedule-time">{row.time}</span>
                  <span className="badge-schedule-activity">{row.activity}</span>
                </div>
                {row.room && <div className="badge-schedule-location">{row.room}</div>}
              </div>
            )) : <div className="badge-schedule-entry"><div className="badge-schedule-row"><span className="badge-schedule-time">—</span><span className="badge-schedule-activity">No schedule assigned</span></div></div>}
          </div>
        </div>
      </div>
    );
  };

  const badgeBackCard = (record: Camper, key: string) => (
    <div key={key} className="badge-card-v2 badge-card-back" style={{ width: `${geometry.w}in`, height: `${geometry.h}in` }}>
      <div className="badge-band" style={{ background: bandColor }}>
        <BadgeName name={fullName(record)} widthIn={geometry.w} />
      </div>
      <div className="badge-body">
        <div className="badge-back-block">
          <span className="badge-back-label">Emergency contact</span>
          <span className="badge-back-value">{record.guardianName || "—"}</span>
          <span className="badge-back-value badge-back-phone">{record.emergencyPhone || record.guardianPhone || "—"}</span>
        </div>
        <div className="badge-foot">
          <CamperScannableCode value={record.scanCode} label="" size={96} />
          <span className="badge-role-label">Scan for check-in / checkout</span>
        </div>
      </div>
    </div>
  );

  const cropMark = (x: number, y: number) => (
    <span key={`${x}-${y}`}>
      <span className="crop crop-h" style={{ left: `${x - 0.12}in`, top: `${y}in` }} />
      <span className="crop crop-h" style={{ left: `${x}in`, top: `${y}in` }} />
      <span className="crop crop-v" style={{ left: `${x}in`, top: `${y - 0.12}in` }} />
      <span className="crop crop-v" style={{ left: `${x}in`, top: `${y}in` }} />
    </span>
  );

  const renderBadges = (records: Camper[]) => {
    if (badgeTarget === "card") {
      return records.flatMap((record, index) => [
        <article key={`${record.id}-f`} className="print-page badge-single">
          {badgeCard(record, `${record.id}-card`)}
        </article>,
        <article key={`${record.id}-b`} className="print-page badge-single" data-last={index === records.length - 1 || undefined}>
          {badgeBackCard(record, `${record.id}-back`)}
        </article>,
      ]);
    }
    const sheets = chunkItems(records, geometry.perSheet);
    const layoutSheet = (sheetRecords: Camper[], back: boolean, sheetKey: string, isLast: boolean) => (
      <article key={sheetKey} className="print-page badge-sheet-v2" data-last={isLast || undefined}>
        {sheetRecords.map((record, cardIndex) => {
          const col = cardIndex % geometry.cols;
          const rowIndex = Math.floor(cardIndex / geometry.cols);
          const x = geometry.offsetX + col * geometry.w;
          const y = geometry.offsetY + rowIndex * geometry.h;
          return (
            <div key={record.id} className="badge-slot" style={{ left: `${x}in`, top: `${y}in` }}>
              {back ? badgeBackCard(record, `${record.id}-sheet-back`) : badgeCard(record, `${record.id}-sheet`)}
            </div>
          );
        })}
        {sheetRecords.map((_, cardIndex) => {
          const col = cardIndex % geometry.cols;
          const rowIndex = Math.floor(cardIndex / geometry.cols);
          const x = geometry.offsetX + col * geometry.w;
          const y = geometry.offsetY + rowIndex * geometry.h;
          return [cropMark(x, y), cropMark(x + geometry.w, y), cropMark(x, y + geometry.h), cropMark(x + geometry.w, y + geometry.h)];
        })}
      </article>
    );
    return sheets.flatMap((sheetRecords, sheetIndex) => [
      layoutSheet(sheetRecords, false, `sheet-${sheetIndex}-front`, false),
      layoutSheet(sheetRecords, true, `sheet-${sheetIndex}-back`, sheetIndex === sheets.length - 1),
    ]);
  };

  const renderTeacherPackets = () => teachers.map((person, index) => {
    const rows = teacherRows(person, courses, mandatorySessions, campers, sessionTemplates);
    return (
      <article key={person.id} className="print-page doc-page" data-last={index === teachers.length - 1 || undefined}>
        <h1 className="doc-title">{fullName(person)}</h1>
        <p className="doc-subtitle">{person.role}{person.email ? ` · ${person.email}` : ""}{person.phone ? ` · ${person.phone}` : ""}</p>
        <table className="doc-table">
          <thead><tr><th style={{ width: "110px" }}>Time</th><th>Assignment</th><th style={{ width: "110px" }}>Room</th><th style={{ width: "110px" }}>Group</th><th>Students</th></tr></thead>
          <tbody>{rows.length ? rows.map((row, idx) => (
            <tr key={idx} className={row.title === "No Assigned Class" ? "teacher-free-row" : undefined}><td>{row.time}</td><td>{row.title}</td><td>{row.room}</td><td>{row.age}</td><td>{row.students.map(fullName).join(", ") || "—"}</td></tr>
          )) : <tr><td colSpan={5}>No assignments yet.</td></tr>}</tbody>
        </table>
      </article>
    );
  });

  const renderEmergencyCards = () => {
    const byFirstName = [...campers].sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName));
    const pages = chunkItems(byFirstName, 22);
    return pages.map((page, pageIndex) => (
      <article key={`emergency-${pageIndex}`} className="print-page doc-page" data-last={pageIndex === pages.length - 1 || undefined}>
        <h1 className="doc-title">Emergency information</h1>
        <p className="doc-subtitle">Alphabetical by first name · Page {pageIndex + 1} of {pages.length}</p>
        <table className="doc-table">
          <thead><tr><th style={{ width: "150px" }}>Participant</th><th style={{ width: "90px" }}>Age group</th><th>Guardian</th><th style={{ width: "110px" }}>Emergency phone</th><th>Medical / dietary</th></tr></thead>
          <tbody>{page.map(camper => (
            <tr key={camper.id}>
              <td><strong>{camper.firstName} {camper.lastName}</strong></td>
              <td>{camper.ageGroup?.name || "—"}</td>
              <td>{camper.guardianName || "—"}{camper.guardianPhone ? `\n${camper.guardianPhone}` : ""}</td>
              <td>{camper.emergencyPhone || camper.guardianPhone || "—"}</td>
              <td>{[camper.medicalNotes, camper.dietaryNotes].filter(Boolean).join(" / ") || "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </article>
    ));
  };

  const renderPickupCards = () => families.map((family, index) => {
    const lead = family.members[0];
    return (
      <article key={family.key} className="print-page doc-page" data-last={index === families.length - 1 || undefined}>
        <div className="pickup-card-landscape">
          <div className="pickup-number-giant">{lead.pickupNumber || "—"}</div>
          <div className="pickup-family">{lead.lastName} Family</div>
          <div className="pickup-members">{family.members.map(fullName).join(" · ")}</div>
        </div>
      </article>
    );
  });

  const renderRoomSigns = () => {
    // One page per room: every class held in the room, in time order,
    // each with its student roster underneath.
    return roomsWithSchedule.map((room, index) => {
      const groups = rosters.filter(group => group.room === room.name);
      return (
        <article key={room.id} className="print-page doc-page" data-last={index === roomsWithSchedule.length - 1 || undefined}>
          <div className="room-sign">
            <div className="room-sign-kicker">Room</div>
            <div className="room-sign-name">{room.name}</div>
            {room.description && <div className="room-sign-room">{room.description}</div>}
            <div className="room-sign-schedule">
              {groups.length ? groups.map(group => {
                const course = courses.find(c => c.id === group.courseId);
                const teacherList = course?.courseTeachers?.map(ct => `${fullName(ct.person)}${ct.person.role && ct.person.role !== "teacher" ? ` (${ct.person.role})` : ""}`).join(", ") || "—";
                return (
                  <div key={group.key} className="room-sign-class">
                    <div className="room-sign-row"><span className="room-sign-time">{group.time}</span><span className="room-sign-class-name">{group.title}</span></div>
                    <div className="room-sign-teacher">Led by: {teacherList}</div>
                    <div className="room-sign-students">{group.campers.length ? group.campers.map(fullName).join(" · ") : "No participants registered yet"}</div>
                  </div>
                );
              }) : <div className="room-sign-class"><div className="room-sign-row"><span>No classes scheduled in this room.</span></div></div>}
            </div>
          </div>
        </article>
      );
    });
  };

  const divider = (label: string, sheets: number, key: string) => (
    <article key={key} className="print-page packet-divider">
      <div className="packet-divider-label">{label}</div>
      <div className="packet-divider-count">{sheets} sheet{sheets === 1 ? "" : "s"}</div>
    </article>
  );

  const renderTask = () => {
    if (!task) return null;
    if (task.job === "badges") return renderBadges(task.testPage ? badgeRecipients.slice(0, badgeTarget === "sheet" ? geometry.perSheet : 1) : badgeRecipients);
    if (task.job === "teacherPackets") return renderTeacherPackets();
    if (task.job === "emergencyCards") return renderEmergencyCards();
    if (task.job === "pickupCards") return renderPickupCards();
    if (task.job === "roomSigns") return renderRoomSigns();
    // Day packet: every section in run order, with dividers.
    return [
      divider("BADGES", jobCounts.badges.sheets, "d1"), ...renderBadges(badgeRecipients),
      divider("EMERGENCY", jobCounts.emergencyCards.sheets, "d2"), ...renderEmergencyCards(),
      divider("TEACHERS", jobCounts.teacherPackets.sheets, "d3"), ...renderTeacherPackets(),
      divider("ROOM SIGNS", jobCounts.roomSigns.sheets, "d4"), ...renderRoomSigns(),
      divider("PICKUP", jobCounts.pickupCards.sheets, "d5"), ...renderPickupCards(),
    ];
  };

  if (accessError) return <EmptyState title="The print center could not load this event" description={accessError} actionHref="/dashboard" actionLabel="Choose an event" />;
  if (!campId || loading) return <div className="flex h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /></div>;

  const jobs: { id: JobId; title: string; hasOptions?: boolean }[] = [
    { id: "badges", title: "Badges & lanyards", hasOptions: true },
    { id: "teacherPackets", title: "Teacher packets" },
    { id: "emergencyCards", title: "Emergency list" },
    { id: "pickupCards", title: "Pickup cards" },
    { id: "roomSigns", title: "Room signs" },
  ];

  return (
    <>
      <style id="print-page-rule">{`@media print { ${pageRule} }`}</style>
      <style>{`
        @media print {
          body > *:not(:has(#print-root)) { display: none !important; }
          body * { visibility: hidden !important; }
          aside, nav, .no-print { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; display: block !important; min-height: 0 !important; }
          main > div { margin: 0 !important; padding: 0 !important; max-width: none !important; width: 100% !important; }
          #print-root { display: block !important; visibility: visible !important; position: static !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
          #print-root * { visibility: visible !important; }
          #print-root, #print-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-page { break-after: page; page-break-after: always; break-inside: avoid; page-break-inside: avoid; overflow: hidden; }
          .print-page[data-last] { break-after: auto; page-break-after: auto; }
        }
        @media screen { #print-root { display: none; } }
        #print-root { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
        .doc-page { padding: 0; }
        .doc-title { font-size: 20px; font-weight: 900; margin: 0 0 6px; }
        .doc-subtitle { font-size: 11px; margin: 0 0 12px; color: #444; }
        .doc-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .doc-table th, .doc-table td { border: 1px solid #111; padding: 5px 4px; font-size: 9.5px; vertical-align: top; white-space: pre-line; line-height: 1.2; overflow-wrap: anywhere; }
        .doc-table th { background: ${eventColor}; color: #fff; font-size: 9px; font-weight: 800; text-align: left; }
        .teacher-free-row td { color: #777; font-style: italic; background: #f5f6f8; }
        .badge-single { display: flex; align-items: center; justify-content: center; }
        .badge-sheet-v2 { position: relative; width: 8.5in; height: 11in; }
        .badge-slot { position: absolute; }
        .badge-card-v2 { display: flex; flex-direction: column; background: #fff; overflow: hidden; box-sizing: border-box; }
        .badge-band { height: 0.35in; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10pt; font-weight: 800; letter-spacing: .08em; }
        /* Size comes from fitName() inline; no ellipsis — every character prints. */
        .badge-band-name { display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; letter-spacing: 0; padding: 0 0.1in; line-height: 1.05; }
        .badge-band-line { display: block; white-space: nowrap; }
        .badge-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.08in; padding: 0.3in; text-align: center; box-sizing: border-box; min-height: 0; }
        .badge-body-schedule { justify-content: flex-start; padding: 0.3in 0.3in 0.3in; align-items: stretch; text-align: left; }
        .badge-first { font-weight: 900; line-height: 1; white-space: nowrap; }
        .badge-last { font-weight: 600; line-height: 1.05; }
        .badge-age { font-size: 9pt; color: #555; font-weight: 600; }
        .badge-foot { margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 3px; }
        .badge-role-label { font-size: 7pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #444; }
        .badge-schedule { flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; min-height: 0; overflow: hidden; }
        .badge-schedule-entry { display: flex; flex-direction: column; }
        .badge-schedule-hr { border: none; border-top: 1px solid #cbd2da; margin: 0 0 5px; }
        .badge-schedule-row { display: flex; gap: 8px; align-items: baseline; }
        .badge-schedule-time { font-family: "Space Grotesk", Arial, Helvetica, sans-serif; font-variant-numeric: tabular-nums; font-size: 10pt; font-weight: 700; min-width: 0.7in; white-space: nowrap; }
        .badge-schedule-activity { font-family: "Space Grotesk", Arial, Helvetica, sans-serif; font-size: 10pt; font-weight: 700; line-height: 1.15; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1; }
        .badge-schedule-location { font-family: "Space Grotesk", Arial, Helvetica, sans-serif; font-size: 7.5pt; font-weight: 500; color: #555; margin-left: calc(0.7in + 8px); line-height: 1.1; margin-top: 1px; }
        .crop { position: absolute; background: #9AA4B2; }
        .crop-h { width: 0.12in; height: 0.25pt; }
        .crop-v { width: 0.25pt; height: 0.12in; }
        .badge-role-strip { background: #f1f3f6; text-align: center; font-size: 7pt; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; padding: 2px 0; border-bottom: 0.5px solid #bbb; }
        .badge-card-back .badge-body { justify-content: center; gap: 0.16in; }
        .badge-back-block { display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; }
        .badge-back-label { font-size: 7pt; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #666; }
        .badge-back-value { font-size: 12pt; font-weight: 800; line-height: 1.15; }
        .badge-back-phone { font-family: ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; font-size: 14pt; }
        .pickup-card-landscape { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 7.4in; text-align: center; }
        .pickup-number-giant { font-size: 420pt; line-height: 0.9; font-weight: 900; letter-spacing: -0.02em; }
        .pickup-family { font-size: 40px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; margin-top: 0.15in; }
        .pickup-members { margin-top: 0.1in; font-size: 16px; font-weight: 600; color: #444; }
        .room-sign { border: 5px solid #111; min-height: 9in; display: flex; flex-direction: column; align-items: center; padding: 0.4in; box-sizing: border-box; text-align: center; }
        .room-sign-kicker { font-size: 14px; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; }
        .room-sign-name { margin-top: 0.1in; font-size: 44px; font-weight: 900; line-height: 1.05; }
        .room-sign-room { margin-top: 0.06in; font-size: 15px; font-weight: 700; color: #555; }
        .room-sign-schedule { margin-top: 0.25in; width: 100%; text-align: left; }
        .room-sign-class { border-top: 2px solid #111; padding: 0.12in 0.05in; }
        .room-sign-row { display: flex; gap: 14px; font-size: 18px; font-weight: 900; align-items: baseline; }
        .room-sign-class-name { flex: 1; }
        .room-sign-time { font-variant-numeric: tabular-nums; white-space: nowrap; }
        .room-sign-teacher { margin-top: 3px; font-size: 12px; font-weight: 800; color: #333; }
        .room-sign-students { margin-top: 4px; font-size: 11.5px; font-weight: 600; line-height: 1.5; color: #444; }
        .packet-divider { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 9.5in; text-align: center; }
        .packet-divider-label { font-size: 56px; font-weight: 900; letter-spacing: .04em; }
        .packet-divider-count { margin-top: 12px; font-size: 16px; font-weight: 700; color: #444; }
      `}</style>

      <div className="no-print space-y-5">
        <div>
          <h1 className="page-title">Print center</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">{campName}</p>
        </div>

        <div className="camp-card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-base font-extrabold text-slate-900">Print everything for opening day</p>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]"><span className="t-data">5 documents · {packetSheets} sheets</span>{printLog.dayPacket ? ` · Last printed ${formatLogTime(printLog.dayPacket)}` : ""}</p>
          </div>
          <button type="button" onClick={() => setTask({ job: "dayPacket" })} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-slate-700">Print</button>
        </div>

        <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-faint)]">Or print one thing</p>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {jobs.map(job => {
            const counts = jobCounts[job.id];
            const empty = counts.sheets === 0;
            return (
              <div key={job.id} className="camp-card flex flex-col gap-2 p-5">
                <p className="text-sm font-extrabold text-slate-900">{job.title}</p>
                <p className="text-sm text-[var(--text-muted)]"><span className="t-data">{counts.primary} · {counts.sheets} sheet{counts.sheets === 1 ? "" : "s"}</span></p>
                <p className="text-xs text-[var(--text-faint)]">{printLog[job.id] ? `Last printed ${formatLogTime(printLog[job.id])}` : "Not printed yet"}</p>
                <div className="mt-auto flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => empty ? alert("There is nothing to print yet for this document. Add the data in Setup first.") : setTask({ job: job.id })}
                    className={`rounded-xl px-4 py-2 text-sm font-extrabold ${empty ? "bg-slate-100 text-slate-400" : "bg-slate-900 text-white hover:bg-slate-700"}`}
                  >
                    Print
                  </button>
                  {job.hasOptions && (
                    <button type="button" onClick={() => setDrawerOpen(true)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Options</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button type="button" onClick={exportCsv} className="text-sm font-bold text-sky-700 underline decoration-sky-300 underline-offset-4 hover:text-sky-900">
          Export participants as CSV
        </button>
      </div>

      {drawerOpen && (
        <div className="no-print fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={() => setDrawerOpen(false)}>
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">Badges & lanyards</h2>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100">Close</button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-xs font-bold text-slate-600">Who is this for?
                <select value={badgeRole} onChange={e => setBadgeRole(e.target.value as BadgeRole)} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-slate-800">
                  {BADGE_ROLES.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-600">Size
                <select value={badgeSize} onChange={e => setBadgeSize(e.target.value as BadgeSize)} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-slate-800">
                  <option value="5x3">5×3 portrait (3in wide × 5in tall)</option>
                  <option value="6x4">6×4 portrait (4in wide × 6in tall)</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-600">Print on
                <select value={badgeTarget} onChange={e => setBadgeTarget(e.target.value as BadgeTarget)} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-slate-800">
                  <option value="sheet">Letter sheet, cut apart</option>
                  <option value="card">Card stock (one card per page)</option>
                </select>
              </label>
              <div className="text-xs font-bold text-slate-600">Card contents
                <p className="mt-1 rounded-xl border border-[var(--border)] bg-[var(--canvas-sunk)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">Front: name + full schedule (including required classes). Back: emergency contact + check-in QR. Backs print as a separate stack after the fronts.</p>
              </div>
              {badgeRole === "participant" && (
                <label className="block text-xs font-bold text-slate-600">Who gets one
                  <select value={badgeScopeAgeGroupId} onChange={e => setBadgeScopeAgeGroupId(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-slate-800">
                    <option value="">Everyone ({sortedCampers.length})</option>
                    {ageGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </label>
              )}

              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--canvas-sunk)] p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--text-faint)]">Preview</p>
                <div className="mx-auto overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm" style={{ width: 168, height: badgeSize === "5x3" ? 280 : 252 }}>
                  <div className="flex h-8 items-center justify-center text-[10px] font-extrabold tracking-widest text-white" style={{ background: bandColor }}>
                    {badgeRecipients[0] ? fullName(badgeRecipients[0]) : "Name"}
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1 p-3 text-center">
                    <div className="w-full space-y-1 text-left">
                      {(badgeRecipients[0] ? scheduleRows(badgeRecipients[0]).slice(0, 7) : []).map((row, idx) => (
                        <div key={idx} className="flex gap-1 border-b border-slate-100 pb-0.5 text-[9px]"><span className="t-data font-bold">{row.time}</span><span className="truncate">{row.activity}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <p className="t-data text-sm text-[var(--text-muted)]">{badgeRecipients.length} badges · {badgeSheetCount} sheets · about {badgeMinutes} minute{badgeMinutes === 1 ? "" : "s"}</p>

              <div className="flex items-center justify-between gap-2 border-t border-[var(--border-hair)] pt-4">
                <button type="button" onClick={() => { setDrawerOpen(false); setTask({ job: "badges", testPage: true }); }} className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Print one test page</button>
                <button type="button" onClick={() => { setDrawerOpen(false); setTask({ job: "badges" }); }} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-slate-700">Print all</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div id="print-root" aria-hidden="true">
        {renderTask()}
      </div>
    </>
  );
}

export default function PrintPage() {
  return <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /></div>}><PrintContent /></Suspense>;
}
