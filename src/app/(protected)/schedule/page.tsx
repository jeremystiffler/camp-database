"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface SessionTemplate {
  id: string;
  label: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Course {
  id: string;
  name: string;
  color: string;
  icon?: string;
  cap: number;
}

interface Room {
  id: string;
  name: string;
}

interface Session {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  enrolledCount: number;
  course?: Course | null;
  room?: Room | null;
  sessionTemplate?: SessionTemplate | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-700",
  active: "bg-forest-100 text-forest-700",
  completed: "bg-slate-100 text-slate-500",
  cancelled: "bg-red-100 text-red-600",
};

function ScheduleContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  const [sessions, setSessions] = useState<Session[]>([]);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filterDay, setFilterDay] = useState<number | "">("");

  useEffect(() => {
    if (!campId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/camps/${campId}/sessions`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/session-templates`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/courses`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/rooms`).then((r) => r.json()),
    ]).then(([s, t, c, r]) => {
      setSessions(Array.isArray(s) ? s : []);
      setTemplates(Array.isArray(t) ? t : []);
      setCourses(Array.isArray(c) ? c : []);
      setRooms(Array.isArray(r) ? r : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [campId]);

  if (!campId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="text-center">
          <span className="text-4xl mb-3 block">Date</span>
          <p>Select a camp to view its schedule.</p>
        </div>
      </div>
    );
  }

  // Group sessions by day of week
  const byDay: Record<number, Session[]> = {};
  for (const s of sessions) {
    const day = s.sessionTemplate?.dayOfWeek ?? new Date(s.date).getDay();
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(s);
  }

  const activeDays = Object.keys(byDay).map(Number).sort();
  const displayDays = filterDay === "" ? activeDays : [Number(filterDay)];

  // Unique time slots across all sessions
  const timeSlots = [...new Set(sessions.map((s) => s.startTime))].sort();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Schedule</h1>
          <p className="text-slate-500 text-sm mt-0.5">{sessions.length} sessions across {activeDays.length} days</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("grid")}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${view === "grid" ? "bg-slate-800 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            Grid
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${view === "list" ? "bg-slate-800 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            List
          </button>
        </div>
      </div>

      {/* Filter by day */}
      {activeDays.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setFilterDay("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterDay === "" ? "bg-slate-800 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            All Days
          </button>
          {activeDays.map((d) => (
            <button
              key={d}
              onClick={() => setFilterDay(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterDay === d ? "bg-slate-800 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {DAYS[d]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-sunset-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="camp-card p-12 text-center">
          <span className="text-5xl mb-4 block">Date</span>
          <h3 className="font-bold text-slate-700 mb-2">No sessions scheduled yet</h3>
          <p className="text-slate-400 text-sm mb-2">Sessions are created from session templates + activities.</p>
          <p className="text-slate-400 text-sm">
            First, set up <strong>session templates</strong> (time slots) in Settings, then assign activities to them.
          </p>
        </div>
      ) : view === "list" ? (
        // List view
        <div className="space-y-3">
          {sessions.map((session) => (
            <div key={session.id} className="camp-card p-4 flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ backgroundColor: session.course?.color || "#94a3b8" }}
              >
                {session.course?.icon || "Date"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{session.course?.name || "Unassigned"}</p>
                <p className="text-xs text-slate-500">
                  {session.sessionTemplate ? `${DAYS[session.sessionTemplate.dayOfWeek]} · ` : ""}
                  {session.startTime}–{session.endTime}
                  {session.room ? ` · ${session.room.name}` : ""}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-semibold text-slate-700">{session.enrolledCount}/{session.course?.cap || "?"}</div>
                <div className="text-xs text-slate-400">enrolled</div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[session.status] || "bg-slate-100 text-slate-600"}`}>
                {session.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        // Grid view
        <div className="space-y-6">
          {displayDays.map((day) => (
            <div key={day}>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">{DAYS[day]}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {(byDay[day] || [])
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((session) => (
                    <div key={session.id} className="camp-card p-4">
                      <div className="flex items-start gap-3 mb-2">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm flex-shrink-0"
                          style={{ backgroundColor: session.course?.color || "#94a3b8" }}
                        >
                          {session.course?.icon || "Date"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">{session.course?.name || "Unassigned"}</p>
                          <p className="text-xs text-slate-500">{session.startTime}–{session.endTime}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_COLORS[session.status] || "bg-slate-100 text-slate-600"}`}>
                          {session.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <span>{session.room?.name || "No room"}</span>
                        <span className="font-semibold text-slate-700">{session.enrolledCount}/{session.course?.cap || "?"} enrolled</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-sunset-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <ScheduleContent />
    </Suspense>
  );
}
