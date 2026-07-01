"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TimeslotAssignmentGrid from "@/components/TimeslotAssignmentGrid";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgeGroup { id: string; name: string; color: string; noSchedule?: boolean; }
interface Room     { id: string; name: string; capacity: number; }
interface Person   { id: string; firstName: string; lastName: string; email?: string; role: string; }
interface SessionTemplate { id: string; label?: string; dayOfWeek?: number | null; startTime: string; endTime: string; }

interface SchedulingConflict {
  type: "room" | "teacher" | "ageGroup";
  slotLabel: string;
  activityName: string;
  detail: string;
  locationNote?: string;
}

// ─── Conflict Modal ───────────────────────────────────────────────────────────

function ConflictModal({ conflicts, onClose }: { conflicts: SchedulingConflict[]; onClose: () => void }) {
  const roomConflicts    = conflicts.filter(c => c.type === "room");
  const teacherConflicts = conflicts.filter(c => c.type === "teacher");
  const ageGroupConflicts = conflicts.filter(c => c.type === "ageGroup");

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-5 border-b border-red-100 bg-red-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-xl flex-shrink-0"></div>
            <div>
              <h2 className="font-bold text-base text-red-800">Scheduling Conflict</h2>
              <p className="text-sm text-red-600 mt-0.5">
                {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""} must be resolved before saving.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* Room conflicts */}
          {roomConflicts.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <span>📍</span> Room Already Booked
              </h3>
              <div className="space-y-2">
                {roomConflicts.map((c, i) => (
                  <div key={i} className="bg-orange-50 border border-orange-200 rounded-xl p-3.5">
                    <p className="text-sm font-semibold text-orange-900">{c.detail}</p>
                    <p className="text-xs text-orange-700 mt-1">
                      Already booked for <strong>{c.activityName}</strong>
                    </p>
                    <p className="text-xs text-orange-600 mt-0.5 flex items-center gap-1">
                      <span>🕐</span> {c.slotLabel}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teacher conflicts */}
          {teacherConflicts.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <span>🧑‍🏫</span> Teacher Already Scheduled
              </h3>
              <div className="space-y-2">
                {teacherConflicts.map((c, i) => (
                  <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-3.5">
                    <p className="text-sm font-semibold text-red-900">{c.detail}</p>
                    <p className="text-xs text-red-700 mt-1">
                      Already teaching <strong>{c.activityName}</strong>
                      {c.locationNote && <span className="text-red-500"> in {c.locationNote}</span>}
                    </p>
                    <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                      <span>🕐</span> {c.slotLabel}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Age-group mandatory/session conflicts */}
          {ageGroupConflicts.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <span>👥</span> Age Group Already Scheduled
              </h3>
              <div className="space-y-2">
                {ageGroupConflicts.map((c, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                    <p className="text-sm font-semibold text-amber-900">{c.detail}</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Already assigned to <strong>{c.activityName}</strong>
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                      <span>🕐</span> {c.slotLabel}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-1 border-t border-slate-100">
            <p className="text-xs text-slate-500 leading-relaxed">
              To fix these conflicts: choose a different room, change the time slots, reassign the teacher, or move the mandatory assembly.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100">
          <button onClick={onClose}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
            Got It — Go Fix It
          </button>
        </div>
      </div>
    </div>
  );
}

interface Course {
  id: string;
  name: string;
  description?: string;
  cap: number;
  color: string;
  icon?: string;
  room?: Room | null;
  courseAgeGroups?: { ageGroup: AgeGroup }[];
  courseTeachers?: { person: Person }[];
  courseSessionTemplates?: { sessionTemplate: SessionTemplate }[];
}

interface MandatorySession {
  id: string;
  title: string;
  ageGroup: AgeGroup;
  room?: Room | null;
  leader?: Person | null;
  sessionTemplate: SessionTemplate;
}

const COLORS = ["#64748B","#78716C","#6B7D5F","#7A8060","#A1624A","#9A7A3D","#607A8C","#7A667A"];
const ICONS  = ["A","B","C","D","E","F","G","H","I","J","K","L"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── Quick-add person inline ──────────────────────────────────────────────────

function QuickAddPerson({
  campId,
  defaultRole,
  onAdded,
}: {
  campId: string;
  defaultRole: "teacher" | "assistant";
  onAdded: (p: Person) => void;
}) {
  const [open, setOpen]         = useState(false);
  const [firstName, setFirst]   = useState("");
  const [lastName, setLast]     = useState("");
  const [email, setEmail]       = useState("");
  const [role, setRole]         = useState<"teacher" | "assistant">(defaultRole);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const save = async () => {
    if (!firstName.trim() || !lastName.trim()) { setError("Name required"); return; }
    setSaving(true); setError("");
    const res = await fetch(`/api/camps/${campId}/persons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || undefined, role }),
    });
    if (res.ok) {
      const p = await res.json();
      onAdded(p);
      setFirst(""); setLast(""); setEmail(""); setOpen(false);
    } else {
      setError("Failed to save");
    }
    setSaving(false);
  };

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)}
      className="text-xs text-forest-600 hover:text-forest-700 font-semibold flex items-center gap-1 mt-1">
      + Add new {defaultRole === "assistant" ? "assistant" : "teacher"}
    </button>
  );

  return (
    <div className="mt-2 p-3 bg-forest-50 rounded-xl border border-forest-200 space-y-2">
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input value={firstName} onChange={e => setFirst(e.target.value)} placeholder="First name *"
          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-forest-500/40" />
        <input value={lastName} onChange={e => setLast(e.target.value)} placeholder="Last name *"
          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-forest-500/40" />
      </div>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address (optional — add details later)"
        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-forest-500/40" />
      <div className="flex items-center gap-2">
        <select value={role} onChange={e => setRole(e.target.value as "teacher" | "assistant")}
          className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-800 focus:outline-none">
          <option value="teacher">Lead Teacher</option>
          <option value="assistant">Teaching Assistant</option>
        </select>
        <button type="button" onClick={save} disabled={saving}
          className="px-3 py-1.5 bg-forest-500 text-white text-xs rounded-lg font-semibold hover:bg-forest-600 disabled:opacity-40">
          {saving ? "..." : "Add"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(""); }}
          className="text-slate-400 hover:text-red-400 text-xs px-1">✕</button>
      </div>
    </div>
  );
}

// ─── Course Modal ─────────────────────────────────────────────────────────────

type SlotMode = "same" | "different";

function CourseModal({
  course, campId, ageGroups, rooms, persons, sessionTemplates,
  onClose, onSaved, onPersonsChanged,
}: {
  course?: Course | null;
  campId: string;
  ageGroups: AgeGroup[];
  rooms: Room[];
  persons: Person[];
  sessionTemplates: SessionTemplate[];
  onClose: () => void;
  onSaved: () => void;
  onPersonsChanged: (p: Person[]) => void;
}) {
  const [name, setName]               = useState(course?.name || "");
  const [description, setDescription] = useState(course?.description || "");
  const [cap, setCap]                 = useState(String(course?.cap || 20));
  const [color, setColor]             = useState(course?.color || COLORS[0]);
  const [icon, setIcon]               = useState(course?.icon || "A");
  const [roomId, setRoomId]           = useState(course?.room?.id || "");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [conflicts, setConflicts]     = useState<SchedulingConflict[]>([]);

  // Age groups
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>(
    course?.courseAgeGroups?.map(cag => cag.ageGroup.id) || []
  );

  // Teachers split by role — both stored in same selectedTeachers array
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>(
    course?.courseTeachers?.map(ct => ct.person.id) || []
  );
  const [localPersons, setLocalPersons] = useState<Person[]>(persons);
  useEffect(() => { setLocalPersons(persons); }, [persons]);

  // Time slots
  const existingSlotIds = course?.courseSessionTemplates?.map(cst => cst.sessionTemplate.id) || [];

  // Derive slot mode from existing data: if all selected slots share same time → "same", else "different"
  const deriveInitialMode = (): SlotMode => {
    if (existingSlotIds.length === 0) return "same";
    const times = existingSlotIds.map(id => {
      const st = sessionTemplates.find(s => s.id === id);
      return st ? `${st.startTime}|${st.endTime}` : "";
    });
    return new Set(times).size === 1 ? "same" : "different";
  };

  const [slotMode, setSlotMode]     = useState<SlotMode>(deriveInitialMode);
  const [selectedSlots, setSelectedSlots] = useState<string[]>(existingSlotIds);

  // ── Derived: unique times across all session templates ──
  const uniqueTimes = useMemo(() => {
    const map = new Map<string, { startTime: string; endTime: string; label?: string }>();
    for (const st of sessionTemplates) {
      const key = `${st.startTime}|${st.endTime}`;
      if (!map.has(key)) map.set(key, { startTime: st.startTime, endTime: st.endTime, label: st.label });
    }
    return [...map.entries()].map(([key, v]) => ({ key, ...v }));
  }, [sessionTemplates]);

  // ── Current selected time key (for "same" mode) ──
  const [sameTimeKey, setSameTimeKey] = useState<string>(() => {
    if (existingSlotIds.length > 0) {
      const st = sessionTemplates.find(s => s.id === existingSlotIds[0]);
      if (st) return `${st.startTime}|${st.endTime}`;
    }
    return uniqueTimes[0]?.key || "";
  });

  // Time slots are assigned in the Schedule Grid tab. Preserve existing assignments when editing,
  // but do not auto-assign new activities from this simplified activity form.

  // ── Derived: days that have templates, with their template options ──
  const dayTemplates = useMemo(() => {
    const map = new Map<number, SessionTemplate[]>();
    for (const st of sessionTemplates) {
      const day = st.dayOfWeek ?? -1;
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(st);
    }
    return map;
  }, [sessionTemplates]);

  // Track which day is selected (for "different" mode) and its chosen slot
  const [daySlotPicks, setDaySlotPicks] = useState<Record<number, string>>(() => {
    if (existingSlotIds.length === 0) return {};
    const picks: Record<number, string> = {};
    for (const id of existingSlotIds) {
      const st = sessionTemplates.find(s => s.id === id);
      if (st && st.dayOfWeek != null) picks[st.dayOfWeek] = id;
    }
    return picks;
  });
  const [selectedDays, setSelectedDays] = useState<number[]>(() => Object.keys(daySlotPicks).map(Number));

  // The clickable grid owns future schedule edits.

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(prev => prev.filter(d => d !== day));
      setDaySlotPicks(prev => { const n = { ...prev }; delete n[day]; return n; });
    } else {
      setSelectedDays(prev => [...prev, day]);
      // Auto-pick first slot for that day
      const slots = dayTemplates.get(day) || [];
      if (slots[0]) setDaySlotPicks(prev => ({ ...prev, [day]: slots[0].id }));
    }
  };

  const switchMode = (mode: SlotMode) => {
    setSlotMode(mode);
    setSelectedSlots([]);
    setSelectedDays([]);
    setDaySlotPicks({});
    if (mode === "same" && uniqueTimes[0]) setSameTimeKey(uniqueTimes[0].key);
  };

  const toggleItem = (id: string, list: string[], setList: (v: string[]) => void) =>
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  // Split persons by role
  const leadTeachers = localPersons.filter(p => p.role === "teacher" || p.role === "director");
  const assistants   = localPersons.filter(p => p.role === "assistant" || p.role === "staff");
  const schedulableAgeGroups = ageGroups.filter(ag => !ag.noSchedule);

  const handlePersonAdded = (p: Person) => {
    const updated = [...localPersons, p];
    setLocalPersons(updated);
    setSelectedTeachers(prev => [...prev, p.id]);
    onPersonsChanged(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setConflicts([]);
    try {
      const url    = course ? `/api/camps/${campId}/courses/${course.id}` : `/api/camps/${campId}/courses`;
      const method = course ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description: description || undefined,
          cap: parseInt(cap), color, icon,
          roomId: roomId || undefined,
          ageGroupIds: selectedAgeGroups,
          teacherIds: selectedTeachers,
          sessionTemplateIds: selectedSlots,
        }),
      });
      if (res.status === 409) {
        const d = await res.json();
        setConflicts(Array.isArray(d.conflicts) ? d.conflicts : []);
      } else if (res.ok) {
        onSaved(); onClose();
      } else {
        const d = await res.json();
        setError(d.error || "Failed to save");
      }
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="font-bold text-lg text-slate-800">{course ? "Edit Activity" : "New Activity"}</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

          {/* Name + Icon */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Activity Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                placeholder="e.g. Watercolor Painting"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Icon</label>
              <select value={icon} onChange={e => setIcon(e.target.value)}
                className="w-full px-2 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30">
                {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="Optional description..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30 resize-none" />
          </div>

          {/* Room + Cap */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Room / Location</label>
              <select value={roomId} onChange={e => setRoomId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30">
                <option value="">No room assigned</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name} (cap: {r.capacity})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Capacity</label>
              <input type="number" value={cap} onChange={e => setCap(e.target.value)} min={1} max={500}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
            </div>
          </div>

          {/* Age Groups */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Age Groups
              <span className="ml-1 text-xs font-normal text-slate-400">(select all that apply)</span>
            </label>
            {schedulableAgeGroups.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No schedulable age groups set up yet — age groups marked “No class schedule” do not need activities.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {schedulableAgeGroups.map(ag => {
                  const checked = selectedAgeGroups.includes(ag.id);
                  return (
                    <button key={ag.id} type="button"
                      onClick={() => toggleItem(ag.id, selectedAgeGroups, setSelectedAgeGroups)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${
                        checked ? "border-transparent text-white shadow-sm" : "border-slate-200 text-slate-600 bg-white hover:border-slate-300"
                      }`}
                      style={checked ? { backgroundColor: ag.color, borderColor: ag.color } : {}}>
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-xs flex-shrink-0 ${checked ? "border-white bg-white/20" : "border-slate-300"}`}>
                        {checked ? "✓" : ""}
                      </span>
                      {ag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-700">
            Time assignment moved to the Schedule Grid tab. This form only saves the activity basics.
          </div>

          {/* ── Lead Teachers ── */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Lead Teacher(s)
              <span className="ml-1 text-xs font-normal text-slate-400">(teaches the class)</span>
            </label>
            {leadTeachers.length === 0 ? (
              <p className="text-xs text-slate-400 italic mb-1">No teachers added yet.</p>
            ) : (
              <div className="space-y-1.5 mb-2">
                {leadTeachers.map(p => {
                  const checked = selectedTeachers.includes(p.id);
                  return (
                    <label key={p.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all ${
                        checked ? "border-berry-400 bg-berry-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"
                      }`}>
                      <input type="checkbox" checked={checked}
                        onChange={() => toggleItem(p.id, selectedTeachers, setSelectedTeachers)}
                        className="w-4 h-4 accent-berry-500 flex-shrink-0" />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-berry-400 to-sky-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {p.firstName[0]}{p.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-slate-800">{p.firstName} {p.lastName}</span>
                          {p.email && <span className="text-xs text-slate-400 ml-1.5 truncate">{p.email}</span>}
                          {!p.email && <span className="text-xs text-amber-500 ml-1.5"> no email</span>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <QuickAddPerson campId={campId} defaultRole="teacher" onAdded={handlePersonAdded} />
          </div>

          {/* ── Teaching Assistants ── */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Teaching Assistants
              <span className="ml-1 text-xs font-normal text-slate-400">(helpers, aides)</span>
            </label>
            {assistants.length === 0 ? (
              <p className="text-xs text-slate-400 italic mb-1">No assistants added yet.</p>
            ) : (
              <div className="space-y-1.5 mb-2">
                {assistants.map(p => {
                  const checked = selectedTeachers.includes(p.id);
                  return (
                    <label key={p.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all ${
                        checked ? "border-sky-400 bg-sky-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"
                      }`}>
                      <input type="checkbox" checked={checked}
                        onChange={() => toggleItem(p.id, selectedTeachers, setSelectedTeachers)}
                        className="w-4 h-4 accent-sky-500 flex-shrink-0" />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-forest-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {p.firstName[0]}{p.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-slate-800">{p.firstName} {p.lastName}</span>
                          {p.email && <span className="text-xs text-slate-400 ml-1.5 truncate">{p.email}</span>}
                          {!p.email && <span className="text-xs text-amber-500 ml-1.5"> no email</span>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <QuickAddPerson campId={campId} defaultRole="assistant" onAdded={handlePersonAdded} />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? "border-slate-800 scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60">
              {loading ? "Checking..." : course ? "Save Changes" : "Create Activity"}
            </button>
          </div>
        </form>
      </div>

      {/* Conflict modal — rendered on top of the course modal */}
      {conflicts.length > 0 && (
        <ConflictModal conflicts={conflicts} onClose={() => setConflicts([])} />
      )}
    </div>
  );
}


// ─── Mandatory Assembly Modal ─────────────────────────────────────────────────

function MandatorySessionModal({
  item, campId, ageGroups, rooms, persons, sessionTemplates, onClose, onSaved,
}: {
  item?: MandatorySession | null;
  campId: string;
  ageGroups: AgeGroup[];
  rooms: Room[];
  persons: Person[];
  sessionTemplates: SessionTemplate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item?.title || "Opening Assembly");
  const [ageGroupId, setAgeGroupId] = useState(item?.ageGroup.id || ageGroups[0]?.id || "");
  const [sessionTemplateId, setSessionTemplateId] = useState(item?.sessionTemplate.id || sessionTemplates[0]?.id || "");
  const [roomId, setRoomId] = useState(item?.room?.id || "");
  const [leaderId, setLeaderId] = useState(item?.leader?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<SchedulingConflict[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setConflicts([]);
    try {
      const url = item ? `/api/camps/${campId}/mandatory-sessions/${item.id}` : `/api/camps/${campId}/mandatory-sessions`;
      const method = item ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, ageGroupId, sessionTemplateId, roomId: roomId || undefined, leaderId: leaderId || undefined }),
      });
      if (res.status === 409) {
        const d = await res.json();
        if (Array.isArray(d.conflicts)) setConflicts(d.conflicts);
        else setError(d.error || "Scheduling conflict");
      } else if (res.ok) {
        onSaved(); onClose();
      } else {
        const d = await res.json();
        setError(d.error || "Failed to save required session");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="font-bold text-lg text-slate-800">{item ? "Edit Required Assembly" : "New Required Assembly"}</h2>
          <p className="text-xs text-slate-500 mt-1">Automatically assigns an age group to a required block with no parent choice.</p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Assembly Name *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Opening Assembly"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Age Group *</label>
              <select value={ageGroupId} onChange={e => setAgeGroupId(e.target.value)} required
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30">
                {ageGroups.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Time Slot *</label>
              <select value={sessionTemplateId} onChange={e => setSessionTemplateId(e.target.value)} required
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30">
                {sessionTemplates.map(st => <option key={st.id} value={st.id}>{st.dayOfWeek == null ? "All" : DAYS[st.dayOfWeek]} · {st.label ? `${st.label} — ` : ""}{st.startTime}–{st.endTime}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Location</label>
              <select value={roomId} onChange={e => setRoomId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30">
                <option value="">No room assigned</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Leader</label>
              <select value={leaderId} onChange={e => setLeaderId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30">
                <option value="">No leader assigned</option>
                {persons.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
            </div>
          </div>
          <div className="bg-forest-50 border border-forest-100 rounded-xl p-3 text-xs text-forest-700">
            Parents will not choose this session. Campers in the selected age group are enrolled automatically when they register.
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60">
              {loading ? "Checking..." : item ? "Save Assembly" : "Create Assembly"}
            </button>
          </div>
        </form>
      </div>
      {conflicts.length > 0 && <ConflictModal conflicts={conflicts} onClose={() => setConflicts([])} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ActivitiesContent({ simpleCatalog = false }: { simpleCatalog?: boolean } = {}) {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  const [courses, setCourses]                   = useState<Course[]>([]);
  const [mandatorySessions, setMandatorySessions] = useState<MandatorySession[]>([]);
  const [ageGroups, setAgeGroups]               = useState<AgeGroup[]>([]);
  const [rooms, setRooms]                       = useState<Room[]>([]);
  const [persons, setPersons]                   = useState<Person[]>([]);
  const [sessionTemplates, setSessionTemplates] = useState<SessionTemplate[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [search, setSearch]                     = useState("");
  const [editingCourse, setEditingCourse]       = useState<Course | null | undefined>(undefined);
  const [editingMandatory, setEditingMandatory] = useState<MandatorySession | null | undefined>(undefined);
  const [showModal, setShowModal]               = useState(false);
  const [showMandatoryModal, setShowMandatoryModal] = useState(false);
  const [sortCol, setSortCol]                   = useState("name");
  const [sortDir, setSortDir]                   = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter]         = useState<"all" | "needs" | "ready">("all");
  const [toolsOpen, setToolsOpen]               = useState(false);
  const [inlineSaving, setInlineSaving]         = useState<Record<string, boolean>>({});
  const [inlineErrors, setInlineErrors]         = useState<Record<string, string>>({});
  const [inlineConflicts, setInlineConflicts]   = useState<SchedulingConflict[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking]           = useState(false);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <span className="text-slate-300 ml-1">⇅</span>;
    return <span className="text-forest-600 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const load = () => {
    if (!campId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/camps/${campId}/courses`).then(r => r.json()),
      fetch(`/api/camps/${campId}/mandatory-sessions`).then(r => r.json()),
      fetch(`/api/camps/${campId}/age-groups`).then(r => r.json()),
      fetch(`/api/camps/${campId}/rooms`).then(r => r.json()),
      fetch(`/api/camps/${campId}/persons`).then(r => r.json()),
      fetch(`/api/camps/${campId}/session-templates`).then(r => r.json()),
    ]).then(([c, ms, ag, r, p, st]) => {
      setCourses(Array.isArray(c) ? c : []);
      setMandatorySessions(Array.isArray(ms) ? ms : []);
      setAgeGroups(Array.isArray(ag) ? ag : []);
      setRooms(Array.isArray(r) ? r : []);
      setPersons(Array.isArray(p) ? p : []);
      setSessionTemplates(Array.isArray(st) ? st : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [campId]);

  const toggleCourseSelected = (id: string) => {
    setSelectedCourseIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelectedCourses = async () => {
    const ids = [...selectedCourseIds];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected activit${ids.length === 1 ? "y" : "ies"}? This cannot be undone.`)) return;
    setBulkWorking(true);
    await Promise.all(ids.map(id => fetch(`/api/camps/${campId}/courses/${id}`, { method: "DELETE" })));
    setSelectedCourseIds(new Set());
    setBulkWorking(false);
    load();
  };

  const duplicateSelectedCourses = async () => {
    const selected = courses.filter(course => selectedCourseIds.has(course.id));
    if (selected.length === 0) return;
    setBulkWorking(true);
    await Promise.all(selected.map(course => fetch(`/api/camps/${campId}/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${course.name} Copy`,
        description: course.description || undefined,
        cap: course.cap || 20,
        color: course.color || "#64748B",
        icon: course.icon || "A",
        roomId: course.room?.id || null,
        ageGroupIds: course.courseAgeGroups?.map(cag => cag.ageGroup.id) || [],
        teacherIds: course.courseTeachers?.map(ct => ct.person.id) || [],
      }),
    })));
    setSelectedCourseIds(new Set());
    setBulkWorking(false);
    load();
  };

  const replaceCourse = (updated: Course) => {
    setCourses(prev => prev.map(course => course.id === updated.id ? updated : course));
  };

  const saveInlineCourse = async (course: Course, field: "teacher" | "assistant" | "room" | "cap" | "ages", body: Record<string, unknown>) => {
    const key = `${course.id}:${field}`;
    setInlineSaving(prev => ({ ...prev, [key]: true }));
    setInlineErrors(prev => { const next = { ...prev }; delete next[course.id]; return next; });
    try {
      const res = await fetch(`/api/camps/${campId}/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 409) {
        setInlineConflicts(Array.isArray(data.conflicts) ? data.conflicts : []);
        setInlineErrors(prev => ({ ...prev, [course.id]: "Scheduling conflict — choose another option." }));
      } else if (res.ok) {
        replaceCourse(data as Course);
      } else {
        setInlineErrors(prev => ({ ...prev, [course.id]: data.error || "Could not save change." }));
      }
    } catch {
      setInlineErrors(prev => ({ ...prev, [course.id]: "Could not save change." }));
    } finally {
      setInlineSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const deleteMandatorySession = async (id: string) => {
    if (!confirm("Delete this required assembly? Existing automatic enrollments remain until manually adjusted.")) return;
    await fetch(`/api/camps/${campId}/mandatory-sessions/${id}`, { method: "DELETE" });
    load();
  };

  const sortedFiltered = courses
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av = "", bv = "";
      if (sortCol === "name") { av = a.name; bv = b.name; }
      else if (sortCol === "room") { av = a.room?.name || ""; bv = b.room?.name || ""; }
      else if (sortCol === "teacher") {
        const ta = a.courseTeachers?.find(ct => ct.person.role === "teacher" || ct.person.role === "director");
        const tb = b.courseTeachers?.find(ct => ct.person.role === "teacher" || ct.person.role === "director");
        av = ta?.person.lastName || ""; bv = tb?.person.lastName || "";
      } else if (sortCol === "time") {
        av = a.courseSessionTemplates?.[0]?.sessionTemplate?.startTime || "";
        bv = b.courseSessionTemplates?.[0]?.sessionTemplate?.startTime || "";
      } else if (sortCol === "cap") {
        return sortDir === "asc" ? (a.cap || 0) - (b.cap || 0) : (b.cap || 0) - (a.cap || 0);
      } else if (sortCol === "agegroup") {
        av = a.courseAgeGroups?.[0]?.ageGroup?.name || "";
        bv = b.courseAgeGroups?.[0]?.ageGroup?.name || "";
      }
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });


  const activityStatus = (course: Course): { label: string; tone: string; priority: "ready" | "needs" } => {
    if (!course.room) return { label: "Needs room", tone: "bg-orange-50 text-orange-700 border-orange-200", priority: "needs" };
    if (!course.courseTeachers || course.courseTeachers.length === 0) return { label: "Needs teacher", tone: "bg-rose-50 text-rose-700 border-rose-200", priority: "needs" };
    if (!course.courseAgeGroups || course.courseAgeGroups.length === 0) return { label: "Needs ages", tone: "bg-sky-50 text-sky-700 border-sky-200", priority: "needs" };
    return { label: "Ready", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", priority: "ready" };
  };

  const scheduleSummary = (course: Course): string => {
    const slots = course.courseSessionTemplates || [];
    if (slots.length === 0) return "No time assigned";
    if (slots.length === 1) {
      const st = slots[0].sessionTemplate;
      return st ? `${st.label || `${st.startTime}–${st.endTime}`}` : "1 time slot";
    }
    const first = slots[0].sessionTemplate;
    return first ? `${slots.length} slots · starts ${first.startTime}` : `${slots.length} time slots`;
  };

  const leadTeacher = (course: Course) =>
    course.courseTeachers?.find(ct => ct.person.role === "teacher" || ct.person.role === "director")?.person;

  const assistant = (course: Course) =>
    course.courseTeachers?.find(ct => ct.person.role === "assistant" || ct.person.role === "staff")?.person;

  const leadTeacherOptions = persons.filter(p => p.role === "teacher" || p.role === "director");
  const assistantOptions = persons.filter(p => p.role === "assistant" || p.role === "staff");
  const schedulableAgeGroups = ageGroups.filter(ageGroup => !ageGroup.noSchedule);

  const quickAddInlinePerson = async (course: Course, role: "teacher" | "assistant") => {
    const label = role === "assistant" ? "assistant" : "teacher";
    const rawName = window.prompt(`Quick add ${label} name`, "");
    if (!rawName?.trim()) return;
    const parts = rawName.trim().split(/\s+/);
    const firstName = parts.shift() || rawName.trim();
    const lastName = parts.join(" ") || "TBD";
    setInlineErrors(prev => { const next = { ...prev }; delete next[course.id]; return next; });
    const res = await fetch(`/api/camps/${campId}/persons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, role }),
    });
    const person = await res.json().catch(() => null) as Person | null;
    if (!res.ok || !person?.id) {
      setInlineErrors(prev => ({ ...prev, [course.id]: `Could not add ${label}.` }));
      return;
    }
    setPersons(prev => [...prev, person]);
    const existingLeadId = leadTeacher(course)?.id;
    const existingAssistantId = assistant(course)?.id;
    const teacherIds = role === "teacher"
      ? [person.id, existingAssistantId].filter(Boolean) as string[]
      : [existingLeadId, person.id].filter(Boolean) as string[];
    await saveInlineCourse(course, role, { teacherIds });
  };

  const toggleInlineAgeGroup = (course: Course, ageGroupId: string) => {
    const currentIds = course.courseAgeGroups?.map(cag => cag.ageGroup.id) || [];
    const nextIds = currentIds.includes(ageGroupId)
      ? currentIds.filter(id => id !== ageGroupId)
      : [...currentIds, ageGroupId];
    saveInlineCourse(course, "ages", { ageGroupIds: nextIds });
  };

  const filteredByStatus = sortedFiltered.filter(course => {
    if (statusFilter === "all") return true;
    return activityStatus(course).priority === statusFilter;
  });
  const selectedCount = selectedCourseIds.size;
  const visibleIds = filteredByStatus.map(course => course.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedCourseIds.has(id));
  const toggleAllVisible = () => {
    setSelectedCourseIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach(id => next.delete(id));
      else visibleIds.forEach(id => next.add(id));
      return next;
    });
  };

  const readyCount = courses.filter(c => activityStatus(c).priority === "ready").length;
  const needsCount = Math.max(courses.length - readyCount, 0);
  const scheduledCount = courses.filter(c => (c.courseSessionTemplates || []).length > 0).length;
  const registrationReady = courses.length > 0 && needsCount === 0;

  if (!campId) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center"><span className="text-4xl mb-3 block">A</span><p>Select a camp to view activities.</p></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {!simpleCatalog && (
        <>
          <div className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-amber-50 p-6 shadow-sm">
        <div className="absolute right-6 top-6 hidden h-24 w-24 rounded-full bg-amber-200/30 blur-2xl md:block" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-700 shadow-sm">
              Activity command center
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Activities</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Manage activities from one working sheet: default camp blocks at the top, then activity rows with room, teacher, capacity, and click-to-schedule cells.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button onClick={() => setToolsOpen(v => !v)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
                Tools ▾
              </button>
              {toolsOpen && (
                <div className="absolute right-0 top-12 z-20 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-xl">
                  <button onClick={() => { setEditingMandatory(null); setShowMandatoryModal(true); setToolsOpen(false); }} className="w-full rounded-xl px-3 py-2 text-left font-semibold text-slate-700 hover:bg-amber-50">Add required assembly</button>
                  <a href={`/import${campId ? `?campId=${campId}` : ""}`} className="block rounded-xl px-3 py-2 font-semibold text-slate-700 hover:bg-emerald-50">Import activities</a>
                  <button onClick={() => { setSortCol("name"); setSortDir("asc"); setStatusFilter("all"); setSearch(""); setToolsOpen(false); }} className="w-full rounded-xl px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50">✨ Reset filters</button>
                </div>
              )}
            </div>
            <button onClick={() => { setEditingCourse(null); setShowModal(true); }}
              className="rounded-xl bg-gradient-to-r from-forest-500 to-forest-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90">
              + New Activity
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
        {[
          { label: "Activities", value: courses.length, detail: "in catalog", tone: "text-sky-700", action: () => { setStatusFilter("all"); setSearch(""); } },
          { label: "Scheduled", value: scheduledCount, detail: "have a time", tone: "text-emerald-700", action: () => document.getElementById("activity-schedule-grid")?.scrollIntoView({ behavior: "smooth", block: "start" }) },
          { label: "Need attention", value: needsCount, detail: needsCount === 0 ? "all clear" : "missing details", tone: "text-amber-700", action: () => setStatusFilter("needs") },
          { label: "Registration", value: registrationReady ? "Ready" : "Not yet", detail: `${mandatorySessions.length} default block${mandatorySessions.length !== 1 ? "s" : ""}`, tone: registrationReady ? "text-emerald-700" : "text-slate-600", action: () => document.getElementById("activity-schedule-grid")?.scrollIntoView({ behavior: "smooth", block: "start" }) },
        ].map(item => (
          <button key={item.label} onClick={item.action} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left font-bold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50">
            <span className={`mr-1 ${item.tone}`}>{item.value}</span>
            <span>{item.label}</span>
            <span className="ml-1 font-medium text-slate-400">· {item.detail}</span>
          </button>
        ))}
      </div>

      <div id="activity-schedule-grid" className="scroll-mt-6">
        <TimeslotAssignmentGrid campId={campId} />
      </div>
        </>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Activity catalog</h2>
              <p className="mt-1 text-xs text-slate-500">Simple rows only: activity, teacher, room, seats, and age groups. Use the Schedule Grid tab for clickable time-slot assignment.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{filteredByStatus.length} shown</span>
              <button onClick={() => { setEditingCourse(null); setShowModal(true); }} className="rounded-xl bg-gradient-to-r from-forest-500 to-forest-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:opacity-90">+ Add Activity</button>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 p-4">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search activities..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "all", label: "All" },
                { key: "needs", label: `Needs attention (${needsCount})` },
                { key: "ready", label: `Ready (${readyCount})` },
              ].map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key as "all" | "needs" | "ready")}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold ${statusFilter === f.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {selectedCount > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm">
              <p className="text-sm font-black text-sky-900">{selectedCount} selected</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={duplicateSelectedCourses} disabled={bulkWorking} className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-black text-sky-700 hover:bg-sky-100 disabled:opacity-50">Duplicate</button>
                <button type="button" onClick={deleteSelectedCourses} disabled={bulkWorking} className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50">Delete</button>
                <button type="button" onClick={() => setSelectedCourseIds(new Set())} disabled={bulkWorking} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-50 disabled:opacity-50">Clear</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest-500 border-t-transparent" />
            </div>
          ) : filteredByStatus.length === 0 ? (
            <div className="camp-card p-12 text-center">
              <span className="mb-4 block text-5xl">A</span>
              <h3 className="mb-2 font-bold text-slate-700">{search || statusFilter !== "all" ? "No activities match" : "No activities yet"}</h3>
              <p className="mb-5 text-sm text-slate-400">Create activities first, then schedule them in the grid above.</p>
              <button onClick={() => { setEditingCourse(null); setShowModal(true); }} className="rounded-xl bg-gradient-to-r from-forest-500 to-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">+ Add First Activity</button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisible}
                          aria-label="Select all visible activities"
                          className="h-4 w-4 rounded border-slate-300 accent-sky-600"
                        />
                        <span>Activity</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left">Teacher</th>
                    <th className="px-3 py-3 text-left">Assistant</th>
                    <th className="px-3 py-3 text-left">Room</th>
                    <th className="px-3 py-3 text-center">Total seats</th>
                    <th className="px-4 py-3 text-left min-w-[280px]">Ages</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredByStatus.map(course => {
                    const status = activityStatus(course);
                    const teacher = leadTeacher(course);
                    const helper = assistant(course);
                    return (
                      <tr key={course.id} className="align-top hover:bg-sky-50/30">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={selectedCourseIds.has(course.id)}
                              onChange={() => toggleCourseSelected(course.id)}
                              aria-label={`Select ${course.name}`}
                              className="mt-2 h-4 w-4 shrink-0 rounded border-slate-300 accent-sky-600"
                            />
                            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-base text-white shadow-sm" style={{ backgroundColor: course.color || "#64748B" }}>{course.icon || "A"}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-black text-slate-900">{course.name}</span>
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${status.tone}`}>{status.label}</span>
                              </div>
                              {course.description && <p className="mt-0.5 line-clamp-1 max-w-sm text-xs text-slate-500">{course.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          <select
                            value={teacher?.id || ""}
                            disabled={!!inlineSaving[`${course.id}:teacher`]}
                            onChange={e => {
                              if (e.target.value === "__add_teacher") {
                                e.currentTarget.value = teacher?.id || "";
                                quickAddInlinePerson(course, "teacher");
                                return;
                              }
                              const assistantIds = course.courseTeachers
                                ?.filter(ct => ct.person.role !== "teacher" && ct.person.role !== "director")
                                .map(ct => ct.person.id) || [];
                              saveInlineCourse(course, "teacher", { teacherIds: e.target.value ? [...assistantIds, e.target.value] : assistantIds });
                            }}
                            className={`w-full min-w-[145px] rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-forest-500/30 ${teacher ? "border-slate-200 bg-white text-slate-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}
                          >
                            <option value="">Not assigned</option>
                            <option value="__add_teacher">+ Add teacher…</option>
                            {leadTeacherOptions.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                          </select>
                          {inlineErrors[course.id] && <p className="mt-1 text-[10px] font-bold text-red-500">{inlineErrors[course.id]}</p>}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          <select
                            value={helper?.id || ""}
                            disabled={!!inlineSaving[`${course.id}:assistant`]}
                            onChange={e => {
                              if (e.target.value === "__add_assistant") {
                                e.currentTarget.value = helper?.id || "";
                                quickAddInlinePerson(course, "assistant");
                                return;
                              }
                              const leadId = leadTeacher(course)?.id;
                              const teacherIds = [leadId, e.target.value].filter(Boolean) as string[];
                              saveInlineCourse(course, "assistant", { teacherIds });
                            }}
                            className={`w-full min-w-[145px] rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/30 ${helper ? "border-slate-200 bg-white text-slate-700" : "border-sky-100 bg-sky-50 text-sky-700"}`}
                          >
                            <option value="">Not assigned</option>
                            <option value="__add_assistant">+ Add assistant…</option>
                            {assistantOptions.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          <select
                            value={course.room?.id || ""}
                            disabled={!!inlineSaving[`${course.id}:room`]}
                            onChange={e => saveInlineCourse(course, "room", { roomId: e.target.value || null })}
                            className={`w-full min-w-[130px] rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-forest-500/30 ${course.room ? "border-slate-200 bg-white text-slate-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}
                          >
                            <option value="">Not assigned</option>
                            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-3 text-center text-xs font-bold text-slate-700">
                          <input
                            type="number"
                            min={1}
                            max={500}
                            defaultValue={course.cap || 20}
                            disabled={!!inlineSaving[`${course.id}:cap`]}
                            onBlur={e => {
                              const nextCap = Number(e.target.value);
                              if (Number.isFinite(nextCap) && nextCap > 0 && nextCap !== course.cap) {
                                saveInlineCourse(course, "cap", { cap: nextCap });
                              } else {
                                e.target.value = String(course.cap || 20);
                              }
                            }}
                            onKeyDown={e => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") { e.currentTarget.value = String(course.cap || 20); e.currentTarget.blur(); }
                            }}
                            className="mx-auto w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
                          />
                        </td>
                        <td className="px-4 py-3 min-w-[280px]">
                          <div className="flex max-w-[360px] flex-wrap gap-1.5">
                            {schedulableAgeGroups.length > 0 ? schedulableAgeGroups.map(ageGroup => {
                              const checked = course.courseAgeGroups?.some(cag => cag.ageGroup.id === ageGroup.id) || false;
                              return (
                                <button
                                  key={ageGroup.id}
                                  type="button"
                                  disabled={!!inlineSaving[`${course.id}:ages`]}
                                  onClick={() => toggleInlineAgeGroup(course, ageGroup.id)}
                                  title={`${checked ? "Remove" : "Add"} ${ageGroup.name}`}
                                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap transition-all disabled:opacity-60 ${
                                    checked ? "border-transparent text-white shadow-sm" : "border-slate-200 bg-white text-slate-400 hover:border-sky-200 hover:text-sky-700"
                                  }`}
                                  style={checked ? { backgroundColor: ageGroup.color } : {}}
                                >
                                  {checked ? "✓ " : "+ "}{ageGroup.name}
                                </button>
                              );
                            }) : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">No ages set up</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <CourseModal
          course={editingCourse}
          campId={campId}
          ageGroups={ageGroups}
          rooms={rooms}
          persons={persons}
          sessionTemplates={sessionTemplates}
          onClose={() => { setShowModal(false); setEditingCourse(undefined); }}
          onSaved={load}
          onPersonsChanged={setPersons}
        />
      )}

      {showMandatoryModal && (
        <MandatorySessionModal
          item={editingMandatory}
          campId={campId}
          ageGroups={ageGroups}
          rooms={rooms}
          persons={persons}
          sessionTemplates={sessionTemplates}
          onClose={() => { setShowMandatoryModal(false); setEditingMandatory(undefined); }}
          onSaved={load}
        />
      )}

      {inlineConflicts.length > 0 && (
        <ConflictModal conflicts={inlineConflicts} onClose={() => setInlineConflicts([])} />
      )}
    </div>
  );
}

export default function ActivitiesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <ActivitiesContent />
    </Suspense>
  );
}
