"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CamperScannableCode from "@/components/CamperScannableCode";
import { RowDeleteButton } from "@/components/InlineEditing";
import { EmptyState } from "@/components/OperationalUI";

interface AgeGroup {
  id: string;
  name: string;
  color: string;
}

interface CampSession {
  id: string;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  enrolledCount?: number;
  course?: { id: string; name: string; cap?: number | null } | null;
  mandatorySession?: { id: string; title: string } | null;
  room?: { id: string; name: string } | null;
  sessionTemplate?: { id: string; label?: string | null; dayOfWeek?: number | null; startTime: string; endTime: string } | null;
}

interface Course {
  id: string;
  name: string;
  description?: string | null;
  cap?: number | null;
  ageGroup?: { id: string; name: string } | null;
  courseAgeGroups?: { ageGroup: { id: string; name: string } }[];
  room?: { id: string; name: string } | null;
  courseSessionTemplates?: { sessionTemplate: { id: string; label?: string | null; dayOfWeek?: number | null; startTime: string; endTime: string } }[];
  sessions?: { id: string; sessionTemplateId: string | null; enrolledCount: number }[];
}

interface SessionChoice {
  key: string;
  sessionId?: string;
  sessionIds?: string[];
  courseId: string;
  sessionTemplateId: string;
  sessionTemplateIds?: string[];
  title: string;
  description?: string | null;
  time: string;
  room?: string;
  enrolledCount: number;
  cap?: number | null;
  seatsLeft: number | null;
  full: boolean;
}

interface SessionChoiceGroup {
  key: string;
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  time: string;
  sessionTemplateIds: string[];
  options: SessionChoice[];
}

interface Enrollment {
  id: string;
  sessionId: string;
  status: string;
  session?: CampSession | null;
}

interface Camper {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  guardianName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  emergencyPhone?: string | null;
  tshirtSize?: string | null;
  photoConsent: boolean;
  medicalNotes?: string | null;
  dietaryNotes?: string | null;
  customData?: string | null;
  couponCode?: string | null;
  campPriceCents?: number;
  discountCents?: number;
  platformFeeCents?: number;
  totalPaidCents?: number;
  paymentStatus?: string;
  pickupNumber?: string | null;
  scanCode?: string | null;
  scanCodeGeneratedAt?: string | null;
  pickupCardPrintedAt?: string | null;
  badgePrintedAt?: string | null;
  dateOfBirth?: string | null;
  ageGroup?: AgeGroup | null;
  enrollments?: Enrollment[];
  createdAt: string;
}

