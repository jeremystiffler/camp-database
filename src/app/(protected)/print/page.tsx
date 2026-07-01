"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type PrintType = "principal_schedule" | "teacher_schedules" | "class_rosters" | "rotation_roster" | "camper_choices" | "camper_roster" | "tshirt_list" | "badges";
type PaperSize = "letter" | "legal" | "tabloid" | "a4" | "4x6" | "5x3" | "3x5" | "custom";
type Orientation = "portrait" | "landscape";
type Density = "compact" | "normal" | "large";

interface CampSession {
  id: string;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  course?: { id: string; name: string } | null;
  mandatorySession?: { id: string; title: string } | null;
  room?: { id?: string; name: string } | null;
  sessionTemplate?: { id: string; label?: string | null; dayOfWeek?: number | null; startTime: string; endTime: string } | null;
}
interface Enrollment { id: string; sessionId: string; session?: CampSession | null; }
interface Camper {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  tshirtSize?: string;
  ageGroup?: { id?: string; name: string; color: string } | null;
  guardianName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  emergencyPhone?: string | null;
  medicalNotes?: string | null;
  dietaryNotes?: string | null;
  enrollments?: Enrollment[];
}
interface Person { id: string; firstName: string; lastName: string; role: string; email?: string | null; phone?: string | null; }
interface SessionTemplate { id: string; label?: string | null; startTime: string; endTime: string; dayOfWeek?: number | null; }
interface Course {
  id: string;
  name: string;
  color: string;
  icon?: string;
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
interface PrintTemplate {
  id?: string;
  name: string;
  type: PrintType;
  category: string;
  paperSize: PaperSize;
  orientation: Orientation;
  isDefault?: boolean;
  settings: string;
  builtin?: boolean;
}
interface CampOption { id: string; name: string; startDate?: string | null; endDate?: string | null; }

type ScheduleCell = { key: string; label: string; sortValue: string };
type ScheduleSlot = { key: string; label: string; sortValue: string };

const PAPER_LABELS: Record<PaperSize, string> = {
  letter: "Letter 8.5×11",
  legal: "Legal 8.5×14",
  tabloid: "Tabloid 11×17",
  a4: "A4",
  "4x6": "4×6 Card",
  "5x3": "5×3 Badge",
  "3x5": "3×5 Lanyard",
  custom: "Custom size",
};
const PAPER_CSS: Record<PaperSize, string> = {
  letter: "letter",
  legal: "legal",
  tabloid: "ledger",
  a4: "A4",
  "4x6": "6in 4in",
  "5x3": "5in 3in",
  "3x5": "3in 5in",
  custom: "var(--custom-print-size)",
};
const DEFAULT_SETTINGS = { density: "compact" as Density, headerColor: "#55c7c7", stripedRows: true, showEmergency: true, showMedical: true, showStudents: true, groupByPage: true, badgeRows: 4, badgeCols: 3, badgeLayout: "standard", showSchedule: false, showGuardian: false, showAgeGroup: true, showRoom: true, showTeacher: true, rotationColumns: 5, customPageWidth: "36in", customPageHeight: "8.5in", rotationTimeFilter: "", rotationBandColor: "#f8dfe6", rotationBandMode: "color", showFooterLabel: true, rotationHeaderHeight: "0.70in", rotationBandHeight: "0.36in", rotationTeacherHeight: "0.32in", rotationFooterHeight: "0.45in", rotationStudentFont: 11, rotationStudentAlign: "center", rotationHeaderFont: 10, rotationTeacherFont: 10, rotationFooterFont: 9 };
const BUILTIN_TEMPLATES: PrintTemplate[] = [
  { builtin: true, name: "Principal Schedule — Landscape Grid", type: "principal_schedule", category: "operations", paperSize: "letter", orientation: "landscape", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "compact" }) },
  { builtin: true, name: "Teacher Packets — Classes + Students", type: "teacher_schedules", category: "operations", paperSize: "letter", orientation: "portrait", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "normal", groupByPage: true, showStudents: true }) },
  { builtin: true, name: "Teacher Schedule Only — Deduped", type: "teacher_schedules", category: "operations", paperSize: "letter", orientation: "portrait", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "compact", groupByPage: true, showStudents: false }) },
  { builtin: true, name: "Classroom Rosters — Deduped", type: "class_rosters", category: "operations", paperSize: "letter", orientation: "portrait", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "compact", showEmergency: true, showMedical: true, showTeacher: true }) },
  { builtin: true, name: "Custom Grid Printable — Rotation Roster", type: "rotation_roster", category: "operations", paperSize: "custom", orientation: "landscape", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "compact", customPageWidth: "36in", customPageHeight: "8.5in", rotationColumns: 5, rotationBandColor: "#f8dfe6", showTeacher: true, showRoom: true, showFooterLabel: true }) },
  { builtin: true, name: "Camper Class Choices", type: "camper_choices", category: "operations", paperSize: "letter", orientation: "portrait", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "compact", showRoom: true, showTeacher: true }) },
  { builtin: true, name: "Camper Roster", type: "camper_roster", category: "operations", paperSize: "letter", orientation: "portrait", settings: JSON.stringify(DEFAULT_SETTINGS) },
  { builtin: true, name: "T-Shirt List", type: "tshirt_list", category: "operations", paperSize: "letter", orientation: "portrait", settings: JSON.stringify(DEFAULT_SETTINGS) },
  { builtin: true, name: "Camper Badges — Sheet", type: "badges", category: "badges", paperSize: "letter", orientation: "portrait", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "large", badgeRows: 4, badgeCols: 3, showAgeGroup: true }) },
  { builtin: true, name: "Custom Schedule Lanyard Badge — 3×5", type: "badges", category: "badges", paperSize: "3x5", orientation: "portrait", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "large", badgeRows: 1, badgeCols: 1, badgeLayout: "schedule_lanyard", showSchedule: true, showAgeGroup: false }) },
  { builtin: true, name: "Camper Lanyard Badge — 5×3", type: "badges", category: "badges", paperSize: "5x3", orientation: "landscape", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "large", badgeRows: 1, badgeCols: 1, showAgeGroup: true, showSchedule: true }) },
  { builtin: true, name: "Camper Card — 4×6", type: "badges", category: "badges", paperSize: "4x6", orientation: "landscape", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "large", badgeRows: 1, badgeCols: 1, showAgeGroup: true, showGuardian: true, showSchedule: true }) },
];

