"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
  label: string;
  day: string;
  startTime: string;
  endTime: string;
}

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

  // Camp form state
  const [campName,          setCampName]          = useState("");
  const [startDate,         setStartDate]         = useState("");
  const [endDate,           setEndDate]           = useState("");
  const [registrationOpen,  setRegistrationOpen]  = useState(false);
  const [status,            setStatus]            = useState("draft");

  // New room form
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCap,  setNewRoomCap]  = useState("30");
  const [newRoomDesc, setNewRoomDesc] = useState("");

  // Room inline editing
  const [editingRoomId,   setEditingRoomId]   = useState<string | null>(null);
  const [editRoomName,    setEditRoomName]    = useState("");
  const [editRoomCap,     setEditRoomCap]     = useState("");
  const [editRoomDesc,    setEditRoomDesc]    = useState("");

  // New age group form
  const [newAgeName,  setNewAgeName]  = useState("");
  const [newAgeMin,   setNewAgeMin]   = useState("");
  const [newAgeMax,   setNewAgeMax]   = useState("");
  const [newAgeColor, setNewAgeColor] = useState("#22C55E");

  // New time slot form
  const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const [newSlotLabel, setNewSlotLabel] = useState("");
  const [newSlotDay,   setNewSlotDay]   = useState("Monday");
  const [newSlotStart, setNewSlotStart] = useState("09:00");
  const [newSlotEnd,   setNewSlotEnd]   = useState("10:00");

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

  const addSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/camps/${campId}/session-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newSlotLabel, day: newSlotDay, startTime: newSlotStart, endTime: newSlotEnd }),
    });
    if (res.ok) { setNewSlotLabel(""); setNewSlotStart("09:00"); setNewSlotEnd("10:00"); load(); }
  };

  const deleteSlot = async (id: string) => {
    if (!confirm("Delete this time slot?")) return;
    await fetch(`/api/camps/${campId}/session-templates/${id}`, { method: "DELETE" });
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

      {/* ── Camp Details ── */}
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

      {/* ── Rooms ── */}
      <Section title="📍 Rooms & Locations">
        <div className="space-y-3 mb-4">
          {rooms.length === 0 && <p className="text-slate-400 text-sm">No rooms yet. Add your first room below.</p>}
          {rooms.map(room => (
            <div key={room.id}>
              {editingRoomId === room.id ? (
                /* ── inline edit row ── */
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
                      className="w-full max-w-md px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30" />
                  </div>
                </div>
              ) : (
                /* ── read-only row ── */
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
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Capacity</label>
            <input type="number" value={newRoomCap} onChange={e => setNewRoomCap(e.target.value)} min={1}
              className="w-20 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Location / Description</label>
            <input type="text" value={newRoomDesc} onChange={e => setNewRoomDesc(e.target.value)} placeholder="e.g. North wing"
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
          </div>
          <button type="submit" className="px-4 py-2 bg-forest-500 text-white rounded-xl text-sm font-semibold hover:bg-forest-600 transition-colors">
            + Add Room
          </button>
        </form>
      </Section>

      {/* ── Age Groups ── */}
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
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Min Age</label>
            <input type="number" value={newAgeMin} onChange={e => setNewAgeMin(e.target.value)} min={1} placeholder="6"
              className="w-16 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Max Age</label>
            <input type="number" value={newAgeMax} onChange={e => setNewAgeMax(e.target.value)} min={1} placeholder="12"
              className="w-16 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
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

      {/* ── Time Slots ── */}
      <Section title="🕐 Time Slots">
        <p className="text-xs text-slate-400 mb-4">Define the recurring time blocks for your camp schedule. These are the slots you&apos;ll assign activities to.</p>

        {slots.length === 0 && (
          <p className="text-slate-400 text-sm mb-4">No time slots yet. Add your first one below.</p>
        )}

        {/* Group slots by day */}
        {DAYS.filter(d => slots.some(s => s.day === d)).map(day => (
          <div key={day} className="mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{day}</p>
            <div className="space-y-2">
              {slots
                .filter(s => s.day === day)
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map(slot => (
                  <div key={slot.id} className="flex items-center justify-between py-2.5 px-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-100 text-sky-700 rounded-lg text-xs font-semibold">
                        🕐 {slot.startTime} – {slot.endTime}
                      </span>
                      <span className="font-medium text-slate-800 text-sm">{slot.label}</span>
                    </div>
                    <button onClick={() => deleteSlot(slot.id)} className="text-slate-300 hover:text-red-500 transition-colors text-sm p-1">🗑️</button>
                  </div>
                ))}
            </div>
          </div>
        ))}

        <form onSubmit={addSlot} className="flex gap-3 items-end flex-wrap mt-2 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Label</label>
            <input type="text" value={newSlotLabel} onChange={e => setNewSlotLabel(e.target.value)} required placeholder="e.g. Morning Session"
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Day</label>
            <select value={newSlotDay} onChange={e => setNewSlotDay(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30">
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Start Time</label>
            <input type="time" value={newSlotStart} onChange={e => setNewSlotStart(e.target.value)} required
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">End Time</label>
            <input type="time" value={newSlotEnd} onChange={e => setNewSlotEnd(e.target.value)} required
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30" />
          </div>
          <button type="submit" className="px-4 py-2 bg-sky-500 text-white rounded-xl text-sm font-semibold hover:bg-sky-600 transition-colors">
            + Add Slot
          </button>
        </form>
      </Section>
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
