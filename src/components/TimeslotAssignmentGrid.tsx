
"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

interface Room { id: string; name: string; capacity?: number | null; }
interface AgeGroup { id: string; name: string; noSchedule?: boolean; }
interface MandatorySession { id: string; title: string; ageGroupId: string; sessionTemplateId: string; }
interface Person { id: string; firstName: string; lastName: string; role: string; }
interface SessionTemplate { id: string; label: string | null; dayOfWeek: number | null; startTime: string; endTime: string; mandatory?: boolean; }
interface SessionGroup { key: string; label: string; startTime: string; endTime: string; ids: string[]; mandatory: boolean; }
interface Course {
  id: string;
  name: string;
  roomId: string | null;
  cap: number | null;
  room: { id: string; name: string; capacity?: number | null } | null;
  courseSessionTemplates: { sessionTemplateId?: string; sessionTemplate?: SessionTemplate }[];
  courseAgeGroups: { ageGroup: { id: string; name: string } }[];
  courseTeachers: { person: { id: string; firstName: string; lastName: string; role: string } }[];
  sessions?: { id: string; sessionTemplateId: string | null; enrolledCount: number }[];
}
interface SchedulingConflict { type: string; detail: string; activityName: string; slotLabel: string; locationNote?: string; }
type CellAvailability = { status: "scheduled" | "available" | "blocked"; label: string; title: string; className: string; conflicts: string[] };

const DAYS = ["S","M","T","W","T","F","S"];

