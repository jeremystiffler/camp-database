"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgeGroup { id: string; name: string; color: string; }
interface Room     { id: string; name: string; capacity: number; }
interface Person   { id: string; firstName: string; lastName: string; email?: string; role: string; }
interface SessionTemplate { id: string; label?: string; dayOfWeek?: number | null; startTime: string; endTime: string; }

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
    setLoading(true); setError("");
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
      if (res.ok) { onSaved(); onClose(); }
      else { const d = await res.json(); setError(d.error || "Failed to save"); }
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
              {loading ? "Saving..." : course ? "Save Changes" : "Create Activity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ActivitiesContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  const [courses, setCourses]                   = useState<Course[]>([]);
  const [ageGroups, setAgeGroups]               = useState<AgeGroup[]>([]);
  const [rooms, setRooms]                       = useState<Room[]>([]);
  const [persons, setPersons]                   = useState<Person[]>([]);
  const [sessionTemplates, setSessionTemplates] = useState<SessionTemplate[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [search, setSearch]                     = useState("");
  const [editingCourse, setEditingCourse]       = useState<Course | null | undefined>(undefined);
  const [showModal, setShowModal]               = useState(false);

  const load = () => {
    if (!campId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/camps/${campId}/courses`).then(r => r.json()),
      fetch(`/api/camps/${campId}/age-groups`).then(r => r.json()),
      fetch(`/api/camps/${campId}/rooms`).then(r => r.json()),
      fetch(`/api/camps/${campId}/persons`).then(r => r.json()),
      fetch(`/api/camps/${campId}/session-templates`).then(r => r.json()),
    ]).then(([c, ag, r, p, st]) => {
      setCourses(Array.isArray(c) ? c : []);
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

  const filtered = courses.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  if (!campId) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center"><span className="text-4xl mb-3 block">🎯</span><p>Select a camp to view activities.</p></div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Activities</h1>
          <p className="text-slate-500 text-sm mt-0.5">{courses.length} {courses.length === 1 ? "activity" : "activities"}</p>
        </div>
        <button onClick={() => { setEditingCourse(null); setShowModal(true); }}
          className="px-4 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 flex items-center gap-2">
          + New Activity
        </button>
      </div>

      <div className="mb-5">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search activities..."
          className="w-full max-w-sm px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="camp-card p-12 text-center">
          <span className="text-5xl mb-4 block">🎯</span>
          <h3 className="font-bold text-slate-700 mb-2">{search ? "No activities match" : "No activities yet"}</h3>
          <p className="text-slate-400 text-sm mb-5">Create your first activity with rooms, teachers, and time slots.</p>
          {!search && (
            <button onClick={() => { setEditingCourse(null); setShowModal(true); }}
              className="px-5 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
              + Add First Activity
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(course => {
            const teachers   = course.courseTeachers?.filter(ct => ct.person.role === "teacher" || ct.person.role === "director") || [];
            const aides      = course.courseTeachers?.filter(ct => ct.person.role === "assistant" || ct.person.role === "staff") || [];
            return (
              <div key={course.id} className="camp-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-white flex-shrink-0"
                      style={{ backgroundColor: course.color || "#22C55E" }}>
                      {course.icon || "🎯"}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm leading-tight">{course.name}</h3>
                      {course.courseAgeGroups && course.courseAgeGroups.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-0.5">
                          {course.courseAgeGroups.map(cag => (
                            <span key={cag.ageGroup.id} className="text-xs px-1.5 py-0.5 rounded-full text-white font-medium"
                              style={{ backgroundColor: cag.ageGroup.color }}>
                              {cag.ageGroup.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingCourse(course); setShowModal(true); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors text-sm">✏️</button>
                    <button onClick={() => deleteCourse(course.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors text-sm">🗑️</button>
                  </div>
                </div>

                {course.description && (
                  <p className="text-slate-500 text-xs mb-3 leading-relaxed line-clamp-2">{course.description}</p>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  {course.room && (
                    <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-slate-600">
                      📍 {course.room.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-slate-600">
                    👥 {course.cap}
                  </span>
                  {teachers.length > 0 && (
                    <span className="flex items-center gap-1 bg-berry-50 border border-berry-100 px-2 py-1 rounded-lg text-berry-700">
                      🧑‍🏫 {teachers.map(t => t.person.firstName).join(", ")}
                    </span>
                  )}
                  {aides.length > 0 && (
                    <span className="flex items-center gap-1 bg-sky-50 border border-sky-100 px-2 py-1 rounded-lg text-sky-700">
                      🤝 {aides.map(t => t.person.firstName).join(", ")}
                    </span>
                  )}
                  {course.courseSessionTemplates && course.courseSessionTemplates.length > 0 && (
                    <span className="flex items-center gap-1 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg text-amber-700">
                      ⏰ {course.courseSessionTemplates.length} slot{course.courseSessionTemplates.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
