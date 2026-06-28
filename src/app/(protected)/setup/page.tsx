"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { TeachersContent } from "../teachers/page";
import { ActivitiesContent } from "../activities/page";

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
}

const DAY_INT_TO_NAME = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_ABBR        = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
type SetupTab = "details" | "rooms" | "ages" | "times" | "teachers" | "activities";

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
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [activeTab, setActiveTab]  = useState<SetupTab>("details");

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

  // Room inline editing
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoomName,  setEditRoomName]  = useState("");
  const [editRoomCap,   setEditRoomCap]   = useState("");
  const [editRoomDesc,  setEditRoomDesc]  = useState("");

  // New age group form
  const [newAgeName,  setNewAgeName]  = useState("");
  const [newAgeMin,   setNewAgeMin]   = useState("");
  const [newAgeMax,   setNewAgeMax]   = useState("");
  const [newAgeColor, setNewAgeColor] = useState("#22C55E");

  // Time Slots grid state
  const [weekOffset, setWeekOffset] = useState(0);
  const [draftRows,  setDraftRows]  = useState<DraftRow[]>([]);

  const load = () => {
    if (!campId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/camps/${campId}`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/age-groups`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/rooms`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/session-templates`).then((r) => r.json()),
    ]).then(([c, ag, r, st]) => {
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
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [campId]);

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
      if (slot.dayOfWeek !== null && slot.dayOfWeek !== undefined) {
        row.days.add(slot.dayOfWeek);
        row.slotIds.set(slot.dayOfWeek, slot.id);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [slots]);

  const isEveryDayForRow = (row: SessionRow) =>
    campDayOfWeeks.size > 0 && [...campDayOfWeeks].every(d => row.days.has(d));

  // ── Handlers ──

  const saveCamp = async () => {
    setSaving(true);
    const res = await fetch(`/api/camps/${campId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: campName, startDate: startDate || null, endDate: endDate || null, registrationOpen, status }),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
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

  const startEditRoom = (room: Room) => {
    setEditingRoomId(room.id);
    setEditRoomName(room.name);
    setEditRoomCap(room.capacity?.toString() ?? "");
    setEditRoomDesc(room.description ?? "");
  };

  const saveRoom = async (id: string) => {
    await fetch(`/api/camps/${campId}/rooms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editRoomName, capacity: editRoomCap ? parseInt(editRoomCap) : undefined, description: editRoomDesc || undefined }),
    });
    setEditingRoomId(null);
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

  const deleteAgeGroup = async (id: string) => {
    if (!confirm("Delete this age group?")) return;
    await fetch(`/api/camps/${campId}/age-groups/${id}`, { method: "DELETE" });
    load();
  };

  // Toggle whether a session row is mandatory. Mandatory sessions appear on schedules but parents do not choose a class for them.
  const setMandatoryForRow = async (row: SessionRow, mandatory: boolean) => {
    await Promise.all([...row.slotIds.values()].map(id =>
      fetch(`/api/camps/${campId}/session-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandatory }),
      })
    ));
    load();
  };

  // Toggle a single day checkbox for an existing session row
  const toggleDayForSession = async (row: SessionRow, dayOfWeek: number) => {
    if (row.days.has(dayOfWeek)) {
      const slotId = row.slotIds.get(dayOfWeek);
      if (slotId) await fetch(`/api/camps/${campId}/session-templates/${slotId}`, { method: "DELETE" });
    } else {
      await fetch(`/api/camps/${campId}/session-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: row.label, startTime: row.startTime, endTime: row.endTime, day: DAY_INT_TO_NAME[dayOfWeek] }),
      });
    }
    load();
  };

  // Per-row "every day" toggle
  const setEveryDayForRow = async (row: SessionRow, enable: boolean) => {
    if (enable) {
      const missing = [...campDayOfWeeks].filter(d => !row.days.has(d));
      await Promise.all(missing.map(dow =>
        fetch(`/api/camps/${campId}/session-templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: row.label, startTime: row.startTime, endTime: row.endTime, day: DAY_INT_TO_NAME[dow] }),
        })
      ));
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
    setDraftRows(prev => [...prev, { id: Math.random().toString(36).slice(2), label: `Session ${num}`, start: "09:00", end: "10:00" }]);
  };

  const updateDraft = (id: string, field: keyof Omit<DraftRow, "id">, value: string) => {
    setDraftRows(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const removeDraft = (id: string) => setDraftRows(prev => prev.filter(d => d.id !== id));

  // First checkbox click on a draft row → saves to DB
  const commitDraftDay = async (draft: DraftRow, dayOfWeek: number) => {
    if (!draft.label.trim() || !draft.start || !draft.end) return;
    await fetch(`/api/camps/${campId}/session-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: draft.label.trim(), startTime: draft.start, endTime: draft.end, day: DAY_INT_TO_NAME[dayOfWeek] }),
    });
    setDraftRows(prev => prev.filter(d => d.id !== draft.id));
    load();
  };

  // "Fill every day" on a draft row
  const commitDraftEveryDay = async (draft: DraftRow) => {
    if (!draft.label.trim() || !draft.start || !draft.end) return;
    await Promise.all([...campDayOfWeeks].map(dow =>
      fetch(`/api/camps/${campId}/session-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: draft.label.trim(), startTime: draft.start, endTime: draft.end, day: DAY_INT_TO_NAME[dow] }),
      })
    ));
    setDraftRows(prev => prev.filter(d => d.id !== draft.id));
    load();
  };

  if (!campId) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center"><span className="text-4xl mb-3 block">🏕️</span><p>Select a camp to configure it.</p></div>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-berry-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const totalPages = Math.ceil(campDates.length / 7);

  const setupTabs: Array<{ key: SetupTab; label: string; icon: string; count?: string | number; help: string }> = [
    { key: "details", label: "Camp Details", icon: "🏕️", help: "Name, dates, registration" },
    { key: "rooms", label: "Rooms", icon: "📍", count: rooms.length, help: "Locations + capacities" },
    { key: "ages", label: "Age Groups", icon: "👦", count: ageGroups.length, help: "Registration groups" },
    { key: "times", label: "Time Slots", icon: "🕐", count: sessionRows.length, help: "Daily session blocks" },
    { key: "teachers", label: "Teachers", icon: "🧑‍🏫", help: "People + schedules" },
    { key: "activities", label: "Activities", icon: "🎯", help: "Classes + grid" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Camp Setup</h1>
          <p className="text-slate-500 text-sm mt-0.5">Configure camp info, rooms, and age groups</p>
        </div>
      </div>

      {/* ── Import shortcut ── */}
      <div className="camp-card p-5 border-2 border-dashed border-slate-200 bg-slate-50/50 mb-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-forest-400 flex items-center justify-center text-white text-xl flex-shrink-0">
              📥
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Bulk Import</p>
              <p className="text-xs text-slate-500 mt-0.5">Upload a spreadsheet to create activities, teachers, rooms, and time slots all at once.</p>
            </div>
          </div>
          <Link href={`/import?campId=${campId}`}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2 whitespace-nowrap flex-shrink-0">
            Go to Import →
          </Link>
        </div>
      </div>

      <div className="camp-card p-2 mb-5 sticky top-0 z-20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {setupTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-3 py-3 text-left transition ${activeTab === tab.key ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-black">
                <span>{tab.icon} {tab.label}</span>
                {tab.count !== undefined && <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeTab === tab.key ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>{tab.count}</span>}
              </span>
              <span className={`mt-0.5 block text-[11px] ${activeTab === tab.key ? "text-white/60" : "text-slate-400"}`}>{tab.help}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Camp Details ── */}
      {activeTab === "details" && (
      <Section title="🏕️ Camp Details">
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
                className={`relative w-10 h-5 rounded-full transition-colors ${registrationOpen ? "bg-forest-500" : "bg-slate-200"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${registrationOpen ? "translate-x-5" : ""}`} />
              </button>
              <span className="text-sm font-medium text-slate-700">Registration Open</span>
            </div>
          </div>
          <button onClick={saveCamp} disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${saved ? "bg-forest-500 text-white" : "bg-gradient-to-r from-berry-500 to-berry-600 text-white hover:opacity-90"} disabled:opacity-60`}>
            {saved ? "✓ Saved!" : saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Section>
      )}

      {/* ── Rooms ── */}
      {activeTab === "rooms" && (
      <Section title="📍 Rooms & Locations">
        <div className="space-y-3 mb-4">
          {rooms.length === 0 && <p className="text-slate-400 text-sm">No rooms yet. Add your first room below.</p>}
          {rooms.map(room => (
            <div key={room.id}>
              {editingRoomId === room.id ? (
                <div className="flex flex-col gap-2 py-3 px-4 bg-sky-50 border border-sky-200 rounded-xl">
                  <div className="flex gap-3 items-end flex-wrap">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                      <input type="text" value={editRoomName} onChange={e => setEditRoomName(e.target.value)} required
                        className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Capacity</label>
                      <input type="number" value={editRoomCap} onChange={e => setEditRoomCap(e.target.value)} min={1}
                        className="w-20 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveRoom(room.id)}
                        className="px-4 py-2 bg-sky-500 text-white rounded-xl text-sm font-semibold hover:bg-sky-600 transition-colors">
                        ✓ Save
                      </button>
                      <button onClick={() => setEditingRoomId(null)}
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Location / Description</label>
                    <input type="text" value={editRoomDesc} onChange={e => setEditRoomDesc(e.target.value)} placeholder="e.g. North wing, second floor"
                      className="w-full max-w-md px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-[#636363] focus:outline-none focus:ring-2 focus:ring-sky-500/30" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between py-2.5 px-4 bg-slate-50 rounded-xl">
                  <div>
                    <span className="font-medium text-slate-800 text-sm">{room.name}</span>
                    {room.capacity && <span className="text-slate-400 text-xs ml-3">cap: {room.capacity}</span>}
                    {room.description && <span className="text-slate-400 text-xs ml-3">· {room.description}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEditRoom(room)} className="text-slate-400 hover:text-sky-500 transition-colors text-sm p-1" title="Edit">✏️</button>
                    <button onClick={() => deleteRoom(room.id)} className="text-slate-300 hover:text-red-500 transition-colors text-sm p-1" title="Delete">🗑️</button>
                  </div>
                </div>
              )}
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
          <button type="submit" className="px-4 py-2 bg-forest-500 text-white rounded-xl text-sm font-semibold hover:bg-forest-600 transition-colors">
            + Add Room
          </button>
        </form>
      </Section>
      )}

      {/* ── Age Groups ── */}
      {activeTab === "ages" && (
      <Section title="👦 Age Groups">
        <div className="space-y-3 mb-4">
          {ageGroups.length === 0 && <p className="text-slate-400 text-sm">No age groups yet. Add your first group below.</p>}
          {ageGroups
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map(ag => (
              <div key={ag.id} className="flex items-center justify-between py-2.5 px-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: ag.color }} />
                  <span className="font-medium text-slate-800 text-sm">{ag.name}</span>
                  {(ag.minAge || ag.maxAge) && (
                    <span className="text-slate-400 text-xs">{ag.minAge ?? "?"}-{ag.maxAge ?? "?"} yrs</span>
                  )}
                  {ag.noSchedule && (
                    <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                      Registration only
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
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
                    <span className="text-xs text-slate-500 whitespace-nowrap">Reg. only</span>
                  </label>
                  <button onClick={() => deleteAgeGroup(ag.id)} className="text-slate-300 hover:text-red-500 transition-colors text-sm p-1">🗑️</button>
                </div>
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
          <button type="submit" className="px-4 py-2 bg-forest-500 text-white rounded-xl text-sm font-semibold hover:bg-forest-600 transition-colors">
            + Add Group
          </button>
        </form>
      </Section>
      )}

      {/* ── Time Slots ── */}
      {activeTab === "times" && (
      <Section title="🕐 Time Slots">
        <p className="text-xs text-slate-400 mb-4">
          Each row is a session (e.g. "Morning Session"). Check the days it runs. Toggle the switch on a row to fill every day of camp instantly.
        </p>

        {/* No dates warning */}
        {campDates.length === 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-4">
            <span className="text-lg">📅</span>
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 border-b border-slate-200 w-52 min-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-6 h-3 rounded-full bg-slate-200 inline-block" title="Every-day toggle" />
                        Session
                      </div>
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
                    return (
                      <tr key={row.key} className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-sky-50/30 transition-colors`}>
                        {/* Session info cell */}
                        <td className="py-3 px-4 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            {/* Every-day toggle */}
                            <button
                              type="button"
                              onClick={() => setEveryDayForRow(row, !everyDay)}
                              title={everyDay ? "Clear all days" : "Fill every day of camp"}
                              className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${everyDay ? "bg-sky-500" : "bg-slate-200"}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${everyDay ? "translate-x-4" : ""}`} />
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <div className="font-semibold text-slate-800 text-xs truncate">{row.label}</div>
                                {row.mandatory && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">Mandatory</span>}
                              </div>
                              <div className="text-xs text-slate-400">{row.startTime} – {row.endTime}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setMandatoryForRow(row, !row.mandatory)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${row.mandatory ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                              title={row.mandatory ? "Parents will not choose a class for this session" : "Mark this session as mandatory"}
                            >
                              {row.mandatory ? "Required" : "Optional"}
                            </button>
                            <button
                              onClick={() => deleteSessionRow(row)}
                              className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 text-xs"
                              title="Delete session"
                            >🗑️</button>
                          </div>
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
                              {valid && (
                                <button
                                  type="button"
                                  onClick={() => commitDraftEveryDay(draft)}
                                  className="text-xs text-sky-600 hover:text-sky-800 font-medium transition-colors"
                                >
                                  ↺ Every day
                                </button>
                              )}
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
                        {/* Draft checkboxes — disabled until label+times filled */}
                        {visibleDates.map(d => (
                          <td key={d.toISOString()} className="text-center py-3 px-2 border-b border-sky-100">
                            <input
                              type="checkbox"
                              disabled={!valid}
                              onChange={valid ? () => commitDraftDay(draft, d.getDay()) : undefined}
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
                      <td colSpan={visibleDates.length + 1} className="text-center py-8 text-slate-400 text-sm">
                        No sessions yet — click <strong>+ Add Session</strong> below to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={visibleDates.length + 1} className="px-4 py-3 bg-slate-50/50 rounded-b-xl border-t border-slate-200">
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
              <span>
                <span className="inline-block w-5 h-2.5 rounded-full bg-sky-500 align-middle mr-1" /> toggle = every day of camp
              </span>
              <span>checkboxes save instantly</span>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ActivitiesContent />
        </div>
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
