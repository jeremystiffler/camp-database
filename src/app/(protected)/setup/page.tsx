"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { TeachersContent } from "../teachers/page";
import { ActivitiesContent } from "../activities/page";
import TimeslotAssignmentGrid from "@/components/TimeslotAssignmentGrid";
import { HelpCopy } from "@/components/HelpMode";

interface Camp {
  id: string;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  registrationOpen: boolean;
  primaryColor: string;
  accentColor: string;
}

interface AgeGroup {
  id: string;
  name: string;
  minAge?: number;
  maxAge?: number;
  color: string;
  displayOrder: number;
  noSchedule: boolean;
}

interface Room {
  id: string;
  name: string;
  capacity: number;
  description?: string;
}

interface SessionTemplate {
  id: string;
  label: string | null;
  day: string | null;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  mandatory: boolean;
}

interface PersonSummary {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface CourseSessionTemplateSummary {
  sessionTemplateId?: string;
  sessionTemplate?: { id: string };
}

interface CourseSummary {
  id: string;
  name: string;
  room?: { id: string; name: string } | null;
  cap?: number | null;
  courseAgeGroups?: unknown[];
  courseTeachers?: unknown[];
  courseSessionTemplates?: CourseSessionTemplateSummary[];
}

interface MandatorySessionSummary {
  id: string;
  title: string;
  ageGroupId: string;
  sessionTemplateId: string;
  roomId?: string | null;
}

interface SessionRow {
  key: string;
  label: string;
  startTime: string;
  endTime: string;
  mandatory: boolean;
  days: Set<number>;
  slotIds: Map<number, string>;
}

interface DraftRow {
  id: string;
  label: string;
  start: string;
  end: string;
  days: number[];
}

interface SessionRowEditDraft {
  label: string;
  start: string;
  end: string;
}

const DAY_INT_TO_NAME = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_ABBR        = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
type SetupTab = "details" | "ages" | "rooms" | "times" | "teachers" | "activities" | "schedule" | "registration" | "review";

type SetupStep = {
  key: SetupTab;
  label: string;
  shortLabel: string;
  icon: string;
  help: string;
  question: string;
  done: boolean;
  locked?: boolean;
  actionLabel?: string;
};

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="camp-card p-6 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-slate-800 text-base">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function SetupContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  const [camp,      setCamp]      = useState<Camp | null>(null);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [rooms,     setRooms]     = useState<Room[]>([]);
  const [slots,     setSlots]     = useState<SessionTemplate[]>([]);
  const [persons,   setPersons]   = useState<PersonSummary[]>([]);
  const [courses,   setCourses]   = useState<CourseSummary[]>([]);
  const [mandatorySessions, setMandatorySessions] = useState<MandatorySessionSummary[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [activeTab, setActiveTab]  = useState<SetupTab>("details");
  const [requiredRoomDrafts, setRequiredRoomDrafts] = useState<Record<string, string>>({});
  const [overrideDraftRows, setOverrideDraftRows] = useState<Record<string, boolean>>({});
  const [sessionRowDrafts, setSessionRowDrafts] = useState<Record<string, SessionRowEditDraft>>({});

  // Camp form state
  const [campName,         setCampName]         = useState("");
  const [startDate,        setStartDate]        = useState("");
  const [endDate,          setEndDate]          = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [status,           setStatus]           = useState("draft");

  // New room form
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCap,  setNewRoomCap]  = useState("30");
  const [newRoomDesc, setNewRoomDesc] = useState("");

  // New age group form
  const [newAgeName,  setNewAgeName]  = useState("");
  const [newAgeMin,   setNewAgeMin]   = useState("");
  const [newAgeMax,   setNewAgeMax]   = useState("");
  const [newAgeColor, setNewAgeColor] = useState("#6B7D5F");

  // Age group inline editing
  const [editingAgeGroupId, setEditingAgeGroupId] = useState<string | null>(null);
  const [editAgeName, setEditAgeName] = useState("");

  // Time Slots grid state
  const [weekOffset, setWeekOffset] = useState(0);
  const [draftRows,  setDraftRows]  = useState<DraftRow[]>([]);