function parseSettings(template?: PrintTemplate) {
  try { return { ...DEFAULT_SETTINGS, ...(template?.settings ? JSON.parse(template.settings) : {}) }; } catch { return DEFAULT_SETTINGS; }
}
function encodeSettings(settings: typeof DEFAULT_SETTINGS) { return JSON.stringify(settings); }
function fullName(p: { firstName: string; lastName: string }) { return `${p.firstName} ${p.lastName}`.trim(); }
function sessionStart(session?: CampSession | null) { return session?.startTime || session?.sessionTemplate?.startTime || ""; }
function sessionEnd(session?: CampSession | null) { return session?.endTime || session?.sessionTemplate?.endTime || ""; }
function templateStart(template?: SessionTemplate | null) { return template?.startTime || ""; }
function templateEnd(template?: SessionTemplate | null) { return template?.endTime || ""; }
function formatTime(value?: string | null) {
  if (!value) return "";
  const [rawHour, rawMinute = "00"] = value.split(":");
  const hour = Number(rawHour);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${rawMinute.padStart(2, "0").slice(0, 2)} ${suffix}`;
}
function formatRange(start?: string | null, end?: string | null) { return `${formatTime(start) || "Time"}${end ? `–${formatTime(end)}` : ""}`; }
function sessionSlotKey(session?: CampSession | null) { return `${sessionStart(session)}|${sessionEnd(session)}`; }
function slotLabel(session?: CampSession | null) { return formatTime(sessionStart(session)) || session?.sessionTemplate?.label || "Time"; }
function scheduleTitle(session?: CampSession | null) { return session?.mandatorySession?.title || session?.course?.name || session?.sessionTemplate?.label || "Session"; }
function scheduleCellKey(session?: CampSession | null) {
  const title = scheduleTitle(session);
  const start = sessionStart(session);
  const end = sessionEnd(session);
  const room = session?.room?.id || session?.room?.name || "";
  if (session?.mandatorySession) return `mandatory|${title}|${start}|${end}|${room}`;
  return `${session?.course?.id || session?.id || title}|${start}|${end}|${room}`;
}
function formatScheduleCell(session: CampSession | null | undefined, ageGroup?: Camper["ageGroup"]) {
  if (!session) return "";
  const group = !session.mandatorySession && ageGroup?.name ? ` (${ageGroup.name})` : "";
  const room = session.room?.name ? `\n[${session.room.name}]` : "";
  return `${scheduleTitle(session)}${group}${room}`;
}
function scheduleCellsForCamper(camper: Camper) {
  const byCell = new Map<string, ScheduleCell>();
  for (const enrollment of camper.enrollments || []) {
    const session = enrollment.session;
    if (!session) continue;
    const key = scheduleCellKey(session);
    const sortValue = `${sessionStart(session) || "99:99"}|${sessionEnd(session) || "99:99"}|${scheduleTitle(session).toLowerCase()}`;
    if (!byCell.has(key)) byCell.set(key, { key, label: formatScheduleCell(session, camper.ageGroup), sortValue });
  }
  return [...byCell.values()].sort((a, b) => a.sortValue.localeCompare(b.sortValue));
}
function scheduleSlots(campers: Camper[]): ScheduleSlot[] {
  const slots = new Map<string, ScheduleSlot>();
  for (const camper of campers) for (const enrollment of camper.enrollments || []) {
    const session = enrollment.session;
    if (!session) continue;
    const key = sessionSlotKey(session);
    if (!key.trim() || slots.has(key)) continue;
    slots.set(key, { key, label: slotLabel(session), sortValue: `${sessionStart(session) || "99:99"}|${sessionEnd(session) || "99:99"}` });
  }
  return [...slots.values()].sort((a, b) => a.sortValue.localeCompare(b.sortValue));
}
function cellForSlot(camper: Camper, slot: ScheduleSlot) {
  return scheduleCellsForCamper(camper).filter(cell => cell.sortValue.startsWith(slot.sortValue)).map(cell => cell.label).join("\n\n");
}
function courseAgeLabel(course: Course) { return course.courseAgeGroups?.map(cag => cag.ageGroup.name).join(", ") || course.ageGroup?.name || "All groups"; }
function sortedCampersList(campers: Camper[]) { return [...campers].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)); }

function rosterGroups(campers: Camper[]) {
  const groups = new Map<string, { key: string; courseId: string; title: string; time: string; timeLabel: string; start: string; end: string; room: string; campers: Camper[]; sortValue: string }>();
  for (const camper of campers) for (const enrollment of camper.enrollments || []) {
    const session = enrollment.session;
    if (!session?.course?.id) continue;
    // Option A: combine repeated sessions. Same class at the same class time prints once,
    // even when it exists across multiple repeated day/session records.
    const key = `${session.course.id}|${sessionSlotKey(session)}|${session.room?.id || session.room?.name || ""}`;
    const sortValue = `${sessionStart(session) || "99:99"}|${session.course.name}`;
    const start = sessionStart(session);
    const end = sessionEnd(session);
    const existing = groups.get(key) || { key, courseId: session.course.id, title: session.course.name, time: formatRange(start, end), timeLabel: formatTime(start) || "Time", start, end, room: session.room?.name || "—", campers: [], sortValue };
    if (!existing.campers.some(c => c.id === camper.id)) existing.campers.push(camper);
    groups.set(key, existing);
  }
  return [...groups.values()].map(group => ({ ...group, campers: sortedCampersList(group.campers) })).sort((a, b) => a.sortValue.localeCompare(b.sortValue));
}
function courseTeacherNames(course?: Course) {
  return course?.courseTeachers?.map(ct => fullName(ct.person)).filter(Boolean).join(" / ") || "—";
}
function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += Math.max(size, 1)) chunks.push(items.slice(i, i + Math.max(size, 1)));
  return chunks.length ? chunks : [[]];
}
function numericSetting(value: unknown, fallback: number, min: number, max: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(Math.max(next, min), max);
}
function rotationStudentFontSize(count: number, base: number) {
  if (count > 28) return Math.max(5.2, base - 5.2);
  if (count > 22) return Math.max(5.8, base - 4.2);
  if (count > 17) return Math.max(6.5, base - 3.2);
  if (count > 13) return Math.max(7.4, base - 2.2);
  if (count > 10) return Math.max(8.2, base - 1.2);
  return base;
}
const ROTATION_COLOR_BANDS = ["#f8dfe6", "#dff3f7", "#e2efd9", "#fff1c7", "#eadff7", "#f4e0d4", "#dce8f8", "#e8ead6"];
const ROTATION_GRAY_BANDS = ["#f1f5f9", "#e5e7eb", "#f8fafc", "#d1d5db", "#eeeeee", "#e2e8f0", "#f3f4f6", "#d9d9d9"];
function rotationBandColorForTime(timeKey: string, mode: unknown, rotationTimes: [string, string][]) {
  const palette = mode === "grayscale" ? ROTATION_GRAY_BANDS : ROTATION_COLOR_BANDS;
  const index = Math.max(0, rotationTimes.findIndex(([value]) => value === timeKey));
  return palette[index % palette.length];
}
function courseById(courses: Course[], courseId: string) { return courses.find(course => course.id === courseId); }
function campersForCourseSlot(campers: Camper[], courseId: string, start: string, end: string, roomName?: string | null) {
  const matches = new Map<string, Camper>();
  for (const camper of campers) for (const enrollment of camper.enrollments || []) {
    const session = enrollment.session;
    if (!session?.course?.id || session.course.id !== courseId) continue;
    if (sessionStart(session) !== start || sessionEnd(session) !== end) continue;
    if (roomName && session.room?.name && session.room.name !== roomName) continue;
    matches.set(camper.id, camper);
  }
  return sortedCampersList([...matches.values()]);
}
function badgeScheduleSummary(camper: Camper) {
  return scheduleCellsForCamper(camper)
    .slice(0, 5)
    .map(cell => cell.label.replace(/\n/g, " "))
    .join(" • ");
}
function lanyardScheduleRows(camper: Camper) {
  const rows = new Map<string, { time: string; activity: string; sortValue: string }>();
  for (const enrollment of camper.enrollments || []) {
    const session = enrollment.session;
    if (!session) continue;
    const start = sessionStart(session);
    const end = sessionEnd(session);
    const room = session.room?.name ? `\n[${session.room.name}]` : "";
    const age = !session.mandatorySession && camper.ageGroup?.name ? ` (${camper.ageGroup.name})` : "";
    const title = `${scheduleTitle(session)}${age}${room}`;
    const key = `${start}|${end}|${scheduleTitle(session)}|${session.room?.id || session.room?.name || ""}`;
    if (!rows.has(key)) rows.set(key, { time: formatTime(start) || session.sessionTemplate?.label || "Time", activity: title, sortValue: `${start || "99:99"}|${end || "99:99"}|${title.toLowerCase()}` });
  }
  return [...rows.values()].sort((a, b) => a.sortValue.localeCompare(b.sortValue));
}
function classChoicesForCamper(camper: Camper, courses: Course[]) {
  const choices = new Map<string, { label: string; sortValue: string }>();
  for (const enrollment of camper.enrollments || []) {
    const session = enrollment.session;
    if (!session?.course?.id) continue;
    const start = sessionStart(session);
    const end = sessionEnd(session);
    const course = courseById(courses, session.course.id);
    const teachers = courseTeacherNames(course);
    const pieces = [
      formatRange(start, end),
      session.course.name,
      session.room?.name ? `Room: ${session.room.name}` : "",
      teachers !== "—" ? `Teacher: ${teachers}` : "",
    ].filter(Boolean);
    const key = `${session.course.id}|${start}|${end}|${session.room?.id || session.room?.name || ""}`;
    if (!choices.has(key)) choices.set(key, { label: pieces.join(" — "), sortValue: `${start || "99:99"}|${session.course.name}` });
  }
  return [...choices.values()].sort((a, b) => a.sortValue.localeCompare(b.sortValue));
}

function teacherRows(person: Person, courses: Course[], mandatorySessions: MandatorySession[], campers: Camper[]) {
  const rows = new Map<string, { time: string; title: string; room: string; age: string; sortValue: string; students: Camper[] }>();
  for (const course of courses.filter(course => course.courseTeachers?.some(ct => ct.person.id === person.id))) {
    for (const cst of course.courseSessionTemplates || []) {
      const start = templateStart(cst.sessionTemplate);
      const end = templateEnd(cst.sessionTemplate);
      const room = course.room?.name || "—";
      const key = `${course.id}|${start}|${end}|${room}`;
      if (!rows.has(key)) rows.set(key, { time: formatRange(start, end), title: course.name, room, age: courseAgeLabel(course), sortValue: `${start || "99:99"}|${course.name}`, students: campersForCourseSlot(campers, course.id, start, end, course.room?.name) });
    }
  }
  for (const assignment of mandatorySessions.filter(ms => ms.leader?.id === person.id)) {
    const start = templateStart(assignment.sessionTemplate);
    const end = templateEnd(assignment.sessionTemplate);
    const room = assignment.room?.name || "—";
    const key = `mandatory|${assignment.title}|${start}|${end}|${room}`;
    if (!rows.has(key)) rows.set(key, { time: formatRange(start, end), title: assignment.title, room, age: assignment.ageGroup?.name || "Required", sortValue: `${start || "99:99"}|${assignment.title}`, students: [] });
  }
  return [...rows.values()].sort((a, b) => a.sortValue.localeCompare(b.sortValue));
}

function PrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campIdFromUrl = searchParams.get("campId") || "";
  const [resolvedCampId, setResolvedCampId] = useState(campIdFromUrl);
  const campId = campIdFromUrl || resolvedCampId;
  const [campers, setCampers] = useState<Camper[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [mandatorySessions, setMandatorySessions] = useState<MandatorySession[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<PrintTemplate[]>([]);
  const [campOptions, setCampOptions] = useState<CampOption[]>([]);
  const [sourceCampId, setSourceCampId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeDoc, setActiveDoc] = useState<PrintType | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("builtin-0");
  const [draftTemplate, setDraftTemplate] = useState<PrintTemplate>(BUILTIN_TEMPLATES[0]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (campIdFromUrl) {
      setResolvedCampId(campIdFromUrl);
      return;
    }

    const savedCampId = typeof window !== "undefined" ? localStorage.getItem("activeCampId") : "";
    if (savedCampId) {
      setResolvedCampId(savedCampId);
      router.replace(`/print?campId=${savedCampId}`);
      return;
    }

    fetch("/api/camps")
      .then(r => r.ok ? r.json() : [])
      .then(camps => {
        if (Array.isArray(camps) && camps[0]?.id) {
          setResolvedCampId(camps[0].id);
          if (typeof window !== "undefined") localStorage.setItem("activeCampId", camps[0].id);
          router.replace(`/print?campId=${camps[0].id}`);
        }
      })
      .catch(() => {});
  }, [campIdFromUrl, router]);

  useEffect(() => {
    if (!campId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/camps/${campId}/campers`).then(r => r.json()),
      fetch(`/api/camps/${campId}/courses`).then(r => r.json()),
      fetch(`/api/camps/${campId}/persons`).then(r => r.json()),
      fetch(`/api/camps/${campId}/mandatory-sessions`).then(r => r.json()),
      fetch(`/api/camps/${campId}/print-templates`).then(r => r.ok ? r.json() : []),
      fetch(`/api/camps`).then(r => r.ok ? r.json() : []),
    ]).then(([c, co, p, ms, templates, camps]) => {
      setCampers(Array.isArray(c) ? c : []);
      setCourses(Array.isArray(co) ? co : []);
      setPersons(Array.isArray(p) ? p : []);
      setMandatorySessions(Array.isArray(ms) ? ms : []);
      setSavedTemplates(Array.isArray(templates) ? templates : []);
      const campList = Array.isArray(camps) ? camps : [];
      setCampOptions(campList);
      setSourceCampId(campList.find((camp: CampOption) => camp.id !== campId)?.id || "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [campId]);

  const allTemplates = [...BUILTIN_TEMPLATES.map((template, index) => ({ ...template, id: `builtin-${index}`, builtin: true })), ...savedTemplates];
  const selectedSettings = parseSettings(draftTemplate);
  const sortedCampers = sortedCampersList(campers);
  const principalScheduleSlots = scheduleSlots(campers);
  const sizeGroups = campers.reduce<Record<string, Camper[]>>((acc, c) => { const s = c.tshirtSize || "Unknown"; acc[s] = [...(acc[s] || []), c]; return acc; }, {});
  const tshirtOrder = ["YXS","YS","YM","YL","AS","AM","AL","AXL","A2XL","Unknown"];
  const rosterPackets = rosterGroups(campers);
  const operationalPeople = persons.filter(p => ["teacher", "assistant", "director", "staff"].includes(p.role));
  const bodyFont = selectedSettings.density === "compact" ? "8px" : selectedSettings.density === "large" ? "11px" : "9px";
  const cellPadding = selectedSettings.density === "compact" ? "4px 3px" : selectedSettings.density === "large" ? "8px 6px" : "6px 4px";
  const badgeCols = draftTemplate.paperSize === "letter" ? Math.max(1, Number(selectedSettings.badgeCols || 3)) : 1;
  const badgeRows = draftTemplate.paperSize === "letter" ? Math.max(1, Number(selectedSettings.badgeRows || 4)) : 1;
  const printTileClasses = ["tile-aqua", "tile-sage", "tile-clay", "tile-denim", "tile-butter", "tile-lavender", "tile-berry", "tile-aqua", "tile-sage", "tile-clay"];
  const pageSizeCss = draftTemplate.paperSize === "custom" ? `${selectedSettings.customPageWidth || "36in"} ${selectedSettings.customPageHeight || "8.5in"}` : PAPER_CSS[draftTemplate.paperSize];
  const rotationTimes = Array.from(new Map(rosterPackets.map(group => [group.start || group.time, group.timeLabel || group.time])).entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const rotationRosterPackets = rosterPackets.filter(group => !selectedSettings.rotationTimeFilter || group.start === selectedSettings.rotationTimeFilter);
  const rotationColumns = Math.max(1, Number(selectedSettings.rotationColumns || 5));
  const rotationStudentBaseFont = numericSetting(selectedSettings.rotationStudentFont, 11, 5, 20);
  const rotationHeaderFont = numericSetting(selectedSettings.rotationHeaderFont, 10, 6, 20);
  const rotationTeacherFont = numericSetting(selectedSettings.rotationTeacherFont, 10, 6, 18);
  const rotationFooterFont = numericSetting(selectedSettings.rotationFooterFont, 9, 6, 16);
  const rotationStudentTextAlign = selectedSettings.rotationStudentAlign === "left" ? "left" : selectedSettings.rotationStudentAlign === "right" ? "right" : "center";

  const chooseTemplate = (key: string) => {
    const template = allTemplates.find(t => t.id === key) || allTemplates[0];
    setSelectedTemplateKey(key);
    setDraftTemplate(template);
    setMessage("");
  };
  const updateDraft = (patch: Partial<PrintTemplate>) => setDraftTemplate(prev => ({ ...prev, ...patch }));
  const updateSettings = (patch: Partial<typeof DEFAULT_SETTINGS>) => updateDraft({ settings: encodeSettings({ ...selectedSettings, ...patch }) });
  const saveAsTemplate = async () => {
    const name = window.prompt("Template name", draftTemplate.name.replace(/^Copy of /, ""));
    if (!name) return;
    setSaving(true); setMessage("");
    const res = await fetch(`/api/camps/${campId}/print-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draftTemplate, id: undefined, builtin: undefined, name }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) { setSavedTemplates(prev => [...prev, data]); setSelectedTemplateKey(data.id); setDraftTemplate(data); setMessage("Template saved for this camp."); }
    else setMessage(data.detail || data.error || "Could not save template.");
  };
  const updateSavedTemplate = async () => {
    if (!draftTemplate.id || draftTemplate.builtin) return saveAsTemplate();
    setSaving(true); setMessage("");
    const res = await fetch(`/api/camps/${campId}/print-templates/${draftTemplate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftTemplate),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) { setSavedTemplates(prev => prev.map(t => t.id === data.id ? data : t)); setDraftTemplate(data); setMessage("Template updated."); }
    else setMessage(data.detail || data.error || "Could not update template.");
  };
  const importTemplatesFromCamp = async () => {
    if (!sourceCampId || sourceCampId === campId) return;
    setSaving(true); setMessage("");
    try {
      const sourceRes = await fetch(`/api/camps/${sourceCampId}/print-templates`);
      const sourceTemplates = await sourceRes.json().catch(() => []);
      if (!sourceRes.ok || !Array.isArray(sourceTemplates) || sourceTemplates.length === 0) {
        setMessage("No saved templates found in that camp yet.");
        setSaving(false);
        return;
      }
      const copied: PrintTemplate[] = [];
      for (const template of sourceTemplates) {
        const res = await fetch(`/api/camps/${campId}/print-templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...template, id: undefined, builtin: undefined, isDefault: false, name: `${template.name} (copy)` }),
        });
        if (res.ok) copied.push(await res.json());
      }
      if (copied.length) {
        setSavedTemplates(prev => [...prev, ...copied]);
        setMessage(`Copied ${copied.length} template${copied.length === 1 ? "" : "s"} from ${campOptions.find(c => c.id === sourceCampId)?.name || "that camp"}.`);
      } else setMessage("Could not copy templates from that camp.");
    } finally {
      setSaving(false);
    }
  };
  const printDoc = (type = draftTemplate.type) => { setActiveDoc(type); setTimeout(() => window.print(), 300); };

  if (!campId) return <div className="flex h-64 items-center justify-center text-slate-400">Finding your active camp…</div>;

  return (
    <>
      <style>{`
        @media print {
          @page { size: ${pageSizeCss} ${draftTemplate.paperSize === "custom" ? "" : draftTemplate.orientation}; margin: 0.25in; }
          aside, nav, .no-print { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; }
          .print-doc { display: block !important; }
          body { background: white !important; }
          .page-break { page-break-after: always; }
          .page-break:last-child { page-break-after: auto; }
        }
        .print-doc { display: none; }
        .ops-print { font-family: Arial, Helvetica, sans-serif; color: #000; }
        .ops-print table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .ops-print th, .ops-print td { border: 1px solid #111; vertical-align: middle; white-space: pre-line; line-height: 1.12; }
        .ops-print th { background: ${selectedSettings.headerColor}; color: #000; font-size: 10px; font-weight: 800; padding: 4px 3px; text-align: center; }
        .ops-print td { font-size: ${bodyFont}; padding: ${cellPadding}; }
        .ops-print .center td { text-align: center; }
        .ops-print .striped tbody tr:nth-child(odd) td { background: #dff4f6; }
        .ops-print .striped tbody tr:nth-child(even) td { background: #fff; }
        .ops-print .student-col { width: 105px; font-weight: 700; text-align: center; }
        .ops-print .time-col { width: calc((100% - 105px) / ${Math.max(principalScheduleSlots.length, 1)}); text-align: center; }
        .ops-title { font-size: 20px; font-weight: 900; margin: 0 0 8px; }
        .ops-subtitle { font-size: 12px; margin: 0 0 14px; color: #444; }
        .badge-sheet { display: grid; grid-template-columns: repeat(${badgeCols}, minmax(0, 1fr)); grid-auto-rows: ${draftTemplate.paperSize === "letter" ? `calc((10.5in - 0.18in * ${Math.max(badgeRows - 1, 0)}) / ${badgeRows})` : "auto"}; gap: 0.18in; }
        .badge-card { border: 2px solid #111; border-radius: 10px; padding: 0.16in; text-align: center; page-break-inside: avoid; display: flex; flex-direction: column; justify-content: center; min-height: ${draftTemplate.paperSize === "letter" ? "auto" : "calc(100vh - 0.5in)"}; }
        .badge-name { font-size: ${draftTemplate.paperSize === "letter" ? "24px" : "34px"}; font-weight: 900; line-height: 1; }
        .badge-last { font-size: ${draftTemplate.paperSize === "letter" ? "14px" : "20px"}; margin-top: 4px; }
        .single-badge-page { page-break-after: always; }
        .single-badge-page:last-child { page-break-after: auto; }
        .lanyard-schedule-card { border: 2px solid #111; border-radius: 0; padding: 0; text-align: left; page-break-inside: avoid; display: flex; flex-direction: column; min-height: ${draftTemplate.paperSize === "letter" ? "auto" : "calc(100vh - 0.5in)"}; background: #fff; overflow: hidden; }
        .lanyard-name { background: ${selectedSettings.headerColor}; border-bottom: 2px solid #111; color: #000; font-size: 19px; font-weight: 900; line-height: 1.05; padding: 0.10in 0.06in; text-align: center; }
        .lanyard-table { width: 100%; flex: 1; display: flex; flex-direction: column; }
        .lanyard-row { display: grid; grid-template-columns: 0.72in minmax(0, 1fr); flex: 1; min-height: 0.36in; border-bottom: 1.5px solid #111; }
        .lanyard-row:last-child { border-bottom: 0; }
        .lanyard-time { border-right: 1.5px solid #111; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 10px; font-weight: 900; line-height: 1.05; padding: 0.04in; }
        .lanyard-activity { display: flex; align-items: center; white-space: pre-line; font-size: 9.2px; font-weight: 800; line-height: 1.12; padding: 0.035in 0.055in; overflow: hidden; word-break: break-word; }
        .rotation-page { page-break-after: always; width: 100%; height: calc(${selectedSettings.customPageHeight || "8.5in"} - 0.5in); overflow: hidden; }
        .rotation-page:last-child { page-break-after: auto; }
        .rotation-grid { width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; }
        .rotation-grid td { border: 1px solid #222; padding: 0; vertical-align: top; height: 100%; overflow: hidden; }
        .rotation-card { height: 100%; min-height: 0; display: grid; grid-template-rows: ${selectedSettings.rotationHeaderHeight || "0.70in"} ${selectedSettings.rotationBandHeight || "0.36in"} ${selectedSettings.showTeacher ? (selectedSettings.rotationTeacherHeight || "0.32in") : "0in"} minmax(0, 1fr) ${selectedSettings.showFooterLabel ? (selectedSettings.rotationFooterHeight || "0.45in") : "0in"}; overflow: hidden; }
        .rotation-top { background: #f8fafc; text-align: center; font-weight: 800; font-size: ${rotationHeaderFont}px; line-height: 1.12; padding: 4px; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; }
        .rotation-band { text-align: center; font-size: 18px; font-weight: 900; padding: 0 4px; border-top: 1px solid #222; border-bottom: 1px solid #222; overflow: hidden; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
        .rotation-teacher { text-align: center; font-size: ${rotationTeacherFont}px; font-weight: 700; padding: 0 4px; border-bottom: 1px solid #222; overflow: hidden; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
        .rotation-students { min-height: 0; padding: 6px 7px; line-height: 1.28; font-weight: 800; text-align: ${rotationStudentTextAlign}; overflow: hidden; word-break: break-word; box-sizing: border-box; }
        .rotation-students div { break-inside: avoid; page-break-inside: avoid; }
        .rotation-footer { text-align: center; font-size: ${rotationFooterFont}px; font-weight: 800; line-height: 1.12; padding: 3px 4px; border-top: 1px solid #222; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; }
      `}</style>

      <div className="no-print space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Operations printing</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Print Center</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Build reusable print templates for principal schedules, teacher packets, classroom rosters, and future badges/labels.</p>
        </div>
        {loading ? <div className="flex h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /></div> : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                {BUILTIN_TEMPLATES.map((template, index) => (
                  <button key={`${template.type}-${template.name}`} onClick={() => { updateDraft({ ...template, id: `builtin-${index}`, builtin: true }); setSelectedTemplateKey(`builtin-${index}`); }} className={`tile-button ${printTileClasses[index % printTileClasses.length]} p-4 text-left transition ${selectedTemplateKey === `builtin-${index}` || (!draftTemplate.id && draftTemplate.name === template.name) ? "ring-2 ring-[var(--tile-accent)]" : ""}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/60 text-xs font-black text-slate-700 shadow-sm">{template.type === "principal_schedule" ? "Sc" : template.type === "teacher_schedules" ? "T" : template.type === "class_rosters" ? "R" : template.type === "rotation_roster" ? "Grid" : template.type === "camper_choices" ? "Ch" : template.type === "badges" ? "B" : template.type === "tshirt_list" ? "Ts" : "C"}</span>
                      <span className="rounded-full bg-white/55 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">{PAPER_LABELS[template.paperSize].split(" ")[0]}</span>
                    </div>
                    <p className="text-sm font-black text-slate-900">{template.name}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{template.type === "principal_schedule" ? "Camper names down the left; full chosen schedule across the page." : template.type === "teacher_schedules" ? "Deduped teacher packet: each class time once, with optional student roster under it." : template.type === "class_rosters" ? "Deduped class rosters by class/time with campers listed once." : template.type === "rotation_roster" ? "Spreadsheet-style custom grid: one class roster per column, grouped by time slot." : template.type === "camper_choices" ? "Every camper with their selected class choices, times, rooms, and teachers." : template.type === "badges" ? "Badge/label layouts for lanyards, cards, and sheets." : "Reusable operating document."}</p>
                  </button>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Saved templates</h2>
                    <p className="text-xs text-slate-500">Reuse these from this camp, or copy saved templates from another camp.</p>
                  </div>
                  <button onClick={saveAsTemplate} disabled={saving} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Save as template</button>
                </div>
                <select value={selectedTemplateKey} onChange={e => chooseTemplate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  {allTemplates.map(t => <option key={t.id} value={t.id}>{t.builtin ? "Preset: " : "Saved: "}{t.name}</option>)}
                </select>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <select value={sourceCampId} onChange={e => setSourceCampId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    <option value="">Copy templates from another camp…</option>
                    {campOptions.filter(camp => camp.id !== campId).map(camp => <option key={camp.id} value={camp.id}>{camp.name}</option>)}
                  </select>
                  <button onClick={importTemplatesFromCamp} disabled={saving || !sourceCampId} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Copy in</button>
                </div>
                {message && <p className="mt-2 text-xs font-semibold text-slate-600">{message}</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black text-slate-900">Template setup</h2>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-bold text-slate-500">Name<input value={draftTemplate.name} onChange={e => updateDraft({ name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" /></label>
                <label className="block text-xs font-bold text-slate-500">Document type<select value={draftTemplate.type} onChange={e => updateDraft({ type: e.target.value as PrintType })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800">
                  <option value="principal_schedule">Principal schedule grid</option><option value="teacher_schedules">Teacher packets / schedules</option><option value="class_rosters">Classroom rosters</option><option value="rotation_roster">Custom grid rotation roster</option><option value="camper_choices">Camper class choices</option><option value="camper_roster">Camper roster</option><option value="tshirt_list">T-shirt list</option><option value="badges">Badges</option>
                </select></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-bold text-slate-500">Paper<select value={draftTemplate.paperSize} onChange={e => updateDraft({ paperSize: e.target.value as PaperSize })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800">{Object.entries(PAPER_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                  <label className="block text-xs font-bold text-slate-500">Orientation<select value={draftTemplate.orientation} onChange={e => updateDraft({ orientation: e.target.value as Orientation })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
                </div>
                {draftTemplate.paperSize === "custom" && (
                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 p-3">
                    <label className="block text-xs font-bold text-slate-500">Page width<input value={selectedSettings.customPageWidth} onChange={e => updateSettings({ customPageWidth: e.target.value })} placeholder="36in" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" /></label>
                    <label className="block text-xs font-bold text-slate-500">Page height<input value={selectedSettings.customPageHeight} onChange={e => updateSettings({ customPageHeight: e.target.value })} placeholder="8.5in" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" /></label>
                  </div>
                )}
                <label className="block text-xs font-bold text-slate-500">Density<select value={selectedSettings.density} onChange={e => updateSettings({ density: e.target.value as Density })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"><option value="compact">Compact</option><option value="normal">Normal</option><option value="large">Large print</option></select></label>
                {draftTemplate.type === "rotation_roster" && (
                  <div className="rounded-2xl border border-slate-200 p-3 space-y-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Rotation grid</p>
                    <label className="block text-xs font-bold text-slate-500">Time slot<select value={selectedSettings.rotationTimeFilter} onChange={e => updateSettings({ rotationTimeFilter: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"><option value="">All time slots</option>{rotationTimes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-xs font-bold text-slate-500">Columns per page<input type="number" min={1} max={20} value={rotationColumns} onChange={e => updateSettings({ rotationColumns: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
                      <label className="block text-xs font-bold text-slate-500">Band style<select value={selectedSettings.rotationBandMode} onChange={e => updateSettings({ rotationBandMode: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"><option value="color">Color by time slot</option><option value="grayscale">Grayscale by time slot</option></select></label>
                    </div>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={selectedSettings.showFooterLabel} onChange={e => updateSettings({ showFooterLabel: e.target.checked })} /> Repeat activity/location footer</label>
                    <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-500">V2 layout controls</summary>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <label className="block text-xs font-bold text-slate-500">Header height<input value={selectedSettings.rotationHeaderHeight} onChange={e => updateSettings({ rotationHeaderHeight: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></label>
                        <label className="block text-xs font-bold text-slate-500">Time band height<input value={selectedSettings.rotationBandHeight} onChange={e => updateSettings({ rotationBandHeight: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></label>
                        <label className="block text-xs font-bold text-slate-500">Teacher height<input value={selectedSettings.rotationTeacherHeight} onChange={e => updateSettings({ rotationTeacherHeight: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></label>
                        <label className="block text-xs font-bold text-slate-500">Footer height<input value={selectedSettings.rotationFooterHeight} onChange={e => updateSettings({ rotationFooterHeight: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></label>
                        <label className="block text-xs font-bold text-slate-500">Student font<input type="number" min={5} max={20} value={rotationStudentBaseFont} onChange={e => updateSettings({ rotationStudentFont: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></label>
                        <label className="block text-xs font-bold text-slate-500">Student align<select value={rotationStudentTextAlign} onChange={e => updateSettings({ rotationStudentAlign: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"><option value="center">Center</option><option value="left">Left</option><option value="right">Right</option></select></label>
                      </div>
                    </details>
                    <p className="text-[11px] font-semibold text-slate-400">V3 colors the time band automatically by time slot. Use grayscale mode for copier-friendly printing.</p>
                  </div>
                )}
                <div className="rounded-2xl border border-slate-200 p-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Flexible fields</p>
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={selectedSettings.showStudents} onChange={e => updateSettings({ showStudents: e.target.checked })} /> Student names</label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={selectedSettings.showTeacher} onChange={e => updateSettings({ showTeacher: e.target.checked })} /> Teachers</label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={selectedSettings.showRoom} onChange={e => updateSettings({ showRoom: e.target.checked })} /> Rooms</label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={selectedSettings.showEmergency} onChange={e => updateSettings({ showEmergency: e.target.checked })} /> Emergency</label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={selectedSettings.showMedical} onChange={e => updateSettings({ showMedical: e.target.checked })} /> Medical</label>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-slate-400">Repeated class sessions are always combined once by default.</p>
                </div>
                {draftTemplate.type === "badges" && (
                  <div className="rounded-2xl border border-slate-200 p-3 space-y-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Badge layout</p>
                    <label className="block text-xs font-bold text-slate-500">Layout<select value={selectedSettings.badgeLayout} onChange={e => updateSettings({ badgeLayout: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"><option value="standard">Standard name badge</option><option value="schedule_lanyard">Schedule lanyard table</option></select></label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-xs font-bold text-slate-500">Rows<input type="number" min={1} max={8} value={badgeRows} onChange={e => updateSettings({ badgeRows: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
                      <label className="block text-xs font-bold text-slate-500">Columns<input type="number" min={1} max={5} value={badgeCols} onChange={e => updateSettings({ badgeCols: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs font-bold text-slate-600">
                      <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2"><input type="checkbox" checked={selectedSettings.showAgeGroup} onChange={e => updateSettings({ showAgeGroup: e.target.checked })} /> Show age group</label>
                      <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2"><input type="checkbox" checked={selectedSettings.showGuardian} onChange={e => updateSettings({ showGuardian: e.target.checked })} /> Show guardian contact</label>
                      <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2"><input type="checkbox" checked={selectedSettings.showSchedule} onChange={e => updateSettings({ showSchedule: e.target.checked })} /> Show compact schedule</label>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button onClick={() => printDoc()} className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white">Print preview</button>
                  <button onClick={updateSavedTemplate} disabled={saving} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">{draftTemplate.builtin ? "Save copy" : "Update"}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {activeDoc === "principal_schedule" && <div className="print-doc ops-print"><table className={`center ${selectedSettings.stripedRows ? "striped" : ""}`}><thead><tr><th className="student-col">Student</th>{principalScheduleSlots.map(slot => <th key={slot.key} className="time-col">{slot.label}</th>)}</tr></thead><tbody>{sortedCampers.map(camper => <tr key={camper.id}><td className="student-col">{fullName(camper)}</td>{principalScheduleSlots.map(slot => <td key={slot.key} className="time-col">{cellForSlot(camper, slot)}</td>)}</tr>)}</tbody></table></div>}

      {activeDoc === "teacher_schedules" && <div className="print-doc ops-print">{operationalPeople.map(person => { const rows = teacherRows(person, courses, mandatorySessions, campers); const columns = 3 + (selectedSettings.showRoom ? 1 : 0) + (selectedSettings.showStudents ? 1 : 0); return <section key={person.id} className="page-break"><h1 className="ops-title">{fullName(person)} Teacher Packet</h1><p className="ops-subtitle">{person.role} {person.email ? `• ${person.email}` : ""} {person.phone ? `• ${person.phone}` : ""}</p><table><thead><tr><th style={{width:"100px"}}>Time</th><th>Assignment</th>{selectedSettings.showRoom && <th style={{width:"120px"}}>Room</th>}<th style={{width:"110px"}}>Group</th>{selectedSettings.showStudents && <th>Registered Students</th>}</tr></thead><tbody>{rows.length ? rows.map((row, idx) => <tr key={`${row.sortValue}-${idx}`}><td>{row.time}</td><td>{row.title}</td>{selectedSettings.showRoom && <td>{row.room}</td>}<td>{row.age}</td>{selectedSettings.showStudents && <td>{row.students.length ? row.students.map(student => fullName(student)).join("\n") : "—"}</td>}</tr>) : <tr><td colSpan={columns}>No scheduled assignments.</td></tr>}</tbody></table></section>; })}</div>}

      {activeDoc === "class_rosters" && <div className="print-doc ops-print">{rosterPackets.map(group => { const course = courseById(courses, group.courseId); return <section key={group.key} className="page-break"><h1 className="ops-title">{group.title}</h1><p className="ops-subtitle">{group.time}{selectedSettings.showRoom ? ` • ${group.room}` : ""}{selectedSettings.showTeacher ? ` • Teacher: ${courseTeacherNames(course)}` : ""} • {group.campers.length} camper{group.campers.length === 1 ? "" : "s"}</p><table><thead><tr><th style={{width:"150px"}}>Camper</th><th style={{width:"100px"}}>Age Group</th><th>Guardian</th>{selectedSettings.showEmergency && <th>Emergency</th>}{selectedSettings.showMedical && <th>Medical / Dietary</th>}</tr></thead><tbody>{group.campers.map(camper => <tr key={camper.id}><td>{fullName(camper)}</td><td>{camper.ageGroup?.name || "—"}</td><td>{camper.guardianName || "—"}<br />{camper.guardianPhone || camper.guardianEmail || ""}</td>{selectedSettings.showEmergency && <td>{camper.emergencyPhone || "—"}</td>}{selectedSettings.showMedical && <td>{[camper.medicalNotes, camper.dietaryNotes].filter(Boolean).join(" / ") || "—"}</td>}</tr>)}</tbody></table></section>; })}</div>}

      {activeDoc === "rotation_roster" && <div className="print-doc ops-print">{chunkItems(rotationRosterPackets, rotationColumns).map((pageGroups, pageIndex) => <section key={`rotation-${pageIndex}`} className="rotation-page"><table className="rotation-grid"><tbody><tr>{Array.from({ length: rotationColumns }).map((_, idx) => { const group = pageGroups[idx]; if (!group) return <td key={`empty-${idx}`} />; const course = courseById(courses, group.courseId); const teacherNames = courseTeacherNames(course); const age = course ? courseAgeLabel(course) : ""; const headerTitle = `${group.title}${age ? ` (${age})` : ""}`; return <td key={group.key}><div className="rotation-card"><div className="rotation-top"><div>{group.timeLabel}</div><div>{headerTitle}</div>{selectedSettings.showRoom && <div>[{group.room}]</div>}</div><div className="rotation-band" style={{ background: rotationBandColorForTime(group.start || group.time, selectedSettings.rotationBandMode, rotationTimes) }}>{group.timeLabel}</div>{selectedSettings.showTeacher && <div className="rotation-teacher">{teacherNames}</div>}<div className="rotation-students" style={{ fontSize: `${rotationStudentFontSize(group.campers.length, rotationStudentBaseFont)}px` }}>{selectedSettings.showStudents ? (group.campers.length ? group.campers.map(camper => <div key={camper.id}>{fullName(camper)}</div>) : <div>—</div>) : <div>{group.campers.length} registered</div>}</div>{selectedSettings.showFooterLabel && <div className="rotation-footer"><div>{headerTitle}</div>{selectedSettings.showRoom && <div>[{group.room}]</div>}</div>}</div></td>; })}</tr></tbody></table></section>)}</div>}

      {activeDoc === "camper_choices" && <div className="print-doc ops-print"><h1 className="ops-title">Camper Class Choices</h1><p className="ops-subtitle">Repeated sessions are combined; each selected class time appears once per camper.</p><table><thead><tr><th style={{width:"145px"}}>Camper</th><th style={{width:"95px"}}>Age Group</th><th>Class Choices</th></tr></thead><tbody>{sortedCampers.map(camper => { const choices = classChoicesForCamper(camper, courses); return <tr key={camper.id}><td>{fullName(camper)}</td><td>{camper.ageGroup?.name || "—"}</td><td>{choices.length ? choices.map(choice => choice.label).join("\n") : "—"}</td></tr>; })}</tbody></table></div>}

      {activeDoc === "camper_roster" && <div className="print-doc ops-print"><h1 className="ops-title">Camper Roster</h1><table><thead><tr><th>Last</th><th>First</th><th>Age Group</th><th>Guardian</th><th>Email</th></tr></thead><tbody>{sortedCampers.map(c => <tr key={c.id}><td>{c.lastName}</td><td>{c.firstName}</td><td>{c.ageGroup?.name || "—"}</td><td>{c.guardianName || "—"}</td><td>{c.guardianEmail || "—"}</td></tr>)}</tbody></table></div>}

      {activeDoc === "tshirt_list" && <div className="print-doc ops-print"><h1 className="ops-title">T-Shirt Sizes</h1>{tshirtOrder.filter(s => sizeGroups[s]?.length).map(size => <section key={size} style={{marginBottom:18}}><h2 style={{fontSize:16, margin:"0 0 6px"}}>{size} ({sizeGroups[size].length})</h2><table><tbody>{sortedCampersList(sizeGroups[size]).map(c => <tr key={c.id}><td>{c.lastName}, {c.firstName}</td><td>{c.ageGroup?.name || "—"}</td></tr>)}</tbody></table></section>)}</div>}

      {activeDoc === "badges" && <div className="print-doc ops-print">
        <div className={draftTemplate.paperSize === "letter" ? "badge-sheet" : ""}>
          {sortedCampers.map(c => {
            if (selectedSettings.badgeLayout === "schedule_lanyard") {
              const rows = lanyardScheduleRows(c);
              return <div key={c.id} className={`lanyard-schedule-card ${draftTemplate.paperSize === "letter" ? "" : "single-badge-page"}`}>
                <div className="lanyard-name">{fullName(c)}</div>
                <div className="lanyard-table">
                  {rows.length ? rows.map((row, idx) => <div key={`${row.sortValue}-${idx}`} className="lanyard-row">
                    <div className="lanyard-time">{row.time}</div>
                    <div className="lanyard-activity">{row.activity}</div>
                  </div>) : <div className="lanyard-row"><div className="lanyard-time">—</div><div className="lanyard-activity">No schedule assigned</div></div>}
                </div>
              </div>;
            }
            return <div key={c.id} className={`badge-card ${draftTemplate.paperSize === "letter" ? "" : "single-badge-page"}`}>
              <div style={{fontSize:11, textTransform:"uppercase", letterSpacing:".12em", marginBottom:8}}>Camper</div>
              <div className="badge-name">{c.firstName}</div>
              <div className="badge-last">{c.lastName}</div>
              {selectedSettings.showAgeGroup && <div style={{fontSize:13, fontWeight:800, marginTop:8, borderTop:"1px solid #ddd", paddingTop:8}}>{c.ageGroup?.name || ""}</div>}
              {selectedSettings.showGuardian && <div style={{fontSize:10, marginTop:6}}>{c.guardianName || ""}{c.guardianPhone ? ` • ${c.guardianPhone}` : ""}</div>}
              {selectedSettings.showSchedule && <div style={{fontSize:9, marginTop:8, lineHeight:1.25}}>{badgeScheduleSummary(c)}</div>}
            </div>;
          })}
        </div>
      </div>}
    </>
  );
}

export default function PrintPage() {
  return <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /></div>}><PrintContent /></Suspense>;
}