const TSHIRT_SIZES = ["YXS", "YS", "YM", "YL", "AS", "AM", "AL", "AXL", "A2XL"];
const PAYMENT_STATUSES = ["not_required", "unpaid", "paid", "refunded", "comped"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function age(dob: string) {
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return a;
}
function cents(value?: number) { return `$${((value || 0) / 100).toFixed(2)}`; }
function sessionTitle(session?: CampSession | null) { return session?.mandatorySession?.title || session?.course?.name || session?.sessionTemplate?.label || "Untitled session"; }
function sessionDay(session?: CampSession | null) {
  if (session?.date) return new Date(session.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (session?.sessionTemplate?.dayOfWeek != null) return DAYS[session.sessionTemplate.dayOfWeek];
  return "Any day";
}
function sessionTime(session?: CampSession | null) {
  const start = session?.startTime || session?.sessionTemplate?.startTime || "";
  const end = session?.endTime || session?.sessionTemplate?.endTime || "";
  return `${sessionDay(session)}${start || end ? ` · ${start}${end ? `–${end}` : ""}` : ""}`;
}
function sessionChoiceKey(session?: CampSession | null) {
  const template = session?.sessionTemplate;
  const start = session?.startTime || template?.startTime || "";
  const end = session?.endTime || template?.endTime || "";
  if (session?.mandatorySession) {
    return `mandatory|${session.mandatorySession.title}|${start}|${end}|${session.room?.id || ""}`;
  }
  if (session?.course?.id && template?.id) return `${session.course.id}|${template.id}`;
  return session?.id || "missing";
}
function courseMatchesAgeGroup(course: Course, ageGroupId: string) {
  if (!ageGroupId) return false;
  return course.ageGroup?.id === ageGroupId || Boolean(course.courseAgeGroups?.some(cag => cag.ageGroup.id === ageGroupId));
}
function buildSessionChoices(courses: Course[], ageGroupId: string, selectedKeys: Set<string>): SessionChoice[] {
  return buildSessionChoiceGroups(courses, ageGroupId, selectedKeys).flatMap(group => group.options);
}
function sessionTemplateGroupKey(template: { label?: string | null; startTime: string; endTime: string }) {
  return `${template.label || "Session"}|${template.startTime}|${template.endTime}`;
}
function buildSessionChoiceGroups(courses: Course[], ageGroupId: string, selectedKeys: Set<string>): SessionChoiceGroup[] {
  if (!ageGroupId) return [];
  const eligibleCourses = courses.filter(course => courseMatchesAgeGroup(course, ageGroupId));
  const templateGroups = new Map<string, { label: string; startTime: string; endTime: string; sessionTemplateIds: string[] }>();
  for (const course of eligibleCourses) {
    for (const cst of course.courseSessionTemplates || []) {
      const template = cst.sessionTemplate;
      if (!template?.id) continue;
      const key = sessionTemplateGroupKey(template);
      const existing = templateGroups.get(key) || { label: template.label || "Session", startTime: template.startTime, endTime: template.endTime, sessionTemplateIds: [] };
      if (!existing.sessionTemplateIds.includes(template.id)) existing.sessionTemplateIds.push(template.id);
      templateGroups.set(key, existing);
    }
  }
  return [...templateGroups.entries()].map(([key, group]) => {
    const options: SessionChoice[] = [];
    for (const course of eligibleCourses) {
      const courseTemplateIds = new Set((course.courseSessionTemplates || []).map(cst => cst.sessionTemplate?.id).filter(Boolean));
      if (!group.sessionTemplateIds.every(templateId => courseTemplateIds.has(templateId))) continue;
      const matchingSessions = group.sessionTemplateIds
        .map(templateId => (course.sessions || []).find(session => session.sessionTemplateId === templateId))
        .filter((session): session is { id: string; sessionTemplateId: string | null; enrolledCount: number } => Boolean(session));
      const enrolledCount = matchingSessions.length ? Math.max(...matchingSessions.map(session => session.enrolledCount || 0)) : 0;
      const cap = course.cap;
      const seatsLeft = cap === null || cap === undefined ? null : Math.max(cap - enrolledCount, 0);
      const full = seatsLeft !== null && seatsLeft <= 0;
      const selectedInGroup = group.sessionTemplateIds.some(templateId => selectedKeys.has(`${course.id}|${templateId}`));
      if (full && !selectedInGroup) continue;
      options.push({
        key: `${course.id}|${group.sessionTemplateIds.join("|")}`,
        sessionId: matchingSessions[0]?.id,
        sessionIds: matchingSessions.map(session => session.id),
        courseId: course.id,
        sessionTemplateId: group.sessionTemplateIds[0],
        sessionTemplateIds: group.sessionTemplateIds,
        title: course.name,
        description: course.description,
        time: `${group.label} · ${group.startTime}${group.endTime ? `–${group.endTime}` : ""}`,
        room: course.room?.name,
        enrolledCount,
        cap,
        seatsLeft,
        full,
      });
    }
    return {
      key,
      id: group.sessionTemplateIds.join("|"),
      label: group.label,
      startTime: group.startTime,
      endTime: group.endTime,
      time: `${group.label} · ${group.startTime}${group.endTime ? `–${group.endTime}` : ""}`,
      sessionTemplateIds: group.sessionTemplateIds,
      options: options.sort((a, b) => a.title.localeCompare(b.title)),
    };
  }).filter(group => group.options.length > 0).sort((a, b) => `${a.startTime}|${a.label}`.localeCompare(`${b.startTime}|${b.label}`));
}
function sessionSortValue(session?: CampSession | null) {
  const day = session?.date ? new Date(session.date).getDay() : session?.sessionTemplate?.dayOfWeek ?? 99;
  const time = session?.startTime || session?.sessionTemplate?.startTime || "99:99";
  return `${String(day).padStart(2, "0")}|${time}|${sessionTitle(session).toLowerCase()}`;
}
function summarizedEnrollmentChoices(enrollments: Enrollment[] = []) {
  const byChoice = new Map<string, { key: string; title: string; days: string[]; time: string; rooms: string[]; sortValue: string }>();
  for (const enrollment of [...enrollments].sort((a, b) => sessionSortValue(a.session).localeCompare(sessionSortValue(b.session)))) {
    const session = enrollment.session;
    const key = sessionChoiceKey(session);
    const title = sessionTitle(session);
    const day = sessionDay(session);
    const start = session?.startTime || session?.sessionTemplate?.startTime || "";
    const end = session?.endTime || session?.sessionTemplate?.endTime || "";
    const time = start || end ? `${start}${end ? `–${end}` : ""}` : "";
    const room = session?.room?.name || "";
    const sortValue = sessionSortValue(session);
    const existing = byChoice.get(key) || { key, title, days: [], time, rooms: [], sortValue };
    if (sortValue < existing.sortValue) existing.sortValue = sortValue;
    if (day && !existing.days.includes(day)) existing.days.push(day);
    if (room && !existing.rooms.includes(room)) existing.rooms.push(room);
    byChoice.set(key, existing);
  }
  return [...byChoice.values()].sort((a, b) => a.sortValue.localeCompare(b.sortValue));
}
function choiceSummaryLine(choice: { days: string[]; time: string; rooms: string[] }) {
  const parts = [choice.days.join(", "), choice.time, choice.rooms.join(", ")].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Selected class";
}
function parseCustomData(raw?: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try { const parsed = JSON.parse(raw); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null; } catch { return null; }
}

function CamperDrawer({
  camper,
  campId,
  ageGroups,
  sessions,
  courses,
  onClose,
  onSaved,
  onDeleted,
  canEdit,
}: {
  camper: Camper;
  campId: string;
  ageGroups: AgeGroup[];
  sessions: CampSession[];
  courses: Course[];
  onClose: () => void;
  onSaved: (camper: Camper) => void;
  onDeleted: (id: string) => void;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(camper.id === "__new__" && canEdit);
  const isNew = camper.id === "__new__";
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: camper.firstName || "",
    lastName: camper.lastName || "",
    dateOfBirth: camper.dateOfBirth ? camper.dateOfBirth.slice(0, 10) : "",
    ageGroupId: camper.ageGroup?.id || "",
    guardianName: camper.guardianName || "",
    guardianEmail: camper.guardianEmail || "",
    guardianPhone: camper.guardianPhone || "",
    emergencyPhone: camper.emergencyPhone || "",
    tshirtSize: camper.tshirtSize || "",
    photoConsent: camper.photoConsent,
    medicalNotes: camper.medicalNotes || "",
    dietaryNotes: camper.dietaryNotes || "",
    customData: camper.customData || "",
    couponCode: camper.couponCode || "",
    campPriceCents: String(camper.campPriceCents || 0),
    discountCents: String(camper.discountCents || 0),
    platformFeeCents: String(camper.platformFeeCents || 0),
    totalPaidCents: String(camper.totalPaidCents || 0),
    paymentStatus: camper.paymentStatus || "not_required",
    pickupNumber: camper.pickupNumber || "",
  });
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>((camper.enrollments || []).map(e => e.sessionId));
  const [selectedChoiceKeys, setSelectedChoiceKeys] = useState<string[]>((camper.enrollments || []).map(e => sessionChoiceKey(e.session)).filter(key => key && key !== "missing" && !key.startsWith("mandatory|")));
  const [showSessionCatalog, setShowSessionCatalog] = useState(isNew);
  const selectedSessions = sessions.filter(session => selectedSessionIds.includes(session.id));
  const selectedKeySet = new Set(selectedChoiceKeys);
  const availableSessionGroups = buildSessionChoiceGroups(courses, form.ageGroupId, selectedKeySet);
  const availableSessionChoices = availableSessionGroups.flatMap(group => group.options);
  const selectedChoiceObjects = availableSessionChoices.filter(choice => (choice.sessionTemplateIds || [choice.sessionTemplateId]).some(templateId => selectedKeySet.has(`${choice.courseId}|${templateId}`)));
  const sessionGroupsToRender = showSessionCatalog
    ? availableSessionGroups
    : availableSessionGroups
        .map(group => ({ ...group, options: group.options.filter(choice => (choice.sessionTemplateIds || [choice.sessionTemplateId]).some(templateId => selectedKeySet.has(`${choice.courseId}|${templateId}`))) }))
        .filter(group => group.options.length > 0);
  const selectedChoiceCount = summarizedEnrollmentChoices(camper.enrollments || []).length || new Set(selectedSessions.map(sessionChoiceKey)).size;

  const update = (key: keyof typeof form, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === "ageGroupId") {
      setSelectedChoiceKeys([]);
      setSelectedSessionIds([]);
      setShowSessionCatalog(true);
    }
  };
  const toggleSessionChoice = (choice: SessionChoice) => {
    const templateIds = choice.sessionTemplateIds || [choice.sessionTemplateId];
    const sessionIds = choice.sessionIds || (choice.sessionId ? [choice.sessionId] : []);
    const selected = templateIds.every(templateId => selectedKeySet.has(`${choice.courseId}|${templateId}`));
    setSelectedChoiceKeys(prev => selected
      ? prev.filter(key => !templateIds.some(templateId => key === `${choice.courseId}|${templateId}`))
      : [...prev.filter(key => !templateIds.some(templateId => key.endsWith(`|${templateId}`))), ...templateIds.map(templateId => `${choice.courseId}|${templateId}`)]);
    if (sessionIds.length) setSelectedSessionIds(prev => selected
      ? prev.filter(id => !sessionIds.includes(id))
      : [...prev.filter(id => !availableSessionChoices.some(option => (option.sessionIds || []).includes(id) && templateIds.some(templateId => (option.sessionTemplateIds || []).includes(templateId)))), ...sessionIds]);
  };

  const save = async () => {
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    if (!firstName || !lastName) { setError("Student first and last name are required."); return; }
    setSaving(true); setError("");
    const res = await fetch(isNew ? `/api/camps/${campId}/campers` : `/api/camps/${campId}/campers/${camper.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        dateOfBirth: form.dateOfBirth || null,
        ageGroupId: form.ageGroupId || null,
        guardianName: form.guardianName.trim() || null,
        guardianEmail: form.guardianEmail.trim() || null,
        guardianPhone: form.guardianPhone.trim() || null,
        emergencyPhone: form.emergencyPhone.trim() || null,
        tshirtSize: form.tshirtSize || null,
        photoConsent: form.photoConsent,
        medicalNotes: form.medicalNotes.trim() || null,
        dietaryNotes: form.dietaryNotes.trim() || null,
        customData: form.customData.trim() || null,
        couponCode: form.couponCode.trim() || null,
        campPriceCents: Number(form.campPriceCents) || 0,
        discountCents: Number(form.discountCents) || 0,
        platformFeeCents: Number(form.platformFeeCents) || 0,
        totalPaidCents: Number(form.totalPaidCents) || 0,
        paymentStatus: form.paymentStatus,
        pickupNumber: form.pickupNumber.trim() || null,
        scanCode: camper.scanCode || null,
        sessionIds: selectedSessionIds,
        sessionChoices: selectedChoiceKeys.map(key => {
          const [courseId, sessionTemplateId] = key.split("|");
          return { courseId, sessionTemplateId };
        }),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) { onSaved(data); setEditing(false); }
    else setError(data.detail || data.error || "Could not update this participant.");
  };

  const remove = async () => {
    if (!confirm(`Delete ${camper.firstName} ${camper.lastName}? This removes the participant and their registration choices.`)) return;
    setDeleting(true); setError("");
    const res = await fetch(`/api/camps/${campId}/campers/${camper.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (res.ok) onDeleted(camper.id);
    else setError(data.detail || data.error || "Could not delete this participant.");
  };

  const manageIdentity = async (action: string, extra: Record<string, unknown> = {}) => {
    setSaving(true); setError("");
    const res = await fetch(`/api/camps/${campId}/campers/identity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ camperId: camper.id, action, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && data.camper) {
      onSaved(data.camper);
      setForm(prev => ({ ...prev, pickupNumber: data.camper.pickupNumber || "" }));
    } else {
      setError(data.detail || data.error || "Could not update scannable code settings.");
    }
  };

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30";
  const currentName = `${camper.firstName} ${camper.lastName}`.trim();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-berry-500 flex items-center justify-center text-white font-bold">
              {camper.firstName[0]}{camper.lastName[0]}
            </div>
            <div>
              <h2 className="font-bold text-slate-800">{currentName}</h2>
              <p className="text-xs text-slate-500">Registration submission</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && !editing && <button onClick={() => setEditing(true)} className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 text-xs font-bold hover:bg-sky-100">Edit Participant</button>}
            {canEdit && !editing && !isNew && <button onClick={remove} disabled={deleting} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 disabled:opacity-50">{deleting ? "Deleting…" : "Delete"}</button>}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">✕</button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Parent / Guardian Info</h3>
            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputCls} placeholder="Guardian name" value={form.guardianName} onChange={e => update("guardianName", e.target.value)} />
                <input className={inputCls} placeholder="Guardian email" type="email" value={form.guardianEmail} onChange={e => update("guardianEmail", e.target.value)} />
                <input className={inputCls} placeholder="Guardian phone" value={form.guardianPhone} onChange={e => update("guardianPhone", e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2.5">
                <Info label="Name" value={camper.guardianName || "—"} />
                <Info label="Email" value={camper.guardianEmail || "—"} href={camper.guardianEmail ? `mailto:${camper.guardianEmail}` : undefined} tone="sky" />
                <Info label="Phone" value={camper.guardianPhone || "—"} href={camper.guardianPhone ? `tel:${camper.guardianPhone}` : undefined} />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Student Info</h3>
            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputCls} placeholder="First name" value={form.firstName} onChange={e => update("firstName", e.target.value)} />
                <input className={inputCls} placeholder="Last name" value={form.lastName} onChange={e => update("lastName", e.target.value)} />
                <input className={inputCls} type="date" value={form.dateOfBirth} onChange={e => update("dateOfBirth", e.target.value)} />
                <select className={inputCls} value={form.ageGroupId} onChange={e => update("ageGroupId", e.target.value)}>
                  <option value="">No age group</option>
                  {ageGroups.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                </select>
                <select className={inputCls} value={form.tshirtSize} onChange={e => update("tshirtSize", e.target.value)}>
                  <option value="">No T-shirt size</option>
                  {TSHIRT_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.photoConsent} onChange={e => update("photoConsent", e.target.checked)} /> Photo consent granted</label>
              </div>
            ) : (
              <div className="space-y-2.5">
                {camper.dateOfBirth && <Info label="Age" value={`${age(camper.dateOfBirth)} years old`} />}
                <Info label="Age Group" value={camper.ageGroup?.name || "—"} />
                <Info label="T-Shirt Size" value={camper.tshirtSize || "—"} />
                <Info label="Photo Consent" value={camper.photoConsent ? "✓ Granted" : "✗ Not granted"} tone={camper.photoConsent ? "forest" : "red"} />
                <Info label="Registered" value={new Date(camper.createdAt).toLocaleDateString()} />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Pickup / Scannable Codes</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">Unique participant QR plus shared family pickup number for car-line cards.</p>
              </div>
              {!isNew && <button type="button" onClick={() => manageIdentity("ensure_identity")} disabled={saving} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-60">Ensure codes</button>}
            </div>
            {editing ? (
              <label className="mt-3 block text-xs font-bold text-slate-500">Pickup number
                <input className={inputCls + " mt-1"} placeholder="e.g. 104" value={form.pickupNumber} onChange={e => update("pickupNumber", e.target.value)} />
              </label>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="space-y-2 text-sm">
                  <Info label="Pickup #" value={camper.pickupNumber || "—"} tone="sky" />
                  <Info label="Pickup card" value={`${camper.lastName.toUpperCase()} FAMILY`} />
                  <Info label="Scan code" value={camper.scanCode ? "Generated" : "Missing"} tone={camper.scanCode ? "forest" : "red"} />
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button type="button" onClick={() => navigator.clipboard?.writeText(camper.scanCode || "")} disabled={!camper.scanCode} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 disabled:opacity-40">Copy scan code</button>
                    <button type="button" onClick={() => manageIdentity("regenerate_scan_code")} disabled={saving || isNew} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800 disabled:opacity-40">Regenerate QR</button>
                  </div>
                </div>
                <CamperScannableCode value={camper.scanCode} label="Participant QR" size={132} />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contact and Emergency Info</h3>
            {editing ? (
              <div className="space-y-3">
                <input className={inputCls} placeholder="Emergency phone" value={form.emergencyPhone} onChange={e => update("emergencyPhone", e.target.value)} />
                <textarea className={inputCls + " resize-none"} rows={3} placeholder="Medical notes" value={form.medicalNotes} onChange={e => update("medicalNotes", e.target.value)} />
                <textarea className={inputCls + " resize-none"} rows={3} placeholder="Dietary notes" value={form.dietaryNotes} onChange={e => update("dietaryNotes", e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2.5">
                <Info label="Emergency Phone" value={camper.emergencyPhone || "—"} href={camper.emergencyPhone ? `tel:${camper.emergencyPhone}` : undefined} tone="red" />
                {camper.medicalNotes && <Note label="Medical" value={camper.medicalNotes} tone="red" />}
                {camper.dietaryNotes && <Note label="Dietary" value={camper.dietaryNotes} tone="sunset" />}
                {!camper.medicalNotes && !camper.dietaryNotes && <p className="text-sm text-slate-400">No medical or dietary notes submitted.</p>}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registration Choices</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {editing
                    ? showSessionCatalog
                      ? "Showing the full class catalogue so you can add or remove choices."
                      : `Showing only this participant's ${selectedChoiceCount || selectedSessionIds.length} selected choice${(selectedChoiceCount || selectedSessionIds.length) === 1 ? "" : "s"}.`
                    : "Only classes chosen for this participant are shown here."}
                </p>
              </div>
              {editing && !isNew && (availableSessionChoices.length > selectedChoiceObjects.length || selectedChoiceObjects.length > 0) && (
                <button
                  type="button"
                  onClick={() => setShowSessionCatalog(prev => !prev)}
                  className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  {showSessionCatalog ? "Show selected only" : "Add/change classes"}
                </button>
              )}
            </div>
            {editing ? (
              <div>
                {showSessionCatalog && <p className="mb-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800">{form.ageGroupId ? `${availableSessionChoices.length} open class option${availableSessionChoices.length === 1 ? "" : "s"} available for this age group. Full classes are hidden.` : "Choose an age group above to show all eligible open class options."}</p>}
                <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-slate-100">
                {sessionGroupsToRender.length === 0 ? <p className="text-sm text-slate-400 p-3">{form.ageGroupId ? "No open class options are available for this age group." : "Choose an age group to see registration choices."}</p> : sessionGroupsToRender.map((group) => (
                  <div key={group.key} className="border-b border-slate-100 last:border-b-0">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
                      <p className="font-bold text-slate-800 text-sm">{group.time}</p>
                      <p className="text-xs text-slate-500">Choose one class for this session.</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {group.options.map((choice) => {
                        const checked = group.sessionTemplateIds.every(templateId => selectedChoiceKeys.includes(`${choice.courseId}|${templateId}`));
                        return (
                          <label key={choice.key} className={`block border-l-4 p-4 transition-all ${choice.full ? "border-slate-200 bg-slate-50 opacity-70" : checked ? "border-forest-300 bg-forest-50 ring-2 ring-forest-200" : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"}`}>
                            <div className="flex items-start gap-3">
                              <input type="radio" name={`session-${group.id}`} className="mt-1 w-4 h-4 accent-forest-500" checked={checked} disabled={choice.full && !checked} onChange={() => toggleSessionChoice(choice)} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="font-semibold text-slate-800">{choice.title}</p>
                                  <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${choice.full ? "text-slate-600 bg-slate-200 border border-slate-300" : "text-emerald-800 bg-emerald-100 border border-emerald-200"}`}>
                                    {choice.seatsLeft === null ? "Open seats" : choice.full ? "Full" : `${choice.seatsLeft} seats left`}
                                  </span>
                                </div>
                                {choice.description && <p className="text-sm text-slate-500 mt-0.5">{choice.description}</p>}
                                {choice.room && <p className="text-xs text-slate-500 mt-1">Room: {choice.room}</p>}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {summarizedEnrollmentChoices(camper.enrollments || []).length === 0 ? <p className="text-sm text-slate-400">No registration choices selected.</p> : summarizedEnrollmentChoices(camper.enrollments || []).map((choice) => (
                  <div key={choice.key} className="rounded-xl border border-slate-100 px-3 py-2">
                    <div className="text-sm font-semibold text-slate-800">{choice.title}</div>
                    <div className="text-xs text-slate-500">{choiceSummaryLine(choice)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Payment and Custom Data</h3>
            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputCls} placeholder="Coupon code" value={form.couponCode} onChange={e => update("couponCode", e.target.value)} />
                <select className={inputCls} value={form.paymentStatus} onChange={e => update("paymentStatus", e.target.value)}>{PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                <input className={inputCls} type="number" placeholder="Program price cents" value={form.campPriceCents} onChange={e => update("campPriceCents", e.target.value)} />
                <input className={inputCls} type="number" placeholder="Discount cents" value={form.discountCents} onChange={e => update("discountCents", e.target.value)} />
                <input className={inputCls} type="number" placeholder="Platform fee cents" value={form.platformFeeCents} onChange={e => update("platformFeeCents", e.target.value)} />
                <input className={inputCls} type="number" placeholder="Total paid cents" value={form.totalPaidCents} onChange={e => update("totalPaidCents", e.target.value)} />
                <textarea className={inputCls + " resize-none sm:col-span-2 font-mono"} rows={4} placeholder='Custom form data JSON' value={form.customData} onChange={e => update("customData", e.target.value)} />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <Info label="Status" value={camper.paymentStatus || "not_required"} />
                  <Info label="Coupon" value={camper.couponCode || "—"} />
                  <Info label="Program price" value={cents(camper.campPriceCents)} />
                  <Info label="Discount" value={cents(camper.discountCents)} />
                  <Info label="Platform fee" value={cents(camper.platformFeeCents)} />
                  <Info label="Total paid" value={cents(camper.totalPaidCents)} />
                </div>
                {parseCustomData(camper.customData) ? <div className="grid sm:grid-cols-2 gap-2">{Object.entries(parseCustomData(camper.customData) || {}).map(([key, value]) => <Info key={key} label={key} value={String(value ?? "—")} />)}</div> : camper.customData ? <Note label="Custom Data" value={camper.customData} tone="sunset" /> : null}
              </div>
            )}
          </section>

          {editing && (
            <div className="sticky bottom-0 bg-white border-t border-slate-100 py-4 flex gap-3">
              <button onClick={() => { if (isNew) onClose(); else setEditing(false); setError(""); }} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : isNew ? "Add Participant" : "Save Participant"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, href, tone = "slate" }: { label: string; value: string; href?: string; tone?: "slate" | "sky" | "forest" | "red" }) {
  const color = tone === "sky" ? "text-sky-600" : tone === "forest" ? "text-forest-600" : tone === "red" ? "text-red-500" : "text-slate-800";
  const content = <span className={`text-sm font-medium ${color}`}>{value}</span>;
  return <div className="flex justify-between gap-4"><span className="text-sm text-slate-500">{label}</span>{href ? <a href={href} className={`${color} hover:underline text-sm font-medium`}>{value}</a> : content}</div>;
}

function Note({ label, value, tone }: { label: string; value: string; tone: "red" | "sunset" }) {
  return <div><p className="text-xs font-medium text-slate-500 mb-1">{label}</p><p className={`text-sm text-slate-700 ${tone === "red" ? "bg-red-50" : "bg-sunset-50"} rounded-xl px-3 py-2`}>{value}</p></div>;
}

function CampersContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  const [campers, setCampers] = useState<Camper[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [sessions, setSessions] = useState<CampSession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAge, setFilterAge] = useState("");
  const [filterSize, setFilterSize] = useState("");
  const [selectedCamper, setSelectedCamper] = useState<Camper | null>(null);
  const [addingCamper, setAddingCamper] = useState(false);
  const [sortField, setSortField] = useState<"lastName" | "createdAt">("lastName");
  const [myRole, setMyRole] = useState<string | null>(null);
  const [showExtraColumns, setShowExtraColumns] = useState(false);
  const canEdit = myRole === "owner" || myRole === "admin" || myRole === "editor";

  const load = () => {
    if (!campId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/camps/${campId}/campers`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/age-groups`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/sessions`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/courses`).then((r) => r.json()),
    ]).then(([c, ag, sess, courseList]) => {
      setCampers(Array.isArray(c) ? c : []);
      setAgeGroups(Array.isArray(ag) ? ag : []);
      setSessions(Array.isArray(sess) ? sess : []);
      setCourses(Array.isArray(courseList) ? courseList : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [campId]);
  useEffect(() => {
    if (!campId) return;
    fetch("/api/camps").then(r => r.ok ? r.json() : []).then((programs) => {
      const active = Array.isArray(programs) ? programs.find((program: { id: string; myRole?: string }) => program.id === campId) : null;
      setMyRole(active?.myRole || "viewer");
    }).catch(() => setMyRole("viewer"));
  }, [campId]);

  const assignMissingPickupNumbers = async () => {
    if (!campId) return;
    const startAt = window.prompt("Start pickup numbers at", "101");
    if (startAt === null) return;
    const res = await fetch(`/api/camps/${campId}/campers/identity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign_missing_pickup_numbers", startAt: Number(startAt) || 101 }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.campers)) {
      setCampers(data.campers);
      alert(`Assigned/generated ${data.updated || 0} participant code record${data.updated === 1 ? "" : "s"}.`);
    } else {
      alert(data.detail || data.error || "Could not assign pickup numbers.");
    }
  };

  const deleteCamper = async (camper: Camper) => {
    const res = await fetch(`/api/camps/${campId}/campers/${camper.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Could not delete participant");
    setCampers(prev => prev.filter(item => item.id !== camper.id));
  };

  const filtered = campers
    .filter((c) => {
      const q = search.toLowerCase();
      const fullName = `${c.firstName} ${c.lastName}`.trim();
      const matchSearch =
        !q ||
        fullName.toLowerCase().includes(q) ||
        (c.guardianName || "").toLowerCase().includes(q) ||
        (c.guardianEmail || "").toLowerCase().includes(q) ||
        (c.pickupNumber || "").toLowerCase().includes(q) ||
        (c.scanCode || "").toLowerCase().includes(q);
      const matchAge = !filterAge || c.ageGroup?.id === filterAge;
      const matchSize = !filterSize || c.tshirtSize === filterSize;
      return matchSearch && matchAge && matchSize;
    })
    .sort((a, b) => {
      if (sortField === "lastName") return a.lastName.localeCompare(b.lastName);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  if (!campId) return <EmptyState title="Choose a program first" description="Participants are organized by program. Choose one from the dashboard to view its roster." actionHref="/dashboard" actionLabel="Go to dashboard" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Participants</h1>
          <p className="text-slate-500 text-sm mt-0.5">{campers.length} registered</p>
          {myRole === "viewer" && <p className="mt-1 text-xs font-semibold text-slate-500">You have view-only access to this program.</p>}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && <button onClick={assignMissingPickupNumbers} className="px-3 py-2 border border-slate-200 bg-white text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50">Assign Pickup #s</button>}
          {canEdit && <button onClick={() => setAddingCamper(true)} className="px-3 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800">+ Add Participant</button>}
          <button
            onClick={() => {
              const csv = [
                ["Last Name", "First Name", "Age Group", "T-Shirt", "Guardian", "Guardian Email", "Guardian Phone", "Emergency", "Photo Consent"].join(","),
                ...filtered.map((c) => [
                  c.lastName, c.firstName,
                  c.ageGroup?.name || "",
                  c.tshirtSize || "",
                  c.guardianName || "", c.guardianEmail || "",
                  c.guardianPhone || "",
                  c.emergencyPhone || "",
                  c.photoConsent ? "Yes" : "No",
                ].map((v) => `"${v}"`).join(",")),
              ].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "participants.csv"; a.click();
            }}
            className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            ↓ Export CSV
          </button>
          <button type="button" onClick={() => setShowExtraColumns(value => !value)} aria-pressed={showExtraColumns} className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
            Columns {showExtraColumns ? "▴" : "▾"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search participants, guardians..."
          className="flex-1 min-w-[200px] max-w-sm px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
        />
        <select
          value={filterAge}
          onChange={(e) => setFilterAge(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        >
          <option value="">All Age Groups</option>
          {ageGroups.map((ag) => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
        </select>
        <select
          value={filterSize}
          onChange={(e) => setFilterSize(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        >
          <option value="">All Sizes</option>
          {TSHIRT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as "lastName" | "createdAt")}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        >
          <option value="lastName">Sort: Last Name</option>
          <option value="createdAt">Sort: Newest First</option>
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {ageGroups.map((ag) => {
          const count = campers.filter((c) => c.ageGroup?.id === ag.id).length;
          return (
            <div key={ag.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <div className="text-lg font-bold text-slate-800">{count}</div>
              <div className="text-xs text-slate-500">{ag.name}</div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="camp-card p-12 text-center">
          <span className="text-5xl mb-4 block">👦</span>
          <h3 className="font-bold text-slate-700 mb-2">{search || filterAge || filterSize ? "No participants match your filters" : "No participants yet"}</h3>
          <p className="text-slate-400 text-sm">Participants will appear here once they register through the public registration form.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Participant</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Age Group</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Guardian</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Choices</th>
                {showExtraColumns && <><th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Payment</th><th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">T-Shirt</th><th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Pickup #</th><th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Photo</th></>}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((camper) => (
                <tr key={camper.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-berry-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {camper.firstName[0]}{camper.lastName[0]}
                      </div>
                      <button type="button" onClick={() => setSelectedCamper(camper)} className="truncate rounded px-1 font-medium text-slate-800 hover:bg-sky-50 hover:text-sky-700" title="Open participant editor">{`${camper.firstName} ${camper.lastName}`.trim()}</button>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {camper.ageGroup ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {camper.ageGroup.name}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="text-slate-800">{camper.guardianName || "—"}</div>
                    <div className="text-slate-400 text-xs">{camper.guardianEmail || "—"}</div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="text-slate-800">{summarizedEnrollmentChoices(camper.enrollments || []).length} selected</div>
                    <div className="text-slate-400 text-xs max-w-[180px] truncate">{summarizedEnrollmentChoices(camper.enrollments || []).map(choice => choice.title).join(" · ") || "—"}</div>
                  </td>
                  {showExtraColumns && <><td className="px-4 py-3 hidden lg:table-cell"><div className="text-slate-800">{camper.paymentStatus || "not_required"}</div><div className="text-slate-400 text-xs">{cents(camper.totalPaidCents)}</div></td><td className="px-4 py-3 hidden lg:table-cell"><span className="text-slate-600">{camper.tshirtSize || "—"}</span></td><td className="px-4 py-3 hidden md:table-cell"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">{camper.pickupNumber || "—"}</span></td><td className="px-4 py-3 hidden md:table-cell"><span className={camper.photoConsent ? "text-forest-600" : "text-red-400"}>{camper.photoConsent ? "✓" : "✗"}</span></td></>}
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setSelectedCamper(camper)}
                        className="px-3 py-1 text-xs font-black text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        QR / Pickup
                      </button>
                      <button
                        onClick={() => setSelectedCamper(camper)}
                        className="px-3 py-1 text-xs font-medium text-sky-600 bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors"
                      >
                        View
                      </button>
                      {canEdit && <RowDeleteButton onDelete={() => deleteCamper(camper)} label={`${camper.firstName} ${camper.lastName}`} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(selectedCamper || addingCamper) && (
        <CamperDrawer
          camper={selectedCamper || {
            id: "__new__",
            firstName: "",
            lastName: "",
            fullName: "",
            photoConsent: false,
            createdAt: new Date().toISOString(),
            enrollments: [],
          }}
          campId={campId}
          ageGroups={ageGroups}
          sessions={sessions}
          courses={courses}
          onClose={() => { setSelectedCamper(null); setAddingCamper(false); }}
          onSaved={(updated) => {
            setCampers(prev => prev.some(c => c.id === updated.id) ? prev.map(c => c.id === updated.id ? updated : c) : [...prev, updated]);
            setSelectedCamper(updated);
            setAddingCamper(false);
          }}
          onDeleted={(id) => {
            setCampers(prev => prev.filter(c => c.id !== id));
            setSelectedCamper(null);
            setAddingCamper(false);
          }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

export default function CampersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <CampersContent />
    </Suspense>
  );
}
