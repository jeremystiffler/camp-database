"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role: string;
  bio?: string;
}

const ROLES = ["teacher", "assistant", "director", "staff"];

function TeacherModal({ person, campId, onClose, onSaved }: {
  person?: Person | null;
  campId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(person?.firstName || "");
  const [lastName,  setLastName]  = useState(person?.lastName  || "");
  const [email,     setEmail]     = useState(person?.email     || "");
  const [phone,     setPhone]     = useState(person?.phone     || "");
  const [role,      setRole]      = useState(person?.role      || "teacher");
  const [bio,       setBio]       = useState(person?.bio       || "");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const url    = person ? `/api/camps/${campId}/persons/${person.id}` : `/api/camps/${campId}/persons`;
      const method = person ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email: email || undefined, phone: phone || undefined, role, bio: bio || undefined }),
      });
      if (res.ok) { onSaved(); onClose(); }
      else { const d = await res.json(); setError(d.error || "Failed to save"); }
    } catch { setError("Something went wrong"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="font-bold text-lg text-slate-800">{person ? "Edit Teacher" : "Add Teacher"}</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name *</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name *</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="teacher@example.com"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="(555) 555-5555"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30">
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Bio / Notes</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2}
              placeholder="Optional bio or notes..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30 resize-none" />
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-berry-500 to-berry-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60">
              {loading ? "Saving..." : person ? "Save Changes" : "Add Teacher"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TeachersContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  const [persons,  setPersons]  = useState<Person[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [editing,  setEditing]  = useState<Person | null | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    if (!campId) return;
    setLoading(true);
    fetch(`/api/camps/${campId}/persons`)
      .then(r => r.json())
      .then(d => { setPersons(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [campId]);

  const deletePerson = async (id: string) => {
    if (!confirm("Remove this teacher?")) return;
    await fetch(`/api/camps/${campId}/persons/${id}`, { method: "DELETE" });
    load();
  };

  const filtered = persons.filter(p =>
    `${p.firstName} ${p.lastName} ${p.email || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const ROLE_COLORS: Record<string, string> = {
    teacher: "bg-berry-100 text-berry-700",
    assistant: "bg-sky-100 text-sky-700",
    director: "bg-sunset-100 text-sunset-700",
    staff: "bg-slate-100 text-slate-600",
  };

  if (!campId) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center"><span className="text-4xl mb-3 block">🧑‍🏫</span><p>Select a camp to manage teachers.</p></div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Teachers</h1>
          <p className="text-slate-500 text-sm mt-0.5">{persons.length} {persons.length === 1 ? "person" : "people"}</p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="px-4 py-2.5 bg-gradient-to-r from-berry-500 to-berry-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 flex items-center gap-2">
          + Add Teacher
        </button>
      </div>

      <div className="mb-5">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search teachers..."
          className="w-full max-w-sm px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-berry-500/30 focus:border-berry-400" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-berry-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="camp-card p-12 text-center">
          <span className="text-5xl mb-4 block">🧑‍🏫</span>
          <h3 className="font-bold text-slate-700 mb-2">{search ? "No teachers match" : "No teachers yet"}</h3>
          <p className="text-slate-400 text-sm mb-5">Add teachers to assign them to activities.</p>
          {!search && (
            <button onClick={() => { setEditing(null); setShowModal(true); }}
              className="px-5 py-2.5 bg-gradient-to-r from-berry-500 to-berry-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
              + Add First Teacher
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="camp-card p-5">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-berry-400 to-sky-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {p.firstName[0]}{p.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800">{p.firstName} {p.lastName}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[p.role] || "bg-slate-100 text-slate-600"}`}>
                      {p.role}
                    </span>
                  </div>
                  {p.email && <p className="text-xs text-slate-500 mt-0.5 truncate">{p.email}</p>}
                  {p.phone && <p className="text-xs text-slate-400">{p.phone}</p>}
                  {p.bio && <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">{p.bio}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditing(p); setShowModal(true); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 text-sm">✏️</button>
                  <button onClick={() => deletePerson(p.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 text-sm">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <TeacherModal
          person={editing}
          campId={campId}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          onSaved={load}
        />
      )}
    </div>
  );
}

export default function TeachersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-berry-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <TeachersContent />
    </Suspense>
  );
}