export default function TimeslotAssignmentGrid({ campId }: { campId: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [mandatorySessions, setMandatorySessions] = useState<MandatorySession[]>([]);
  const [sessionTemplates, setSessionTemplates] = useState<SessionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignSaving, setAssignSaving] = useState<Record<string, boolean>>({});
  const [defaultSaving, setDefaultSaving] = useState<Record<string, boolean>>({});
  const [conflictToast, setConflictToast] = useState<{ courseId?: string; courseName: string; sessionLabel: string; message: string } | null>(null);
  const [activityFilter, setActivityFilter] = useState("");
  const [rowSort, setRowSort] = useState<"name" | "teacher" | "ageGroup">("name");
  const [rowSortDir, setRowSortDir] = useState<"asc" | "desc">("asc");
  const [focusAgeGroupId, setFocusAgeGroupId] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [columnPage, setColumnPage] = useState(0);
  const [quickAddByGroup, setQuickAddByGroup] = useState<Record<string, string>>({});
  const [blockedCells, setBlockedCells] = useState<Set<string>>(new Set());

  const loadGridData = () => {
    if (!campId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/camps/${campId}/courses`).then(r => r.json()),
      fetch(`/api/camps/${campId}/rooms`).then(r => r.json()),
      fetch(`/api/camps/${campId}/age-groups`).then(r => r.json()),
      fetch(`/api/camps/${campId}/persons`).then(r => r.json()),
      fetch(`/api/camps/${campId}/mandatory-sessions`).then(r => r.json()),
      fetch(`/api/camps/${campId}/session-templates`).then(r => r.json()),
    ]).then(([c, r, ag, p, ms, st]) => {
      const sorted = Array.isArray(c) ? [...c].sort((a: Course, b: Course) => a.name.localeCompare(b.name)) : [];
      setCourses(sorted);
      setRooms(Array.isArray(r) ? r : []);
      setAgeGroups(Array.isArray(ag) ? ag : []);
      setPersons(Array.isArray(p) ? p : []);
      setMandatorySessions(Array.isArray(ms) ? ms : []);
      setSessionTemplates(Array.isArray(st) ? st : []);
      setBlockedCells(new Set());
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadGridData(); }, [campId]);

  const allSessionGroups = useMemo((): SessionGroup[] => {
    const map = new Map<string, SessionGroup>();
    for (const st of sessionTemplates) {
      const key = `${st.label ?? ""}|${st.startTime}|${st.endTime}`;
      if (!map.has(key)) {
        map.set(key, { key, label: st.label ?? `${st.startTime}–${st.endTime}`, startTime: st.startTime, endTime: st.endTime, ids: [], mandatory: false });
      }
      const group = map.get(key)!;
      group.ids.push(st.id);
      group.mandatory = group.mandatory || Boolean(st.mandatory);
    }
    return Array.from(map.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [sessionTemplates]);

  const defaultSessionGroups = useMemo(() => allSessionGroups.filter(sg => sg.mandatory), [allSessionGroups]);
  const sessionGroups = useMemo(() => allSessionGroups.filter(sg => !sg.mandatory), [allSessionGroups]);

  const assignedTemplateId = (cst: { sessionTemplateId?: string; sessionTemplate?: SessionTemplate }) => cst.sessionTemplateId || cst.sessionTemplate?.id || "";

  const courseCheckedGroups = (course: Course): Set<string> => {
    const assignedIds = new Set((course.courseSessionTemplates || []).map(assignedTemplateId).filter(Boolean));
    const checked = new Set<string>();
    for (const sg of sessionGroups) {
      if (sg.ids.some(id => assignedIds.has(id))) checked.add(sg.key);
    }
    return checked;
  };

  const courseEnrollmentForGroup = (course: Course, sg: SessionGroup): number => {
    const counts = (course.sessions || [])
      .filter(s => s.sessionTemplateId && sg.ids.includes(s.sessionTemplateId))
      .map(s => s.enrolledCount || 0);
    return counts.length ? Math.max(...counts) : 0;
  };

  const courseCapacityForGroup = (course: Course, sg: SessionGroup): number => courseCheckedGroups(course).has(sg.key) ? (course.cap || 0) : 0;

  const sessionGroupStats = (sg: SessionGroup) => {
    const assignedCourses = courses.filter(c => courseCheckedGroups(c).has(sg.key));
    const totalCap = assignedCourses.reduce((sum, c) => sum + (c.cap || 0), 0);
    const registered = assignedCourses.reduce((sum, c) => sum + courseEnrollmentForGroup(c, sg), 0);
    return { assignedCount: assignedCourses.length, totalCap, registered, remaining: Math.max(totalCap - registered, 0), fillRate: totalCap > 0 ? registered / totalCap : 0 };
  };

  const averageAssignedCapacity = useMemo(() => {
    const stats = sessionGroups.map(sessionGroupStats).filter(s => s.assignedCount > 0);
    if (stats.length === 0) return 0;
    return stats.reduce((sum, s) => sum + s.totalCap, 0) / stats.length;
  }, [courses, sessionGroups]);

  const hasRegistrations = useMemo(() => courses.some(c => (c.sessions || []).some(s => (s.enrolledCount || 0) > 0)), [courses]);

  const courseTeacherName = (course: Course): string => {
    const teacher = course.courseTeachers.find(ct => ct.person.role === "teacher" || ct.person.role === "director")?.person
      || course.courseTeachers[0]?.person;
    return teacher ? `${teacher.lastName} ${teacher.firstName}` : "zzzz unassigned";
  };

  const courseAgeGroupLabel = (course: Course): string =>
    course.courseAgeGroups?.map(cag => cag.ageGroup.name).sort((a, b) => a.localeCompare(b))[0] || "zzzz no age group";

  const leadTeacherId = (course: Course): string =>
    course.courseTeachers.find(ct => ct.person.role === "teacher" || ct.person.role === "director")?.person.id || "";

  const assistantId = (course: Course): string =>
    course.courseTeachers.find(ct => ct.person.role === "assistant" || ct.person.role === "staff")?.person.id || "";

  const personName = (personId: string): string => {
    const person = persons.find(p => p.id === personId);
    return person ? `${person.firstName} ${person.lastName}` : "This person";
  };

  const assignedCoursesForGroup = (sg: SessionGroup): Course[] =>
    courses.filter(c => courseCheckedGroups(c).has(sg.key));

  const getCellAvailability = (course: Course, sg: SessionGroup, isChecked = courseCheckedGroups(course).has(sg.key)): CellAvailability => {
    if (isChecked) return { status: "scheduled", label: "scheduled", title: "Already scheduled in this time block", className: "", conflicts: [] };

    const conflicts: string[] = [];
    const assignedCourses = assignedCoursesForGroup(sg).filter(c => c.id !== course.id);
    const roomId = course.roomId || course.room?.id || "";
    const teacherId = leadTeacherId(course);
    const helperId = assistantId(course);

    const roomConflict = roomId ? assignedCourses.find(c => (c.roomId || c.room?.id || "") === roomId) : undefined;
    if (roomConflict) conflicts.push(`Room booked: ${course.room?.name || "selected room"} is used by ${roomConflict.name}`);

    const teacherConflict = teacherId ? assignedCourses.find(c => c.courseTeachers.some(ct => ct.person.id === teacherId)) : undefined;
    if (teacherConflict) conflicts.push(`Teacher booked: ${personName(teacherId)} is assigned to ${teacherConflict.name}`);

    const assistantConflict = helperId ? assignedCourses.find(c => c.courseTeachers.some(ct => ct.person.id === helperId)) : undefined;
    if (assistantConflict) conflicts.push(`Assistant booked: ${personName(helperId)} is assigned to ${assistantConflict.name}`);

    if (conflicts.length > 0) {
      return {
        status: "blocked",
        label: "×",
        title: conflicts.join(" • "),
        className: "cursor-not-allowed border-red-300 bg-red-100 text-red-700 opacity-85",
        conflicts,
      };
    }

    return {
      status: "available",
      label: "open",
      title: "Available to schedule — no room, teacher, or assistant conflicts detected",
      className: "border-sky-300 bg-sky-100 text-sky-800 ring-2 ring-sky-200/70 hover:border-sky-400 hover:bg-sky-200",
      conflicts: [],
    };
  };

  const courseHasAvailableSlot = (course: Course): boolean => {
    if (sessionGroups.length === 0) return false;
    return sessionGroups.some(sg => getCellAvailability(course, sg).status === "available");
  };

  const filteredCourses = useMemo(() => {
    const q = activityFilter.trim().toLowerCase();
    const filtered = courses.filter(c => {
      const teacherText = c.courseTeachers.map(ct => `${ct.person.firstName} ${ct.person.lastName}`).join(" ").toLowerCase();
      const ageText = c.courseAgeGroups.map(cag => cag.ageGroup.name).join(" ").toLowerCase();
      const haystack = `${c.name} ${c.room?.name || ""} ${teacherText} ${ageText}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (focusAgeGroupId && !c.courseAgeGroups?.some(cag => cag.ageGroup.id === focusAgeGroupId)) return false;
      if (roomFilter && (c.roomId || c.room?.id || "") !== roomFilter) return false;
      if (teacherFilter && !c.courseTeachers?.some(ct => ct.person.id === teacherFilter)) return false;
      if (availableOnly && !courseHasAvailableSlot(c)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const av = rowSort === "teacher" ? courseTeacherName(a) : rowSort === "ageGroup" ? courseAgeGroupLabel(a) : a.name;
      const bv = rowSort === "teacher" ? courseTeacherName(b) : rowSort === "ageGroup" ? courseAgeGroupLabel(b) : b.name;
      const primary = av.localeCompare(bv);
      const result = primary !== 0 ? primary : a.name.localeCompare(b.name);
      return rowSortDir === "asc" ? result : -result;
    });
  }, [courses, activityFilter, rowSort, rowSortDir, focusAgeGroupId, roomFilter, teacherFilter, availableOnly, sessionGroups]);

  const pageSize = 7;
  const totalColumnPages = Math.max(1, Math.ceil(sessionGroups.length / pageSize));
  const visibleSessionGroups = useMemo(() => sessionGroups.slice(columnPage * pageSize, columnPage * pageSize + pageSize), [sessionGroups, columnPage]);

  useEffect(() => {
    if (columnPage > totalColumnPages - 1) setColumnPage(Math.max(totalColumnPages - 1, 0));
  }, [columnPage, totalColumnPages]);

  const heatClass = (rate: number): string => {
    if (rate >= 1) return "bg-red-100 border-red-300 text-red-800";
    if (rate >= 0.9) return "bg-rose-100 border-rose-300 text-rose-800";
    if (rate >= 0.75) return "bg-orange-100 border-orange-300 text-orange-800";
    if (rate >= 0.5) return "bg-amber-100 border-amber-300 text-amber-800";
    return "bg-emerald-100 border-emerald-300 text-emerald-800";
  };

  const columnHeatClass = (sg: SessionGroup): string => {
    const stats = sessionGroupStats(sg);
    if (stats.totalCap === 0) return "bg-slate-50 border-slate-200 text-slate-500";
    if (hasRegistrations) return heatClass(stats.fillRate);
    if (averageAssignedCapacity <= 0) return "bg-emerald-100 border-emerald-300 text-emerald-800";
    const capacityRatio = stats.totalCap / averageAssignedCapacity;
    if (capacityRatio < 0.55) return "bg-red-100 border-red-300 text-red-800";
    if (capacityRatio < 0.75) return "bg-orange-100 border-orange-300 text-orange-800";
    if (capacityRatio < 0.9) return "bg-amber-100 border-amber-300 text-amber-800";
    return "bg-emerald-100 border-emerald-300 text-emerald-800";
  };

  const activeCellClass = (course: Course, sg: SessionGroup): string => {
    const cap = course.cap || 0;
    if (cap <= 0) return "border-slate-300 bg-slate-100 text-slate-700";
    const rate = courseEnrollmentForGroup(course, sg) / cap;
    if (rate >= 1) return "border-red-300 bg-red-100 text-red-800";
    if (rate >= 0.9) return "border-rose-300 bg-rose-100 text-rose-800";
    if (rate >= 0.75) return "border-orange-300 bg-orange-100 text-orange-800";
    if (rate >= 0.5) return "border-amber-300 bg-amber-100 text-amber-800";
    return "border-emerald-300 bg-emerald-100 text-emerald-800";
  };

  const teacherOptions = persons.filter(p => p.role === "teacher" || p.role === "director");
  const assistantOptions = persons.filter(p => p.role === "assistant" || p.role === "staff");
  const allPersonOptions = persons.filter(p => p.role === "teacher" || p.role === "director" || p.role === "assistant" || p.role === "staff");

  const replaceCourse = (updated: Course) => setCourses(prev => prev.map(c => c.id === updated.id ? updated : c));

  const isColumnFull = (sg: SessionGroup): boolean => courses.length > 0 && courses.every(c => courseCheckedGroups(c).has(sg.key));

  const cellKey = (courseId: string, groupKey: string) => `${courseId}:${groupKey}`;

  const simpleConflictMessage = (conflicts: SchedulingConflict[]): string => {
    const conflict = conflicts.find(c => c.type === "teacher") || conflicts.find(c => c.type === "room") || conflicts[0];
    if (!conflict) return "That time slot is already taken.";
    if (conflict.type === "teacher") return `${conflict.detail} is already teaching ${conflict.activityName} during this time.`;
    if (conflict.type === "room") return `${conflict.detail} is already booked by ${conflict.activityName} during this time.`;
    return conflict.detail || "That time slot is already taken.";
  };

  const toggleSlotGroup = async (course: Course, group: SessionGroup, checked: boolean) => {
    const saveKey = cellKey(course.id, group.key);
    setAssignSaving(prev => ({ ...prev, [saveKey]: true }));
    setConflictToast(null);

    const assignedIds = new Set((course.courseSessionTemplates || []).map(assignedTemplateId).filter(Boolean));
    const newIds = checked
      ? [...assignedIds, ...group.ids.filter(id => !assignedIds.has(id))]
      : [...assignedIds].filter(id => !group.ids.includes(id));

    try {
      const res = await fetch(`/api/camps/${campId}/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionTemplateIds: newIds }),
      });
      if (!res.ok) {
        const d = await res.json();
        if (d.error === "scheduling_conflict" && Array.isArray(d.conflicts)) {
          setBlockedCells(prev => new Set(prev).add(saveKey));
          setConflictToast({ courseId: course.id, courseName: course.name, sessionLabel: group.label, message: simpleConflictMessage(d.conflicts) });
        } else {
          setConflictToast({ courseId: course.id, courseName: course.name, sessionLabel: group.label, message: d.error || "Could not update this assignment." });
        }
      } else {
        const updated = await res.json();
        replaceCourse(updated as Course);
      }
    } catch {
      setConflictToast({ courseId: course.id, courseName: course.name, sessionLabel: group.label, message: "Network error. Please try again." });
    } finally {
      setAssignSaving(prev => { const n = { ...prev }; delete n[saveKey]; return n; });
    }
  };

  const toggleColumnAll = async (sg: SessionGroup, enable: boolean) => {
    for (const course of courses) {
      const alreadyOn = courseCheckedGroups(course).has(sg.key);
      if (enable === alreadyOn) continue;
      if (enable && getCellAvailability(course, sg, alreadyOn).status === "blocked") continue;
      await toggleSlotGroup(course, sg, enable);
    }
  };

  const setDefaultForGroup = async (sg: SessionGroup, enable: boolean) => {
    if (enable) {
      setConflictToast({ courseName: "Locked schedule session", sessionLabel: sg.label, message: "Lock schedule blocks from the Time Slots tab so you can choose the required location first." });
      return;
    }
    setDefaultSaving(prev => ({ ...prev, [sg.key]: true }));
    setConflictToast(null);
    try {
      // A default/all-camp session should not also be wired to individual activity checkboxes.
      // Remove those course links first so the required/default assignment can own the slot cleanly.
      if (enable) {
        await Promise.all(courses.map(course => {
          const assignedIds = new Set((course.courseSessionTemplates || []).map(assignedTemplateId).filter(Boolean));
          const hasGroup = sg.ids.some(id => assignedIds.has(id));
          if (!hasGroup) return Promise.resolve();
          const newIds = [...assignedIds].filter(id => !sg.ids.includes(id));
          return fetch(`/api/camps/${campId}/courses/${course.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionTemplateIds: newIds }),
          });
        }));
      }

      await Promise.all(sg.ids.map(id =>
        fetch(`/api/camps/${campId}/session-templates/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mandatory: enable }),
        })
      ));

      if (enable) {
        const scheduleAgeGroups = ageGroups.filter(ag => !ag.noSchedule);
        const existingKeys = new Set(mandatorySessions.map(ms => `${ms.ageGroupId}:${ms.sessionTemplateId}`));
        await Promise.all(sg.ids.flatMap(sessionTemplateId =>
          scheduleAgeGroups
            .filter(ageGroup => !existingKeys.has(`${ageGroup.id}:${sessionTemplateId}`))
            .map(ageGroup => fetch(`/api/camps/${campId}/mandatory-sessions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: sg.label, ageGroupId: ageGroup.id, sessionTemplateId }),
            }))
        ));
      } else {
        const generatedDefaults = mandatorySessions.filter(ms => sg.ids.includes(ms.sessionTemplateId) && ms.title === sg.label);
        await Promise.all(generatedDefaults.map(ms =>
          fetch(`/api/camps/${campId}/mandatory-sessions/${ms.id}`, { method: "DELETE" })
        ));
      }

      loadGridData();
    } catch {
      setConflictToast({ courseName: "Locked schedule session", sessionLabel: sg.label, message: "Could not update this locked schedule session. Please try again." });
    } finally {
      setDefaultSaving(prev => { const n = { ...prev }; delete n[sg.key]; return n; });
    }
  };

  const patchCourse = async (course: Course, body: Record<string, unknown>) => {
    setBlockedCells(new Set());
    const res = await fetch(`/api/camps/${campId}/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) replaceCourse(await res.json() as Course);
    else {
      const d = await res.json().catch(() => ({}));
      if (d.error === "scheduling_conflict" && Array.isArray(d.conflicts)) {
        setConflictToast({ courseId: course.id, courseName: course.name, sessionLabel: "Details", message: simpleConflictMessage(d.conflicts) });
      } else {
        setConflictToast({ courseId: course.id, courseName: course.name, sessionLabel: "Details", message: d.error || "Could not update this activity." });
      }
    }
  };

  const updateRoom = async (course: Course, roomId: string) => {
    await patchCourse(course, { roomId: roomId || null });
  };

  const updateLeadTeacher = async (course: Course, personId: string) => {
    const helperId = assistantId(course);
    const teacherIds = [personId, helperId].filter(Boolean);
    await patchCourse(course, { teacherIds });
  };

  const updateAssistant = async (course: Course, personId: string) => {
    const leadId = leadTeacherId(course);
    const teacherIds = [leadId, personId].filter(Boolean);
    await patchCourse(course, { teacherIds });
  };

  const updateCap = async (course: Course, value: string) => {
    const nextCap = Number(value);
    if (Number.isFinite(nextCap) && nextCap > 0 && nextCap !== (course.cap || 0)) {
      await patchCourse(course, { cap: nextCap });
    }
  };

  const quickAddCourseToGroup = async (sg: SessionGroup) => {
    const courseId = quickAddByGroup[sg.key];
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    await toggleSlotGroup(course, sg, true);
    setQuickAddByGroup(prev => ({ ...prev, [sg.key]: "" }));
  };

  if (loading) return (
    <div className="camp-card p-8 mb-5 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="camp-card p-4 mb-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">▦</span>
            Visual Schedule Builder
          </h2>
          <p className="text-xs text-slate-500 mt-1">Put the pieces together visually: choose a time block, drop in activities, confirm room + teacher, and keep the detailed grid one click away.</p>
        </div>
        <span className="text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-3 py-1 whitespace-nowrap">
          {sessionGroups.length} time blocks · {defaultSessionGroups.length} locked
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
        <span className="font-black uppercase tracking-wide text-slate-500">At a glance</span>
        <span className="rounded-full bg-white px-2.5 py-1 font-bold text-berry-700 shadow-sm">{teacherOptions.length} teachers</span>
        <span className="rounded-full bg-white px-2.5 py-1 font-bold text-sky-700 shadow-sm">{sessionGroups.length} time rows</span>
        <span className="rounded-full bg-white px-2.5 py-1 font-bold text-forest-700 shadow-sm">{courses.length} activities</span>
        <span className="rounded-full bg-white px-2.5 py-1 font-bold text-amber-700 shadow-sm">{ageGroups.length} age groups</span>
      </div>

      {allSessionGroups.length > 0 && (
        <details className="mb-3 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2">
          <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-wide text-amber-900">
            <span className="inline-flex items-center gap-2">🔒 Locked schedule sessions <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-amber-700">{defaultSessionGroups.length} locked</span></span>
            <span className="ml-2 text-[11px] font-semibold normal-case tracking-normal text-amber-700">click to edit</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-amber-100 pt-2">
            {allSessionGroups.map(sg => {
              const days = sessionTemplates.filter(st => sg.ids.includes(st.id) && st.dayOfWeek !== null).map(st => DAYS[st.dayOfWeek!]).join(", ");
              const saving = defaultSaving[sg.key];
              return (
                <button
                  key={sg.key}
                  type="button"
                  disabled={saving}
                  onClick={() => setDefaultForGroup(sg, !sg.mandatory)}
                  title={sg.mandatory ? "Unlock this time block for activity scheduling again" : "Lock this time block onto everyone’s schedule"}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all disabled:opacity-60 ${sg.mandatory ? "border-amber-300 bg-white text-amber-900" : "border-slate-200 bg-white/70 text-slate-600 hover:border-sky-200 hover:text-sky-700"}`}
                >
                  {sg.mandatory ? "Locked" : "Open"} · {sg.label} · {sg.startTime}–{sg.endTime}{days ? ` · ${days}` : ""}
                </button>
              );
            })}
          </div>
        </details>
      )}

      {allSessionGroups.length === 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <span className="text-lg">🕐</span>
          <span>No time slots set up yet. Create the camp&apos;s base times in <strong>Camp Setup</strong>, then assign activities here.</span>
        </div>
      )}

      {courses.length === 0 && sessionGroups.length > 0 && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500">
          <span className="text-lg">📭</span>
          <span>No activities yet — add one above or import a spreadsheet first.</span>
        </div>
      )}

      {courses.length > 0 && sessionGroups.length === 0 && allSessionGroups.length > 0 && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500">
          <span className="text-lg">✅</span>
          <span>All time slots are locked to the schedule. Unlock a row in Time Slots to make that slot assignable to activities.</span>
        </div>
      )}

      {courses.length > 0 && sessionGroups.length > 0 && (
        <>
          <div className="mb-3 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 xl:grid-cols-[minmax(220px,1fr)_auto] xl:items-center">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input type="text" value={activityFilter} onChange={e => setActivityFilter(e.target.value)} placeholder="Search activity, teacher, room, or age…" className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30 bg-white" />
              {activityFilter && <button onClick={() => setActivityFilter("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={rowSort} onChange={e => setRowSort(e.target.value as "name" | "teacher" | "ageGroup")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/30">
                <option value="name">Sort: activity</option>
                <option value="teacher">Sort: teacher</option>
                <option value="ageGroup">Sort: age group</option>
              </select>
              <button type="button" onClick={() => setRowSortDir(dir => dir === "asc" ? "desc" : "asc")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-sky-50">{rowSortDir === "asc" ? "A→Z" : "Z→A"}</button>
              <select value={focusAgeGroupId} onChange={e => setFocusAgeGroupId(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/30">
                <option value="">Age: all</option>
                {ageGroups.map(ageGroup => <option key={ageGroup.id} value={ageGroup.id}>Age: {ageGroup.name}</option>)}
              </select>
              <select value={roomFilter} onChange={e => setRoomFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/30">
                <option value="">Room: all</option>
                {rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
              <select value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/30">
                <option value="">Person: all</option>
                {allPersonOptions.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
              <button type="button" onClick={() => setAvailableOnly(v => !v)} className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${availableOnly ? "border-emerald-300 bg-emerald-100 text-emerald-800" : "border-slate-200 bg-white text-slate-500 hover:bg-emerald-50"}`}>
                {availableOnly ? "Can schedule only" : "Show all classes"}
              </button>
              {(activityFilter || focusAgeGroupId || roomFilter || teacherFilter || availableOnly || rowSort !== "name" || rowSortDir !== "asc") && (
                <button type="button" onClick={() => { setActivityFilter(""); setFocusAgeGroupId(""); setRoomFilter(""); setTeacherFilter(""); setAvailableOnly(false); setRowSort("name"); setRowSortDir("asc"); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-400 hover:text-slate-700">Reset</button>
              )}
              <span className="text-xs font-semibold text-slate-400">{filteredCourses.length}/{courses.length}</span>
            </div>
          </div>

          {conflictToast && !conflictToast.courseId && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg flex-shrink-0">🚫</span>
                  <div>
                    <p className="text-sm font-semibold text-red-800">Can&apos;t assign <span className="italic">{conflictToast.courseName}</span> to <span className="italic">{conflictToast.sessionLabel}</span></p>
                    <p className="text-xs text-red-700 mt-1">{conflictToast.message}</p>
                  </div>
                </div>
                <button onClick={() => setConflictToast(null)} className="text-red-400 hover:text-red-600 flex-shrink-0 text-lg leading-none">✕</button>
              </div>
            </div>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800">Activity scheduling grid</h3>
                <p className="text-xs text-slate-500">One row per activity. Pick room, teacher, seats, and time cells without opening extra blocks.</p>
              </div>
              <span className="text-xs font-bold text-slate-400">{filteredCourses.length} rows × {visibleSessionGroups.length}/{sessionGroups.length} blocks</span>
            </div>
            {totalColumnPages > 1 && (
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-xs">
                <button type="button" disabled={columnPage === 0} onClick={() => setColumnPage(p => Math.max(p - 1, 0))} className="rounded-lg border border-slate-200 px-2.5 py-1 font-bold text-slate-600 disabled:opacity-40">← Previous blocks</button>
                <span className="font-bold text-slate-500">Block page {columnPage + 1} of {totalColumnPages}</span>
                <button type="button" disabled={columnPage >= totalColumnPages - 1} onClick={() => setColumnPage(p => Math.min(p + 1, totalColumnPages - 1))} className="rounded-lg border border-slate-200 px-2.5 py-1 font-bold text-slate-600 disabled:opacity-40">Next blocks →</button>
              </div>
            )}
            <div className="overflow-x-auto">
            <table className="w-full table-fixed text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-20 bg-slate-50 text-left py-3 px-4 text-xs font-semibold text-slate-500 border-b border-slate-200 w-[170px]">Activity</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 border-b border-slate-200 w-[120px]">Room</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 border-b border-slate-200 w-[120px]">Teacher</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 border-b border-slate-200 w-[120px]">Assistant</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 border-b border-slate-200 w-[72px]">Seats</th>
                  {visibleSessionGroups.map(sg => {
                    const days = sessionTemplates.filter(st => sg.ids.includes(st.id) && st.dayOfWeek !== null).map(st => DAYS[st.dayOfWeek!]).join(", ");
                    const full = isColumnFull(sg);
                    const stats = sessionGroupStats(sg);
                    const fillPct = stats.totalCap > 0 ? Math.round(stats.fillRate * 100) : 0;
                    const balanceNote = !hasRegistrations && averageAssignedCapacity > 0 && stats.totalCap > 0 ? `${Math.round((stats.totalCap / averageAssignedCapacity) * 100)}% of avg` : `${fillPct}% full`;
                    return (
                      <th key={sg.key} className={`text-center py-3 px-2 border-b w-[96px] align-top ${columnHeatClass(sg)}`}>
                        <div className="font-black text-slate-800 text-[11px] leading-tight truncate" title={sg.label}>{sg.label}</div>
                        <div className="text-slate-500 text-[10px] font-semibold">{sg.startTime}–{sg.endTime}</div>
                        {days && <div className="text-slate-400 text-[10px] font-normal truncate" title={days}>{days}</div>}
                        <div className="mt-1 text-[10px] font-bold text-slate-700">{stats.registered}/{stats.totalCap} · {stats.remaining} open</div>
                        <div className="mt-1 h-1 rounded-full bg-white/80 overflow-hidden"><div className="h-full rounded-full bg-current transition-all" style={{ width: `${Math.min(Math.max(hasRegistrations ? fillPct : stats.totalCap > 0 ? 100 : 0, 0), 100)}%` }} /></div>
                        <button type="button" onClick={() => toggleColumnAll(sg, !full)} title={`${balanceNote} — ${full ? "Remove all from this session" : "Assign all activities to this session"}`} className="mt-1 text-[10px] font-bold text-slate-500 underline decoration-dotted underline-offset-2 hover:text-sky-700">
                          {full ? "clear all" : "assign all"}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((course, i) => {
                  const checked = courseCheckedGroups(course);
                  const rowConflict = conflictToast?.courseId === course.id ? conflictToast : null;
                  return (
                    <Fragment key={course.id}>
                      {rowConflict && (
                        <tr className={i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                          <td colSpan={5 + visibleSessionGroups.length} className="border-b border-red-100 px-3 pb-1 pt-2">
                            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-left shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2">
                                  <span className="text-base flex-shrink-0">🚫</span>
                                  <div>
                                    <p className="text-sm font-semibold text-red-800">Can&apos;t assign <span className="italic">{rowConflict.courseName}</span> to <span className="italic">{rowConflict.sessionLabel}</span></p>
                                    <p className="text-xs text-red-700 mt-1">{rowConflict.message}</p>
                                  </div>
                                </div>
                                <button onClick={() => setConflictToast(null)} className="text-red-400 hover:text-red-600 flex-shrink-0 text-lg leading-none">✕</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"} hover:bg-sky-50/20 transition-colors`}>
                      <td className={`sticky left-0 z-10 py-2 px-3 border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                        <div className="font-semibold text-slate-800 text-xs">{course.name}</div>
                        {course.courseAgeGroups.length > 0 && <div className="text-xs text-berry-600 font-medium mt-0.5">{course.courseAgeGroups.map(cag => cag.ageGroup.name).join(" · ")}</div>}
                      </td>
                      <td className="py-2 px-2 border-b border-slate-100">
                        <select value={course.roomId || course.room?.id || ""} onChange={e => updateRoom(course, e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400/30 bg-white">
                          <option value="">No room</option>
                          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </td>
                      <td className="py-2 px-2 border-b border-slate-100">
                        <select value={leadTeacherId(course)} onChange={e => updateLeadTeacher(course, e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400/30 bg-white">
                          <option value="">No teacher</option>
                          {teacherOptions.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                        </select>
                      </td>
                      <td className="py-2 px-2 border-b border-slate-100">
                        <select value={assistantId(course)} onChange={e => updateAssistant(course, e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400/30 bg-white">
                          <option value="">No assistant</option>
                          {assistantOptions.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                        </select>
                      </td>
                      <td className="py-2 px-2 border-b border-slate-100 text-center">
                        <input
                          type="number"
                          min={1}
                          max={500}
                          defaultValue={course.cap || 20}
                          onBlur={e => updateCap(course, e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { e.currentTarget.value = String(course.cap || 20); e.currentTarget.blur(); } }}
                          className="mx-auto w-14 rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-center text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                        />
                        {course.room?.capacity ? <div className="text-[9px] text-slate-400">room {course.room.capacity}</div> : null}
                      </td>
                      {visibleSessionGroups.map(sg => {
                        const saveKey = cellKey(course.id, sg.key);
                        const isSaving = assignSaving[saveKey];
                        const isChecked = checked.has(sg.key);
                        const serverBlocked = blockedCells.has(saveKey) && !isChecked;
                        const availability = getCellAvailability(course, sg, isChecked);
                        const isBlocked = !isChecked && (serverBlocked || availability.status === "blocked");
                        const isAvailable = !isChecked && !isBlocked && availability.status === "available";
                        const enrolled = courseEnrollmentForGroup(course, sg);
                        const cap = course.cap || 0;
                        const seatsLeft = Math.max(cap - enrolled, 0);
                        const blockedTitle = serverBlocked ? "Blocked by a scheduling conflict" : availability.title;
                        return (
                          <td key={sg.key} className="text-center py-2 px-2 border-b border-slate-100 bg-white transition-colors">
                            {isSaving ? <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" /> : (
                              <button
                                type="button"
                                disabled={isBlocked}
                                title={isBlocked ? blockedTitle : isChecked ? `${enrolled}/${cap || "—"} registered/seats — click to remove` : availability.title}
                                onClick={() => toggleSlotGroup(course, sg, !isChecked)}
                                className={`mx-auto flex h-10 w-full min-w-0 items-center justify-center rounded-lg border-2 text-[11px] font-black shadow-sm transition-all ${
                                  isChecked
                                    ? activeCellClass(course, sg)
                                    : isBlocked
                                      ? (serverBlocked ? "cursor-not-allowed border-red-200 bg-red-50 text-red-300 opacity-60" : availability.className)
                                      : isAvailable
                                        ? availability.className
                                        : "border-dashed border-slate-200 bg-slate-50 text-slate-300 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
                                }`}
                              >
                                {isChecked ? (
                                  <span>
                                    <span className="block text-xs leading-tight">{enrolled}/{cap || "—"}</span>
                                    <span className="block text-[10px] font-semibold opacity-70">{cap > 0 ? `${seatsLeft} open` : "no cap"}</span>
                                  </span>
                                ) : isBlocked ? "×" : isAvailable ? availability.label : "+"}
                              </button>
                            )}
                          </td>
                        );
                      })}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          </section>

          <div className="text-xs text-slate-400 mt-3 flex items-center gap-4 flex-wrap">
            <span>Rows are the default view: edit room, teacher, assistant, capacity, and schedule cells in one dense sheet</span>
            <span className="basis-full h-0" />
            <span className="font-semibold text-slate-500">Capacity colors:</span>
            <span><span className="inline-block w-4 h-3 rounded bg-emerald-100 border border-emerald-300 align-middle" /> healthy</span>
            <span><span className="inline-block w-4 h-3 rounded bg-amber-100 border border-amber-300 align-middle" /> watch</span>
            <span><span className="inline-block w-4 h-3 rounded bg-orange-100 border border-orange-300 align-middle" /> tight</span>
            <span><span className="inline-block w-4 h-3 rounded bg-red-100 border border-red-300 align-middle" /> full/short</span>
            <span><span className="inline-block w-4 h-3 rounded bg-red-100 border border-red-300 align-middle" /> unavailable — hover for reason</span>
            <span><span className="inline-block w-4 h-3 rounded bg-sky-100 border border-sky-300 align-middle" /> open + safe to schedule</span>
          </div>
        </>
      )}
    </div>
  );
}
