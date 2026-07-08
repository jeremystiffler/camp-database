"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CamperScannableCode from "@/components/CamperScannableCode";
import { HelpCopy } from "@/components/HelpMode";

type PrintType = "principal_schedule" | "teacher_schedules" | "class_rosters" | "rotation_roster" | "camper_choices" | "camper_roster" | "tshirt_list" | "badges" | "pickup_cards" | "pickup_roster" | "custom_table";
type CustomDataSource = "participants" | "people" | "activities";
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
  pickupNumber?: string | null;
  scanCode?: string | null;
  pickupCardPrintedAt?: string | null;
  badgePrintedAt?: string | null;
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
const DEFAULT_SETTINGS = { density: "compact" as Density, headerColor: "#55c7c7", stripedRows: true, showEmergency: true, showMedical: true, showStudents: true, groupByPage: true, badgeRows: 4, badgeCols: 3, badgeLayout: "standard", lanyardTheme: "aquaSheet", customBlockOrder: [] as string[], badgeContentBlocks: [] as string[], badgeBackEnabled: false, badgeBackContentBlocks: [] as string[], showSchedule: false, showGuardian: false, showAgeGroup: true, showRoom: true, showTeacher: true, rotationColumns: 5, customPageWidth: "36in", customPageHeight: "8.5in", rotationTimeFilter: "", rotationBandColor: "#f8dfe6", rotationBandMode: "color", showFooterLabel: true, rotationHeaderHeight: "0.70in", rotationBandHeight: "0.36in", rotationTeacherHeight: "0.32in", rotationFooterHeight: "0.45in", rotationStudentFont: 11, rotationStudentAlign: "center", rotationHeaderFont: 10, rotationTeacherFont: 10, rotationFooterFont: 9, customDataSource: "participants" as CustomDataSource, customFields: ["fullName", "ageGroup", "guardianName", "guardianPhone", "classChoices"] as string[], customGroupBy: "", customSortBy: "lastName" };
const BUILTIN_TEMPLATES: PrintTemplate[] = [
  { builtin: true, name: "Field Builder — Blank Table", type: "custom_table", category: "custom", paperSize: "letter", orientation: "portrait", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "compact", customDataSource: "participants", customFields: ["fullName", "ageGroup", "guardianName", "guardianPhone", "classChoices"], customSortBy: "lastName" }) },
  { builtin: true, name: "Principal Schedule — Landscape Grid", type: "principal_schedule", category: "operations", paperSize: "letter", orientation: "landscape", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "compact" }) },
  { builtin: true, name: "Teacher Packets — Classes + Students", type: "teacher_schedules", category: "operations", paperSize: "letter", orientation: "portrait", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "normal", groupByPage: true, showStudents: true }) },
  { builtin: true, name: "Teacher Schedule Only — Deduped", type: "teacher_schedules", category: "operations", paperSize: "letter", orientation: "portrait", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "compact", groupByPage: true, showStudents: false }) },
  { builtin: true, name: "Classroom Rosters — Deduped", type: "class_rosters", category: "operations", paperSize: "letter", orientation: "portrait", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "compact", showEmergency: true, showMedical: true, showTeacher: true }) },
  { builtin: true, name: "Custom Grid Printable — Rotation Roster", type: "rotation_roster", category: "operations", paperSize: "custom", orientation: "landscape", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "compact", customPageWidth: "36in", customPageHeight: "8.5in", rotationColumns: 5, rotationBandColor: "#f8dfe6", showTeacher: true, showRoom: true, showFooterLabel: true }) },
  { builtin: true, name: "Participant Class Choices", type: "camper_choices", category: "operations", paperSize: "letter", orientation: "portrait", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "compact", showRoom: true, showTeacher: true }) },
  { builtin: true, name: "Participant Roster", type: "camper_roster", category: "operations", paperSize: "letter", orientation: "portrait", settings: JSON.stringify(DEFAULT_SETTINGS) },
  { builtin: true, name: "T-Shirt List", type: "tshirt_list", category: "operations", paperSize: "letter", orientation: "portrait", settings: JSON.stringify(DEFAULT_SETTINGS) },
  { builtin: true, name: "Pickup Window Cards — Number + Family", type: "pickup_cards", category: "badges", paperSize: "4x6", orientation: "landscape", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "large" }) },
  { builtin: true, name: "Pickup Number Roster", type: "pickup_roster", category: "operations", paperSize: "letter", orientation: "portrait", settings: JSON.stringify(DEFAULT_SETTINGS) },
  { builtin: true, name: "Participant Badges — Sheet", type: "badges", category: "badges", paperSize: "letter", orientation: "portrait", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "large", badgeRows: 4, badgeCols: 3, showAgeGroup: true }) },
  { builtin: true, name: "Custom Schedule Lanyard Badge — 3×5", type: "badges", category: "badges", paperSize: "3x5", orientation: "portrait", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "large", badgeRows: 1, badgeCols: 1, badgeLayout: "schedule_lanyard", lanyardTheme: "aquaSheet", showSchedule: true, showAgeGroup: false, badgeBackEnabled: true, badgeBackContentBlocks: ["qr"] }) },
  { builtin: true, name: "Participant Lanyard Badge — 5×3", type: "badges", category: "badges", paperSize: "5x3", orientation: "landscape", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "large", badgeRows: 1, badgeCols: 1, showAgeGroup: true, showSchedule: true, badgeBackEnabled: true, badgeBackContentBlocks: ["qr"] }) },
  { builtin: true, name: "Participant Card — 4×6", type: "badges", category: "badges", paperSize: "4x6", orientation: "landscape", settings: JSON.stringify({ ...DEFAULT_SETTINGS, density: "large", badgeRows: 1, badgeCols: 1, showAgeGroup: true, showGuardian: true, showSchedule: true }) },
];

type CustomBlockOption = { id: string; label: string };
const ROTATION_BLOCK_OPTIONS: CustomBlockOption[] = [
  { id: "header", label: "Class header" },
  { id: "timeBand", label: "Time band" },
  { id: "teacher", label: "Teacher row" },
  { id: "students", label: "Student roster" },
  { id: "footer", label: "Footer label" },
];
const BADGE_STANDARD_BLOCK_OPTIONS: CustomBlockOption[] = [
  { id: "label", label: "Participant label" },
  { id: "firstName", label: "First name" },
  { id: "lastName", label: "Last name" },
  { id: "fullName", label: "Full name" },
  { id: "ageGroup", label: "Age group" },
  { id: "guardian", label: "Guardian contact" },
  { id: "emergency", label: "Emergency phone" },
  { id: "medical", label: "Medical / dietary notes" },
  { id: "schedule", label: "Compact schedule" },
  { id: "qr", label: "QR scan code" },
];
const BADGE_LANYARD_BLOCK_OPTIONS: CustomBlockOption[] = [
  { id: "name", label: "Name header" },
  { id: "fullName", label: "Full name" },
  { id: "schedule", label: "Schedule table" },
  { id: "ageGroup", label: "Age group" },
  { id: "guardian", label: "Guardian contact" },
  { id: "emergency", label: "Emergency phone" },
  { id: "medical", label: "Medical / dietary notes" },
  { id: "qr", label: "QR scan code" },
];
type FieldOption = { id: string; label: string; value: (item: any, courses?: Course[]) => string };
const CUSTOM_FIELD_OPTIONS: Record<CustomDataSource, FieldOption[]> = {
  participants: [
    { id: "fullName", label: "Participant name", value: (c: Camper) => fullName(c) },
    { id: "firstName", label: "First name", value: (c: Camper) => c.firstName || "" },
    { id: "lastName", label: "Last name", value: (c: Camper) => c.lastName || "" },
    { id: "ageGroup", label: "Age group", value: (c: Camper) => c.ageGroup?.name || "" },
    { id: "guardianName", label: "Guardian", value: (c: Camper) => c.guardianName || "" },
    { id: "guardianEmail", label: "Guardian email", value: (c: Camper) => c.guardianEmail || "" },
    { id: "guardianPhone", label: "Guardian phone", value: (c: Camper) => c.guardianPhone || "" },
    { id: "emergencyPhone", label: "Emergency phone", value: (c: Camper) => c.emergencyPhone || "" },
    { id: "pickupNumber", label: "Pickup #", value: (c: Camper) => c.pickupNumber || "" },
    { id: "tshirtSize", label: "T-shirt", value: (c: Camper) => c.tshirtSize || "" },
    { id: "medicalNotes", label: "Medical", value: (c: Camper) => c.medicalNotes || "" },
    { id: "dietaryNotes", label: "Dietary", value: (c: Camper) => c.dietaryNotes || "" },
    { id: "classChoices", label: "Class choices", value: (c: Camper, courses = []) => classChoicesForCamper(c, courses).map(choice => choice.label).join("\n") },
    { id: "schedule", label: "Schedule summary", value: (c: Camper) => badgeScheduleSummary(c) },
  ],
  people: [
    { id: "fullName", label: "Name", value: (p: Person) => fullName(p) },
    { id: "role", label: "Role", value: (p: Person) => p.role || "" },
    { id: "email", label: "Email", value: (p: Person) => p.email || "" },
    { id: "phone", label: "Phone", value: (p: Person) => p.phone || "" },
  ],
  activities: [
    { id: "name", label: "Activity", value: (c: Course) => c.name || "" },
    { id: "room", label: "Room", value: (c: Course) => c.room?.name || "" },
    { id: "teachers", label: "Teachers", value: (c: Course) => courseTeacherNames(c) },
    { id: "ageGroups", label: "Age groups", value: (c: Course) => courseAgeLabel(c) },
    { id: "capacity", label: "Capacity", value: (c: Course) => String(c.cap ?? "") },
    { id: "times", label: "Times", value: (c: Course) => (c.courseSessionTemplates || []).map(cst => formatRange(cst.sessionTemplate.startTime, cst.sessionTemplate.endTime)).filter(Boolean).join("\n") },
  ],
};

