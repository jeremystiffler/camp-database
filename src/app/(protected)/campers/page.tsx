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
  guardianName: string;
  guardianEmail: string;
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
  onClose,
}: {
  camper: Camper;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-berry-500 flex items-center justify-center text-white font-bold">
              {camper.firstName[0]}{camper.lastName[0]}
            </div>
            <div>
              <h2 className="font-bold text-slate-800">{camper.fullName}</h2>
              {camper.ageGroup && <p className="text-xs text-slate-500">{camper.ageGroup.name}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">✕</button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Camper Info</h3>
            <div className="space-y-2.5">
              {camper.dateOfBirth && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Age</span>
                  <span className="text-sm font-medium text-slate-800">{age(camper.dateOfBirth)} years old</span>
                </div>
              )}
              {camper.tshirtSize && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">T-Shirt Size</span>
                  <span className="text-sm font-medium text-slate-800">{camper.tshirtSize}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Photo Consent</span>
                <span className={`text-sm font-medium ${camper.photoConsent ? "text-forest-600" : "text-red-500"}`}>
                  {camper.photoConsent ? "✓ Granted" : "✗ Not granted"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Registered</span>
                <span className="text-sm font-medium text-slate-800">
                  {new Date(camper.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Guardian</h3>
            <div className="space-y-2.5">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Name</span>
                <span className="text-sm font-medium text-slate-800">{camper.guardianName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Email</span>
                <a href={`mailto:${camper.guardianEmail}`} className="text-sm font-medium text-sky-600 hover:underline">{camper.guardianEmail}</a>
              </div>
              {camper.guardianPhone && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Phone</span>
                  <a href={`tel:${camper.guardianPhone}`} className="text-sm font-medium text-slate-800">{camper.guardianPhone}</a>
                </div>
              )}
              {camper.emergencyPhone && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Emergency</span>
                  <a href={`tel:${camper.emergencyPhone}`} className="text-sm font-medium text-red-600">{camper.emergencyPhone}</a>
                </div>
              )}
            </div>
          </div>

          {(camper.medicalNotes || camper.dietaryNotes) && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Notes</h3>
              {camper.medicalNotes && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-slate-500 mb-1">Medical</p>
                  <p className="text-sm text-slate-700 bg-red-50 rounded-xl px-3 py-2">{camper.medicalNotes}</p>
                </div>
              )}
              {camper.dietaryNotes && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Dietary</p>
                  <p className="text-sm text-slate-700 bg-sunset-50 rounded-xl px-3 py-2">{camper.dietaryNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
      const matchSearch =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        c.guardianName.toLowerCase().includes(q) ||
        c.guardianEmail.toLowerCase().includes(q);
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
                  c.guardianName, c.guardianEmail,
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
                      <span className="font-medium text-slate-800">{camper.fullName}</span>
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
                    <div className="text-slate-800">{camper.guardianName}</div>
                    <div className="text-slate-400 text-xs">{camper.guardianEmail}</div>
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
        <CamperDrawer camper={selectedCamper} onClose={() => setSelectedCamper(null)} />
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
