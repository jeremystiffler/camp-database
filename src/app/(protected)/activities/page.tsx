"use client";

import { useState, useEffect } from "react";

interface Activity {
  id: string;
  name: string;
  cap: number;
  ageGroup: string;
  timeSlot: { id: string; label: string } | null;
  location: { id: string; name: string } | null;
  teachers: { teacher: { id: string; name: string } }[];
  _count?: { assignments: number };
}

interface Teacher {
  id: string;
  name: string;
}

interface TimeSlot {
  id: string;
  label: string;
}

interface Location {
  id: string;
  name: string;
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-night-700 border border-night-500 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading font-semibold text-xl text-cream">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-cream text-xl">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const ageGroupColors: Record<string, string> = {
  younger: "bg-info/10 text-info border-info/30",
  older: "bg-gold-500/10 text-gold-500 border-gold-500/30",
  both: "bg-success/10 text-success border-success/30",
};

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState({ name: "", timeSlotId: "", locationId: "", cap: 20, ageGroup: "both", teacherIds: [] as string[] });

  const fetchAll = async () => {
    try {
      const [actRes, teachRes, slotRes, locRes] = await Promise.all([
        fetch("/api/activities"), fetch("/api/teachers"), fetch("/api/time-slots"), fetch("/api/locations")
      ]);
      setActivities(Array.isArray(await actRes.json()) ? await actRes.json() : []);
      setTeachers(Array.isArray(await teachRes.json()) ? await teachRes.json() : []);
      setTimeSlots(Array.isArray(await slotRes.json()) ? await slotRes.json() : []);
      setLocations(Array.isArray(await locRes.json()) ? await locRes.json() : []);
    } catch { /* */ }
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", timeSlotId: "", locationId: "", cap: 20, ageGroup: "both", teacherIds: [] });
    setModalOpen(true);
  };

  const openEdit = (a: Activity) => {
    setEditing(a);
    setForm({
      name: a.name,
      timeSlotId: a.timeSlot?.id || "",
      locationId: a.location?.id || "",
      cap: a.cap,
      ageGroup: a.ageGroup,
      teacherIds: a.teachers.map(t => t.teacher.id),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const url = editing ? `/api/activities/${editing.id}` : "/api/activities";
    await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setModalOpen(false); fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this activity?")) return;
    await fetch(`/api/activities/${id}`, { method: "DELETE" }); fetchAll();
  };

  const toggleTeacher = (tid: string) => {
    setForm(f => ({
      ...f,
      teacherIds: f.teacherIds.includes(tid) ? f.teacherIds.filter(t => t !== tid) : [...f.teacherIds, tid],
    }));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-2 border-ember-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="font-heading font-bold text-3xl text-cream mb-2">Activities</h1><p className="text-muted">Create and manage camp activities</p></div>
        <button onClick={openCreate} className="px-5 py-2.5 text-sm font-medium bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl hover:opacity-90">+ New Activity</button>
      </div>

      {activities.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <span className="text-5xl mb-4 block">🎯</span>
          <h2 className="font-heading font-semibold text-xl text-cream mb-2">No activities yet</h2>
          <p className="text-muted mb-6">Create your first activity with time slots, locations, and teachers</p>
          <button onClick={openCreate} className="px-6 py-2.5 text-sm font-medium bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl hover:opacity-90">+ Create Activity</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activities.map((a) => {
            const enrolled = a._count?.assignments || 0;
            const fillPct = Math.min((enrolled / a.cap) * 100, 100);
            const fillColor = fillPct >= 90 ? "bg-error" : fillPct >= 70 ? "bg-gold-500" : "bg-success";
            return (
              <div key={a.id} className="glass-card rounded-2xl p-5 hover:border-ember-500/20 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-heading font-semibold text-lg text-cream">{a.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {a.timeSlot && <span className="text-xs text-muted bg-night-600 px-2 py-0.5 rounded-full">{a.timeSlot.label}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${ageGroupColors[a.ageGroup] || ageGroupColors.both}`}>{a.ageGroup}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(a)} className="px-2 py-1 text-xs text-muted hover:text-cream rounded">Edit</button>
                    <button onClick={() => handleDelete(a.id)} className="px-2 py-1 text-xs text-error hover:text-error/80 rounded">Delete</button>
                  </div>
                </div>
                {a.location && <p className="text-sm text-muted mb-2">📍 {a.location.name}</p>}
                {a.teachers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {a.teachers.map(t => (
                      <span key={t.teacher.id} className="text-xs bg-ember-500/10 text-ember-400 px-2 py-0.5 rounded-full">{t.teacher.name}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-night-600 rounded-full overflow-hidden">
                    <div className={`h-full ${fillColor} rounded-full transition-all`} style={{ width: `${fillPct}%` }} />
                  </div>
                  <span className="text-xs text-muted font-mono">{enrolled}/{a.cap}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Activity" : "New Activity"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">Activity Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bible Study" className="w-full px-3 py-2 bg-night-800 border border-night-500 rounded-xl text-cream text-sm placeholder:text-muted/40 focus:border-ember-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1.5">Time Slot</label>
              <select value={form.timeSlotId} onChange={(e) => setForm({ ...form, timeSlotId: e.target.value })} className="w-full px-3 py-2 bg-night-800 border border-night-500 rounded-xl text-cream text-sm focus:border-ember-500 focus:outline-none">
                <option value="">— None —</option>
                {timeSlots.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1.5">Location</label>
              <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className="w-full px-3 py-2 bg-night-800 border border-night-500 rounded-xl text-cream text-sm focus:border-ember-500 focus:outline-none">
                <option value="">— None —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1.5">Capacity</label>
              <input type="number" value={form.cap} onChange={(e) => setForm({ ...form, cap: parseInt(e.target.value) || 20 })} className="w-full px-3 py-2 bg-night-800 border border-night-500 rounded-xl text-cream text-sm focus:border-ember-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1.5">Age Group</label>
              <select value={form.ageGroup} onChange={(e) => setForm({ ...form, ageGroup: e.target.value })} className="w-full px-3 py-2 bg-night-800 border border-night-500 rounded-xl text-cream text-sm focus:border-ember-500 focus:outline-none">
                <option value="younger">Younger</option>
                <option value="older">Older</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5">Teachers</label>
            <div className="flex flex-wrap gap-2">
              {teachers.map(t => (
                <button
                  key={t.id}
                  onClick={() => toggleTeacher(t.id)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    form.teacherIds.includes(t.id)
                      ? "bg-ember-500/20 text-ember-400 border-ember-500/30"
                      : "bg-night-600 text-muted border-night-500 hover:border-night-400"
                  }`}
                >
                  {t.name}
                </button>
              ))}
              {teachers.length === 0 && <p className="text-sm text-muted/60">No teachers yet. Add teachers first.</p>}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 text-sm text-muted border border-night-500 rounded-xl hover:bg-night-600">Cancel</button>
            <button onClick={handleSave} className="flex-1 px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl hover:opacity-90">{editing ? "Save" : "Create"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
