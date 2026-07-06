"use client";

import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";

// ── Column definitions (no session columns) ──────────────────────────────────
const IMPORT_HEADERS = [
  "activity_name", "activity_description", "activity_capacity",
  "room_name", "age_group_name",
  "teacher_first_name", "teacher_last_name", "teacher_email", "teacher_role",
  "assistant_first_name", "assistant_last_name", "assistant_email",
];

const COLUMN_NOTES: Record<string, string> = {
  activity_name:      "Required. Unique per camp. Existing names update the activity.",
  activity_capacity:  "Number e.g. 20",
  room_name:          "Must match a room in Camp Setup (or will be created)",
  age_group_name:     "Must match an age group in Camp Setup (see Reference tab)",
  teacher_role:       "teacher  or  director",
  teacher_email:      "Optional — can add later",
  assistant_email:    "Optional — can add later",
};

const EXAMPLE_ROW = [
  "Watercolor Painting", "Learn basic watercolor techniques", "15",
  "Art Room", "Younger Campers",
  "Jane", "Smith", "jane@camp.com", "teacher",
  "Bob", "Jones", "bob@camp.com",
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface AgeGroup  { id: string; name: string; }
interface Room      { id: string; name: string; }
interface SessionTemplate {
  id: string; label: string | null; dayOfWeek: number | null;
  startTime: string; endTime: string;
}
interface SessionGroup {
  key: string; label: string; startTime: string; endTime: string; ids: string[];
}
interface Course {
  id: string; name: string; roomId: string | null; cap: number | null;
  room: { id: string; name: string } | null;
  courseSessionTemplates: { sessionTemplateId: string }[];
  courseAgeGroups: { ageGroup: { id: string; name: string } }[];
  courseTeachers: { person: { id: string; firstName: string; lastName: string; role: string } }[];
  sessions?: { id: string; sessionTemplateId: string | null; enrolledCount: number; enrollments?: { camperId: string }[] }[];
}
interface ImportResult {
  coursesCreated: number; coursesUpdated: number; teachersCreated: number;
  roomsCreated: number; ageGroupsCreated: number; errors: string[]; total: number;
}
interface SchedulingConflict {
  type: string;
  detail: string;
  activityName: string;
  slotLabel: string;
  locationNote?: string;
}

const DAY_ABBR = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── Template download — pre-populated with existing data ──────────────────────
async function downloadTemplate(campId: string) {
  const [courseRes, agRes, roomRes] = await Promise.all([
    fetch(`/api/camps/${campId}/courses`).then(r => r.json()),
    fetch(`/api/camps/${campId}/age-groups`).then(r => r.json()),
    fetch(`/api/camps/${campId}/rooms`).then(r => r.json()),
  ]);

  const courses: Course[]    = Array.isArray(courseRes) ? courseRes : [];
  const ageGroups: AgeGroup[] = Array.isArray(agRes) ? agRes : [];
  const rooms: Room[]         = Array.isArray(roomRes) ? roomRes : [];

  // ── Sheet 1: Activities ───────────────────────────────────────────────────
  const rows: (string | number)[][] = [IMPORT_HEADERS];

  if (courses.length > 0) {
    for (const c of courses) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ext = c as any;
      const leadTeacher = ext.courseTeachers?.find((ct: any) => ct.person?.role === "teacher" || ct.person?.role === "director");
      const assistant   = ext.courseTeachers?.find((ct: any) => ct.person?.role === "assistant" || ct.person?.role === "staff");
      const ag          = ext.courseAgeGroups?.[0]?.ageGroup;
      rows.push([
        c.name || "",
        ext.description || "",
        ext.cap || "",
        c.room?.name || "",
        ag?.name || "",
        leadTeacher?.person?.firstName || "",
        leadTeacher?.person?.lastName  || "",
        leadTeacher?.person?.email     || "",
        leadTeacher?.person?.role      || "",
        assistant?.person?.firstName   || "",
        assistant?.person?.lastName    || "",
        assistant?.person?.email       || "",
      ]);
    }
    // Blank rows for new entries
    rows.push([], [], []);
  } else {
    rows.push(EXAMPLE_ROW);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  ws1["!cols"] = IMPORT_HEADERS.map(h => ({ wch: Math.max(h.length + 2, 22) }));

  // ── Sheet 2: Reference ────────────────────────────────────────────────────
  const refRows: (string | number)[][] = [
    ["=== AGE GROUPS ==="],
    ["Name"],
    ...ageGroups.map(ag => [ag.name]),
    [],
    ["=== ROOMS ==="],
    ["Name"],
    ...rooms.map(r => [r.name]),
    [],
    ["=== TEACHER ROLES ==="],
    ["Role", "Description"],
    ["teacher",   "Lead teacher for the activity"],
    ["director",  "Camp director also teaching"],
    ["assistant", "Teaching assistant"],
    ["staff",     "General staff helper"],
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(refRows);
  ws2["!cols"] = [{ wch: 30 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Activities");
  XLSX.utils.book_append_sheet(wb, ws2, "Reference");

  const buf  = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "camp-activities-import.xlsx";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Main component ─────────────────────────────────────────────────────────────
function ImportContent() {
  const searchParams = useSearchParams();
  const campId       = searchParams.get("campId") || "";
  const fileRef      = useRef<HTMLInputElement>(null);

  // Upload state
  const [rows,       setRows]       = useState<Record<string, string>[]>([]);
  const [fileName,   setFileName]   = useState("");
  const [importing,  setImporting]  = useState(false);
  const [result,     setResult]     = useState<ImportResult | null>(null);
  const [dragOver,   setDragOver]   = useState(false);
  const [parseError, setParseError] = useState("");
  const [dlLoading,  setDlLoading]  = useState(false);

  // Assignment grid state
  const [courses,          setCourses]          = useState<Course[]>([]);
  const [rooms,            setRooms]            = useState<Room[]>([]);
  const [sessionTemplates, setSessionTemplates] = useState<SessionTemplate[]>([]);
  const [assignSaving,     setAssignSaving]     = useState<Record<string, boolean>>({});
  const [conflictToast,    setConflictToast]    = useState<{ courseName: string; sessionLabel: string; message: string } | null>(null);
  const [activityFilter,   setActivityFilter]   = useState("");
  const [blockedCells,     setBlockedCells]     = useState<Set<string>>(new Set());

  const loadGridData = () => {
    if (!campId) return;
    Promise.all([
      fetch(`/api/camps/${campId}/courses`).then(r => r.json()),
      fetch(`/api/camps/${campId}/rooms`).then(r => r.json()),
      fetch(`/api/camps/${campId}/session-templates`).then(r => r.json()),
    ]).then(([c, r, st]) => {
      // Sort alphabetically once on load — never reorders on room/slot changes
      const sorted = Array.isArray(c) ? [...c].sort((a: Course, b: Course) => a.name.localeCompare(b.name)) : [];
      setCourses(sorted);
      setRooms(Array.isArray(r) ? r : []);
      setSessionTemplates(Array.isArray(st) ? st : []);
      setBlockedCells(new Set());
    });
  };

  useEffect(() => { loadGridData(); }, [campId]);

  // Group session templates by label+startTime+endTime
  const sessionGroups = useMemo((): SessionGroup[] => {
    const map = new Map<string, SessionGroup>();
    for (const st of sessionTemplates) {
      const key = `${st.label ?? ""}|${st.startTime}|${st.endTime}`;
      if (!map.has(key)) {
        map.set(key, { key, label: st.label ?? `${st.startTime}–${st.endTime}`, startTime: st.startTime, endTime: st.endTime, ids: [] });
      }
      map.get(key)!.ids.push(st.id);
    }
    return Array.from(map.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [sessionTemplates]);

  // Delete selected courses
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const toggleSelectCourse = (id: string) => {
    setSelectedCourseIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedCourseIds(prev =>
      prev.size === courses.length ? new Set() : new Set(courses.map(c => c.id))
    );
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selectedCourseIds.size} activit${selectedCourseIds.size === 1 ? "y" : "ies"}? This cannot be undone.`)) return;
    setDeleting(true);
    await Promise.all([...selectedCourseIds].map(id =>
      fetch(`/api/camps/${campId}/courses/${id}`, { method: "DELETE" })
    ));
    setSelectedCourseIds(new Set());
    setDeleting(false);
    loadGridData();
  };
  const courseCheckedGroups = (course: Course): Set<string> => {
    const assignedIds = new Set(course.courseSessionTemplates.map(cst => cst.sessionTemplateId));
    const checked = new Set<string>();
    for (const sg of sessionGroups) {
      if (sg.ids.some(id => assignedIds.has(id))) checked.add(sg.key);
    }
    return checked;
  };

  const courseEnrollmentForGroup = (course: Course, sg: SessionGroup): number => {
    const matchingSessions = (course.sessions || []).filter(s => s.sessionTemplateId && sg.ids.includes(s.sessionTemplateId));
    const camperIds = new Set(matchingSessions.flatMap(s => (s.enrollments || []).map(e => e.camperId).filter(Boolean)));
    if (camperIds.size > 0) return camperIds.size;
    const counts = matchingSessions.map(s => s.enrolledCount || 0);
    return counts.length ? Math.max(...counts) : 0;
  };

  const courseCapacityForGroup = (course: Course, sg: SessionGroup): number => {
    return courseCheckedGroups(course).has(sg.key) ? (course.cap || 0) : 0;
  };

  const sessionGroupStats = (sg: SessionGroup) => {
    const assignedCourses = courses.filter(c => courseCheckedGroups(c).has(sg.key));
    const totalCap = assignedCourses.reduce((sum, c) => sum + (c.cap || 0), 0);
    const registered = assignedCourses.reduce((sum, c) => sum + courseEnrollmentForGroup(c, sg), 0);
    return {
      assignedCount: assignedCourses.length,
      totalCap,
      registered,
      remaining: Math.max(totalCap - registered, 0),
      fillRate: totalCap > 0 ? registered / totalCap : 0,
    };
  };

  const averageAssignedCapacity = useMemo(() => {
    const stats = sessionGroups.map(sessionGroupStats).filter(s => s.assignedCount > 0);
    if (stats.length === 0) return 0;
    return stats.reduce((sum, s) => sum + s.totalCap, 0) / stats.length;
  }, [courses, sessionGroups]);

  const hasRegistrations = useMemo(() => {
    return courses.some(c => (c.sessions || []).some(s => (s.enrolledCount || 0) > 0));
  }, [courses]);

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

  const cellHeatClass = (course: Course, sg: SessionGroup): string => {
    const cap = courseCapacityForGroup(course, sg);
    if (cap <= 0) return "bg-white";
    return heatClass(courseEnrollmentForGroup(course, sg) / cap);
  };

  // Is every activity assigned to this session group?
  const isColumnFull = (sg: SessionGroup): boolean => {
    if (courses.length === 0) return false;
    return courses.every(c => courseCheckedGroups(c).has(sg.key));
  };

  // Is at least one (but not all) activity assigned to this session group?
  const isColumnPartial = (sg: SessionGroup): boolean => {
    if (courses.length === 0) return false;
    const count = courses.filter(c => courseCheckedGroups(c).has(sg.key)).length;
    return count > 0 && count < courses.length;
  };

  // Toggle every activity in a session group on or off
  const toggleColumnAll = async (sg: SessionGroup, enable: boolean) => {
    for (const course of courses) {
      const checked = courseCheckedGroups(course);
      const alreadyOn = checked.has(sg.key);
      if (enable === alreadyOn) continue;
      await toggleSlotGroup(course, sg, enable);
    }
  };

  const cellKey = (courseId: string, groupKey: string) => `${courseId}:${groupKey}`;

  const simpleConflictMessage = (conflicts: SchedulingConflict[]): string => {
    const conflict = conflicts.find(c => c.type === "teacher") || conflicts.find(c => c.type === "room") || conflicts[0];
    if (!conflict) return "That time slot is already taken.";
    if (conflict.type === "teacher") {
      return `${conflict.detail} is already teaching ${conflict.activityName} during this time.`;
    }
    if (conflict.type === "room") {
      return `${conflict.detail} is already booked by ${conflict.activityName} during this time.`;
    }
    return conflict.detail || "That time slot is already taken.";
  };

  // Toggle a session group for a course
  const toggleSlotGroup = async (course: Course, group: SessionGroup, checked: boolean) => {
    const saveKey = cellKey(course.id, group.key);
    setAssignSaving(prev => ({ ...prev, [saveKey]: true }));
    setConflictToast(null);

    const assignedIds = new Set(course.courseSessionTemplates.map(cst => cst.sessionTemplateId));
    let newIds: string[];
    if (checked) {
      newIds = [...assignedIds, ...group.ids.filter(id => !assignedIds.has(id))];
    } else {
      newIds = [...assignedIds].filter(id => !group.ids.includes(id));
    }

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
          setConflictToast({
            courseName:   course.name,
            sessionLabel: group.label,
            message:      simpleConflictMessage(d.conflicts),
          });
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

  // Update room for a course
  const updateRoom = async (course: Course, roomId: string) => {
    setBlockedCells(new Set());
    await fetch(`/api/camps/${campId}/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: roomId || null }),
    });
    loadGridData();
  };

  // File parsing
  const parseFile = (file: File) => {
    setParseError(""); setResult(null); setRows([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw  = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
        if (raw.length < 2) { setParseError("File appears empty or has only a header row."); return; }
        const headers = raw[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, "_"));
        const parsed  = raw.slice(1)
          .filter(row => row.some(cell => String(cell).trim() !== ""))
          .map(row => {
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => { obj[h] = String(row[i] ?? "").trim(); });
            return obj;
          });
        setRows(parsed);
        setFileName(file.name);
      } catch {
        setParseError("Could not parse file. Make sure it's a valid .xlsx, .xls, or .csv file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const runImport = async () => {
    if (!campId || validRows.length === 0) return;
    setImporting(true);
    try {
      const res  = await fetch(`/api/camps/${campId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows }),
      });
      const data = await res.json();
      if (res.ok) { setResult(data); loadGridData(); }
      else setParseError(data.error || "Import failed");
    } catch { setParseError("Network error during import"); }
    finally { setImporting(false); }
  };

  const reset = () => {
    setRows([]); setFileName(""); setResult(null); setParseError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const validRows   = rows.filter(r => r.activity_name?.trim());
  const invalidRows = rows.filter(r => !r.activity_name?.trim());

  if (!campId) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center"><span className="text-4xl mb-3 block">📥</span><p>Select a program to import data.</p></div>
    </div>
  );

  return (
    <div className="max-w-5xl">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-800">Import</h1>
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full">BETA</span>
          </div>
          <p className="text-slate-500 text-sm">Upload a spreadsheet to bulk-create activities and teachers. Assign rooms and time slots from the Activities tab.</p>
        </div>
        <button
          onClick={async () => { setDlLoading(true); await downloadTemplate(campId); setDlLoading(false); }}
          disabled={dlLoading}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-sm flex-shrink-0 disabled:opacity-60"
        >
          {dlLoading ? <><div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> Building…</> : <>⬇️ Download Template</>}
        </button>
      </div>

      {/* ── Beta warning ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 flex items-start gap-3">
        <span className="text-xl flex-shrink-0"></span>
        <div>
          <p className="text-sm font-semibold text-amber-800">Beta Feature</p>
          <p className="text-xs text-amber-700 mt-0.5">
            The template is pre-filled with your existing activities. Rows with a matching activity name will <strong>update</strong> that activity — no duplicates.
            Time slot assignment now happens on the <strong>Activities</strong> tab so scheduling lives in one place.
          </p>
        </div>
      </div>

      {/* ── Step 1: Upload ── */}
      <div className="camp-card p-6 mb-6">
        <h2 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-forest-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
          Upload Activities
        </h2>
        <p className="text-xs text-slate-400 mb-5 ml-8">
          Download the template above (pre-filled with your existing activities), fill in new rows, and upload it here.
          No session columns needed — assign time slots on the Activities tab after upload.
        </p>

        {/* Column guide */}
        <details className="mb-5">
          <summary className="text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700 select-none mb-2">
             Column Reference (click to expand)
          </summary>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-4 text-slate-500 font-semibold whitespace-nowrap">Column</th>
                  <th className="text-left py-2 pr-4 text-slate-500 font-semibold">Notes</th>
                  <th className="text-left py-2 text-slate-500 font-semibold">Example</th>
                </tr>
              </thead>
              <tbody>
                {IMPORT_HEADERS.map((h, i) => (
                  <tr key={h} className={i % 2 === 0 ? "bg-slate-50/50" : ""}>
                    <td className="py-1.5 pr-4 font-mono text-forest-700 whitespace-nowrap">{h}</td>
                    <td className="py-1.5 pr-4 text-slate-500">{COLUMN_NOTES[h] || "Text"}</td>
                    <td className="py-1.5 text-slate-400">{EXAMPLE_ROW[i] || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        {!result ? (
          <>
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all mb-5 ${
                dragOver ? "border-forest-400 bg-forest-50" : "border-slate-200 hover:border-forest-300 hover:bg-slate-50"
              }`}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
              <span className="text-4xl mb-2 block">📂</span>
              <p className="text-sm font-semibold text-slate-700 mb-1">Drop your file here or click to browse</p>
              <p className="text-xs text-slate-400">Supports .xlsx, .xls, .csv</p>
              {fileName && <p className="text-xs text-forest-600 font-semibold mt-2">File: {fileName}</p>}
            </div>

            {parseError && <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-4 text-sm text-red-700">{parseError}</div>}

            {/* Preview */}
            {rows.length > 0 && (
              <div className="border border-slate-100 rounded-xl overflow-hidden mb-5">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <span className="text-sm font-semibold text-slate-700">{rows.length} row{rows.length !== 1 ? "s" : ""} parsed</span>
                    <span className="text-xs text-forest-600 ml-3"> {validRows.length} valid</span>
                    {invalidRows.length > 0 && <span className="text-xs text-red-500 ml-2"> {invalidRows.length} missing activity_name</span>}
                  </div>
                  <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600">✕ Clear</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-3 py-2 text-left text-slate-400 font-semibold">#</th>
                        {IMPORT_HEADERS.map(h => (
                          <th key={h} className="px-3 py-2 text-left text-slate-500 font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((row, i) => {
                        const isInvalid = !row.activity_name?.trim();
                        return (
                          <tr key={i} className={`border-b border-slate-50 ${isInvalid ? "bg-red-50" : i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                            <td className={`px-3 py-1.5 font-mono ${isInvalid ? "text-red-400" : "text-slate-300"}`}>{i + 2}</td>
                            {IMPORT_HEADERS.map(h => (
                              <td key={h} className={`px-3 py-1.5 whitespace-nowrap max-w-[120px] truncate ${isInvalid && h === "activity_name" ? "text-red-500 font-semibold" : "text-slate-600"}`}>
                                {row[h] || <span className="text-slate-200">—</span>}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {rows.length > 50 && (
                    <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
                      Showing first 50 of {rows.length} rows. All {rows.length} will be imported.
                    </p>
                  )}
                </div>
              </div>
            )}

            {validRows.length > 0 && (
              <button onClick={runImport} disabled={importing}
                className="px-5 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center gap-2">
                {importing
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing {validRows.length} rows…</>
                  : <>📥 Import {validRows.length} row{validRows.length !== 1 ? "s" : ""}</>}
              </button>
            )}
          </>
        ) : (
          /* Import result */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎉</span>
              <div>
                <h3 className="font-bold text-slate-800">Import Complete</h3>
                <p className="text-sm text-slate-500">{result.total} rows processed</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { icon: "", label: "Activities created",  val: result.coursesCreated  },
                { icon: "🔄", label: "Activities updated",  val: result.coursesUpdated  },
                { icon: "👤", label: "People added",        val: result.teachersCreated },
                { icon: "📍", label: "Rooms created",       val: result.roomsCreated    },
                { icon: "🏷️", label: "Age groups created", val: result.ageGroupsCreated},
              ].map(s => (
                <div key={s.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-slate-800">{s.val}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.icon} {s.label}</p>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-700 mb-2"> {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} had errors:</p>
                <ul className="space-y-1">{result.errors.map((e, i) => <li key={i} className="text-xs text-red-600">• {e}</li>)}</ul>
              </div>
            )}
            <div className="pt-2 border-t border-slate-100">
              <button onClick={reset} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                Import Another File
              </button>
            </div>
            <p className="text-xs text-sky-600 font-medium">Next: open Activities to assign rooms and time slots.</p>
          </div>
        )}
      </div>

      <div className="camp-card p-6 border-sky-100 bg-sky-50/60">
        <h2 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">→</span>
          Time Slot Assignment Moved
        </h2>
        <p className="text-sm text-slate-600 ml-8">
          Rooms, session checkboxes, and capacity balancing now live on the <strong>Activities</strong> tab, right beside the activity list. Import stays focused on bulk upload only.
        </p>
      </div>

    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <ImportContent />
    </Suspense>
  );
}
