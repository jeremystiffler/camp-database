"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TimeslotAssignmentGrid from "@/components/TimeslotAssignmentGrid";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgeGroup { id: string; name: string; color: string; }
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
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-xl flex-shrink-0">⚠️</div>
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

const COLORS = ["#22C55E","#0EA5E9","#F97316","#A855F7","#EAB308","#EC4899","#14B8A6","#6366F1"];
const ICONS  = ["🎨","🎭","🎵","📖","🏃","🎯","🔬","🏕️","⚽","🎤","🎺","✏️"];
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
    if (!email.trim()) { setError("Email required to send schedule"); return; }
    setSaving(true); setError("");
    const res = await fetch(`/api/camps/${campId}/persons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), role }),
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
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address * (required for schedule)"
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
  const [icon, setIcon]               = useState(course?.icon || "🎯");
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

  // When sameTimeKey changes, auto-select all templates with that time
  useEffect(() => {
    if (slotMode !== "same" || !sameTimeKey) return;
    const [start, end] = sameTimeKey.split("|");
    const ids = sessionTemplates.filter(s => s.startTime === start && s.endTime === end).map(s => s.id);
    setSelectedSlots(ids);
  }, [sameTimeKey, slotMode, sessionTemplates]);

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

  // When daySlotPicks changes in "different" mode, sync selectedSlots
  useEffect(() => {
    if (slotMode !== "different") return;
    setSelectedSlots(Object.values(daySlotPicks).filter(Boolean));
  }, [daySlotPicks, slotMode]);

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
            {ageGroups.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No age groups set up yet — add them in Settings.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ageGroups.map(ag => {
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

          {/* ── Time Schedule ── */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Time Schedule
              <span className="ml-1 text-xs font-normal text-slate-400">(when does this activity meet?)</span>
            </label>

            {sessionTemplates.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No time slots set up yet — add them in Settings.</p>
            ) : (
              <>
                {/* Mode toggle */}
                <div className="flex rounded-xl border border-slate-200 overflow-hidden mb-3">
                  <button type="button"
                    onClick={() => switchMode("same")}
                    className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
                      slotMode === "same"
                        ? "bg-sky-500 text-white"
                        : "bg-white text-slate-500 hover:bg-slate-50"
                    }`}>
                    🔁 Same time every day
                  </button>
                  <button type="button"
                    onClick={() => switchMode("different")}
                    className={`flex-1 px-3 py-2 text-xs font-semibold border-l border-slate-200 transition-colors ${
                      slotMode === "different"
                        ? "bg-sky-500 text-white"
                        : "bg-white text-slate-500 hover:bg-slate-50"
                    }`}>
                    📅 Different time each day
                  </button>
                </div>

                {/* ── Same time every day ── */}
                {slotMode === "same" && (
                  <div className="space-y-2">
                    {uniqueTimes.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No time slots configured in Settings.</p>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500">Select a time — it will be applied to all days of camp:</p>
                        <div className="space-y-1.5">
                          {uniqueTimes.map(ut => {
                            const active = sameTimeKey === ut.key;
                            const matchingCount = sessionTemplates.filter(s => s.startTime === ut.startTime && s.endTime === ut.endTime).length;
                            return (
                              <label key={ut.key}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                                  active ? "border-sky-400 bg-sky-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"
                                }`}>
                                <input type="radio" checked={active}
                                  onChange={() => setSameTimeKey(ut.key)}
                                  className="w-4 h-4 accent-sky-500 flex-shrink-0" />
                                <div className="flex-1">
                                  <span className="font-semibold text-sm text-slate-800">{ut.startTime} – {ut.endTime}</span>
                                  {ut.label && <span className="ml-2 text-xs text-slate-400">{ut.label}</span>}
                                </div>
                                <span className="text-xs text-slate-400">{matchingCount} day{matchingCount !== 1 ? "s" : ""}</span>
                              </label>
                            );
                          })}
                        </div>
                        {selectedSlots.length > 0 && (
                          <p className="text-xs text-sky-600 font-medium mt-1">
                            ✓ Will run on {selectedSlots.length} day{selectedSlots.length !== 1 ? "s" : ""} at this time
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ── Different time each day ── */}
                {slotMode === "different" && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">Choose which days this activity meets and pick a time for each:</p>

                    {/* Day pills */}
                    <div className="flex flex-wrap gap-2">
                      {[...dayTemplates.entries()].sort((a, b) => a[0] - b[0]).map(([day]) => {
                        const isSelected = selectedDays.includes(day);
                        return (
                          <button key={day} type="button"
                            onClick={() => toggleDay(day)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                              isSelected
                                ? "bg-sky-500 border-sky-500 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-600 hover:border-sky-300"
                            }`}>
                            {day === -1 ? "All Days" : DAYS[day]}
                          </button>
                        );
                      })}
                    </div>

                    {/* Time slot picker per selected day */}
                    {selectedDays.length > 0 && (
                      <div className="space-y-2">
                        {selectedDays.sort((a, b) => a - b).map(day => {
                          const slots = dayTemplates.get(day) || [];
                          return (
                            <div key={day} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200">
                              <span className="text-xs font-bold text-sky-700 w-8 flex-shrink-0">
                                {day === -1 ? "All" : DAYS[day]}
                              </span>
                              <select
                                value={daySlotPicks[day] || ""}
                                onChange={e => setDaySlotPicks(prev => ({ ...prev, [day]: e.target.value }))}
                                className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500/40">
                                {slots.map(s => (
                                  <option key={s.id} value={s.id}>
                                    {s.label ? `${s.label} — ` : ""}{s.startTime} – {s.endTime}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {selectedDays.length === 0 && (
                      <p className="text-xs text-slate-400 italic">Select at least one day above.</p>
                    )}
                  </div>
                )}
              </>
            )}
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
                          {!p.email && <span className="text-xs text-amber-500 ml-1.5">⚠️ no email</span>}
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
                          {!p.email && <span className="text-xs text-amber-500 ml-1.5">⚠️ no email</span>}
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

function ActivitiesContent() {
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
  const [openMenuId, setOpenMenuId]             = useState<string | null>(null);

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

  const deleteCourse = async (id: string) => {
    if (!confirm("Delete this activity?")) return;
    await fetch(`/api/camps/${campId}/courses/${id}`, { method: "DELETE" });
    load();
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
    if (!course.courseSessionTemplates || course.courseSessionTemplates.length === 0) return { label: "Needs time", tone: "bg-amber-50 text-amber-700 border-amber-200", priority: "needs" };
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

  const filteredByStatus = sortedFiltered.filter(course => {
    if (statusFilter === "all") return true;
    return activityStatus(course).priority === statusFilter;
  });

  const readyCount = courses.filter(c => activityStatus(c).priority === "ready").length;
  const needsCount = Math.max(courses.length - readyCount, 0);
  const scheduledCount = courses.filter(c => (c.courseSessionTemplates || []).length > 0).length;
  const registrationReady = courses.length > 0 && needsCount === 0;

  if (!campId) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center"><span className="text-4xl mb-3 block">🎯</span><p>Select a camp to view activities.</p></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-amber-50 p-6 shadow-sm">
        <div className="absolute right-6 top-6 hidden h-24 w-24 rounded-full bg-amber-200/30 blur-2xl md:block" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-700 shadow-sm">
              🏕️ Activity command center
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
                  <button onClick={() => { document.getElementById("activity-schedule-grid")?.scrollIntoView({ behavior: "smooth", block: "start" }); setToolsOpen(false); }} className="w-full rounded-xl px-3 py-2 text-left font-semibold text-slate-700 hover:bg-sky-50">▦ Jump to working grid</button>
                  <button onClick={() => { setEditingMandatory(null); setShowMandatoryModal(true); setToolsOpen(false); }} className="w-full rounded-xl px-3 py-2 text-left font-semibold text-slate-700 hover:bg-amber-50">🔒 Add required assembly</button>
                  <a href={`/import${campId ? `?campId=${campId}` : ""}`} className="block rounded-xl px-3 py-2 font-semibold text-slate-700 hover:bg-emerald-50">📥 Import activities</a>
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

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Activities", value: courses.length, detail: "in catalog", tone: "from-sky-500 to-sky-600", action: () => { setStatusFilter("all"); setSearch(""); } },
          { label: "Scheduled", value: scheduledCount, detail: "have a time", tone: "from-emerald-500 to-forest-600", action: () => document.getElementById("activity-schedule-grid")?.scrollIntoView({ behavior: "smooth", block: "start" }) },
          { label: "Need attention", value: needsCount, detail: needsCount === 0 ? "all clear" : "missing details", tone: "from-amber-500 to-orange-500", action: () => setStatusFilter("needs") },
          { label: "Registration", value: registrationReady ? "Ready" : "Not yet", detail: `${mandatorySessions.length} default block${mandatorySessions.length !== 1 ? "s" : ""}`, tone: registrationReady ? "from-emerald-500 to-forest-600" : "from-slate-500 to-slate-600", action: () => document.getElementById("activity-schedule-grid")?.scrollIntoView({ behavior: "smooth", block: "start" }) },
        ].map(card => (
          <button key={card.label} onClick={card.action} className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className={`mb-3 h-1.5 rounded-full bg-gradient-to-r ${card.tone}`} />
            <div className="text-2xl font-black text-slate-900">{card.value}</div>
            <div className="text-sm font-bold text-slate-700">{card.label}</div>
            <div className="text-xs text-slate-400">{card.detail}</div>
          </button>
        ))}
      </div>

      <div id="activity-schedule-grid" className="scroll-mt-6">
        <TimeslotAssignmentGrid campId={campId} />
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Activity details & advanced actions</h2>
              <p className="mt-1 text-xs text-slate-500">Kept below the working grid so the schedule stays calm. Open when you need descriptions, age groups, edit, or delete.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{filteredByStatus.length} shown</span>
          </div>
        </summary>
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

          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest-500 border-t-transparent" />
            </div>
          ) : filteredByStatus.length === 0 ? (
            <div className="camp-card p-12 text-center">
              <span className="mb-4 block text-5xl">🎯</span>
              <h3 className="mb-2 font-bold text-slate-700">{search || statusFilter !== "all" ? "No activities match" : "No activities yet"}</h3>
              <p className="mb-5 text-sm text-slate-400">Create activities first, then schedule them in the grid above.</p>
              <button onClick={() => { setEditingCourse(null); setShowModal(true); }} className="rounded-xl bg-gradient-to-r from-forest-500 to-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">+ Add First Activity</button>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filteredByStatus.map(course => {
                const status = activityStatus(course);
                const teacher = leadTeacher(course);
                const slots = course.courseSessionTemplates || [];
                return (
                  <div key={course.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-xl text-white shadow-sm" style={{ backgroundColor: course.color || "#22C55E" }}>{course.icon || "🎯"}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-black text-slate-900">{course.name}</h3>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${status.tone}`}>{status.label}</span>
                        </div>
                        {course.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{course.description}</p>}
                        <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="font-bold text-slate-500">Time:</span> {scheduleSummary(course)}</div>
                          <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="font-bold text-slate-500">Room:</span> {course.room?.name || "Not assigned"}</div>
                          <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="font-bold text-slate-500">Teacher:</span> {teacher ? `${teacher.firstName} ${teacher.lastName}` : "Not assigned"}</div>
                          <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="font-bold text-slate-500">Capacity:</span> {course.cap || "—"} seats</div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {course.courseAgeGroups && course.courseAgeGroups.length > 0 ? course.courseAgeGroups.map(cag => (
                            <span key={cag.ageGroup.id} className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: cag.ageGroup.color }}>{cag.ageGroup.name}</span>
                          )) : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-400">No age groups</span>}
                          {slots.length > 1 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{slots.length} time slots</span>}
                        </div>
                      </div>
                      <div className="relative flex flex-shrink-0 items-center gap-1">
                        <button onClick={() => { setEditingCourse(course); setShowModal(true); }} className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100">Edit</button>
                        <button onClick={() => setOpenMenuId(openMenuId === course.id ? null : course.id)} className="rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50">⋯</button>
                        {openMenuId === course.id && (
                          <div className="absolute right-0 top-10 z-10 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                            <button onClick={() => { setEditingCourse(course); setShowModal(true); setOpenMenuId(null); }} className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50">✏️ Edit details</button>
                            <button onClick={() => { document.getElementById("activity-schedule-grid")?.scrollIntoView({ behavior: "smooth", block: "start" }); setOpenMenuId(null); }} className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-sky-50">▦ Jump to grid</button>
                            <button onClick={() => { deleteCourse(course.id); setOpenMenuId(null); }} className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50">🗑️ Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </details>

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
