"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface AgeGroup {
  id: string;
  name: string;
  color: string;
}

interface Room {
  id: string;
  name: string;
  capacity: number;
}

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Course {
  id: string;
  name: string;
  description?: string;
  cap: number;
  color: string;
  icon?: string;
  ageGroup?: AgeGroup | null;
  room?: Room | null;
  courseTeachers?: { person: Person }[];
}

const COLORS = [
  "#22C55E", "#0EA5E9", "#F97316", "#A855F7", "#EAB308", "#EC4899", "#14B8A6", "#6366F1",
];

const ICONS = ["🎨", "🎭", "🎵", "📖", "🏃", "🎯", "🔬", "🏕️", "⚽", "🎤", "🎺", "✏️"];

function CourseModal({
  course,
  campId,
  ageGroups,
  rooms,
  persons,
  onClose,
  onSaved,
}: {
  course?: Course | null;
  campId: string;
  ageGroups: AgeGroup[];
  rooms: Room[];
  persons: Person[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(course?.name || "");
  const [description, setDescription] = useState(course?.description || "");
  const [cap, setCap] = useState(String(course?.cap || 20));
  const [color, setColor] = useState(course?.color || COLORS[0]);
  const [icon, setIcon] = useState(course?.icon || "🎯");
  const [ageGroupId, setAgeGroupId] = useState(course?.ageGroup?.id || "");
  const [roomId, setRoomId] = useState(course?.room?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const url = course
        ? `/api/camps/${campId}/courses/${course.id}`
        : `/api/camps/${campId}/courses`;
      const method = course ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          cap: parseInt(cap),
          color,
          icon,
          ageGroupId: ageGroupId || undefined,
          roomId: roomId || undefined,
        }),
      });
      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="font-bold text-lg text-slate-800">{course ? "Edit Activity" : "New Activity"}</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Activity Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Watercolor Painting"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Icon</label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full px-2 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30"
              >
                {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Room / Location</label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30"
              >
                <option value="">No room assigned</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} (cap: {r.capacity})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Capacity</label>
              <input
                type="number"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                min={1}
                max={500}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Age Group</label>
            <select
              value={ageGroupId}
              onChange={(e) => setAgeGroupId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/30"
            >
              <option value="">All age groups</option>
              {ageGroups.map((ag) => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? "border-slate-800 scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60">
              {loading ? "Saving..." : course ? "Save Changes" : "Create Activity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ActivitiesContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  const [courses, setCourses] = useState<Course[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingCourse, setEditingCourse] = useState<Course | null | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    if (!campId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/camps/${campId}/courses`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/age-groups`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/rooms`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/persons`).then((r) => r.json()),
    ]).then(([c, ag, r, p]) => {
      setCourses(Array.isArray(c) ? c : []);
      setAgeGroups(Array.isArray(ag) ? ag : []);
      setRooms(Array.isArray(r) ? r : []);
      setPersons(Array.isArray(p) ? p : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [campId]);

  const deleteCourse = async (id: string) => {
    if (!confirm("Delete this activity?")) return;
    await fetch(`/api/camps/${campId}/courses/${id}`, { method: "DELETE" });
    load();
  };

  const filtered = courses.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.ageGroup?.name.toLowerCase().includes(search.toLowerCase() || "")
  );

  if (!campId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="text-center">
          <span className="text-4xl mb-3 block">🏕️</span>
          <p>Select a camp from the sidebar to view activities.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Activities</h1>
          <p className="text-slate-500 text-sm mt-0.5">{courses.length} {courses.length === 1 ? "activity" : "activities"} total</p>
        </div>
        <button
          onClick={() => { setEditingCourse(null); setShowModal(true); }}
          className="px-4 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold shadow-sm shadow-forest-500/20 hover:opacity-90 flex items-center gap-2"
        >
          + New Activity
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search activities..."
          className="w-full max-w-sm px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="camp-card p-12 text-center">
          <span className="text-5xl mb-4 block">🎯</span>
          <h3 className="font-bold text-slate-700 mb-2">{search ? "No activities match your search" : "No activities yet"}</h3>
          <p className="text-slate-400 text-sm mb-5">Create your first activity with a room, capacity, and age group.</p>
          {!search && (
            <button
              onClick={() => { setEditingCourse(null); setShowModal(true); }}
              className="px-5 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90"
            >
              + Add First Activity
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((course) => (
            <div key={course.id} className="camp-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-white flex-shrink-0"
                    style={{ backgroundColor: course.color || "#22C55E" }}
                  >
                    {course.icon || "🎯"}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm leading-tight">{course.name}</h3>
                    {course.ageGroup && (
                      <span className="text-xs text-slate-500">{course.ageGroup.name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditingCourse(course); setShowModal(true); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors text-sm"
                  >✏️</button>
                  <button
                    onClick={() => deleteCourse(course.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors text-sm"
                  >🗑️</button>
                </div>
              </div>

              {course.description && (
                <p className="text-slate-500 text-xs mb-3 leading-relaxed line-clamp-2">{course.description}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                {course.room && (
                  <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg">
                    📍 {course.room.name}
                  </span>
                )}
                <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg">
                  👥 Cap: {course.cap}
                </span>
                {course.courseTeachers && course.courseTeachers.length > 0 && (
                  <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg">
                    🧑‍🏫 {course.courseTeachers.map((t) => t.person.firstName).join(", ")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CourseModal
          course={editingCourse}
          campId={campId}
          ageGroups={ageGroups}
          rooms={rooms}
          persons={persons}
          onClose={() => { setShowModal(false); setEditingCourse(undefined); }}
          onSaved={load}
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
