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

interface CoursePreview {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  room?: string | null;
  ageGroups: string[];
  timeSlots: Array<{ label?: string | null; dayOfWeek?: number | null; startTime: string; endTime: string }>;
  campers: Array<{ firstName: string; lastName: string; ageGroup?: string | null; guardianName?: string | null; guardianEmail?: string | null; medicalNotes?: string | null }>;
}

interface SchedulePreview {
  person: Person;
  camp: { name: string; startDate?: string | null; endDate?: string | null };
  courses: CoursePreview[];
}

const ROLES = ["teacher", "assistant", "director", "staff"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Teacher add/edit modal ─────────────────────────────────────────────────
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

// ── Schedule preview + send modal ─────────────────────────────────────────
function SendScheduleModal({ person, campId, onClose }: {
  person: Person;
  campId: string;
  onClose: () => void;
}) {
  const [preview,   setPreview]   = useState<SchedulePreview | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [note,      setNote]      = useState("");
  const [sending,   setSending]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    fetch(`/api/camps/${campId}/persons/${person.id}/send-schedule`)
      .then(r => r.json())
      .then(d => { setPreview(d); setLoading(false); })
      .catch(() => { setError("Failed to load schedule preview"); setLoading(false); });
  }, [campId, person.id]);

  const handleSend = async () => {
    if (!person.email) { setError("This teacher has no email address. Edit their profile to add one."); return; }
    setSending(true); setError("");
    try {
      const res = await fetch(`/api/camps/${campId}/persons/${person.id}/send-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (res.ok) { setSent(true); }
      else { const d = await res.json(); setError(d.error || "Failed to send email"); }
    } catch { setError("Something went wrong"); }
    finally { setSending(false); }
  };

  const totalCampers = preview?.courses.reduce((s, c) => s + c.campers.length, 0) ?? 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-lg text-slate-800">📧 Send Schedule to {person.firstName}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {person.email
                ? <>Will send to <strong className="text-slate-700">{person.email}</strong></>
                : <span className="text-amber-600 font-medium">⚠️ No email on file — edit teacher to add one</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 text-lg">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading && (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && sent && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-6xl mb-4">✅</span>
              <h3 className="font-bold text-lg text-slate-800 mb-1">Email Sent!</h3>
              <p className="text-slate-500 text-sm">Schedule delivered to {person.email}</p>
            </div>
          )}

          {!loading && !sent && preview && (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-forest-50 border border-forest-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-forest-700">{preview.courses.length}</p>
                  <p className="text-xs text-forest-600 mt-0.5">Activities</p>
                </div>
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-sky-700">{totalCampers}</p>
                  <p className="text-xs text-sky-600 mt-0.5">Total Students</p>
                </div>
                <div className="bg-berry-50 border border-berry-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-berry-700">
                    {preview.courses.reduce((s, c) => s + c.timeSlots.length, 0)}
                  </p>
                  <p className="text-xs text-berry-600 mt-0.5">Time Slots</p>
                </div>
              </div>

              {/* Course list preview */}
              <div className="space-y-3">
                {preview.courses.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    No activities assigned to this teacher yet.
                  </div>
                ) : preview.courses.map(course => (
                  <div key={course.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3" style={{ borderLeft: `4px solid ${course.color}` }}>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{course.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {course.room && <span className="text-xs text-slate-500">📍 {course.room}</span>}
                          {course.timeSlots.map((ts, i) => (
                            <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5">
                              {ts.label || ""} {ts.dayOfWeek != null ? DAYS[ts.dayOfWeek] + " " : ""}{ts.startTime}–{ts.endTime}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="ml-auto text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-slate-800">{course.campers.length}</p>
                        <p className="text-xs text-slate-400">students</p>
                      </div>
                    </div>
                    {course.campers.length > 0 && (
                      <div className="px-4 pb-3 pt-1 bg-slate-50 border-t border-slate-100">
                        <p className="text-xs font-medium text-slate-500 mb-1.5">Enrolled students:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {course.campers.map((c, i) => (
                            <span key={i} className="text-xs bg-white border border-slate-200 rounded-full px-2.5 py-1 text-slate-700">
                              {c.firstName} {c.lastName}
                              {c.medicalNotes && <span className="text-red-500 ml-1">⚠️</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Optional note */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Add a personal note <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="e.g. Please arrive 15 minutes early on the first day..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 resize-none" />
              </div>
            </>
          )}

          {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
        </div>

        {/* Footer */}
        {!sent && !loading && (
          <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={handleSend} disabled={sending || !person.email}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {sending ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
              ) : (
                <>📧 Send Schedule Email</>
              )}
            </button>
          </div>
        )}
        {sent && (
          <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
            <button onClick={onClose} className="w-full px-4 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export function TeachersContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  const [persons,    setPersons]    = useState<Person[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [editing,    setEditing]    = useState<Person | null | undefined>(undefined);
  const [showModal,  setShowModal]  = useState(false);
  const [scheduling, setScheduling] = useState<Person | null>(null);

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
        <div className="camp-card overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(220px,1.4fr)_minmax(160px,1fr)_minmax(130px,0.8fr)_minmax(180px,1.2fr)_130px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500">
            <div>Teacher</div>
            <div>Email</div>
            <div>Phone</div>
            <div>Notes</div>
            <div className="text-right">Actions</div>
          </div>

          <div className="divide-y divide-slate-100">
            {filtered.map(p => (
              <div key={p.id} className="px-4 py-4 md:px-5 hover:bg-slate-50/70 transition-colors">
                <div className="grid gap-3 md:grid-cols-[minmax(220px,1.4fr)_minmax(160px,1fr)_minmax(130px,0.8fr)_minmax(180px,1.2fr)_130px] md:items-center md:gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-berry-400 to-sky-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                      {p.firstName[0]}{p.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-800 truncate">{p.firstName} {p.lastName}</h3>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[p.role] || "bg-slate-100 text-slate-600"}`}>
                          {p.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-sm md:text-xs min-w-0">
                    <span className="md:hidden block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Email</span>
                    {p.email
                      ? <span className="text-slate-600 truncate block">{p.email}</span>
                      : <span className="text-amber-500 italic">No email — add one to send schedule</span>}
                  </div>

                  <div className="text-sm md:text-xs min-w-0">
                    <span className="md:hidden block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Phone</span>
                    {p.phone
                      ? <span className="text-slate-500 truncate block">{p.phone}</span>
                      : <span className="text-slate-300 italic">—</span>}
                  </div>

                  <div className="text-sm md:text-xs min-w-0">
                    <span className="md:hidden block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Notes</span>
                    {p.bio
                      ? <span className="text-slate-500 italic line-clamp-2">{p.bio}</span>
                      : <span className="text-slate-300 italic">—</span>}
                  </div>

                  <div className="flex items-center gap-2 md:justify-end">
                    <button onClick={() => setScheduling(p)}
                      title="Send schedule email"
                      className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-semibold transition-colors">📧 Schedule</button>
                    <button onClick={() => { setEditing(p); setShowModal(true); }}
                      title="Edit teacher"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 text-sm">✏️</button>
                    <button onClick={() => deletePerson(p.id)}
                      title="Remove teacher"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 text-sm">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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

      {scheduling && (
        <SendScheduleModal
          person={scheduling}
          campId={campId}
          onClose={() => setScheduling(null)}
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
