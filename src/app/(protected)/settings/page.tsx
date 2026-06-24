"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="camp-card p-6 mb-5">
      <h2 className="font-bold text-slate-800 mb-4 text-base">{title}</h2>
      {children}
    </div>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  const [camp, setCamp] = useState<Camp | null>(null);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Camp form state
  const [campName, setCampName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [status, setStatus] = useState("draft");

  // New room form
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCap, setNewRoomCap] = useState("30");

  // New age group form
  const [newAgeName, setNewAgeName] = useState("");
  const [newAgeMin, setNewAgeMin] = useState("");
  const [newAgeMax, setNewAgeMax] = useState("");
  const [newAgeColor, setNewAgeColor] = useState("#22C55E");

  const load = () => {
    if (!campId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/camps/${campId}`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/age-groups`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/rooms`).then((r) => r.json()),
    ]).then(([c, ag, r]) => {
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
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [campId]);

  const saveCamp = async () => {
    setSaving(true);
    const res = await fetch(`/api/camps/${campId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: campName,
        startDate: startDate || null,
        endDate: endDate || null,
        registrationOpen,
        status,
      }),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  const addRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/camps/${campId}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoomName, capacity: parseInt(newRoomCap) }),
    });
    if (res.ok) { setNewRoomName(""); setNewRoomCap("30"); load(); }
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
      body: JSON.stringify({
        name: newAgeName,
        minAge: newAgeMin ? parseInt(newAgeMin) : undefined,
        maxAge: newAgeMax ? parseInt(newAgeMax) : undefined,
        color: newAgeColor,
        displayOrder: ageGroups.length,
      }),
    });
    if (res.ok) { setNewAgeName(""); setNewAgeMin(""); setNewAgeMax(""); load(); }
  };

  const deleteAgeGroup = async (id: string) => {
    if (!confirm("Delete this age group?")) return;
    await fetch(`/api/camps/${campId}/age-groups/${id}`, { method: "DELETE" });
    load();
  };

  if (!campId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="text-center">
          <span className="text-4xl mb-3 block">⚙️</span>
          <p>Select a camp to manage its settings.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-berry-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage camp details, rooms, and age groups</p>
        </div>
      </div>

      {/* Camp Details */}
      <Section title="🏕️ Camp Details">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Camp Name</label>
            <input
              type="text"
              value={campName}
              onChange={(e) => setCampName(e.target.value)}
              className="w-full max-w-md px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-berry-500/30 focus:border-berry-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-berry-500/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-berry-500/30"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-berry-500/30"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                role="switch"
                aria-checked={registrationOpen}
                onClick={() => setRegistrationOpen((v) => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${registrationOpen ? "bg-forest-500" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${registrationOpen ? "translate-x-5" : ""}`} />
              </button>
              <span className="text-sm font-medium text-slate-700">Registration Open</span>
            </div>
          </div>
          <button
            onClick={saveCamp}
            disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${saved ? "bg-forest-500 text-white" : "bg-gradient-to-r from-berry-500 to-berry-600 text-white hover:opacity-90"} disabled:opacity-60`}
          >
            {saved ? "✓ Saved!" : saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Section>

      {/* Rooms */}
      <Section title="📍 Rooms & Locations">
        <div className="space-y-3 mb-4">
          {rooms.length === 0 && (
            <p className="text-slate-400 text-sm">No rooms yet. Add your first room below.</p>
          )}
          {rooms.map((room) => (
            <div key={room.id} className="flex items-center justify-between py-2.5 px-4 bg-slate-50 rounded-xl">
              <div>
                <span className="font-medium text-slate-800 text-sm">{room.name}</span>
                <span className="text-slate-400 text-xs ml-3">cap: {room.capacity}</span>
                {room.description && <span className="text-slate-400 text-xs ml-3">{room.description}</span>}
              </div>
              <button onClick={() => deleteRoom(room.id)} className="text-slate-300 hover:text-red-500 transition-colors text-sm p-1">🗑️</button>
            </div>
          ))}
        </div>
        <form onSubmit={addRoom} className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Room Name</label>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              required
              placeholder="e.g. Main Hall"
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Capacity</label>
            <input
              type="number"
              value={newRoomCap}
              onChange={(e) => setNewRoomCap(e.target.value)}
              min={1}
              className="w-20 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-forest-500 text-white rounded-xl text-sm font-semibold hover:bg-forest-600 transition-colors">
            + Add Room
          </button>
        </form>
      </Section>

      {/* Age Groups */}
      <Section title="👦 Age Groups">
        <div className="space-y-3 mb-4">
          {ageGroups.length === 0 && (
            <p className="text-slate-400 text-sm">No age groups yet. Add your first group below.</p>
          )}
          {ageGroups
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((ag) => (
              <div key={ag.id} className="flex items-center justify-between py-2.5 px-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: ag.color }} />
                  <span className="font-medium text-slate-800 text-sm">{ag.name}</span>
                  {(ag.minAge || ag.maxAge) && (
                    <span className="text-slate-400 text-xs">
                      {ag.minAge ?? "?"}-{ag.maxAge ?? "?"} yrs
                    </span>
                  )}
                  {ag.noSchedule && (
                    <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                      Registration only
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer" title="No schedule — registration, t-shirts, nametags only">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={ag.noSchedule}
                      onClick={async () => {
                        await fetch(`/api/camps/${campId}/age-groups/${ag.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ noSchedule: !ag.noSchedule }),
                        });
                        setAgeGroups(prev => prev.map(g => g.id === ag.id ? { ...g, noSchedule: !g.noSchedule } : g));
                      }}
                      className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${ag.noSchedule ? "bg-amber-400" : "bg-slate-200"}`}
                    >
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
            <input
              type="text"
              value={newAgeName}
              onChange={(e) => setNewAgeName(e.target.value)}
              required
              placeholder="e.g. Younger Campers"
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Min Age</label>
            <input
              type="number"
              value={newAgeMin}
              onChange={(e) => setNewAgeMin(e.target.value)}
              min={1}
              placeholder="6"
              className="w-16 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Max Age</label>
            <input
              type="number"
              value={newAgeMax}
              onChange={(e) => setNewAgeMax(e.target.value)}
              min={1}
              placeholder="12"
              className="w-16 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Color</label>
            <input
              type="color"
              value={newAgeColor}
              onChange={(e) => setNewAgeColor(e.target.value)}
              className="w-10 h-9 border border-slate-200 rounded-xl cursor-pointer"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-forest-500 text-white rounded-xl text-sm font-semibold hover:bg-forest-600 transition-colors">
            + Add Group
          </button>
        </form>
      </Section>

      {/* Danger zone */}
      <Section title="⚠️ Danger Zone">
        <p className="text-slate-500 text-sm mb-4">These actions are permanent and cannot be undone.</p>
        <button
          onClick={() => {
            if (confirm(`Delete "${campName}" and all its data? This cannot be undone.`)) {
              fetch(`/api/camps/${campId}`, { method: "DELETE" }).then(() => {
                window.location.href = "/dashboard";
              });
            }
          }}
          className="px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors"
        >
          🗑️ Delete This Camp
        </button>
      </Section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-berry-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}
