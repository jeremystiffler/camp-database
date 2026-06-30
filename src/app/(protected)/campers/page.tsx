"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface AgeGroup {
  id: string;
  name: string;
  color: string;
}

interface Camper {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  guardianName?: string;
  guardianEmail?: string;
  guardianPhone?: string;
  emergencyPhone?: string;
  tshirtSize?: string;
  photoConsent: boolean;
  medicalNotes?: string;
  dietaryNotes?: string;
  dateOfBirth?: string;
  ageGroup?: AgeGroup | null;
  createdAt: string;
}

const TSHIRT_SIZES = ["YXS", "YS", "YM", "YL", "AS", "AM", "AL", "AXL", "A2XL"];

function age(dob: string) {
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return a;
}

function CamperDrawer({
  camper,
  campId,
  ageGroups,
  onClose,
  onSaved,
}: {
  camper: Camper;
  campId: string;
  ageGroups: AgeGroup[];
  onClose: () => void;
  onSaved: (camper: Camper) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: camper.firstName || "",
    lastName: camper.lastName || "",
    dateOfBirth: camper.dateOfBirth ? camper.dateOfBirth.slice(0, 10) : "",
    ageGroupId: camper.ageGroup?.id || "",
    guardianName: camper.guardianName || "",
    guardianEmail: camper.guardianEmail || "",
    guardianPhone: camper.guardianPhone || "",
    emergencyPhone: camper.emergencyPhone || "",
    tshirtSize: camper.tshirtSize || "",
    photoConsent: camper.photoConsent,
    medicalNotes: camper.medicalNotes || "",
    dietaryNotes: camper.dietaryNotes || "",
  });

  const update = (key: keyof typeof form, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    if (!firstName || !lastName) { setError("Student first and last name are required."); return; }
    setSaving(true); setError("");
    const res = await fetch(`/api/camps/${campId}/campers/${camper.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        dateOfBirth: form.dateOfBirth || null,
        ageGroupId: form.ageGroupId || null,
        guardianName: form.guardianName.trim() || null,
        guardianEmail: form.guardianEmail.trim() || null,
        guardianPhone: form.guardianPhone.trim() || null,
        emergencyPhone: form.emergencyPhone.trim() || null,
        tshirtSize: form.tshirtSize || null,
        photoConsent: form.photoConsent,
        medicalNotes: form.medicalNotes.trim() || null,
        dietaryNotes: form.dietaryNotes.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) { onSaved(data); setEditing(false); }
    else setError(data.detail || data.error || "Could not update this registration submission.");
  };

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30";
  const currentName = `${camper.firstName} ${camper.lastName}`.trim();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-berry-500 flex items-center justify-center text-white font-bold">
              {camper.firstName[0]}{camper.lastName[0]}
            </div>
            <div>
              <h2 className="font-bold text-slate-800">{currentName}</h2>
              <p className="text-xs text-slate-500">Registration submission</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && <button onClick={() => setEditing(true)} className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 text-xs font-bold hover:bg-sky-100">Edit Submission</button>}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">✕</button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Parent / Guardian Info</h3>
            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputCls} placeholder="Guardian name" value={form.guardianName} onChange={e => update("guardianName", e.target.value)} />
                <input className={inputCls} placeholder="Guardian email" type="email" value={form.guardianEmail} onChange={e => update("guardianEmail", e.target.value)} />
                <input className={inputCls} placeholder="Guardian phone" value={form.guardianPhone} onChange={e => update("guardianPhone", e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2.5">
                <Info label="Name" value={camper.guardianName || "—"} />
                <Info label="Email" value={camper.guardianEmail || "—"} href={camper.guardianEmail ? `mailto:${camper.guardianEmail}` : undefined} tone="sky" />
                <Info label="Phone" value={camper.guardianPhone || "—"} href={camper.guardianPhone ? `tel:${camper.guardianPhone}` : undefined} />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Student Info</h3>
            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputCls} placeholder="First name" value={form.firstName} onChange={e => update("firstName", e.target.value)} />
                <input className={inputCls} placeholder="Last name" value={form.lastName} onChange={e => update("lastName", e.target.value)} />
                <input className={inputCls} type="date" value={form.dateOfBirth} onChange={e => update("dateOfBirth", e.target.value)} />
                <select className={inputCls} value={form.ageGroupId} onChange={e => update("ageGroupId", e.target.value)}>
                  <option value="">No age group</option>
                  {ageGroups.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                </select>
                <select className={inputCls} value={form.tshirtSize} onChange={e => update("tshirtSize", e.target.value)}>
                  <option value="">No T-shirt size</option>
                  {TSHIRT_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.photoConsent} onChange={e => update("photoConsent", e.target.checked)} /> Photo consent granted</label>
              </div>
            ) : (
              <div className="space-y-2.5">
                {camper.dateOfBirth && <Info label="Age" value={`${age(camper.dateOfBirth)} years old`} />}
                <Info label="Age Group" value={camper.ageGroup?.name || "—"} />
                <Info label="T-Shirt Size" value={camper.tshirtSize || "—"} />
                <Info label="Photo Consent" value={camper.photoConsent ? "✓ Granted" : "✗ Not granted"} tone={camper.photoConsent ? "forest" : "red"} />
                <Info label="Registered" value={new Date(camper.createdAt).toLocaleDateString()} />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contact and Emergency Info</h3>
            {editing ? (
              <div className="space-y-3">
                <input className={inputCls} placeholder="Emergency phone" value={form.emergencyPhone} onChange={e => update("emergencyPhone", e.target.value)} />
                <textarea className={inputCls + " resize-none"} rows={3} placeholder="Medical notes" value={form.medicalNotes} onChange={e => update("medicalNotes", e.target.value)} />
                <textarea className={inputCls + " resize-none"} rows={3} placeholder="Dietary notes" value={form.dietaryNotes} onChange={e => update("dietaryNotes", e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2.5">
                <Info label="Emergency Phone" value={camper.emergencyPhone || "—"} href={camper.emergencyPhone ? `tel:${camper.emergencyPhone}` : undefined} tone="red" />
                {camper.medicalNotes && <Note label="Medical" value={camper.medicalNotes} tone="red" />}
                {camper.dietaryNotes && <Note label="Dietary" value={camper.dietaryNotes} tone="sunset" />}
                {!camper.medicalNotes && !camper.dietaryNotes && <p className="text-sm text-slate-400">No medical or dietary notes submitted.</p>}
              </div>
            )}
          </section>

          {editing && (
            <div className="sticky bottom-0 bg-white border-t border-slate-100 py-4 flex gap-3">
              <button onClick={() => { setEditing(false); setError(""); }} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : "Save Submission"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, href, tone = "slate" }: { label: string; value: string; href?: string; tone?: "slate" | "sky" | "forest" | "red" }) {
  const color = tone === "sky" ? "text-sky-600" : tone === "forest" ? "text-forest-600" : tone === "red" ? "text-red-500" : "text-slate-800";
  const content = <span className={`text-sm font-medium ${color}`}>{value}</span>;
  return <div className="flex justify-between gap-4"><span className="text-sm text-slate-500">{label}</span>{href ? <a href={href} className={`${color} hover:underline text-sm font-medium`}>{value}</a> : content}</div>;
}

function Note({ label, value, tone }: { label: string; value: string; tone: "red" | "sunset" }) {
  return <div><p className="text-xs font-medium text-slate-500 mb-1">{label}</p><p className={`text-sm text-slate-700 ${tone === "red" ? "bg-red-50" : "bg-sunset-50"} rounded-xl px-3 py-2`}>{value}</p></div>;
}

function CampersContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  const [campers, setCampers] = useState<Camper[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAge, setFilterAge] = useState("");
  const [filterSize, setFilterSize] = useState("");
  const [selectedCamper, setSelectedCamper] = useState<Camper | null>(null);
  const [sortField, setSortField] = useState<"lastName" | "createdAt">("lastName");

  const load = () => {
    if (!campId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/camps/${campId}/campers`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/age-groups`).then((r) => r.json()),
    ]).then(([c, ag]) => {
      setCampers(Array.isArray(c) ? c : []);
      setAgeGroups(Array.isArray(ag) ? ag : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [campId]);

  const filtered = campers
    .filter((c) => {
      const q = search.toLowerCase();
      const fullName = `${c.firstName} ${c.lastName}`.trim();
      const matchSearch =
        !q ||
        fullName.toLowerCase().includes(q) ||
        (c.guardianName || "").toLowerCase().includes(q) ||
        (c.guardianEmail || "").toLowerCase().includes(q);
      const matchAge = !filterAge || c.ageGroup?.id === filterAge;
      const matchSize = !filterSize || c.tshirtSize === filterSize;
      return matchSearch && matchAge && matchSize;
    })
    .sort((a, b) => {
      if (sortField === "lastName") return a.lastName.localeCompare(b.lastName);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  if (!campId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="text-center">
          <span className="text-4xl mb-3 block">👦</span>
          <p>Select a camp from the sidebar to view campers.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Campers</h1>
          <p className="text-slate-500 text-sm mt-0.5">{campers.length} registered</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const csv = [
                ["Last Name", "First Name", "Age Group", "T-Shirt", "Guardian", "Guardian Email", "Guardian Phone", "Emergency", "Photo Consent"].join(","),
                ...filtered.map((c) => [
                  c.lastName, c.firstName,
                  c.ageGroup?.name || "",
                  c.tshirtSize || "",
                  c.guardianName || "", c.guardianEmail || "",
                  c.guardianPhone || "",
                  c.emergencyPhone || "",
                  c.photoConsent ? "Yes" : "No",
                ].map((v) => `"${v}"`).join(",")),
              ].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "campers.csv"; a.click();
            }}
            className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search campers, guardians..."
          className="flex-1 min-w-[200px] max-w-sm px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
        />
        <select
          value={filterAge}
          onChange={(e) => setFilterAge(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        >
          <option value="">All Age Groups</option>
          {ageGroups.map((ag) => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
        </select>
        <select
          value={filterSize}
          onChange={(e) => setFilterSize(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        >
          <option value="">All Sizes</option>
          {TSHIRT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as "lastName" | "createdAt")}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        >
          <option value="lastName">Sort: Last Name</option>
          <option value="createdAt">Sort: Newest First</option>
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {ageGroups.map((ag) => {
          const count = campers.filter((c) => c.ageGroup?.id === ag.id).length;
          return (
            <div key={ag.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <div className="text-lg font-bold text-slate-800">{count}</div>
              <div className="text-xs text-slate-500">{ag.name}</div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="camp-card p-12 text-center">
          <span className="text-5xl mb-4 block">👦</span>
          <h3 className="font-bold text-slate-700 mb-2">{search || filterAge || filterSize ? "No campers match your filters" : "No campers yet"}</h3>
          <p className="text-slate-400 text-sm">Campers will appear here once they register through the public registration form.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Camper</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Age Group</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Guardian</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">T-Shirt</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Photo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((camper) => (
                <tr key={camper.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-berry-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {camper.firstName[0]}{camper.lastName[0]}
                      </div>
                      <span className="font-medium text-slate-800">{`${camper.firstName} ${camper.lastName}`.trim()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {camper.ageGroup ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {camper.ageGroup.name}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="text-slate-800">{camper.guardianName || "—"}</div>
                    <div className="text-slate-400 text-xs">{camper.guardianEmail || "—"}</div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-slate-600">{camper.tshirtSize || "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={camper.photoConsent ? "text-forest-600" : "text-red-400"}>
                      {camper.photoConsent ? "✓" : "✗"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedCamper(camper)}
                      className="px-3 py-1 text-xs font-medium text-sky-600 bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedCamper && (
        <CamperDrawer
          camper={selectedCamper}
          campId={campId}
          ageGroups={ageGroups}
          onClose={() => setSelectedCamper(null)}
          onSaved={(updated) => {
            setCampers(prev => prev.map(c => c.id === updated.id ? updated : c));
            setSelectedCamper(updated);
          }}
        />
      )}
    </div>
  );
}

export default function CampersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <CampersContent />
    </Suspense>
  );
}
