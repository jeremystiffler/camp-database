
"use client";

import { useEffect, useMemo, useState } from "react";

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

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

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
  const [conflictToast, setConflictToast] = useState<{ courseName: string; sessionLabel: string; message: string } | null>(null);
  const [activityFilter, setActivityFilter] = useState("");
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

  const filteredCourses = useMemo(() =>
    courses.filter(c => c.name.toLowerCase().includes(activityFilter.toLowerCase())),
    [courses, activityFilter]
  );

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

  const leadTeacherId = (course: Course): string =>
    course.courseTeachers.find(ct => ct.person.role === "teacher" || ct.person.role === "director")?.person.id || "";

  const teacherOptions = persons.filter(p => p.role === "teacher" || p.role === "director" || p.role === "assistant" || p.role === "staff");

  const isColumnFull = (sg: SessionGroup): boolean => courses.length > 0 && courses.every(c => courseCheckedGroups(c).has(sg.key));

  const isColumnPartial = (sg: SessionGroup): boolean => {
    if (courses.length === 0) return false;
    const count = courses.filter(c => courseCheckedGroups(c).has(sg.key)).length;
    return count > 0 && count < courses.length;
  };

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
          setConflictToast({ courseName: course.name, sessionLabel: group.label, message: simpleConflictMessage(d.conflicts) });
        } else {
          setConflictToast({ courseName: course.name, sessionLabel: group.label, message: d.error || "Could not update this assignment." });
        }
      } else {
        loadGridData();
      }
    } catch {
      setConflictToast({ courseName: course.name, sessionLabel: group.label, message: "Network error. Please try again." });
    } finally {
      setAssignSaving(prev => { const n = { ...prev }; delete n[saveKey]; return n; });
    }
  };

  const toggleColumnAll = async (sg: SessionGroup, enable: boolean) => {
    for (const course of courses) {
      const alreadyOn = courseCheckedGroups(course).has(sg.key);
      if (enable === alreadyOn) continue;
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

  const updateRoom = async (course: Course, roomId: string) => {
    setBlockedCells(new Set());
    await fetch(`/api/camps/${campId}/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: roomId || null }),
    });
    loadGridData();
  };

  const updateLeadTeacher = async (course: Course, personId: string) => {
    setBlockedCells(new Set());
    const nonLeadIds = course.courseTeachers
      .filter(ct => !(ct.person.role === "teacher" || ct.person.role === "director"))
      .map(ct => ct.person.id);
    const teacherIds = personId ? [personId, ...nonLeadIds.filter(id => id !== personId)] : nonLeadIds;
    await fetch(`/api/camps/${campId}/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherIds }),
    });
    loadGridData();
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
        <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50/70 p-3">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-amber-900">Locked schedule sessions</h3>
              <p className="text-xs text-amber-800 mt-0.5">Opening assembly, lunch, closing, or any block everyone attends. Create these in Time Slots so each locked block has a location and cannot take activity assignments.</p>
            </div>
            {defaultSessionGroups.length > 0 && <span className="text-[11px] font-semibold text-sky-700 bg-white/80 border border-sky-200 rounded-full px-2.5 py-1">{defaultSessionGroups.length} locked</span>}
          </div>
          <div className="flex flex-wrap gap-2">
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
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all disabled:opacity-60 ${sg.mandatory ? "border-amber-300 bg-white text-amber-900 shadow-sm" : "border-slate-200 bg-white/70 text-slate-600 hover:border-sky-200 hover:text-sky-700"}`}
                >
                  <span className={`relative w-8 h-4 rounded-full flex-shrink-0 ${sg.mandatory ? "bg-amber-500" : "bg-slate-200"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${sg.mandatory ? "translate-x-4" : ""}`} />
                  </span>
                  <span>
                    <span className="block text-xs font-bold">{sg.label}</span>
                    <span className="block text-[11px] opacity-75">{sg.startTime}–{sg.endTime}{days ? ` · ${days}` : ""}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
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
          <div className="mb-3 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input type="text" value={activityFilter} onChange={e => setActivityFilter(e.target.value)} placeholder="Filter activities…" className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30" />
              {activityFilter && <button onClick={() => setActivityFilter("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>}
            </div>
            {activityFilter && <span className="text-xs text-slate-400">{filteredCourses.length} of {courses.length}</span>}
          </div>

          {conflictToast && (
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

          <details className="mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-4 py-3 text-sm font-black text-slate-700 hover:text-sky-700">
              Optional visual block builder — collapsed so the row grid stays primary
            </summary>
            <div className="grid gap-4 border-t border-slate-100 p-4 xl:grid-cols-2">
            {sessionGroups.map(sg => {
              const assignedCourses = filteredCourses.filter(course => courseCheckedGroups(course).has(sg.key));
              const availableCourses = filteredCourses.filter(course => !courseCheckedGroups(course).has(sg.key));
              const stats = sessionGroupStats(sg);
              const selectedCourseId = quickAddByGroup[sg.key] || "";
              const selectedCourse = courses.find(course => course.id === selectedCourseId);
              const selectedSaving = selectedCourse ? assignSaving[cellKey(selectedCourse.id, sg.key)] : false;
              const days = sessionTemplates.filter(st => sg.ids.includes(st.id) && st.dayOfWeek !== null).map(st => DAYS[st.dayOfWeek!]).join(", ");

              return (
                <section key={sg.key} className={`rounded-3xl border-2 p-4 shadow-sm ${columnHeatClass(sg)}`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-black text-slate-900">{sg.label}</h3>
                      <p className="text-xs font-semibold text-slate-600">{sg.startTime}–{sg.endTime}{days ? ` · ${days}` : ""}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-3 py-2 text-right shadow-sm border border-white/70">
                      <div className="text-sm font-black text-slate-900">{stats.assignedCount}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">activities</div>
                    </div>
                  </div>

                  <div className="mb-3 rounded-2xl bg-white/75 border border-white/70 p-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>{stats.registered} registered</span>
                      <span>{stats.remaining} seats open</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-current transition-all" style={{ width: `${Math.min(Math.max(hasRegistrations && stats.totalCap > 0 ? Math.round(stats.fillRate * 100) : stats.totalCap > 0 ? 100 : 0, 0), 100)}%` }} />
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-slate-500">{stats.totalCap} total seats in this block</div>
                  </div>

                  <div className="space-y-2">
                    {assignedCourses.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/80 bg-white/50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                        Nothing scheduled here yet — add the first activity below.
                      </div>
                    ) : assignedCourses.map(course => {
                      const enrolled = courseEnrollmentForGroup(course, sg);
                      const cap = course.cap || 0;
                      const saveKey = cellKey(course.id, sg.key);
                      const isSaving = assignSaving[saveKey];
                      return (
                        <div key={course.id} className="rounded-2xl border border-white/80 bg-white p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-black text-slate-900 truncate">{course.name}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {course.courseAgeGroups.map(cag => <span key={cag.ageGroup.id} className="rounded-full bg-berry-50 px-2 py-0.5 text-[10px] font-bold text-berry-700 border border-berry-100">{cag.ageGroup.name}</span>)}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => toggleSlotGroup(course, sg, false)}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                              title="Remove this activity from this time block"
                            >
                              {isSaving ? "…" : "Remove"}
                            </button>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                            <label className="rounded-xl bg-slate-50 px-2.5 py-2">
                              <span className="block text-[10px] font-bold uppercase text-slate-400">Room</span>
                              <select value={course.roomId || course.room?.id || ""} onChange={e => updateRoom(course, e.target.value)} className="mt-1 w-full bg-white rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/30">
                                <option value="">No room</option>
                                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                              </select>
                            </label>
                            <label className="rounded-xl bg-slate-50 px-2.5 py-2">
                              <span className="block text-[10px] font-bold uppercase text-slate-400">Teacher</span>
                              <select value={leadTeacherId(course)} onChange={e => updateLeadTeacher(course, e.target.value)} className="mt-1 w-full bg-white rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/30">
                                <option value="">No teacher</option>
                                {teacherOptions.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                              </select>
                            </label>
                            <div className="rounded-xl bg-slate-50 px-2.5 py-2"><span className="block text-[10px] font-bold uppercase text-slate-400">Seats</span><span className="font-semibold text-slate-700">{enrolled}/{cap || "—"}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex gap-2 rounded-2xl bg-white/70 border border-white/80 p-2">
                    <select
                      value={selectedCourseId}
                      onChange={e => setQuickAddByGroup(prev => ({ ...prev, [sg.key]: e.target.value }))}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                    >
                      <option value="">Add activity to this block…</option>
                      {availableCourses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedCourseId || selectedSaving}
                      onClick={() => quickAddCourseToGroup(sg)}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-slate-700 disabled:opacity-40"
                    >
                      {selectedSaving ? "Adding…" : "Add"}
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
          </details>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800">Activity scheduling grid</h3>
                <p className="text-xs text-slate-500">One row per activity. Pick room, teacher, seats, and time cells without opening extra blocks.</p>
              </div>
              <span className="text-xs font-bold text-slate-400">{filteredCourses.length} rows × {sessionGroups.length} times</span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-20 bg-slate-50 text-left py-3 px-4 text-xs font-semibold text-slate-500 border-b border-slate-200 min-w-[190px]">Activity</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 border-b border-slate-200 min-w-[150px]">Room</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 border-b border-slate-200 min-w-[150px]">Teacher</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 border-b border-slate-200 min-w-[86px]">Seats</th>
                  {sessionGroups.map(sg => {
                    const days = sessionTemplates.filter(st => sg.ids.includes(st.id) && st.dayOfWeek !== null).map(st => DAYS[st.dayOfWeek!]).join(", ");
                    const full = isColumnFull(sg);
                    const partial = isColumnPartial(sg);
                    const stats = sessionGroupStats(sg);
                    const fillPct = stats.totalCap > 0 ? Math.round(stats.fillRate * 100) : 0;
                    const balanceNote = !hasRegistrations && averageAssignedCapacity > 0 && stats.totalCap > 0 ? `${Math.round((stats.totalCap / averageAssignedCapacity) * 100)}% of avg` : `${fillPct}% full`;
                    return (
                      <th key={sg.key} className={`text-center py-3 px-2 border-b min-w-[118px] align-top ${columnHeatClass(sg)}`}>
                        <div className="font-semibold text-slate-800 text-xs">{sg.label}</div>
                        <div className="text-slate-500 text-xs font-normal">{sg.startTime}–{sg.endTime}</div>
                        {days && <div className="text-slate-400 text-xs font-normal">{days}</div>}
                        <div className="mt-2 rounded-xl bg-white/75 border border-white/70 px-2 py-1.5 shadow-sm">
                          <div className="text-[11px] font-bold text-slate-800">{stats.totalCap} seats</div>
                          <div className="text-[10px] font-semibold text-slate-600">{stats.registered} reg · {stats.remaining} open</div>
                          <div className="mt-1 h-1.5 rounded-full bg-white/80 overflow-hidden"><div className="h-full rounded-full bg-current transition-all" style={{ width: `${Math.min(Math.max(hasRegistrations ? fillPct : stats.totalCap > 0 ? 100 : 0, 0), 100)}%` }} /></div>
                          <div className="text-[10px] font-medium text-slate-500 mt-0.5">{balanceNote}</div>
                        </div>
                        <button type="button" onClick={() => toggleColumnAll(sg, !full)} title={full ? "Remove all from this session" : "Assign all activities to this session"} className="mt-2 text-[10px] font-bold text-slate-500 underline decoration-dotted underline-offset-2 hover:text-sky-700">
                          {full ? "clear all" : partial ? "partial" : "assign all"}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((course, i) => {
                  const checked = courseCheckedGroups(course);
                  return (
                    <tr key={course.id} className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"} hover:bg-sky-50/20 transition-colors`}>
                      <td className={`sticky left-0 z-10 py-3 px-4 border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                        <div className="font-semibold text-slate-800 text-sm">{course.name}</div>
                        {course.courseAgeGroups.length > 0 && <div className="text-xs text-berry-600 font-medium mt-0.5">{course.courseAgeGroups.map(cag => cag.ageGroup.name).join(" · ")}</div>}
                      </td>
                      <td className="py-3 px-3 border-b border-slate-100">
                        <select value={course.roomId || course.room?.id || ""} onChange={e => updateRoom(course, e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400/30 bg-white">
                          <option value="">No room</option>
                          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-100">
                        <select value={leadTeacherId(course)} onChange={e => updateLeadTeacher(course, e.target.value)} className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400/30 bg-white">
                          <option value="">No teacher</option>
                          {teacherOptions.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-3 border-b border-slate-100 text-center">
                        <div className="font-bold text-slate-700 text-sm">{course.cap || "—"}</div>
                        {course.room?.capacity ? <div className="text-[10px] text-slate-400">room {course.room.capacity}</div> : null}
                      </td>
                      {sessionGroups.map(sg => {
                        const saveKey = cellKey(course.id, sg.key);
                        const isSaving = assignSaving[saveKey];
                        const isChecked = checked.has(sg.key);
                        const isBlocked = blockedCells.has(saveKey) && !isChecked;
                        const enrolled = courseEnrollmentForGroup(course, sg);
                        const cap = course.cap || 0;
                        const seatsLeft = Math.max(cap - enrolled, 0);
                        return (
                          <td key={sg.key} className="text-center py-2 px-2 border-b border-slate-100 bg-white transition-colors">
                            {isSaving ? <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" /> : (
                              <button
                                type="button"
                                disabled={isBlocked}
                                title={isBlocked ? "Blocked by a scheduling conflict" : isChecked ? `${enrolled}/${cap || "—"} registered/seats — click to remove` : "Click to schedule this activity in this time block"}
                                onClick={() => toggleSlotGroup(course, sg, !isChecked)}
                                className={`mx-auto flex h-14 min-w-[82px] items-center justify-center rounded-xl border-2 text-xs font-black shadow-sm transition-all ${
                                  isChecked
                                    ? activeCellClass(course, sg)
                                    : isBlocked
                                      ? "cursor-not-allowed border-red-200 bg-red-50 text-red-300 opacity-60"
                                      : "border-dashed border-slate-200 bg-slate-50 text-slate-300 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
                                }`}
                              >
                                {isChecked ? (
                                  <span>
                                    <span className="block text-sm leading-tight">{enrolled}/{cap || "—"}</span>
                                    <span className="block text-[10px] font-semibold opacity-70">{cap > 0 ? `${seatsLeft} open` : "no cap"}</span>
                                  </span>
                                ) : isBlocked ? "!" : "+"}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </section>

          <div className="text-xs text-slate-400 mt-3 flex items-center gap-4 flex-wrap">
            <span>Rows are the default view: edit room, teacher, capacity, and schedule cells in one dense sheet</span>
            <span>· optional visual blocks are collapsed above if you need them</span>
            <span className="basis-full h-0" />
            <span className="font-semibold text-slate-500">Capacity colors:</span>
            <span><span className="inline-block w-4 h-3 rounded bg-emerald-100 border border-emerald-300 align-middle" /> healthy</span>
            <span><span className="inline-block w-4 h-3 rounded bg-amber-100 border border-amber-300 align-middle" /> watch</span>
            <span><span className="inline-block w-4 h-3 rounded bg-orange-100 border border-orange-300 align-middle" /> tight</span>
            <span><span className="inline-block w-4 h-3 rounded bg-red-100 border border-red-300 align-middle" /> full/short</span>
          </div>
        </>
      )}
    </div>
  );
}