const CUSTOM_PRINTABLE_BACK_BLOCK_OPTIONS: CustomBlockOption[] = [
  { id: "fullName", label: "Full name" },
  { id: "ageGroup", label: "Age group" },
  { id: "guardian", label: "Guardian contact" },
  { id: "emergency", label: "Emergency phone" },
  { id: "medical", label: "Medical / dietary notes" },
  { id: "schedule", label: "Compact schedule" },
  { id: "qr", label: "QR scan code" },
];
const LANYARD_THEMES = {
  aquaSheet: { label: "Aqua spreadsheet", headerBg: "#63d2d2", headerText: "#071827", border: "#334155", rowAlt: "#edfafa", rowBg: "#ffffff", timeBg: "#f8fafc" },
  blueSheet: { label: "Blue office sheet", headerBg: "#2563eb", headerText: "#ffffff", border: "#334155", rowAlt: "#eff6ff", rowBg: "#ffffff", timeBg: "#f8fafc" },
  greenLedger: { label: "Green ledger", headerBg: "#16a34a", headerText: "#ffffff", border: "#36523d", rowAlt: "#f0fdf4", rowBg: "#ffffff", timeBg: "#f7fee7" },
  lavenderRoster: { label: "Lavender roster", headerBg: "#8b5cf6", headerText: "#ffffff", border: "#4c1d95", rowAlt: "#f5f3ff", rowBg: "#ffffff", timeBg: "#faf5ff" },
} as const;
const CUSTOM_BUILTIN_NAMES = new Set(["Custom Grid Printable — Rotation Roster", "Custom Schedule Lanyard Badge — 3×5"]);
type TemplateMeta = { eyebrow: string; description: string; visual: "grid" | "packet" | "roster" | "choices" | "list" | "badge" | "lanyard" | "card" };
function isCustomBuilder(template: PrintTemplate) { return CUSTOM_BUILTIN_NAMES.has(template.name) || (!template.builtin && Boolean(template.id)); }
function templateMeta(template: PrintTemplate): TemplateMeta {
  if (template.type === "custom_table") return { eyebrow: "Field builder", visual: "list", description: "Build a custom table from participants, people, or activities by choosing fields, sort, and grouping." };
  if (template.name.includes("Schedule Lanyard")) return { eyebrow: "Custom badge builder", visual: "lanyard", description: "A child-name header with a vertical schedule table for lanyards." };
  if (template.type === "rotation_roster") return { eyebrow: "Custom grid builder", visual: "grid", description: "Wide rotation charts with draggable blocks, time bands, and optional backs." };
  if (template.type === "principal_schedule") return { eyebrow: "Stock schedule", visual: "grid", description: "A landscape master grid: participants down the left, schedule blocks across." };
  if (template.type === "teacher_schedules") return { eyebrow: "Stock teacher packet", visual: "packet", description: template.name.includes("Only") ? "Deduped teacher schedules without student lists." : "Teacher schedules with optional class rosters under each assignment." };
  if (template.type === "class_rosters") return { eyebrow: "Stock roster", visual: "roster", description: "Classroom rosters by class/time with guardian, emergency, and medical columns." };
  if (template.type === "camper_choices") return { eyebrow: "Stock participant report", visual: "choices", description: "Every participant with their chosen classes, times, rooms, and teachers." };
  if (template.type === "camper_roster") return { eyebrow: "Stock list", visual: "list", description: "A clean participant directory with age group and guardian contact." };
  if (template.type === "tshirt_list") return { eyebrow: "Stock list", visual: "list", description: "Grouped t-shirt sizes for quick sorting and distribution." };
  if (template.type === "pickup_cards") return { eyebrow: "Pickup & scanner", visual: "card", description: "4×6 window cards with large pickup number, family last name, and participant QR." };
  if (template.type === "pickup_roster") return { eyebrow: "Pickup & scanner", visual: "list", description: "Backup roster sorted by pickup number for car-line lookup." };
  if (template.type === "badges" && template.paperSize === "4x6") return { eyebrow: "Stock card", visual: "card", description: "A larger participant info card with guardian and schedule options." };
  if (template.type === "badges" && template.paperSize !== "letter") return { eyebrow: "Stock badge", visual: "badge", description: "One participant per page for lanyards and badge printers." };
  return { eyebrow: "Stock badge sheet", visual: "badge", description: "Printable name badges laid out on a letter-size sheet." };
}
type LanyardThemeKey = keyof typeof LANYARD_THEMES;
function lanyardThemeFor(value: unknown) {
  return LANYARD_THEMES[(typeof value === "string" && value in LANYARD_THEMES ? value : "aquaSheet") as LanyardThemeKey];
}
function orderedCustomBlocks(savedOrder: unknown, options: CustomBlockOption[]) {
  const ids = Array.isArray(savedOrder) ? savedOrder.filter((id): id is string => typeof id === "string") : [];
  const optionById = new Map(options.map(option => [option.id, option]));
  return [...ids.map(id => optionById.get(id)).filter((option): option is CustomBlockOption => Boolean(option)), ...options.filter(option => !ids.includes(option.id))];
}
function selectedBlocks(savedOrder: unknown, defaultIds: string[], options: CustomBlockOption[]) {
  const optionById = new Map(options.map(option => [option.id, option]));
  const savedIds = Array.isArray(savedOrder) ? savedOrder.filter((id): id is string => typeof id === "string" && optionById.has(id)) : [];
  const ids = savedIds.length ? savedIds : defaultIds.filter(id => optionById.has(id));
  return ids.map(id => optionById.get(id)).filter((option): option is CustomBlockOption => Boolean(option));
}
function reorderIds(ids: string[], draggedId: string, targetId: string) {
  if (draggedId === targetId) return ids;
  const next = ids.filter(id => id !== draggedId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex < 0) return ids;
  next.splice(targetIndex, 0, draggedId);
  return next;
}
function moveId(ids: string[], id: string, direction: -1 | 1) {
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
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
function lanyardScheduleRows(camper: Camper, showAgeGroup: boolean) {
  const rows = new Map<string, { time: string; activity: string; sortValue: string }>();
  for (const enrollment of camper.enrollments || []) {
    const session = enrollment.session;
    if (!session) continue;
    const start = sessionStart(session);
    const end = sessionEnd(session);
    const room = session.room?.name ? `\n[${session.room.name}]` : "";
    const age = showAgeGroup && !session.mandatorySession && camper.ageGroup?.name ? ` (${camper.ageGroup.name})` : "";
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
  const [printQueued, setPrintQueued] = useState(false);
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

  useEffect(() => {
    if (!printQueued || !activeDoc) return;
    const id = window.setTimeout(() => {
      window.print();
      setPrintQueued(false);
    }, 250);
    return () => window.clearTimeout(id);
  }, [printQueued, activeDoc]);

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
  const selectedMeta = templateMeta(draftTemplate);
  const dataSummary = [
    { label: "Participants", value: campers.length },
    { label: "Activities", value: courses.length },
    { label: "People", value: persons.length },
    { label: "Saved", value: savedTemplates.length },
  ];
  const pageSizeCss = draftTemplate.paperSize === "custom" ? `${selectedSettings.customPageWidth || "36in"} ${selectedSettings.customPageHeight || "8.5in"}` : PAPER_CSS[draftTemplate.paperSize];
  const explicitDimensionPaper = draftTemplate.paperSize === "custom" || draftTemplate.paperSize === "4x6" || draftTemplate.paperSize === "5x3" || draftTemplate.paperSize === "3x5";
  const printPageSizeCss = explicitDimensionPaper ? pageSizeCss : `${pageSizeCss} ${draftTemplate.orientation}`;
  const lanyardTheme = lanyardThemeFor(selectedSettings.lanyardTheme);
  const rotationTimes = Array.from(new Map(rosterPackets.map(group => [group.start || group.time, group.timeLabel || group.time])).entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const rotationRosterPackets = rosterPackets.filter(group => !selectedSettings.rotationTimeFilter || group.start === selectedSettings.rotationTimeFilter);
  const rotationColumns = Math.max(1, Number(selectedSettings.rotationColumns || 5));
  const rotationStudentBaseFont = numericSetting(selectedSettings.rotationStudentFont, 11, 5, 20);
  const rotationHeaderFont = numericSetting(selectedSettings.rotationHeaderFont, 10, 6, 20);
  const rotationTeacherFont = numericSetting(selectedSettings.rotationTeacherFont, 10, 6, 18);
  const rotationFooterFont = numericSetting(selectedSettings.rotationFooterFont, 9, 6, 16);
  const rotationStudentTextAlign = selectedSettings.rotationStudentAlign === "left" ? "left" : selectedSettings.rotationStudentAlign === "right" ? "right" : "center";
  const customBlockOptions = draftTemplate.type === "rotation_roster"
    ? ROTATION_BLOCK_OPTIONS.filter(block => (block.id !== "teacher" || selectedSettings.showTeacher) && (block.id !== "footer" || selectedSettings.showFooterLabel))
    : [];
  const customBlockOrder = orderedCustomBlocks(selectedSettings.customBlockOrder, customBlockOptions);
  const customBlockOrderIds = customBlockOrder.map(block => block.id);
  const badgeBlockOptions = draftTemplate.type === "badges" && selectedSettings.badgeLayout === "schedule_lanyard"
    ? BADGE_LANYARD_BLOCK_OPTIONS
    : draftTemplate.type === "badges"
      ? BADGE_STANDARD_BLOCK_OPTIONS
      : [];
  const supportsTwoSidedCustom = draftTemplate.type === "badges" || customBlockOptions.length > 0;
  const printableBackBlockOptions = draftTemplate.type === "badges" ? badgeBlockOptions : supportsTwoSidedCustom ? CUSTOM_PRINTABLE_BACK_BLOCK_OPTIONS : [];
  const defaultBadgeBlockIds = selectedSettings.badgeLayout === "schedule_lanyard" ? ["name", "schedule"] : ["label", "firstName", "lastName"];
  const defaultBadgeBackBlockIds = ["fullName", "guardian", "emergency", "medical"].filter(id => printableBackBlockOptions.some(block => block.id === id));
  const badgeContentBlocks = selectedBlocks(selectedSettings.badgeContentBlocks, defaultBadgeBlockIds, badgeBlockOptions);
  const badgeContentBlockIds = badgeContentBlocks.map(block => block.id);
  const addableBadgeBlocks = badgeBlockOptions.filter(block => !badgeContentBlockIds.includes(block.id));
  const badgeBackBlocks = selectedBlocks(selectedSettings.badgeBackContentBlocks, defaultBadgeBackBlockIds, printableBackBlockOptions);
  const badgeBackBlockIds = badgeBackBlocks.map(block => block.id);
  const addableBadgeBackBlocks = printableBackBlockOptions.filter(block => !badgeBackBlockIds.includes(block.id));
  const customDataSource = (["participants", "people", "activities"].includes(String(selectedSettings.customDataSource)) ? selectedSettings.customDataSource : "participants") as CustomDataSource;
  const customFieldOptions = CUSTOM_FIELD_OPTIONS[customDataSource];
  const customFieldOptionMap = new Map<string, FieldOption>(customFieldOptions.map((field: FieldOption) => [field.id, field]));
  const defaultCustomFields: string[] = customFieldOptions.slice(0, Math.min(5, customFieldOptions.length)).map((field: FieldOption) => field.id);
  const customFieldIds: string[] = (Array.isArray(selectedSettings.customFields) ? selectedSettings.customFields : defaultCustomFields).filter((id: string) => customFieldOptionMap.has(id));
  const visibleCustomFieldIds: string[] = customFieldIds.length ? customFieldIds : defaultCustomFields;
  const selectedCustomFields: FieldOption[] = visibleCustomFieldIds.map((id: string) => customFieldOptionMap.get(id)).filter((field: FieldOption | undefined): field is FieldOption => Boolean(field));
  const addableCustomFields = customFieldOptions.filter((field: FieldOption) => !visibleCustomFieldIds.includes(field.id));
  const customGroupBy = typeof selectedSettings.customGroupBy === "string" ? selectedSettings.customGroupBy : "";
  const customSortBy = typeof selectedSettings.customSortBy === "string" ? selectedSettings.customSortBy : "";
  const customSourceItems = customDataSource === "participants" ? campers : customDataSource === "people" ? persons : courses;
  const customValue = (item: any, fieldId: string) => customFieldOptionMap.get(fieldId)?.value(item, courses) || "";
  const sortedCustomItems = [...customSourceItems].sort((a, b) => customValue(a, customSortBy || visibleCustomFieldIds[0] || "").localeCompare(customValue(b, customSortBy || visibleCustomFieldIds[0] || "")));
  const groupedCustomItems = customGroupBy
    ? Array.from(sortedCustomItems.reduce((map, item) => { const key = customValue(item, customGroupBy) || "Ungrouped"; map.set(key, [...(map.get(key) || []), item]); return map; }, new Map<string, any[]>()).entries())
    : [["", sortedCustomItems]] as [string, any[]][];
  const setCustomFields = (ids: string[]) => updateSettings({ customFields: ids });
  const addCustomField = (id: string) => { if (id) setCustomFields([...visibleCustomFieldIds, id]); };
  const removeCustomField = (id: string) => setCustomFields(visibleCustomFieldIds.filter((fieldId: string) => fieldId !== id));
  const moveCustomField = (id: string, direction: -1 | 1) => setCustomFields(moveId(visibleCustomFieldIds, id, direction));
  const resetCustomFields = () => setCustomFields(defaultCustomFields);
  const rotationCardRows = customBlockOrder.map(block => {
    if (block.id === "header") return selectedSettings.rotationHeaderHeight || "0.70in";
    if (block.id === "timeBand") return selectedSettings.rotationBandHeight || "0.36in";
    if (block.id === "teacher") return selectedSettings.rotationTeacherHeight || "0.32in";
    if (block.id === "footer") return selectedSettings.rotationFooterHeight || "0.45in";
    return "minmax(0, 1fr)";
  }).join(" ") || "minmax(0, 1fr)";
  const stockTemplates = BUILTIN_TEMPLATES.map((template, index) => ({ ...template, id: `builtin-${index}`, builtin: true })).filter(template => !isCustomBuilder(template));
  const customTemplates = [
    ...BUILTIN_TEMPLATES.map((template, index) => ({ ...template, id: `builtin-${index}`, builtin: true })).filter(template => isCustomBuilder(template)),
    ...savedTemplates,
  ];
  const flexibleFieldVisible = ["teacher_schedules", "class_rosters", "rotation_roster"].includes(draftTemplate.type);
  const hasAdvancedBasics = !draftTemplate.builtin || draftTemplate.paperSize === "custom";

  const chooseTemplate = (key: string) => {
    const template = allTemplates.find(t => t.id === key) || allTemplates[0];
    setSelectedTemplateKey(key);
    setDraftTemplate(template);
    setMessage("");
  };
  const updateDraft = (patch: Partial<PrintTemplate>) => setDraftTemplate(prev => ({ ...prev, ...patch }));
  const updateSettings = (patch: Partial<typeof DEFAULT_SETTINGS>) => updateDraft({ settings: encodeSettings({ ...selectedSettings, ...patch }) });
  const setCustomBlockOrder = (ids: string[]) => updateSettings({ customBlockOrder: ids });
  const moveCustomBlock = (id: string, direction: -1 | 1) => setCustomBlockOrder(moveId(customBlockOrderIds, id, direction));
  const dropCustomBlock = (draggedId: string, targetId: string) => setCustomBlockOrder(reorderIds(customBlockOrderIds, draggedId, targetId));
  const resetCustomBlockOrder = () => updateSettings({ customBlockOrder: [] });
  const setBadgeContentBlocks = (ids: string[]) => updateSettings({ badgeContentBlocks: ids });
  const moveBadgeBlock = (id: string, direction: -1 | 1) => setBadgeContentBlocks(moveId(badgeContentBlockIds, id, direction));
  const dropBadgeBlock = (draggedId: string, targetId: string) => setBadgeContentBlocks(reorderIds(badgeContentBlockIds, draggedId, targetId));
  const removeBadgeBlock = (id: string) => setBadgeContentBlocks(badgeContentBlockIds.filter(blockId => blockId !== id));
  const addBadgeBlock = (id: string) => { if (id) setBadgeContentBlocks([...badgeContentBlockIds, id]); };
  const resetBadgeBlocks = () => setBadgeContentBlocks(defaultBadgeBlockIds);
  const setBadgeBackBlocks = (ids: string[]) => updateSettings({ badgeBackContentBlocks: ids });
  const moveBadgeBackBlock = (id: string, direction: -1 | 1) => setBadgeBackBlocks(moveId(badgeBackBlockIds, id, direction));
  const dropBadgeBackBlock = (draggedId: string, targetId: string) => setBadgeBackBlocks(reorderIds(badgeBackBlockIds, draggedId, targetId));
  const removeBadgeBackBlock = (id: string) => setBadgeBackBlocks(badgeBackBlockIds.filter(blockId => blockId !== id));
  const addBadgeBackBlock = (id: string) => { if (id) setBadgeBackBlocks([...badgeBackBlockIds, id]); };
  const resetBadgeBackBlocks = () => setBadgeBackBlocks(defaultBadgeBackBlockIds);
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
    if (res.ok) { setSavedTemplates(prev => [...prev, data]); setSelectedTemplateKey(data.id); setDraftTemplate(data); setMessage("Template saved for this program."); }
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
        setMessage("No saved templates found in that program yet.");
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
        setMessage(`Copied ${copied.length} template${copied.length === 1 ? "" : "s"} from ${campOptions.find(c => c.id === sourceCampId)?.name || "that program"}.`);
      } else setMessage("Could not copy templates from that program.");
    } finally {
      setSaving(false);
    }
  };
  const printDoc = (type = draftTemplate.type) => { setActiveDoc(type); setPrintQueued(true); };
  const renderTemplateCard = (template: PrintTemplate, index: number) => {
    const meta = templateMeta(template);
    const key = template.id || `template-${index}`;
    const selected = selectedTemplateKey === key || (!draftTemplate.id && draftTemplate.name === template.name);
    return <button key={key} onClick={() => chooseTemplate(key)} className={`print-template-card tile-button ${printTileClasses[index % printTileClasses.length]} text-left transition ${selected ? "ring-2 ring-[var(--tile-accent)]" : ""}`}>
      <div className="print-visual" data-visual={meta.visual} aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-600">{meta.eyebrow}</span>
        <span className="rounded-full bg-white/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">{PAPER_LABELS[template.paperSize].split(" ")[0]}</span>
      </div>
      <p className="mt-2 text-sm font-black text-slate-900">{template.name}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{meta.description}</p>
    </button>;
  };

  if (!campId) return <div className="flex h-64 items-center justify-center text-slate-400">Finding your active camp…</div>;

  return (
    <>
      <style>{`
        @media print {
          @page { size: ${printPageSizeCss}; margin: 0.25in; }
          body { background: white !important; }
          body * { visibility: hidden !important; }
          aside, nav, .no-print { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; display: block !important; min-height: 0 !important; }
          main > div { margin: 0 !important; padding: 0 !important; max-width: none !important; width: 100% !important; }
          .print-doc { display: block !important; visibility: visible !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; }
          .print-doc * { visibility: visible !important; }
          .page-break { page-break-after: always; }
          .page-break:last-child { page-break-after: auto; }
        }
        .print-doc { display: ${activeDoc ? "block" : "none"}; margin-top: ${activeDoc ? "24px" : "0"}; background: white; padding: ${activeDoc ? "16px" : "0"}; border: ${activeDoc ? "1px solid #e2e8f0" : "0"}; border-radius: ${activeDoc ? "16px" : "0"}; }
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
        .badge-card-back { justify-content: flex-start; gap: 0; text-align: left; border: 1px solid #111; border-radius: 4px; padding: 0.18in; }
        .badge-back-title { border-bottom: 1px solid #111; padding: 0 0 0.07in; margin-bottom: 0.07in; text-align: center; font-size: 12px; font-weight: 800; line-height: 1.15; }
        .badge-back-field { border-bottom: 0.5px solid #999; padding: 0.055in 0; font-size: 9.5px; font-weight: 500; line-height: 1.25; white-space: pre-line; }
        .badge-back-field:last-child { border-bottom: 0; }
        .badge-back-field-label { display: block; margin-bottom: 2px; font-size: 7px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #333; }
        .custom-back-page { page-break-before: always; page-break-after: always; width: 100%; min-height: calc(${selectedSettings.customPageHeight || "8.5in"} - 0.5in); display: grid; grid-template-columns: repeat(auto-fit, minmax(2.25in, 1fr)); gap: 0.12in; align-content: start; }
        .custom-back-page:last-child { page-break-after: auto; }
        .custom-back-card { border: 1px solid #111; border-radius: 4px; padding: 0.12in; min-height: 1.2in; page-break-inside: avoid; }
        .custom-back-title { border-bottom: 1px solid #111; padding-bottom: 0.04in; margin-bottom: 0.04in; text-align: center; font-size: 11px; font-weight: 800; line-height: 1.12; }
        .custom-back-field { border-bottom: 0.5px solid #999; padding: 0.035in 0; font-size: 8.5px; font-weight: 500; line-height: 1.18; white-space: pre-line; }
        .custom-back-field:last-child { border-bottom: 0; }
        .custom-back-label { display: block; margin-bottom: 1px; font-size: 6.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #333; }
        .badge-name { font-size: ${draftTemplate.paperSize === "letter" ? "24px" : "34px"}; font-weight: 900; line-height: 1; }
        .badge-last { font-size: ${draftTemplate.paperSize === "letter" ? "14px" : "20px"}; margin-top: 4px; }
        .single-badge-page { page-break-after: always; }
        .single-badge-page:last-child { page-break-after: auto; }
        .lanyard-schedule-card { border: 0.75px solid ${lanyardTheme.border}; border-radius: 0; padding: 0; text-align: left; page-break-inside: avoid; display: flex; flex-direction: column; min-height: ${draftTemplate.paperSize === "letter" ? "auto" : "calc(100vh - 0.5in)"}; background: #fff; overflow: hidden; }
        .lanyard-name { background: ${lanyardTheme.headerBg}; border-bottom: 0.75px solid ${lanyardTheme.border}; color: ${lanyardTheme.headerText}; font-size: 19px; font-weight: 900; line-height: 1.05; padding: 0.10in 0.06in; text-align: center; }
        .lanyard-table { width: 100%; flex: 1; display: flex; flex-direction: column; }
        .lanyard-row { display: grid; grid-template-columns: 0.72in minmax(0, 1fr); flex: 1; min-height: 0.36in; border-bottom: 0.6px solid ${lanyardTheme.border}; background: ${lanyardTheme.rowBg}; }
        .lanyard-row:nth-child(even) { background: ${lanyardTheme.rowAlt}; }
        .lanyard-row:last-child { border-bottom: 0; }
        .lanyard-time { border-right: 0.6px solid ${lanyardTheme.border}; background: ${lanyardTheme.timeBg}; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 10px; font-weight: 900; line-height: 1.05; padding: 0.04in; }
        .lanyard-activity { display: flex; align-items: center; white-space: pre-line; font-size: 9.2px; font-weight: 800; line-height: 1.12; padding: 0.035in 0.055in; overflow: hidden; word-break: break-word; }
        .lanyard-meta { border-bottom: 0.6px solid ${lanyardTheme.border}; background: ${lanyardTheme.rowAlt}; color: #0f172a; font-size: 9px; font-weight: 800; line-height: 1.15; padding: 0.045in 0.06in; text-align: center; white-space: pre-line; }
        .lanyard-back-card { border: 1px solid #111; page-break-inside: avoid; display: flex; flex-direction: column; min-height: ${draftTemplate.paperSize === "letter" ? "auto" : "calc(100vh - 0.5in)"}; background: #fff; overflow: hidden; padding: 0.18in; }
        .lanyard-back-title { border-bottom: 1px solid #111; font-size: 12px; font-weight: 800; line-height: 1.15; padding: 0 0 0.07in; margin-bottom: 0.07in; text-align: center; }
        .lanyard-back-field { border-bottom: 0.5px solid #999; padding: 0.055in 0; font-size: 9.5px; font-weight: 500; line-height: 1.25; white-space: pre-line; }
        .lanyard-back-field:last-child { border-bottom: 0; }
        .lanyard-back-label { display: block; margin-bottom: 2px; font-size: 7px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #333; }
        .rotation-page { page-break-after: always; width: 100%; height: calc(${selectedSettings.customPageHeight || "8.5in"} - 0.5in); overflow: hidden; }
        .rotation-page:last-child { page-break-after: auto; }
        .rotation-grid { width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; }
        .rotation-grid td { border: 1px solid #222; padding: 0; vertical-align: top; height: 100%; overflow: hidden; }
        .rotation-card { height: 100%; min-height: 0; display: grid; grid-template-rows: ${rotationCardRows}; overflow: hidden; }
        .rotation-top { background: #f8fafc; text-align: center; font-weight: 800; font-size: ${rotationHeaderFont}px; line-height: 1.12; padding: 4px; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; }
        .rotation-band { text-align: center; font-size: 18px; font-weight: 900; padding: 0 4px; border-top: 1px solid #222; border-bottom: 1px solid #222; overflow: hidden; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
        .rotation-teacher { text-align: center; font-size: ${rotationTeacherFont}px; font-weight: 700; padding: 0 4px; border-bottom: 1px solid #222; overflow: hidden; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
        .rotation-students { min-height: 0; padding: 6px 7px; line-height: 1.28; font-weight: 800; text-align: ${rotationStudentTextAlign}; overflow: hidden; word-break: break-word; box-sizing: border-box; }
        .rotation-students div { break-inside: avoid; page-break-inside: avoid; }
        .rotation-footer { text-align: center; font-size: ${rotationFooterFont}px; font-weight: 800; line-height: 1.12; padding: 3px 4px; border-top: 1px solid #222; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; }
        .print-template-card { border-radius: 1rem; padding: 1rem; min-height: 242px; display: flex; flex-direction: column; }
        .print-visual { height: 116px; border-radius: 14px; border: 1px solid rgba(15, 23, 42, .12); background: rgba(255,255,255,.58); padding: 10px; display: grid; gap: 6px; box-shadow: inset 0 1px 0 rgba(255,255,255,.75); }
        .print-visual span { display: block; border-radius: 7px; background: rgba(15,23,42,.16); }
        .print-visual[data-visual="grid"] { grid-template-columns: repeat(4, 1fr); grid-template-rows: 22px 1fr 1fr; }
        .print-visual[data-visual="grid"] span:first-child { grid-column: 1 / -1; background: rgba(20,184,166,.38); }
        .print-visual[data-visual="packet"], .print-visual[data-visual="roster"], .print-visual[data-visual="choices"], .print-visual[data-visual="list"] { grid-template-columns: 1fr; grid-template-rows: 20px repeat(5, 1fr); }
        .print-visual[data-visual="packet"] span:first-child, .print-visual[data-visual="roster"] span:first-child, .print-visual[data-visual="choices"] span:first-child, .print-visual[data-visual="list"] span:first-child { background: rgba(99,102,241,.30); }
        .print-visual[data-visual="badge"], .print-visual[data-visual="card"] { grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(3, 1fr); }
        .print-visual[data-visual="badge"] span, .print-visual[data-visual="card"] span { border: 2px solid rgba(15,23,42,.35); background: rgba(255,255,255,.75); }
        .print-visual[data-visual="lanyard"] { grid-template-columns: .75fr 1fr; grid-template-rows: 28px repeat(5, 1fr); }
        .print-visual[data-visual="lanyard"] span:first-child { grid-column: 1 / -1; background: rgba(20,184,166,.55); }
      `}</style>

      <div className="no-print space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Printable Studio</p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-900">Print Center</h1>
              <HelpCopy title="Printable Studio" className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">Create any printable from program data. Pick a saved or starter template, tune the live studio settings, then save a reusable custom printable.</HelpCopy>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={saveAsTemplate} disabled={saving} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm disabled:opacity-50">Save as printable</button>
              <button onClick={() => printDoc()} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-sm">Print / PDF</button>
            </div>
          </div>
        </div>
        {loading ? <div className="flex h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /></div> : (
          <div className="grid gap-5 2xl:grid-cols-[300px_minmax(0,1fr)_390px] xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm 2xl:sticky 2xl:top-4 2xl:self-start">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Saved printables</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Template gallery</h2>
              </div>
              <div className="space-y-2">
                {savedTemplates.length ? savedTemplates.map((template, index) => {
                  const key = template.id || `saved-${index}`;
                  const selected = selectedTemplateKey === key;
                  return <button key={key} onClick={() => chooseTemplate(key)} className={`w-full rounded-2xl border px-3 py-3 text-left transition ${selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                    <span className="block text-sm font-black">{template.name}</span>
                    <span className={`mt-1 block text-[11px] font-bold uppercase tracking-wide ${selected ? "text-white/90" : "text-slate-500"}`}>{templateMeta(template).eyebrow}</span>
                  </button>;
                }) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">No saved printables yet. Customize a starter, then save it here.</div>}
              </div>
              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Starter templates</p>
                <div className="space-y-2">
                  {BUILTIN_TEMPLATES.map((template, index) => {
                    const key = `builtin-${index}`;
                    const selected = selectedTemplateKey === key;
                    return <button key={key} onClick={() => chooseTemplate(key)} className={`w-full rounded-2xl border px-3 py-3 text-left transition ${selected ? "border-indigo-300 bg-indigo-50 text-slate-950" : "border-slate-200 bg-white text-slate-700 hover:bg-indigo-50"}`}>
                      <span className="block text-sm font-black leading-tight">{template.name}</span>
                      <span className="mt-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{templateMeta(template).visual} · {PAPER_LABELS[template.paperSize]}</span>
                    </button>;
                  })}
                </div>
              </div>
              <details className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-600">Import from another program</summary>
                <div className="mt-3 space-y-2">
                  <select value={sourceCampId} onChange={e => setSourceCampId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <option value="">Choose a program…</option>
                    {campOptions.filter(camp => camp.id !== campId).map(camp => <option key={camp.id} value={camp.id}>{camp.name}</option>)}
                  </select>
                  <button onClick={importTemplatesFromCamp} disabled={saving || !sourceCampId} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Copy saved printables in</button>
                </div>
              </details>
            </aside>

            <main className="space-y-5">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Live studio</p>
                    <h2 className="mt-1 text-2xl font-black text-slate-900">{draftTemplate.name}</h2>
                    <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-600">{selectedMeta.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-slate-600">{selectedMeta.eyebrow}</span>
                    <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-indigo-700">{PAPER_LABELS[draftTemplate.paperSize]}</span>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  {dataSummary.map(item => <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-2xl font-black text-slate-900">{item.value}</p><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p></div>)}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Preview</p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">Printable preview window</h3>
                  </div>
                  <button onClick={() => setActiveDoc(activeDoc === draftTemplate.type ? null : draftTemplate.type)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">{activeDoc === draftTemplate.type ? "Hide preview" : "Show preview"}</button>
                </div>
                <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="print-visual mx-auto max-w-xl" data-visual={selectedMeta.visual} aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
                    <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600 sm:grid-cols-2">
                      <p><strong className="text-slate-900">Data:</strong> {draftTemplate.type.includes("teacher") ? "Teachers + schedules" : draftTemplate.type.includes("roster") ? "Activities + participants" : "Participants + registration data"}</p>
                      <p><strong className="text-slate-900">Layout:</strong> {selectedMeta.visual} / {draftTemplate.orientation}</p>
                      <p><strong className="text-slate-900">Density:</strong> {selectedSettings.density}</p>
                      <p><strong className="text-slate-900">Output:</strong> Print dialog or Save as PDF</p>
                    </div>
                    {activeDoc === draftTemplate.type && <p className="mt-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-900">Full printable preview is rendered below the studio. Use Print / PDF when ready.</p>}
                  </div>
                </div>
              </section>
            </main>

            <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2 2xl:col-span-1 2xl:sticky 2xl:top-4 2xl:self-start">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Selected printable</p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">{draftTemplate.name}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{PAPER_LABELS[draftTemplate.paperSize]}</span>
              </div>
              <div className="mt-5 space-y-4">
                <label className="block text-xs font-bold text-slate-500">Template name<input value={draftTemplate.name} onChange={e => updateDraft({ name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" /></label>
                {hasAdvancedBasics && <details className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-500">Advanced page setup</summary>
                  <div className="mt-3 space-y-3">
                    {!draftTemplate.builtin && <label className="block text-xs font-bold text-slate-500">Document type<select value={draftTemplate.type} onChange={e => updateDraft({ type: e.target.value as PrintType })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                      <option value="custom_table">Field builder table</option><option value="principal_schedule">Principal schedule grid</option><option value="teacher_schedules">Teacher packets / schedules</option><option value="class_rosters">Classroom rosters</option><option value="rotation_roster">Custom grid rotation roster</option><option value="camper_choices">Participant class choices</option><option value="camper_roster">Participant roster</option><option value="tshirt_list">T-shirt list</option><option value="pickup_cards">Pickup window cards</option><option value="pickup_roster">Pickup number roster</option><option value="badges">Badges</option>
                    </select></label>}
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs font-bold text-slate-500">Paper<select value={draftTemplate.paperSize} onChange={e => updateDraft({ paperSize: e.target.value as PaperSize })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">{Object.entries(PAPER_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                      <label className="block text-xs font-bold text-slate-500">Orientation<select value={draftTemplate.orientation} onChange={e => updateDraft({ orientation: e.target.value as Orientation })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
                    </div>
                    {draftTemplate.paperSize === "custom" && <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs font-bold text-slate-500">Page width<input value={selectedSettings.customPageWidth} onChange={e => updateSettings({ customPageWidth: e.target.value })} placeholder="36in" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" /></label>
                      <label className="block text-xs font-bold text-slate-500">Page height<input value={selectedSettings.customPageHeight} onChange={e => updateSettings({ customPageHeight: e.target.value })} placeholder="8.5in" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" /></label>
                    </div>}
                  </div>
                </details>}

                {draftTemplate.type === "custom_table" && (
                  <div className="rounded-2xl border border-slate-200 p-3 space-y-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Field builder</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">Choose any data source, then build the columns in the exact order you want.</p>
                    </div>
                    <label className="block text-xs font-bold text-slate-500">Data source<select value={customDataSource} onChange={e => updateSettings({ customDataSource: e.target.value as CustomDataSource, customFields: CUSTOM_FIELD_OPTIONS[e.target.value as CustomDataSource].slice(0, 5).map(field => field.id), customGroupBy: "", customSortBy: CUSTOM_FIELD_OPTIONS[e.target.value as CustomDataSource][0]?.id || "" })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"><option value="participants">Participants</option><option value="people">People / staff</option><option value="activities">Activities</option></select></label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-xs font-bold text-slate-500">Sort by<select value={customSortBy} onChange={e => updateSettings({ customSortBy: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"><option value="">First selected field</option>{customFieldOptions.map(field => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label>
                      <label className="block text-xs font-bold text-slate-500">Group by<select value={customGroupBy} onChange={e => updateSettings({ customGroupBy: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"><option value="">No grouping</option>{customFieldOptions.map(field => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Columns</p><button type="button" onClick={resetCustomFields} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500">Reset</button></div>
                      <div className="space-y-1">{selectedCustomFields.map((field, index) => <div key={field.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"><span className="text-slate-400">☰</span><span className="flex-1">{index + 1}. {field.label}</span><button type="button" onClick={() => moveCustomField(field.id, -1)} disabled={index === 0} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] disabled:opacity-30">↑</button><button type="button" onClick={() => moveCustomField(field.id, 1)} disabled={index === selectedCustomFields.length - 1} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] disabled:opacity-30">↓</button><button type="button" onClick={() => removeCustomField(field.id)} className="rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-[10px] text-rose-600">Remove</button></div>)}</div>
                      {addableCustomFields.length > 0 && <label className="block text-xs font-bold text-slate-500">Add column<select value="" onChange={e => addCustomField(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"><option value="">Choose a field…</option>{addableCustomFields.map(field => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label>}
                    </div>
                  </div>
                )}

                {draftTemplate.type === "rotation_roster" && (
                  <div className="rounded-2xl border border-slate-200 p-3 space-y-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Custom grid settings</p>
                    <label className="block text-xs font-bold text-slate-500">Time slot<select value={selectedSettings.rotationTimeFilter} onChange={e => updateSettings({ rotationTimeFilter: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"><option value="">All time slots</option>{rotationTimes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-xs font-bold text-slate-500">Columns per page<input type="number" min={1} max={20} value={rotationColumns} onChange={e => updateSettings({ rotationColumns: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
                      <label className="block text-xs font-bold text-slate-500">Band style<select value={selectedSettings.rotationBandMode} onChange={e => updateSettings({ rotationBandMode: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"><option value="color">Color by time slot</option><option value="grayscale">Grayscale by time slot</option></select></label>
                    </div>
                    <HelpCopy title="Time bands" className="text-[11px] font-semibold text-slate-400">Time bands color themselves. No color picker, no chaos gremlin.</HelpCopy>
                    <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-500">Fine-tune row heights</summary>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <label className="block text-xs font-bold text-slate-500">Header height<input value={selectedSettings.rotationHeaderHeight} onChange={e => updateSettings({ rotationHeaderHeight: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></label>
                        <label className="block text-xs font-bold text-slate-500">Time band height<input value={selectedSettings.rotationBandHeight} onChange={e => updateSettings({ rotationBandHeight: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></label>
                        <label className="block text-xs font-bold text-slate-500">Teacher height<input value={selectedSettings.rotationTeacherHeight} onChange={e => updateSettings({ rotationTeacherHeight: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></label>
                        <label className="block text-xs font-bold text-slate-500">Footer height<input value={selectedSettings.rotationFooterHeight} onChange={e => updateSettings({ rotationFooterHeight: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></label>
                        <label className="block text-xs font-bold text-slate-500">Student font<input type="number" min={5} max={20} value={rotationStudentBaseFont} onChange={e => updateSettings({ rotationStudentFont: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></label>
                        <label className="block text-xs font-bold text-slate-500">Student align<select value={rotationStudentTextAlign} onChange={e => updateSettings({ rotationStudentAlign: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"><option value="center">Center</option><option value="left">Left</option><option value="right">Right</option></select></label>
                      </div>
                    </details>
                  </div>
                )}

                {flexibleFieldVisible && <div className="rounded-2xl border border-slate-200 p-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Common fields</p>
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={selectedSettings.showStudents} onChange={e => updateSettings({ showStudents: e.target.checked })} /> Student names</label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={selectedSettings.showTeacher} onChange={e => updateSettings({ showTeacher: e.target.checked })} /> Teachers</label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={selectedSettings.showRoom} onChange={e => updateSettings({ showRoom: e.target.checked })} /> Rooms</label>
                    {draftTemplate.type === "class_rosters" && <><label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={selectedSettings.showEmergency} onChange={e => updateSettings({ showEmergency: e.target.checked })} /> Emergency</label><label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={selectedSettings.showMedical} onChange={e => updateSettings({ showMedical: e.target.checked })} /> Medical</label></>}
                    {draftTemplate.type === "rotation_roster" && <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={selectedSettings.showFooterLabel} onChange={e => updateSettings({ showFooterLabel: e.target.checked })} /> Footer label</label>}
                  </div>
                </div>}

                {customBlockOptions.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Printable block order</p>
                        <p className="text-[11px] font-semibold text-slate-400">Drag rows or use arrows to arrange the custom grid.</p>
                      </div>
                      <button type="button" onClick={resetCustomBlockOrder} className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-500">Reset</button>
                    </div>
                    <div className="space-y-1">
                      {customBlockOrder.map((block, index) => <div key={block.id} draggable onDragStart={e => { e.dataTransfer.setData("text/plain", block.id); e.dataTransfer.effectAllowed = "move"; }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); dropCustomBlock(e.dataTransfer.getData("text/plain"), block.id); }} className="flex cursor-grab items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 active:cursor-grabbing">
                        <span className="text-slate-400">☰</span><span className="flex-1">{index + 1}. {block.label}</span>
                        <button type="button" onClick={() => moveCustomBlock(block.id, -1)} disabled={index === 0} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] disabled:opacity-30">↑</button>
                        <button type="button" onClick={() => moveCustomBlock(block.id, 1)} disabled={index === customBlockOrder.length - 1} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] disabled:opacity-30">↓</button>
                      </div>)}
                    </div>
                  </div>
                )}

                {draftTemplate.type === "badges" && (
                  <div className="rounded-2xl border border-slate-200 p-3 space-y-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Badge builder</p>
                    <label className="block text-xs font-bold text-slate-500">Layout<select value={selectedSettings.badgeLayout} onChange={e => updateSettings({ badgeLayout: e.target.value, badgeContentBlocks: e.target.value === "schedule_lanyard" ? ["name", "schedule"] : ["label", "firstName", "lastName"] })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"><option value="standard">Standard name badge</option><option value="schedule_lanyard">Schedule lanyard table</option></select></label>
                    {selectedSettings.badgeLayout === "schedule_lanyard" && <label className="block text-xs font-bold text-slate-500">Lanyard style<select value={selectedSettings.lanyardTheme} onChange={e => updateSettings({ lanyardTheme: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800">{Object.entries(LANYARD_THEMES).map(([key, theme]) => <option key={key} value={key}>{theme.label}</option>)}</select></label>}
                    {draftTemplate.paperSize === "letter" && <div className="grid grid-cols-2 gap-2">
                      <label className="block text-xs font-bold text-slate-500">Rows on sheet<input type="number" min={1} max={8} value={badgeRows} onChange={e => updateSettings({ badgeRows: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
                      <label className="block text-xs font-bold text-slate-500">Columns on sheet<input type="number" min={1} max={5} value={badgeCols} onChange={e => updateSettings({ badgeCols: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
                    </div>}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Front content</p><p className="text-[11px] font-semibold text-slate-400">Add fields, then drag into printable order.</p></div><button type="button" onClick={resetBadgeBlocks} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500">Reset</button></div>
                      <div className="space-y-1">{badgeContentBlocks.map((block, index) => <div key={block.id} draggable onDragStart={e => { e.dataTransfer.setData("text/plain", block.id); e.dataTransfer.effectAllowed = "move"; }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); dropBadgeBlock(e.dataTransfer.getData("text/plain"), block.id); }} className="flex cursor-grab items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 active:cursor-grabbing"><span className="text-slate-400">☰</span><span className="flex-1">{index + 1}. {block.label}</span><button type="button" onClick={() => moveBadgeBlock(block.id, -1)} disabled={index === 0} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] disabled:opacity-30">↑</button><button type="button" onClick={() => moveBadgeBlock(block.id, 1)} disabled={index === badgeContentBlocks.length - 1} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] disabled:opacity-30">↓</button><button type="button" onClick={() => removeBadgeBlock(block.id)} className="rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-[10px] text-rose-600">Remove</button></div>)}</div>
                      {addableBadgeBlocks.length > 0 && <label className="block text-xs font-bold text-slate-500">Add field<select value="" onChange={e => addBadgeBlock(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"><option value="">Choose a field…</option>{addableBadgeBlocks.map(block => <option key={block.id} value={block.id}>{block.label}</option>)}</select></label>}
                    </div>
                  </div>
                )}

                {supportsTwoSidedCustom && <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-600"><input type="checkbox" checked={selectedSettings.badgeBackEnabled} onChange={e => updateSettings({ badgeBackEnabled: e.target.checked, badgeBackContentBlocks: selectedSettings.badgeBackContentBlocks.length ? selectedSettings.badgeBackContentBlocks : defaultBadgeBackBlockIds })} /> Print a back side</label>
                  <HelpCopy title="Badge backs" className="text-[11px] font-semibold text-slate-400">Backs use the subtle business-card style for guardian, emergency, medical, and schedule info.</HelpCopy>
                  {selectedSettings.badgeBackEnabled && <>
                    <div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Back content</p><button type="button" onClick={resetBadgeBackBlocks} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500">Reset back</button></div>
                    <div className="space-y-1">{badgeBackBlocks.map((block, index) => <div key={block.id} draggable onDragStart={e => { e.dataTransfer.setData("text/plain", block.id); e.dataTransfer.effectAllowed = "move"; }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); dropBadgeBackBlock(e.dataTransfer.getData("text/plain"), block.id); }} className="flex cursor-grab items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 active:cursor-grabbing"><span className="text-slate-400">☰</span><span className="flex-1">{index + 1}. {block.label}</span><button type="button" onClick={() => moveBadgeBackBlock(block.id, -1)} disabled={index === 0} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] disabled:opacity-30">↑</button><button type="button" onClick={() => moveBadgeBackBlock(block.id, 1)} disabled={index === badgeBackBlocks.length - 1} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] disabled:opacity-30">↓</button><button type="button" onClick={() => removeBadgeBackBlock(block.id)} className="rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-[10px] text-rose-600">Remove</button></div>)}</div>
                    {addableBadgeBackBlocks.length > 0 && <label className="block text-xs font-bold text-slate-500">Add back field<select value="" onChange={e => addBadgeBackBlock(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"><option value="">Choose a back field…</option>{addableBadgeBackBlocks.map(block => <option key={block.id} value={block.id}>{block.label}</option>)}</select></label>}
                  </>}
                </div>}

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button onClick={() => printDoc()} className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white">Print preview</button>
                  <button onClick={updateSavedTemplate} disabled={saving} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">{draftTemplate.builtin ? "Save custom copy" : "Update custom"}</button>
                </div>
                {message && <p className="text-xs font-semibold text-slate-600">{message}</p>}
              </div>
            </aside>
          </div>
        )}
      </div>

      {activeDoc === "custom_table" && <div className="print-doc ops-print">
        <h1 className="ops-title">{draftTemplate.name}</h1>
        <p className="ops-subtitle">{customDataSource === "participants" ? "Participants" : customDataSource === "people" ? "People / staff" : "Activities"} • {selectedCustomFields.length} column{selectedCustomFields.length === 1 ? "" : "s"} • {sortedCustomItems.length} row{sortedCustomItems.length === 1 ? "" : "s"}</p>
        {groupedCustomItems.map(([groupName, items]) => <section key={groupName || "all"} className={selectedSettings.groupByPage && groupName ? "page-break" : ""}>
          {groupName && <h2 style={{fontSize: 15, margin: "0 0 6px", fontWeight: 900}}>{groupName} <span style={{fontSize: 11, fontWeight: 700}}>({items.length})</span></h2>}
          <table className={selectedSettings.stripedRows ? "striped" : ""}>
            <thead><tr>{selectedCustomFields.map(field => <th key={field.id}>{field.label}</th>)}</tr></thead>
            <tbody>{items.length ? items.map((item: any, rowIndex: number) => <tr key={`${groupName}-${rowIndex}`}>{selectedCustomFields.map(field => <td key={field.id}>{field.value(item, courses) || "—"}</td>)}</tr>) : <tr><td colSpan={Math.max(selectedCustomFields.length, 1)}>No records found.</td></tr>}</tbody>
          </table>
        </section>)}
      </div>}

      {activeDoc === "principal_schedule" && <div className="print-doc ops-print"><table className={`center ${selectedSettings.stripedRows ? "striped" : ""}`}><thead><tr><th className="student-col">Student</th>{principalScheduleSlots.map(slot => <th key={slot.key} className="time-col">{slot.label}</th>)}</tr></thead><tbody>{sortedCampers.map(camper => <tr key={camper.id}><td className="student-col">{fullName(camper)}</td>{principalScheduleSlots.map(slot => <td key={slot.key} className="time-col">{cellForSlot(camper, slot)}</td>)}</tr>)}</tbody></table></div>}

      {activeDoc === "teacher_schedules" && <div className="print-doc ops-print">{operationalPeople.map(person => { const rows = teacherRows(person, courses, mandatorySessions, campers); const columns = 3 + (selectedSettings.showRoom ? 1 : 0) + (selectedSettings.showStudents ? 1 : 0); return <section key={person.id} className="page-break"><h1 className="ops-title">{fullName(person)} Teacher Packet</h1><p className="ops-subtitle">{person.role} {person.email ? `• ${person.email}` : ""} {person.phone ? `• ${person.phone}` : ""}</p><table><thead><tr><th style={{width:"100px"}}>Time</th><th>Assignment</th>{selectedSettings.showRoom && <th style={{width:"120px"}}>Room</th>}<th style={{width:"110px"}}>Group</th>{selectedSettings.showStudents && <th>Registered Students</th>}</tr></thead><tbody>{rows.length ? rows.map((row, idx) => <tr key={`${row.sortValue}-${idx}`}><td>{row.time}</td><td>{row.title}</td>{selectedSettings.showRoom && <td>{row.room}</td>}<td>{row.age}</td>{selectedSettings.showStudents && <td>{row.students.length ? row.students.map(student => fullName(student)).join("\n") : "—"}</td>}</tr>) : <tr><td colSpan={columns}>No scheduled assignments.</td></tr>}</tbody></table></section>; })}</div>}

      {activeDoc === "class_rosters" && <div className="print-doc ops-print">{rosterPackets.map(group => { const course = courseById(courses, group.courseId); return <section key={group.key} className="page-break"><h1 className="ops-title">{group.title}</h1><p className="ops-subtitle">{group.time}{selectedSettings.showRoom ? ` • ${group.room}` : ""}{selectedSettings.showTeacher ? ` • Teacher: ${courseTeacherNames(course)}` : ""} • {group.campers.length} camper{group.campers.length === 1 ? "" : "s"}</p><table><thead><tr><th style={{width:"150px"}}>Participant</th><th style={{width:"100px"}}>Age Group</th><th>Guardian</th>{selectedSettings.showEmergency && <th>Emergency</th>}{selectedSettings.showMedical && <th>Medical / Dietary</th>}</tr></thead><tbody>{group.campers.map(camper => <tr key={camper.id}><td>{fullName(camper)}</td><td>{camper.ageGroup?.name || "—"}</td><td>{camper.guardianName || "—"}<br />{camper.guardianPhone || camper.guardianEmail || ""}</td>{selectedSettings.showEmergency && <td>{camper.emergencyPhone || "—"}</td>}{selectedSettings.showMedical && <td>{[camper.medicalNotes, camper.dietaryNotes].filter(Boolean).join(" / ") || "—"}</td>}</tr>)}</tbody></table></section>; })}</div>}

      {activeDoc === "rotation_roster" && <div className="print-doc ops-print">{(() => {
        const renderCustomBackField = (camper: Camper, blockId: string) => {
          const field = (label: string, value: string) => <div key={blockId} className="custom-back-field"><span className="custom-back-label">{label}</span>{value || "—"}</div>;
          if (blockId === "fullName" || blockId === "name") return field("Participant", fullName(camper));
          if (blockId === "ageGroup") return field("Age group", camper.ageGroup?.name || "—");
          if (blockId === "guardian") return field("Emergency contact", [camper.guardianName, camper.guardianPhone || camper.guardianEmail].filter(Boolean).join("\n") || "—");
          if (blockId === "emergency") return field("Emergency phone", camper.emergencyPhone || camper.guardianPhone || "—");
          if (blockId === "medical") return field("Medical / dietary", [camper.medicalNotes, camper.dietaryNotes].filter(Boolean).join("\n") || "None listed");
          if (blockId === "schedule") return field("Schedule", badgeScheduleSummary(camper) || "—");
          return null;
        };
        return <>{chunkItems(rotationRosterPackets, rotationColumns).map((pageGroups, pageIndex) => <section key={`rotation-${pageIndex}`} className="rotation-page"><table className="rotation-grid"><tbody><tr>{Array.from({ length: rotationColumns }).map((_, idx) => { const group = pageGroups[idx]; if (!group) return <td key={`empty-${idx}`} />; const course = courseById(courses, group.courseId); const teacherNames = courseTeacherNames(course); const age = course ? courseAgeLabel(course) : ""; const headerTitle = `${group.title}${age ? ` (${age})` : ""}`; const renderRotationBlock = (blockId: string) => {
          if (blockId === "header") return <div key="header" className="rotation-top"><div>{group.timeLabel}</div><div>{headerTitle}</div>{selectedSettings.showRoom && <div>[{group.room}]</div>}</div>;
          if (blockId === "timeBand") return <div key="timeBand" className="rotation-band" style={{ background: rotationBandColorForTime(group.start || group.time, selectedSettings.rotationBandMode, rotationTimes) }}>{group.timeLabel}</div>;
          if (blockId === "teacher") return selectedSettings.showTeacher ? <div key="teacher" className="rotation-teacher">{teacherNames}</div> : null;
          if (blockId === "footer") return selectedSettings.showFooterLabel ? <div key="footer" className="rotation-footer"><div>{headerTitle}</div>{selectedSettings.showRoom && <div>[{group.room}]</div>}</div> : null;
          return <div key="students" className="rotation-students" style={{ fontSize: `${rotationStudentFontSize(group.campers.length, rotationStudentBaseFont)}px` }}>{selectedSettings.showStudents ? (group.campers.length ? group.campers.map(camper => <div key={camper.id}>{fullName(camper)}</div>) : <div>—</div>) : <div>{group.campers.length} registered</div>}</div>;
        }; return <td key={group.key}><div className="rotation-card">{customBlockOrder.map(block => renderRotationBlock(block.id))}</div></td>; })}</tr></tbody></table></section>)}
        {selectedSettings.badgeBackEnabled && chunkItems(sortedCampers, draftTemplate.paperSize === "custom" ? 40 : 12).map((pageCampers, pageIndex) => <section key={`custom-back-${pageIndex}`} className="custom-back-page">{pageCampers.map(camper => <div key={camper.id} className="custom-back-card"><div className="custom-back-title">{fullName(camper)}</div>{badgeBackBlocks.map(block => renderCustomBackField(camper, block.id))}</div>)}</section>)}</>;
      })()}</div>}

      {activeDoc === "camper_choices" && <div className="print-doc ops-print"><h1 className="ops-title">Participant Class Choices</h1><p className="ops-subtitle">Repeated sessions are combined; each selected class time appears once per participant.</p><table><thead><tr><th style={{width:"145px"}}>Participant</th><th style={{width:"95px"}}>Age Group</th><th>Class Choices</th></tr></thead><tbody>{sortedCampers.map(camper => { const choices = classChoicesForCamper(camper, courses); return <tr key={camper.id}><td>{fullName(camper)}</td><td>{camper.ageGroup?.name || "—"}</td><td>{choices.length ? choices.map(choice => choice.label).join("\n") : "—"}</td></tr>; })}</tbody></table></div>}

      {activeDoc === "camper_roster" && <div className="print-doc ops-print"><h1 className="ops-title">Participant Roster</h1><table><thead><tr><th>Last</th><th>First</th><th>Age Group</th><th>Guardian</th><th>Email</th></tr></thead><tbody>{sortedCampers.map(c => <tr key={c.id}><td>{c.lastName}</td><td>{c.firstName}</td><td>{c.ageGroup?.name || "—"}</td><td>{c.guardianName || "—"}</td><td>{c.guardianEmail || "—"}</td></tr>)}</tbody></table></div>}

      {activeDoc === "tshirt_list" && <div className="print-doc ops-print"><h1 className="ops-title">T-Shirt Sizes</h1>{tshirtOrder.filter(s => sizeGroups[s]?.length).map(size => <section key={size} style={{marginBottom:18}}><h2 style={{fontSize:16, margin:"0 0 6px"}}>{size} ({sizeGroups[size].length})</h2><table><tbody>{sortedCampersList(sizeGroups[size]).map(c => <tr key={c.id}><td>{c.lastName}, {c.firstName}</td><td>{c.ageGroup?.name || "—"}</td></tr>)}</tbody></table></section>)}</div>}

      {activeDoc === "pickup_cards" && <div className="print-doc ops-print">{sortedCampers.map(c => <section key={c.id} className="page-break" style={{minHeight:"calc(100vh - 0.5in)", display:"flex", alignItems:"center", justifyContent:"center"}}><div style={{width:"100%", maxWidth:"5.4in", border:"4px solid #111", borderRadius:"18px", padding:"0.28in", textAlign:"center"}}><div style={{fontSize:18, fontWeight:900, letterSpacing:"0.18em", textTransform:"uppercase"}}>Creator&apos;s Program Pickup</div><div style={{fontSize:96, lineHeight:1, fontWeight:900, margin:"0.18in 0 0.08in"}}>{c.pickupNumber || "—"}</div><div style={{fontSize:24, fontWeight:900, letterSpacing:"0.08em", textTransform:"uppercase"}}>{c.lastName} Family</div><div style={{marginTop:"0.18in", display:"flex", justifyContent:"center"}}><CamperScannableCode value={c.scanCode} label="Scan for check-in" size={132} /></div><div style={{marginTop:"0.12in", fontSize:12, fontWeight:700, color:"#444"}}>Staff: scan QR or search pickup #{c.pickupNumber || "—"}</div></div></section>)}</div>}

      {activeDoc === "pickup_roster" && <div className="print-doc ops-print"><h1 className="ops-title">Pickup Number Roster</h1><p className="ops-subtitle">Backup car-line lookup. Pickup numbers can be shared by siblings/family groups.</p><table><thead><tr><th style={{width:"80px"}}>Pickup #</th><th>Family / Participant</th><th>Guardian</th><th>Phone</th><th>Age Group</th></tr></thead><tbody>{[...sortedCampers].sort((a,b) => String(a.pickupNumber || "999999").localeCompare(String(b.pickupNumber || "999999"), undefined, { numeric: true })).map(c => <tr key={c.id}><td style={{fontSize:16, fontWeight:900, textAlign:"center"}}>{c.pickupNumber || "—"}</td><td>{c.lastName.toUpperCase()} FAMILY<br />{fullName(c)}</td><td>{c.guardianName || "—"}</td><td>{c.guardianPhone || c.guardianEmail || "—"}</td><td>{c.ageGroup?.name || "—"}</td></tr>)}</tbody></table></div>}

      {activeDoc === "badges" && <div className="print-doc ops-print">
        {(() => {
          const renderBackField = (c: Camper, blockId: string, lanyard = false) => {
            const fieldClass = lanyard ? "lanyard-back-field" : "badge-back-field";
            const labelClass = lanyard ? "lanyard-back-label" : "badge-back-field-label";
            const field = (label: string, value: string) => <div key={blockId} className={fieldClass}><span className={labelClass}>{label}</span>{value || "—"}</div>;
            if (blockId === "fullName" || blockId === "name") return field("Participant", fullName(c));
            if (blockId === "ageGroup") return field("Age group", c.ageGroup?.name || "—");
            if (blockId === "guardian") return field("Emergency contact", [c.guardianName, c.guardianPhone || c.guardianEmail].filter(Boolean).join("\n") || "—");
            if (blockId === "emergency") return field("Emergency phone", c.emergencyPhone || c.guardianPhone || "—");
            if (blockId === "medical") return field("Medical / dietary", [c.medicalNotes, c.dietaryNotes].filter(Boolean).join("\n") || "None listed");
            if (blockId === "schedule") return field("Schedule", badgeScheduleSummary(c) || "—");
            if (blockId === "qr") return <div key="qr" style={{ display: "flex", flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", padding: "0.08in 0" }}><CamperScannableCode value={c.scanCode} label="Scan for check-in / checkout" size={lanyard ? 150 : 132} /></div>;
            if (blockId === "firstName") return field("First name", c.firstName);
            if (blockId === "lastName") return field("Last name", c.lastName);
            return null;
          };
          const renderFront = (c: Camper, withPageBreak = true) => {
            if (selectedSettings.badgeLayout === "schedule_lanyard") {
              const showAgeInSchedule = badgeContentBlockIds.includes("ageGroup");
              const rows = lanyardScheduleRows(c, showAgeInSchedule);
              const renderLanyardBlock = (blockId: string) => {
                if (blockId === "schedule") return <div key="schedule" className="lanyard-table">
                  {rows.length ? rows.map((row, idx) => <div key={`${row.sortValue}-${idx}`} className="lanyard-row">
                    <div className="lanyard-time">{row.time}</div>
                    <div className="lanyard-activity">{row.activity}</div>
                  </div>) : <div className="lanyard-row"><div className="lanyard-time">—</div><div className="lanyard-activity">No schedule assigned</div></div>}
                </div>;
                if (blockId === "name" || blockId === "fullName") return <div key={blockId} className="lanyard-name">{fullName(c)}</div>;
                if (blockId === "ageGroup") return <div key="ageGroup" className="lanyard-meta">{c.ageGroup?.name || "Age group not set"}</div>;
                if (blockId === "guardian") return <div key="guardian" className="lanyard-meta">{[c.guardianName, c.guardianPhone || c.guardianEmail].filter(Boolean).join("\n") || "Guardian contact not set"}</div>;
                if (blockId === "emergency") return <div key="emergency" className="lanyard-meta">Emergency: {c.emergencyPhone || "—"}</div>;
                if (blockId === "medical") return <div key="medical" className="lanyard-meta">{[c.medicalNotes, c.dietaryNotes].filter(Boolean).join("\n") || "No medical/dietary notes"}</div>;
                return null;
              };
              return <div key={`${c.id}-front`} className={`lanyard-schedule-card ${withPageBreak && draftTemplate.paperSize !== "letter" ? "single-badge-page" : ""}`}>
                {badgeContentBlocks.map(block => renderLanyardBlock(block.id))}
              </div>;
            }
            const renderBadgeBlock = (blockId: string) => {
              if (blockId === "label") return <div key="label" style={{fontSize:11, textTransform:"uppercase", letterSpacing:".12em", marginBottom:8}}>Participant</div>;
              if (blockId === "firstName") return <div key="firstName" className="badge-name">{c.firstName}</div>;
              if (blockId === "lastName") return <div key="lastName" className="badge-last">{c.lastName}</div>;
              if (blockId === "fullName") return <div key="fullName" className="badge-name">{fullName(c)}</div>;
              if (blockId === "ageGroup") return <div key="ageGroup" style={{fontSize:13, fontWeight:800, marginTop:8, borderTop:"1px solid #ddd", paddingTop:8}}>{c.ageGroup?.name || ""}</div>;
              if (blockId === "guardian") return <div key="guardian" style={{fontSize:10, marginTop:6}}>{c.guardianName || ""}{c.guardianPhone ? ` • ${c.guardianPhone}` : c.guardianEmail ? ` • ${c.guardianEmail}` : ""}</div>;
              if (blockId === "emergency") return <div key="emergency" style={{fontSize:10, marginTop:6}}>Emergency: {c.emergencyPhone || "—"}</div>;
              if (blockId === "medical") return <div key="medical" style={{fontSize:9, marginTop:6, lineHeight:1.2}}>{[c.medicalNotes, c.dietaryNotes].filter(Boolean).join(" / ") || "No medical/dietary notes"}</div>;
              if (blockId === "schedule") return <div key="schedule" style={{fontSize:9, marginTop:8, lineHeight:1.25}}>{badgeScheduleSummary(c)}</div>;
              return null;
            };
            return <div key={`${c.id}-front`} className={`badge-card ${withPageBreak && draftTemplate.paperSize !== "letter" ? "single-badge-page" : ""}`}>
              {badgeContentBlocks.map(block => renderBadgeBlock(block.id))}
            </div>;
          };
          const renderBack = (c: Camper, withPageBreak = true) => selectedSettings.badgeLayout === "schedule_lanyard"
            ? <div key={`${c.id}-back`} className={`lanyard-back-card ${withPageBreak && draftTemplate.paperSize !== "letter" ? "single-badge-page" : ""}`}><div className="lanyard-back-title">{fullName(c)}</div>{badgeBackBlocks.map(block => renderBackField(c, block.id, true))}</div>
            : <div key={`${c.id}-back`} className={`badge-card badge-card-back ${withPageBreak && draftTemplate.paperSize !== "letter" ? "single-badge-page" : ""}`}><div className="badge-back-title">{fullName(c)}</div>{badgeBackBlocks.map(block => renderBackField(c, block.id))}</div>;
          if (draftTemplate.paperSize === "letter") {
            const perSheet = Math.max(1, badgeRows * badgeCols);
            return chunkItems(sortedCampers, perSheet).map((sheetCampers, sheetIndex) => <div key={`sheet-${sheetIndex}`}>
              <div className="badge-sheet page-break">{sheetCampers.map(c => renderFront(c, false))}</div>
              {selectedSettings.badgeBackEnabled && <div className="badge-sheet page-break">{sheetCampers.map(c => renderBack(c, false))}</div>}
            </div>);
          }
          return sortedCampers.map(c => <div key={c.id}>{renderFront(c, selectedSettings.badgeBackEnabled)}{selectedSettings.badgeBackEnabled && renderBack(c)}</div>);
        })()}
      </div>}
    </>
  );
}

export default function PrintPage() {
  return <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /></div>}><PrintContent /></Suspense>;
}