  const load = async () => {
    if (!campId) return;
    setLoading(true);
    return Promise.all([
      fetch(`/api/camps/${campId}`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/age-groups`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/rooms`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/session-templates`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/persons`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/courses`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/mandatory-sessions`).then((r) => r.json()),
    ]).then(([c, ag, r, st, people, courseList, requiredList]) => {
      if (c && !c.error) {
        setCamp(c);
        setCampName(c.name || "");
        setStartDate(c.startDate ? c.startDate.slice(0, 10) : "");
        setEndDate(c.endDate ? c.endDate.slice(0, 10) : "");
        setRegistrationOpen(c.registrationOpen || false);
        setStatus(c.status || "draft");
      }
      setAgeGroups(Array.isArray(ag) ? ag : []);
      setRooms(Array.isArray(r) ? r : []);
      setSlots(Array.isArray(st) ? st : []);
      setPersons(Array.isArray(people) ? people : []);
      setCourses(Array.isArray(courseList) ? courseList : []);
      setMandatorySessions(Array.isArray(requiredList) ? requiredList : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [campId]);

  const refreshAndGo = async (tab: SetupTab) => {
    await load();
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Derived: all dates between startDate and endDate ──
  const campDates = useMemo(() => {
    if (!startDate || !endDate) return [];
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [ey, em, ed] = endDate.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end   = new Date(ey, em - 1, ed);
    if (start > end) return [];
    const dates: Date[] = [];
    const d = new Date(start);
    while (d <= end && dates.length < 365) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }, [startDate, endDate]);

  // Reset pagination when date range changes
  useEffect(() => { setWeekOffset(0); }, [campDates]);

  // ── Derived: 7-day window for current page ──
  const visibleDates = useMemo(
    () => campDates.slice(weekOffset * 7, weekOffset * 7 + 7),
    [campDates, weekOffset]
  );

  // ── Derived: unique days-of-week in the whole camp ──
  const campDayOfWeeks = useMemo(
    () => new Set(campDates.map(d => d.getDay())),
    [campDates]
  );

  // ── Derived: session rows grouped by label|startTime|endTime ──
  const sessionRows = useMemo((): SessionRow[] => {
    const map = new Map<string, SessionRow>();
    for (const slot of slots) {
      const key = `${slot.label ?? ""}|${slot.startTime}|${slot.endTime}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label:     slot.label ?? "",
          startTime: slot.startTime,
          endTime:   slot.endTime,
          mandatory: Boolean(slot.mandatory),
          days:    new Set(),
          slotIds: new Map(),
        });
      }
      const row = map.get(key)!;
      // A row represents the same session block across multiple days. If any
      // underlying day slot is locked, treat the whole row as locked in the UI;
      // otherwise a mixed/stale response can make the control appear to revert
      // to "Open" even though one or more day slots saved as mandatory.
      row.mandatory = row.mandatory || Boolean(slot.mandatory);
      if (slot.dayOfWeek !== null && slot.dayOfWeek !== undefined) {
        row.days.add(slot.dayOfWeek);
        row.slotIds.set(slot.dayOfWeek, slot.id);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [slots]);

  const isEveryDayForRow = (row: SessionRow) =>
    campDayOfWeeks.size > 0 && [...campDayOfWeeks].every(d => row.days.has(d));

  const rowMandatorySessions = (row: SessionRow) =>
    mandatorySessions.filter(ms => [...row.slotIds.values()].includes(ms.sessionTemplateId));

  const requiredRoomForRow = (row: SessionRow) => {
    const existingRoomId = rowMandatorySessions(row).find(ms => Boolean(ms.roomId))?.roomId || "";
    return requiredRoomDrafts[row.key] ?? existingRoomId;
  };

  const assignedTemplateId = (cst: CourseSessionTemplateSummary) => cst.sessionTemplateId || cst.sessionTemplate?.id || "";

  const clearActivitiesFromRow = async (row: SessionRow) => {
    const requiredSlotIds = new Set([...row.slotIds.values()]);
    await Promise.all(courses.map(course => {
      const currentIds = (course.courseSessionTemplates || []).map(assignedTemplateId).filter(Boolean);
      const nextIds = currentIds.filter(id => !requiredSlotIds.has(id));
      if (nextIds.length === currentIds.length) return Promise.resolve();
      return fetch(`/api/camps/${campId}/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionTemplateIds: nextIds }),
      });
    }));
  };

  const ensureRequiredSessionsForRow = async (row: SessionRow, roomId: string) => {
    if (!roomId) {
      alert("Choose a location before locking this time block to the schedule.");
      return false;
    }

    const res = await fetch(`/api/camps/${campId}/session-template-groups/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: row.label,
        startTime: row.startTime,
        endTime: row.endTime,
        sessionTemplateIds: [...row.slotIds.values()],
        mandatory: true,
        roomId,
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      alert(error?.error || "Could not save the All Schedule Lock. Please refresh the setup page and try again.");
      load();
      return false;
    }

    return true;
  };

  const clearRequiredSessionsForRow = async (row: SessionRow) => {
    const res = await fetch(`/api/camps/${campId}/session-template-groups/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: row.label,
        startTime: row.startTime,
        endTime: row.endTime,
        sessionTemplateIds: [...row.slotIds.values()],
        mandatory: false,
      }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      alert(error?.error || "Could not unlock this time block. Please refresh and try again.");
    }
  };

  const requiredModeHasChanges = (row: SessionRow) => {
    const draftedAllCamp = Boolean(overrideDraftRows[row.key]);
    const currentRoomId = rowMandatorySessions(row).find(ms => Boolean(ms.roomId))?.roomId || "";
    return draftedAllCamp || (row.mandatory && requiredRoomForRow(row) !== currentRoomId);
  };

  const lockedLocationNameForRow = (row: SessionRow) => {
    const roomId = requiredRoomForRow(row);
    return rooms.find(room => room.id === roomId)?.name || "Location needed";
  };

  const changeRequiredRoomForRow = (row: SessionRow, roomId: string) => {
    setRequiredRoomDrafts(prev => ({ ...prev, [row.key]: roomId }));
  };

  const applyRequiredModeForRow = async (row: SessionRow) => {
    const ok = await ensureRequiredSessionsForRow(row, requiredRoomForRow(row));
    if (ok) {
      setOverrideDraftRows(prev => ({ ...prev, [row.key]: false }));
      load();
    }
  };

  // ── Handlers ──

  const saveCamp = async (override?: Partial<{ registrationOpen: boolean; status: string }>) => {
    setSaving(true);
    const nextRegistrationOpen = override?.registrationOpen ?? registrationOpen;
    const nextStatus = override?.status ?? status;
    const res = await fetch(`/api/camps/${campId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: campName, startDate: startDate || null, endDate: endDate || null, registrationOpen: nextRegistrationOpen, status: nextStatus }),
    });
    setSaving(false);
    if (res.ok) {
      setRegistrationOpen(nextRegistrationOpen);
      setStatus(nextStatus);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      load();
    }
  };

  const addRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/camps/${campId}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoomName, capacity: parseInt(newRoomCap), description: newRoomDesc || undefined }),
    });
    if (res.ok) { setNewRoomName(""); setNewRoomCap("30"); setNewRoomDesc(""); load(); }
  };

  const saveRoomField = async (id: string, data: Partial<Pick<Room, "name" | "capacity" | "description">>) => {
    if ("name" in data && !data.name?.trim()) {
      alert("Room name is required.");
      load();
      return;
    }
    const res = await fetch(`/api/camps/${campId}/rooms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      alert(error?.error || "Could not save this room. Please try again.");
    }
    load();
  };

  const deleteRoom = async (id: string) => {
    if (!confirm("Delete this room?")) return;
    await fetch(`/api/camps/${campId}/rooms/${id}`, { method: "DELETE" });
    load();
  };

  const addAgeGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/camps/${campId}/age-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAgeName, minAge: newAgeMin ? parseInt(newAgeMin) : undefined, maxAge: newAgeMax ? parseInt(newAgeMax) : undefined, color: newAgeColor, displayOrder: ageGroups.length }),
    });
    if (res.ok) { setNewAgeName(""); setNewAgeMin(""); setNewAgeMax(""); load(); }
  };

  const startEditAgeGroup = (ageGroup: AgeGroup) => {
    setEditingAgeGroupId(ageGroup.id);
    setEditAgeName(ageGroup.name);
  };

  const saveAgeGroupName = async (id: string) => {
    const name = editAgeName.trim();
    if (!name) {
      alert("Age group name is required.");
      return;
    }
    const res = await fetch(`/api/camps/${campId}/age-groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      alert(error?.error || "Could not rename this age group. Please try again.");
      return;
    }
    setEditingAgeGroupId(null);
    setAgeGroups(prev => prev.map(group => group.id === id ? { ...group, name } : group));
    load();
  };

  const deleteAgeGroup = async (id: string) => {
    if (!confirm("Delete this age group?")) return;
    await fetch(`/api/camps/${campId}/age-groups/${id}`, { method: "DELETE" });
    load();
  };

  // Toggle whether a session row is locked to the schedule. Locked rows appear on every scheduled age group's schedule,
  // carry a location, and are removed from activity choice scheduling for that time block.
  const setMandatoryForRow = async (row: SessionRow, mandatory: boolean) => {
    if (mandatory) {
      const existingRoomId = requiredRoomForRow(row);
      if (existingRoomId) {
        const ok = await ensureRequiredSessionsForRow(row, existingRoomId);
        if (ok) {
          setOverrideDraftRows(prev => ({ ...prev, [row.key]: false }));
          load();
        }
      } else {
        setOverrideDraftRows(prev => ({ ...prev, [row.key]: true }));
      }
      return;
    } else {
      await clearRequiredSessionsForRow(row);
      setOverrideDraftRows(prev => ({ ...prev, [row.key]: false }));
    }
    load();
  };

  // Toggle a single day checkbox for an existing session row
  const toggleDayForSession = async (row: SessionRow, dayOfWeek: number) => {
    if (row.days.has(dayOfWeek)) {
      const slotId = row.slotIds.get(dayOfWeek);
      if (slotId) await fetch(`/api/camps/${campId}/session-templates/${slotId}`, { method: "DELETE" });
    } else {
      const roomId = row.mandatory ? requiredRoomForRow(row) : "";
      if (row.mandatory && !roomId) {
        alert("Choose a location before adding another required day.");
        return;
      }
      const res = await fetch(`/api/camps/${campId}/session-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: row.label, startTime: row.startTime, endTime: row.endTime, day: DAY_INT_TO_NAME[dayOfWeek], mandatory: row.mandatory }),
      });
      if (row.mandatory && res.ok) {
        const created = await res.json();
        await Promise.all(ageGroups.filter(ag => !ag.noSchedule).map(ageGroup =>
          fetch(`/api/camps/${campId}/mandatory-sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: row.label, ageGroupId: ageGroup.id, sessionTemplateId: created.id, roomId }),
          })
        ));
      }
    }
    load();
  };

  // Per-row "every day" toggle
  const setEveryDayForRow = async (row: SessionRow, enable: boolean) => {
    if (enable) {
      const roomId = row.mandatory ? requiredRoomForRow(row) : "";
      if (row.mandatory && !roomId) {
        alert("Choose a location before filling every required day.");
        return;
      }
      const missing = [...campDayOfWeeks].filter(d => !row.days.has(d));
      await Promise.all(missing.map(async dow => {
        const res = await fetch(`/api/camps/${campId}/session-templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: row.label, startTime: row.startTime, endTime: row.endTime, day: DAY_INT_TO_NAME[dow], mandatory: row.mandatory }),
        });
        if (row.mandatory && res.ok) {
          const created = await res.json();
          await Promise.all(ageGroups.filter(ag => !ag.noSchedule).map(ageGroup =>
            fetch(`/api/camps/${campId}/mandatory-sessions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: row.label, ageGroupId: ageGroup.id, sessionTemplateId: created.id, roomId }),
            })
          ));
        }
      }));
    } else {
      await Promise.all([...row.slotIds.values()].map(id =>
        fetch(`/api/camps/${campId}/session-templates/${id}`, { method: "DELETE" })
      ));
    }
    load();
  };

  // Delete an entire session row (all its slots)
  const deleteSessionRow = async (row: SessionRow) => {
    if (!confirm(`Delete "${row.label}" and all its scheduled days?`)) return;
    await Promise.all([...row.slotIds.values()].map(id =>
      fetch(`/api/camps/${campId}/session-templates/${id}`, { method: "DELETE" })
    ));
    load();
  };

  // Draft row management
  const addDraftRow = () => {
    const num = sessionRows.length + draftRows.length + 1;
    setDraftRows(prev => [...prev, { id: Math.random().toString(36).slice(2), label: `Session ${num}`, start: "09:00", end: "10:00", days: [] }]);
  };

  const updateDraft = (id: string, field: keyof Omit<DraftRow, "id" | "days">, value: string) => {
    setDraftRows(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const toggleDraftDay = (id: string, dayOfWeek: number) => {
    setDraftRows(prev => prev.map(d => {
      if (d.id !== id) return d;
      const days = d.days.includes(dayOfWeek) ? d.days.filter(day => day !== dayOfWeek) : [...d.days, dayOfWeek];
      return { ...d, days };
    }));
  };

  const setDraftEveryDay = (id: string, enable: boolean) => {
    setDraftRows(prev => prev.map(d => d.id === id ? { ...d, days: enable ? [...campDayOfWeeks] : [] } : d));
  };

  const removeDraft = (id: string) => setDraftRows(prev => prev.filter(d => d.id !== id));

  const sessionRowDraft = (row: SessionRow) => sessionRowDrafts[row.key] || { label: row.label, start: row.startTime, end: row.endTime };

  const updateSessionRowDraft = (row: SessionRow, field: keyof SessionRowEditDraft, value: string) => {
    setSessionRowDrafts(prev => ({ ...prev, [row.key]: { ...sessionRowDraft(row), [field]: value } }));
  };

  const sessionRowHasChanges = (row: SessionRow) => {
    const draft = sessionRowDraft(row);
    return draft.label.trim() !== row.label || draft.start !== row.startTime || draft.end !== row.endTime;
  };

  const applySessionRowChanges = async (row: SessionRow) => {
    const draft = sessionRowDraft(row);
    if (!draft.label.trim() || !draft.start || !draft.end) {
      alert("Session block needs a name, start time, and end time before applying.");
      return;
    }
    const slotResponses = await Promise.all([...row.slotIds.values()].map(id =>
      fetch(`/api/camps/${campId}/session-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: draft.label.trim(), startTime: draft.start, endTime: draft.end }),
      })
    ));
    const failedSlotUpdate = slotResponses.find(res => !res.ok);
    if (failedSlotUpdate) {
      const error = await failedSlotUpdate.json().catch(() => null);
      alert(error?.error || "Could not save this session block. Please try again.");
      load();
      return;
    }
    if (row.mandatory) {
      const requiredResponses = await Promise.all(rowMandatorySessions(row).map(ms =>
        fetch(`/api/camps/${campId}/mandatory-sessions/${ms.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: draft.label.trim() }),
        })
      ));
      const failedRequiredUpdate = requiredResponses.find(res => !res.ok);
      if (failedRequiredUpdate) {
        const error = await failedRequiredUpdate.json().catch(() => null);
        alert(error?.error || "The session time saved, but the all-schedule title did not update. Please try again.");
        load();
        return;
      }
    }
    setSessionRowDrafts(prev => {
      const next = { ...prev };
      delete next[row.key];
      return next;
    });
    load();
  };

  const applyDraftRow = async (draft: DraftRow) => {
    if (!draft.label.trim() || !draft.start || !draft.end) {
      alert("Session block needs a name, start time, and end time before applying.");
      return;
    }
    if (draft.days.length === 0) {
      alert("Choose at least one camp day before applying this session block.");
      return;
    }
    const responses = await Promise.all(draft.days.map(dow =>
      fetch(`/api/camps/${campId}/session-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: draft.label.trim(), startTime: draft.start, endTime: draft.end, day: DAY_INT_TO_NAME[dow] }),
      })
    ));
    const failedCreate = responses.find(res => !res.ok);
    if (failedCreate) {
      const error = await failedCreate.json().catch(() => null);
      alert(error?.error || "Could not create this session block. Please try again.");
      load();
      return;
    }
    setDraftRows(prev => prev.filter(d => d.id !== draft.id));
    load();
  };

  if (!campId) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center"><span className="text-4xl mb-3 block"></span><p>Select a camp to configure it.</p></div>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-berry-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const totalPages = Math.ceil(campDates.length / 7);

  const detailsDone = Boolean(campName.trim() && startDate && endDate);
  const teachersDone = persons.length > 0;
  const activitiesDone = courses.length > 0;
  const scheduledActivities = courses.filter(c => (c.courseSessionTemplates || []).length > 0).length;
  const scheduleDone = activitiesDone && scheduledActivities === courses.length;
  const registrationReady = detailsDone && ageGroups.length > 0 && rooms.length > 0 && sessionRows.length > 0 && teachersDone && activitiesDone && scheduleDone;

  const setupSteps: SetupStep[] = [
    { key: "details", label: "Camp Info", shortLabel: "Camp", icon: "1", help: "Name, dates, registration status, and basic identity.", question: "What camp am I building?", done: detailsDone, actionLabel: "Set camp info" },
    { key: "ages", label: "Age Groups", shortLabel: "Ages", icon: "2", help: "Who is this camp serving?", question: "Who is coming?", done: ageGroups.length > 0, locked: !detailsDone, actionLabel: "Add age groups" },
    { key: "rooms", label: "Rooms", shortLabel: "Rooms", icon: "3", help: "Where can activities happen?", question: "Where can things happen?", done: rooms.length > 0, locked: !detailsDone, actionLabel: "Add rooms" },
    { key: "times", label: "Time Slots", shortLabel: "Times", icon: "4", help: "Build the skeleton of each camp day.", question: "When do things happen?", done: sessionRows.length > 0, locked: !detailsDone, actionLabel: "Build day schedule" },
    { key: "teachers", label: "Teachers", shortLabel: "Teachers", icon: "5", help: "Add staff before assigning classes.", question: "Who is helping run this?", done: teachersDone, locked: rooms.length === 0 && ageGroups.length === 0, actionLabel: "Add teachers" },
    { key: "activities", label: "Activities", shortLabel: "Activities", icon: "6", help: "Create the catalog of classes and activities.", question: "What are we offering?", done: activitiesDone, locked: ageGroups.length === 0 || rooms.length === 0 || sessionRows.length === 0, actionLabel: "Create activities" },
    { key: "schedule", label: "Schedule Grid", shortLabel: "Schedule", icon: "7", help: "Assign activities to time slots with room, teacher, and capacity visible.", question: "When/where/who for each activity?", done: scheduleDone, locked: !activitiesDone, actionLabel: "Schedule activities" },
    { key: "registration", label: "Registration Form", shortLabel: "Form", icon: "8", help: "Preview the public form and decide what families fill out.", question: "How do families register?", done: registrationOpen && registrationReady, locked: !scheduleDone, actionLabel: "Prepare registration" },
    { key: "review", label: "Review & Open", shortLabel: "Review", icon: "9", help: "Run the readiness checklist before parents see it.", question: "Are we ready to open?", done: registrationOpen && registrationReady, locked: !registrationReady, actionLabel: registrationOpen ? "Review live camp" : "Open registration" },
  ];
  const completedSteps = setupSteps.filter(step => step.done).length;
  const nextStep = setupSteps.find(step => !step.done && !step.locked) || setupSteps.find(step => !step.done) || setupSteps[setupSteps.length - 1];
  const setupPercent = Math.round((completedSteps / setupSteps.length) * 100);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">First-Time Camp Setup</h1>
          <p className="text-slate-500 text-sm mt-0.5">Build the camp in the order your brain naturally asks the questions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab(nextStep.key)}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-slate-700"
          >
            Next: {nextStep.actionLabel || nextStep.label} →
          </button>
          <Link href={`/import?campId=${campId}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            Bulk import
          </Link>
        </div>
      </div>

      <div className="camp-card mb-5 overflow-hidden p-0">
        <div className="border-b border-slate-100 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="minimal-section-title">Setup progress</p>
              <h2 className="mt-1 text-lg font-black text-slate-900">{completedSteps} of {setupSteps.length} steps complete</h2>
              <p className="mt-1 text-sm text-slate-600">{nextStep.question} <span className="font-semibold text-slate-900">Start with {nextStep.label}.</span></p>
            </div>
            <div className="min-w-[220px]">
              <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500">
                <span>Readiness</span>
                <span>{setupPercent}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white shadow-inner">
                <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${setupPercent}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-0 md:grid-cols-3 xl:grid-cols-9">
          {setupSteps.map((step, index) => (
            <button
              key={step.key}
              type="button"
              disabled={step.locked}
              onClick={() => setActiveTab(step.key)}
              className={`border-b border-r border-slate-100 px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${activeTab === step.key ? "bg-slate-900 text-white" : step.done ? "bg-emerald-50/60 text-slate-700 hover:bg-emerald-50" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              <span className="mb-1 flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-wide">
                <span>{index + 1}. {step.shortLabel}</span>
                <span>{step.done ? "Done" : step.locked ? "Locked" : "Open"}</span>
              </span>
              <span className="block truncate text-sm font-black">{step.label}</span>
              <span className={`mt-0.5 block text-[11px] ${activeTab === step.key ? "text-white/60" : "text-slate-400"}`}>{step.help}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Camp Details ── */}
      {activeTab === "details" && (
      <Section title="Camp Details">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Camp Name</label>
            <input type="text" value={campName} onChange={e => setCampName(e.target.value)}
              className="w-full max-w-md px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-berry-500/30 focus:border-berry-400" />
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-berry-500/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-berry-500/30" />
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-berry-500/30">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mt-5">
              <button type="button" role="switch" aria-checked={registrationOpen}
                onClick={() => setRegistrationOpen(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${registrationOpen ? "bg-slate-900" : "bg-slate-200"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${registrationOpen ? "translate-x-5" : ""}`} />
              </button>
              <span className="text-sm font-medium text-slate-700">Registration Open</span>
            </div>
          </div>
          <button onClick={() => saveCamp()} disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${saved ? "bg-slate-900 text-white" : "bg-slate-900 text-white hover:bg-slate-800"} disabled:opacity-60`}>
            {saved ? "Saved" : saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Section>
      )}

      {/* ── Rooms ── */}
      {activeTab === "rooms" && (
      <Section title="Rooms & Locations">
        <div className="space-y-3 mb-4">
          {rooms.length === 0 && <p className="text-slate-400 text-sm">No rooms yet. Add your first room below.</p>}
          {rooms.map(room => (
            <div key={room.id} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 md:grid-cols-[minmax(180px,1.1fr)_120px_minmax(220px,1.5fr)_auto] md:items-center">
              <label className="block min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">Room / location name</span>
                <input
                  type="text"
                  defaultValue={room.name}
                  onBlur={e => {
                    const name = e.target.value.trim();
                    if (name !== room.name) saveRoomField(room.id, { name });
                  }}
                  onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-800 placeholder-[#636363] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">Capacity</span>
                <input
                  type="number"
                  min={1}
                  defaultValue={room.capacity || ""}
                  onBlur={e => saveRoomField(room.id, { capacity: e.target.value ? parseInt(e.target.value) : 0 })}
                  onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </label>
              <label className="block min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">Location / description</span>
                <input
                  type="text"
                  defaultValue={room.description || ""}
                  placeholder="e.g. North wing, second floor"
                  onBlur={e => saveRoomField(room.id, { description: e.target.value || undefined })}
                  onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 placeholder-[#636363] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </label>
              <div className="flex items-center gap-2 md:justify-end">
                <button type="button" onClick={() => deleteRoom(room.id)} className="text-slate-300 hover:text-red-500 transition-colors text-sm p-1" title="Delete">Delete</button>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={addRoom} className="flex gap-3 items-end flex-wrap pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Room Name</label>
            <input type="text" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} required placeholder="e.g. Main Hall"
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-[#636363] focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Capacity</label>
            <input type="number" value={newRoomCap} onChange={e => setNewRoomCap(e.target.value)} min={1}
              className="w-20 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-[#636363] focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Location / Description</label>
            <input type="text" value={newRoomDesc} onChange={e => setNewRoomDesc(e.target.value)} placeholder="e.g. North wing"
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-[#636363] focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
          </div>
          <button type="submit" className="minimal-button-primary">
            + Add Room
          </button>
        </form>
      </Section>
      )}

      {/* ── Age Groups ── */}
      {activeTab === "ages" && (
      <Section title="Age Groups">
        <div className="space-y-3 mb-4">
          {ageGroups.length === 0 && <p className="text-slate-400 text-sm">No age groups yet. Add your first group below.</p>}
          {ageGroups
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map(ag => (
              <div key={ag.id} className="rounded-xl bg-slate-50 px-4 py-3">
                {editingAgeGroupId === ag.id ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Age Group Name</label>
                      <input
                        type="text"
                        value={editAgeName}
                        onChange={e => setEditAgeName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveAgeGroupName(ag.id); if (e.key === "Escape") setEditingAgeGroupId(null); }}
                        autoFocus
                        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => saveAgeGroupName(ag.id)} className="minimal-button-primary">
                        Save name
                      </button>
                      <button type="button" onClick={() => setEditingAgeGroupId(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: ag.color }} />
                      <span className="font-medium text-slate-800 text-sm truncate">{ag.name}</span>
                      {(ag.minAge || ag.maxAge) && (
                        <span className="text-slate-400 text-xs whitespace-nowrap">{ag.minAge ?? "?"}-{ag.maxAge ?? "?"} yrs</span>
                      )}
                      {ag.noSchedule && (
                        <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                          No class schedule
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 sm:justify-end">
                      <label className="flex items-center gap-1.5 cursor-pointer" title="No schedule — registration, t-shirts, nametags only">
                        <button type="button" role="switch" aria-checked={ag.noSchedule}
                          onClick={async () => {
                            await fetch(`/api/camps/${campId}/age-groups/${ag.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ noSchedule: !ag.noSchedule }),
                            });
                            setAgeGroups(prev => prev.map(g => g.id === ag.id ? { ...g, noSchedule: !g.noSchedule } : g));
                          }}
                          className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${ag.noSchedule ? "bg-amber-400" : "bg-slate-200"}`}>
                          <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${ag.noSchedule ? "translate-x-4" : ""}`} />
                        </button>
                        <span className="text-xs text-slate-500 whitespace-nowrap">No classes</span>
                      </label>
                      <button type="button" onClick={() => startEditAgeGroup(ag)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-sky-50 hover:text-sky-600" title="Rename age group">Rename</button>
                      <button type="button" onClick={() => deleteAgeGroup(ag.id)} className="text-slate-300 hover:text-red-500 transition-colors text-sm p-1" title="Delete">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
        <form onSubmit={addAgeGroup} className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Group Name</label>
            <input type="text" value={newAgeName} onChange={e => setNewAgeName(e.target.value)} required placeholder="e.g. Younger Campers"
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-[#636363] focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Min Age</label>
            <input type="number" value={newAgeMin} onChange={e => setNewAgeMin(e.target.value)} min={1} placeholder="6"
              className="w-16 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-[#636363] focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Max Age</label>
            <input type="number" value={newAgeMax} onChange={e => setNewAgeMax(e.target.value)} min={1} placeholder="12"
              className="w-16 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-[#636363] focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Color</label>
            <input type="color" value={newAgeColor} onChange={e => setNewAgeColor(e.target.value)}
              className="w-10 h-9 border border-slate-200 rounded-xl cursor-pointer" />
          </div>
          <button type="submit" className="minimal-button-primary">
            + Add Group
          </button>
        </form>
      </Section>
      )}

      {/* ── Time Slots ── */}
      {activeTab === "times" && (
      <Section title="Time Slots">
        <HelpCopy title="Time slots" className="text-xs text-slate-400 mb-4">
          Each row is a session block (e.g. "Opening Assembly" or "Morning Session"). Check the specific days it runs, or use <strong>All dates</strong> for every day of camp. Use <strong>All Schedule Lock</strong> when that time block belongs on every scheduled age group&apos;s schedule with one location; locked blocks are removed from activity scheduling so nothing else can be booked then.
        </HelpCopy>

        {/* No dates warning */}
        {campDates.length === 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-4">
            <span className="text-lg"></span>
            <span>Set your camp <strong>Start Date</strong> and <strong>End Date</strong> above to use the schedule grid.</span>
          </div>
        )}

        {campDates.length > 0 && (
          <>
            {/* Pagination bar */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mb-3 px-1">
                <button
                  onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
                  disabled={weekOffset === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-sm font-semibold text-slate-600">
                  Week {weekOffset + 1} of {totalPages}
                  {visibleDates.length > 0 && (
                    <span className="font-normal text-slate-400 ml-2">
                      ({(visibleDates[0].getMonth()+1)}/{visibleDates[0].getDate()} – {(visibleDates[visibleDates.length-1].getMonth()+1)}/{visibleDates[visibleDates.length-1].getDate()})
                    </span>
                  )}
                </span>
                <button
                  onClick={() => setWeekOffset(w => Math.min(totalPages - 1, w + 1))}
                  disabled={weekOffset >= totalPages - 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            )}

            {/* Grid */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    {/* Session column header */}
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 border-b border-slate-200 w-72 min-w-[280px]">
                      Session block
                    </th>
                    <th className="text-center py-3 px-2 border-b border-slate-200 min-w-[72px] text-xs font-semibold text-slate-500">
                      All dates
                    </th>
                    {/* Date column headers */}
                    {visibleDates.map(d => (
                      <th key={d.toISOString()} className="text-center py-3 px-2 border-b border-slate-200 min-w-[72px]">
                        <div className="font-semibold text-slate-700 text-xs">{DAY_ABBR[d.getDay()]}</div>
                        <div className="text-slate-400 text-xs font-normal">{d.getMonth()+1}/{d.getDate()}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Existing session rows */}
                  {sessionRows.map((row, i) => {
                    const everyDay = isEveryDayForRow(row);
                    const overrideActive = row.mandatory || Boolean(overrideDraftRows[row.key]);
                    const editDraft = sessionRowDraft(row);
                    const hasRowChanges = sessionRowHasChanges(row);
                    const hasRequiredChanges = requiredModeHasChanges(row);
                    return (
                      <tr key={row.key} className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-sky-50/30 transition-colors`}>
                        {/* Session info cell */}
                        <td className="py-3 px-4 border-b border-slate-100">
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={editDraft.label}
                                    onChange={e => updateSessionRowDraft(row, "label", e.target.value)}
                                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xs font-semibold text-slate-800 placeholder-[#636363] focus:border-sky-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-400"
                                    placeholder="Session name"
                                  />
                                  {row.mandatory && (
                                    <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold" title={`All Schedule Lock · ${lockedLocationNameForRow(row)}`}>
                                      All Schedule Lock · {lockedLocationNameForRow(row)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="time"
                                    value={editDraft.start}
                                    onChange={e => updateSessionRowDraft(row, "start", e.target.value)}
                                    className="w-[86px] rounded-lg border border-transparent bg-transparent px-2 py-1 text-xs text-slate-500 focus:border-sky-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-400"
                                  />
                                  <span className="text-slate-300 text-xs">–</span>
                                  <input
                                    type="time"
                                    value={editDraft.end}
                                    onChange={e => updateSessionRowDraft(row, "end", e.target.value)}
                                    className="w-[86px] rounded-lg border border-transparent bg-transparent px-2 py-1 text-xs text-slate-500 focus:border-sky-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-400"
                                  />
                                  {hasRowChanges && (
                                    <button
                                      type="button"
                                      onClick={() => applySessionRowChanges(row)}
                                      className="rounded-lg bg-sky-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-sky-600"
                                    >
                                      Apply
                                    </button>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => deleteSessionRow(row)}
                                className="mt-1 text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 text-xs"
                                title="Delete session"
                              >Delete</button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pl-2">
                              <button
                                type="button"
                                onClick={() => setMandatoryForRow(row, !overrideActive)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${overrideActive ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                                title={overrideActive ? "This time block is defaulted onto every schedule. Click to make it open for activity scheduling again." : "Open: this time can be used for activity choices until you lock it to all schedules."}
                              >
                                {overrideActive ? "All Schedule Lock" : "Open"}
                              </button>
                              {overrideActive && (
                                <>
                                  <select
                                    value={requiredRoomForRow(row)}
                                    onChange={e => changeRequiredRoomForRow(row, e.target.value)}
                                    className="min-w-[140px] rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                                    title="Locked schedule blocks need a location. No teacher, capacity, or activity required."
                                  >
                                    <option value="">Choose location…</option>
                                    {rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
                                  </select>
                                  {hasRequiredChanges && (
                                    <button
                                      type="button"
                                      onClick={() => applyRequiredModeForRow(row)}
                                      className="rounded-lg bg-amber-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-600"
                                    >
                                      Apply lock
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-center py-3 px-2 border-b border-slate-100 bg-slate-50/50">
                          <input
                            type="checkbox"
                            checked={everyDay}
                            onChange={() => setEveryDayForRow(row, !everyDay)}
                            title={everyDay ? "Clear every day" : "Use every day of camp"}
                            className="w-4 h-4 rounded cursor-pointer accent-sky-500"
                          />
                        </td>
                        {/* Checkbox cells */}
                        {visibleDates.map(d => {
                          const dow = d.getDay();
                          const checked = row.days.has(dow);
                          return (
                            <td key={d.toISOString()} className="text-center py-3 px-2 border-b border-slate-100">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleDayForSession(row, dow)}
                                className="w-4 h-4 rounded cursor-pointer accent-sky-500"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* Draft (new) session rows */}
                  {draftRows.map(draft => {
                    const valid = draft.label.trim().length > 0 && draft.start && draft.end;
                    const draftEveryDay = campDayOfWeeks.size > 0 && [...campDayOfWeeks].every(dow => draft.days.includes(dow));
                    return (
                      <tr key={draft.id} className="bg-sky-50/60">
                        {/* Draft session input cell */}
                        <td className="py-3 px-4 border-b border-sky-100">
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={draft.label}
                              onChange={e => updateDraft(draft.id, "label", e.target.value)}
                              placeholder="Session name"
                              className="w-full px-2.5 py-1.5 border border-sky-200 rounded-lg text-xs text-slate-800 placeholder-[#636363] focus:outline-none focus:ring-1 focus:ring-sky-400 bg-white"
                            />
                            <div className="flex gap-1 items-center">
                              <input
                                type="time"
                                value={draft.start}
                                onChange={e => updateDraft(draft.id, "start", e.target.value)}
                                className="flex-1 px-2 py-1 border border-sky-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-400 bg-white"
                              />
                              <span className="text-slate-300 text-xs">–</span>
                              <input
                                type="time"
                                value={draft.end}
                                onChange={e => updateDraft(draft.id, "end", e.target.value)}
                                className="flex-1 px-2 py-1 border border-sky-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-400 bg-white"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => applyDraftRow(draft)}
                                disabled={!valid || draft.days.length === 0}
                                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Apply
                              </button>
                              <button
                                type="button"
                                onClick={() => removeDraft(draft.id)}
                                className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                              >
                                ✕ Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="text-center py-3 px-2 border-b border-sky-100 bg-sky-50">
                          <input
                            type="checkbox"
                            disabled={!valid}
                            checked={draftEveryDay}
                            onChange={() => setDraftEveryDay(draft.id, !draftEveryDay)}
                            title="Use every day of camp"
                            className="w-4 h-4 rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed accent-sky-500"
                          />
                        </td>
                        {/* Draft checkboxes — disabled until label+times filled */}
                        {visibleDates.map(d => (
                          <td key={d.toISOString()} className="text-center py-3 px-2 border-b border-sky-100">
                            <input
                              type="checkbox"
                              disabled={!valid}
                              checked={draft.days.includes(d.getDay())}
                              onChange={() => toggleDraftDay(draft.id, d.getDay())}
                              className="w-4 h-4 rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed accent-sky-500"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  {/* Empty state */}
                  {sessionRows.length === 0 && draftRows.length === 0 && (
                    <tr>
                      <td colSpan={visibleDates.length + 2} className="text-center py-8 text-slate-400 text-sm">
                        No sessions yet — click <strong>+ Add Session</strong> below to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={visibleDates.length + 2} className="px-4 py-3 bg-slate-50/50 rounded-b-xl border-t border-slate-200">
                      <button
                        type="button"
                        onClick={addDraftRow}
                        className="px-4 py-2 bg-sky-500 text-white rounded-xl text-sm font-semibold hover:bg-sky-600 transition-colors"
                      >
                        + Add Session
                      </button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Legend */}
            <p className="text-xs text-slate-400 mt-3 flex items-center gap-4">
              <span><strong>All</strong> = every day of camp</span>
              <span>day checkboxes save instantly</span>
            </p>
          </>
        )}
      </Section>
      )}

      {activeTab === "teachers" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <TeachersContent />
        </div>
      )}

      {activeTab === "activities" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-sky-700">Step 6 · Activity Catalog</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Add the activity basics. Schedule comes next.</h2>
                <HelpCopy title="Activity basics" className="mt-1 text-sm text-slate-600">Keep this tab simple: activity name, lead teacher, room, and total seats available. The clickable time-slot grid lives on the next tab.</HelpCopy>
              </div>
              <button
                type="button"
                onClick={() => refreshAndGo("schedule")}
                className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-slate-700"
              >
                Done — refresh & go to Schedule →
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <ActivitiesContent simpleCatalog />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => refreshAndGo("schedule")}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-slate-700"
            >
              Done — refresh everything & continue →
            </button>
          </div>
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-amber-700">Step 7 · Clickable Schedule Grid</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Click where each activity belongs.</h2>
                <HelpCopy title="Clickable schedule grid" className="mt-1 text-sm text-slate-600">Activities are rows. Time slots are columns. Click a cell to add or remove that activity from that slot — simple as setting chairs before service starts.</HelpCopy>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm">{courses.length} activities</span>
                  <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm">{scheduledActivities} scheduled</span>
                  <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm">{Math.max(courses.length - scheduledActivities, 0)} need time</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => refreshAndGo("registration")}
                className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-slate-700"
              >
                Done — refresh & go to Registration →
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <TimeslotAssignmentGrid campId={campId} />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => refreshAndGo("registration")}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-slate-700"
            >
              Done — refresh everything & continue →
            </button>
          </div>
        </div>
      )}

      {activeTab === "registration" && (
        <Section title="Registration">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <HelpCopy title="Registration preview" className="text-sm text-slate-600">Once the schedule is sane, preview what families will see. Campers will only see eligible, non-mandatory activity choices, and full classes stay protected by capacity rules.</HelpCopy>
              <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="font-bold text-slate-800">Public link:</span> /register/{campId}</div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="font-bold text-slate-800">Status:</span> {registrationOpen ? "Open" : "Closed"}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Link href={`/registration?campId=${campId}`} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-slate-700">Manage form →</Link>
              <Link href={`/register/${campId}`} target="_blank" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Preview public form</Link>
            </div>
          </div>
        </Section>
      )}

      {activeTab === "review" && (
        <Section title="Review & Open">
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {setupSteps.slice(0, 8).map(step => (
                <button key={step.key} type="button" onClick={() => setActiveTab(step.key)} className={`rounded-xl border px-3 py-2 text-left text-sm transition ${step.done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"}`}>
                  <span className="font-black">{step.done ? "Done" : "Needs"} {step.label}</span>
                  <span className="mt-0.5 block text-xs opacity-75">{step.done ? "Ready" : step.help}</span>
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <HelpCopy title="Open registration" className="text-sm text-slate-600">Opening registration makes the public form usable for families. If anything above is amber, fix that first — like Nehemiah checking the wall before opening the gates.</HelpCopy>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!registrationReady || saving}
                  onClick={() => saveCamp({ registrationOpen: true, status: "published" })}
                  className="rounded-xl bg-forest-500 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {registrationOpen ? "Registration is open" : saving ? "Opening..." : "Open registration"}
                </button>
                <Link href={`/registration?campId=${campId}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Manage registration settings</Link>
                <Link href={`/print?campId=${campId}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Print materials →</Link>
              </div>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-berry-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <SetupContent />
    </Suspense>
  );
}
