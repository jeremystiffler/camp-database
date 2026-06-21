"use client";

import { useState, useEffect } from "react";

interface Camper {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  guardianName: string;
  guardianEmail: string;
  emergencyPhone: string | null;
  tshirtSize: string | null;
  ageGroup: string;
  photoConsent: boolean;
  editToken: string;
  createdAt: string;
}

const tshirtSizes = ["XS", "S", "M", "L", "XL", "XXL"];
const ageGroups = ["elementary", "middle", "high", "both"];

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-night-700 border border-night-500 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading font-semibold text-xl text-cream">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-cream text-xl">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function CampersPage() {
  const [campers, setCampers] = useState<Camper[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Camper | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Camper | null>(null);
  const [form, setForm] = useState({
    firstName: "", lastName: "", guardianName: "", guardianEmail: "",
    emergencyPhone: "", tshirtSize: "", ageGroup: "both", photoConsent: false,
  });

  const fetchCampers = async () => {
    try {
      const res = await fetch("/api/campers");
      const data = await res.json();
      setCampers(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchCampers(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ firstName: "", lastName: "", guardianName: "", guardianEmail: "", emergencyPhone: "", tshirtSize: "", ageGroup: "both", photoConsent: false });
    setModalOpen(true);
  };

  const openEdit = (c: Camper) => {
    setEditing(c);
    setForm({
      firstName: c.firstName, lastName: c.lastName, guardianName: c.guardianName,
      guardianEmail: c.guardianEmail, emergencyPhone: c.emergencyPhone || "",
      tshirtSize: c.tshirtSize || "", ageGroup: c.ageGroup, photoConsent: c.photoConsent,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const url = editing ? `/api/campers/${editing.id}` : "/api/campers";
    const method = editing ? "PUT" : "POST";
    try {
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setModalOpen(false);
      fetchCampers();
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/campers/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchCampers();
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-ember-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-bold text-3xl text-cream mb-2">Campers</h1>
          <p className="text-muted">Manage registered campers</p>
        </div>
        <button
          onClick={openCreate}
          className="px-5 py-2.5 text-sm font-medium bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl hover:opacity-90 transition-opacity"
        >
          + Add Camper
        </button>
      </div>

      {campers.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <span className="text-5xl mb-4 block">👦</span>
          <h2 className="font-heading font-semibold text-xl text-cream mb-2">No campers yet</h2>
          <p className="text-muted mb-6">Add campers manually or share the registration form link.</p>
          <button onClick={openCreate} className="px-6 py-2.5 text-sm font-medium bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl hover:opacity-90">
            + Add Camper
          </button>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-night-600">
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Guardian</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Age Group</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">T-Shirt</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Photo</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campers.map((c) => (
                  <tr key={c.id} className="border-b border-night-700 hover:bg-night-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-cream">{c.fullName}</div>
                      <div className="text-xs text-muted">{c.emergencyPhone || "—"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-cream">{c.guardianName}</div>
                      <div className="text-xs text-muted">{c.guardianEmail}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-ember-500/10 text-ember-400 border border-ember-500/30">
                        {c.ageGroup}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted">{c.tshirtSize || "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${c.photoConsent ? "bg-success/10 text-success border border-success/30" : "bg-night-500/20 text-muted border border-night-500/30"}`}>
                        {c.photoConsent ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openEdit(c)} className="text-xs text-cream border border-night-500 rounded-lg px-3 py-1 hover:bg-night-600 mr-2">
                        Edit
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className="text-xs text-error border border-error/30 rounded-lg px-3 py-1 hover:bg-error/10">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Camper" : "Add Camper"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1.5">First Name</label>
              <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-3 py-2 bg-night-800 border border-night-500 rounded-xl text-cream text-sm focus:border-ember-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1.5">Last Name</label>
              <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-3 py-2 bg-night-800 border border-night-500 rounded-xl text-cream text-sm focus:border-ember-500 focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1.5">Guardian Name</label>
              <input type="text" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
                className="w-full px-3 py-2 bg-night-800 border border-night-500 rounded-xl text-cream text-sm focus:border-ember-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1.5">Guardian Email</label>
              <input type="email" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })}
                className="w-full px-3 py-2 bg-night-800 border border-night-500 rounded-xl text-cream text-sm focus:border-ember-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5">Emergency Phone</label>
            <input type="tel" value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })}
              className="w-full px-3 py-2 bg-night-800 border border-night-500 rounded-xl text-cream text-sm focus:border-ember-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1.5">T-Shirt Size</label>
              <select value={form.tshirtSize} onChange={(e) => setForm({ ...form, tshirtSize: e.target.value })}
                className="w-full px-3 py-2 bg-night-800 border border-night-500 rounded-xl text-cream text-sm focus:border-ember-500 focus:outline-none">
                <option value="">Select...</option>
                {tshirtSizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1.5">Age Group</label>
              <select value={form.ageGroup} onChange={(e) => setForm({ ...form, ageGroup: e.target.value })}
                className="w-full px-3 py-2 bg-night-800 border border-night-500 rounded-xl text-cream text-sm focus:border-ember-500 focus:outline-none">
                {ageGroups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.photoConsent} onChange={(e) => setForm({ ...form, photoConsent: e.target.checked })}
              className="w-4 h-4 rounded border-night-500 bg-night-800 text-ember-500 focus:ring-ember-500" />
            <span className="text-sm text-muted">Photo consent granted</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 text-sm text-muted border border-night-500 rounded-xl hover:bg-night-600">Cancel</button>
            <button onClick={handleSave} className="flex-1 px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl hover:opacity-90">
              {editing ? "Save Changes" : "Add Camper"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Camper">
        <p className="text-muted mb-6">Are you sure you want to delete &quot;{deleteTarget?.fullName}&quot;? This action cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-muted border border-night-500 rounded-xl hover:bg-night-600">Cancel</button>
          <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium bg-error text-white rounded-xl hover:opacity-90">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
