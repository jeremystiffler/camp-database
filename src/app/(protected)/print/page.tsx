"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface CampSession {
  id: string;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  course?: { id: string; name: string } | null;
  mandatorySession?: { id: string; title: string } | null;
  room?: { id?: string; name: string } | null;
  sessionTemplate?: { id: string; label?: string | null; dayOfWeek?: number | null; startTime: string; endTime: string } | null;
}

interface Enrollment {
  id: string;
  sessionId: string;
  session?: CampSession | null;
}

interface Camper {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  tshirtSize?: string;
  ageGroup?: { name: string; color: string } | null;
  guardianName: string;
  guardianEmail: string;
  enrollments?: Enrollment[];
}

interface Course {
  id: string;
  name: string;
  color: string;
  icon?: string;
  cap: number;
  room?: { name: string } | null;
  courseTeachers?: { person: { firstName: string; lastName: string } }[];
}

type ScheduleCell = { key: string; label: string; sortValue: string };
type ScheduleSlot = { key: string; label: string; sortValue: string };

function sessionStart(session?: CampSession | null) {
  return session?.startTime || session?.sessionTemplate?.startTime || "";
}
function sessionEnd(session?: CampSession | null) {
  return session?.endTime || session?.sessionTemplate?.endTime || "";
}
function sessionSlotKey(session?: CampSession | null) {
  const start = sessionStart(session);
  const end = sessionEnd(session);
  return `${start}|${end}`;
}
function formatTime(value?: string | null) {
  if (!value) return "";
  const [rawHour, rawMinute = "00"] = value.split(":");
  const hour = Number(rawHour);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${rawMinute.padStart(2, "0").slice(0, 2)} ${suffix}`;
}
function slotLabel(session?: CampSession | null) {
  return formatTime(sessionStart(session)) || session?.sessionTemplate?.label || "Time";
}
function scheduleTitle(session?: CampSession | null) {
  return session?.mandatorySession?.title || session?.course?.name || session?.sessionTemplate?.label || "Session";
}
function scheduleCellKey(session?: CampSession | null) {
  const title = scheduleTitle(session);
  const start = sessionStart(session);
  const end = sessionEnd(session);
  const room = session?.room?.id || session?.room?.name || "";
  if (session?.mandatorySession) return `mandatory|${title}|${start}|${end}|${room}`;
  return `${session?.course?.id || session?.id || title}|${start}|${end}|${room}`;
}
function formatScheduleCell(session: CampSession | null | undefined, ageGroup?: Camper["ageGroup"]) {
  if (!session) return "";
  const title = scheduleTitle(session);
  const group = !session.mandatorySession && ageGroup?.name ? ` (${ageGroup.name})` : "";
  const room = session.room?.name ? `\n[${session.room.name}]` : "";
  return `${title}${group}${room}`;
}
function scheduleCellsForCamper(camper: Camper) {
  const byCell = new Map<string, ScheduleCell>();
  for (const enrollment of camper.enrollments || []) {
    const session = enrollment.session;
    if (!session) continue;
    const key = scheduleCellKey(session);
    const sortValue = `${sessionStart(session) || "99:99"}|${sessionEnd(session) || "99:99"}|${scheduleTitle(session).toLowerCase()}`;
    if (!byCell.has(key)) byCell.set(key, { key, label: formatScheduleCell(session, camper.ageGroup), sortValue });
  }
  return [...byCell.values()].sort((a, b) => a.sortValue.localeCompare(b.sortValue));
}
function scheduleSlots(campers: Camper[]): ScheduleSlot[] {
  const slots = new Map<string, ScheduleSlot>();
  for (const camper of campers) {
    for (const enrollment of camper.enrollments || []) {
      const session = enrollment.session;
      if (!session) continue;
      const key = sessionSlotKey(session);
      if (!key.trim() || slots.has(key)) continue;
      slots.set(key, { key, label: slotLabel(session), sortValue: `${sessionStart(session) || "99:99"}|${sessionEnd(session) || "99:99"}` });
    }
  }
  return [...slots.values()].sort((a, b) => a.sortValue.localeCompare(b.sortValue));
}
function cellForSlot(camper: Camper, slot: ScheduleSlot) {
  return scheduleCellsForCamper(camper).filter(cell => cell.sortValue.startsWith(slot.sortValue)).map(cell => cell.label).join("\n\n");
}

function PrintContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  const [campers, setCampers] = useState<Camper[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDoc, setActiveDoc] = useState<string | null>(null);

  useEffect(() => {
    if (!campId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/camps/${campId}/campers`).then((r) => r.json()),
      fetch(`/api/camps/${campId}/courses`).then((r) => r.json()),
    ]).then(([c, a]) => {
      setCampers(Array.isArray(c) ? c : []);
      setCourses(Array.isArray(a) ? a : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [campId]);

  const printDoc = (type: string) => {
    setActiveDoc(type);
    setTimeout(() => window.print(), 300);
  };

  if (!campId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="text-center"><span className="text-4xl mb-3 block"></span><p>Select a camp to print materials.</p></div>
      </div>
    );
  }

  const sizeGroups = campers.reduce<Record<string, Camper[]>>((acc, c) => {
    const s = c.tshirtSize || "Unknown";
    acc[s] = [...(acc[s] || []), c];
    return acc;
  }, {});

  const tshirtOrder = ["YXS","YS","YM","YL","AS","AM","AL","AXL","A2XL","Unknown"];
  const sortedCampers = [...campers].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  const principalScheduleSlots = scheduleSlots(campers);

  return (
    <>
      {/* Print styles injected into head via style tag */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.25in; }
          aside, nav, .no-print { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; }
          .print-doc { display: block !important; }
          body { background: white !important; }
        }
        .print-doc { display: none; }
        .principal-schedule { font-family: Arial, Helvetica, sans-serif; color: #000; }
        .principal-schedule table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .principal-schedule th, .principal-schedule td { border: 1px solid #111; text-align: center; vertical-align: middle; white-space: pre-line; line-height: 1.12; }
        .principal-schedule th { background: #55c7c7; color: #000; font-size: 10px; font-weight: 800; padding: 4px 3px; }
        .principal-schedule td { font-size: 8px; padding: 4px 3px; min-height: 42px; }
        .principal-schedule tbody tr:nth-child(odd) td { background: #dff4f6; }
        .principal-schedule tbody tr:nth-child(even) td { background: #fff; }
        .principal-schedule .student-col { width: 105px; font-weight: 700; }
        .principal-schedule .time-col { width: calc((100% - 105px) / ${Math.max(principalScheduleSlots.length, 1)}); }
      `}</style>

      <div className="no-print">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Print Center</h1>
            <p className="text-slate-500 text-sm mt-0.5">Generate schedules, rosters, and badges</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-berry-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[
              {
                id: "principalSchedule",
                icon: "S",
                title: "Principal Schedule",
                desc: `${campers.length} campers by time slot, with each camper's selected schedule running left to right.`,
                gradient: "stat-sky",
                available: campers.length > 0 && principalScheduleSlots.length > 0,
              },
              {
                id: "roster",
                icon: "R",
                title: "Camper Roster",
                desc: `Full alphabetical list of ${campers.length} campers with guardian info and age groups.`,
                gradient: "stat-forest",
                available: campers.length > 0,
              },
              {
                id: "tshirts",
                icon: "T",
                title: "T-Shirt List",
                desc: `${campers.length} campers sorted by shirt size. Perfect for distribution day.`,
                gradient: "stat-sky",
                available: campers.length > 0,
              },
              {
                id: "activities",
                icon: "A",
                title: "Activity List",
                desc: `${courses.length} activities with rooms, teachers, and capacity.`,
                gradient: "stat-sunset",
                available: courses.length > 0,
              },
              {
                id: "badges",
                icon: "B",
                title: "Name Badges",
                desc: `Print-ready badges for all ${campers.length} campers. Fold and place in holders.`,
                gradient: "stat-berry",
                available: campers.length > 0,
              },
            ].map((doc) => (
              <div key={doc.id} className={`camp-card p-5 ${!doc.available ? "opacity-50" : ""}`}>
                <div className={`${doc.gradient} w-12 h-12 rounded-xl flex items-center justify-center text-2xl text-white mb-4`}>
                  {doc.icon}
                </div>
                <h3 className="font-bold text-slate-800 mb-1">{doc.title}</h3>
                <p className="text-slate-500 text-xs mb-4 leading-relaxed">{doc.desc}</p>
                <button
                  onClick={() => doc.available && printDoc(doc.id)}
                  disabled={!doc.available}
                  className="w-full py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition-colors disabled:cursor-not-allowed"
                >
                   Print {doc.title}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Printable docs — hidden until print */}
      {activeDoc === "principalSchedule" && (
        <div className="print-doc principal-schedule">
          <table>
            <thead>
              <tr>
                <th className="student-col">Student</th>
                {principalScheduleSlots.map(slot => <th key={slot.key} className="time-col">{slot.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {sortedCampers.map((camper) => (
                <tr key={camper.id}>
                  <td className="student-col">{`${camper.firstName} ${camper.lastName}`.trim()}</td>
                  {principalScheduleSlots.map(slot => <td key={slot.key} className="time-col">{cellForSlot(camper, slot)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeDoc === "roster" && (
        <div className="print-doc p-8">
          <h1 className="text-2xl font-bold mb-6">Camper Roster</h1>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-2 pr-4">Last</th>
                <th className="text-left py-2 pr-4">First</th>
                <th className="text-left py-2 pr-4">Age Group</th>
                <th className="text-left py-2 pr-4">Guardian</th>
                <th className="text-left py-2">Guardian Email</th>
              </tr>
            </thead>
            <tbody>
              {sortedCampers.map((c) => (
                <tr key={c.id} className="border-b border-gray-200">
                  <td className="py-1.5 pr-4">{c.lastName}</td>
                  <td className="py-1.5 pr-4">{c.firstName}</td>
                  <td className="py-1.5 pr-4">{c.ageGroup?.name || "—"}</td>
                  <td className="py-1.5 pr-4">{c.guardianName}</td>
                  <td className="py-1.5">{c.guardianEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeDoc === "tshirts" && (
        <div className="print-doc p-8">
          <h1 className="text-2xl font-bold mb-6">T-Shirt Sizes</h1>
          {tshirtOrder.filter((s) => sizeGroups[s]?.length).map((size) => (
            <div key={size} className="mb-5">
              <h2 className="text-base font-bold border-b border-black pb-1 mb-2">{size} ({sizeGroups[size].length})</h2>
              <div className="grid grid-cols-4 gap-x-4 text-sm">
                {[...sizeGroups[size]].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((c) => (
                  <div key={c.id}>{c.lastName}, {c.firstName}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeDoc === "activities" && (
        <div className="print-doc p-8">
          <h1 className="text-2xl font-bold mb-6">Activities</h1>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-2 pr-4">Activity</th>
                <th className="text-left py-2 pr-4">Room</th>
                <th className="text-left py-2 pr-4">Teacher(s)</th>
                <th className="text-left py-2">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {[...courses].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                <tr key={c.id} className="border-b border-gray-200">
                  <td className="py-1.5 pr-4 font-medium">{c.name}</td>
                  <td className="py-1.5 pr-4">{c.room?.name || "—"}</td>
                  <td className="py-1.5 pr-4">{c.courseTeachers?.map((t) => `${t.person.firstName} ${t.person.lastName}`).join(", ") || "—"}</td>
                  <td className="py-1.5">{c.cap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeDoc === "badges" && (
        <div className="print-doc p-4">
          <div className="grid grid-cols-3 gap-2">
            {sortedCampers.map((c) => (
              <div key={c.id} className="border-2 border-black rounded p-3 text-center" style={{ height: "96px" }}>
                <div className="text-xs text-gray-500 uppercase tracking-wider"> Creator&apos;s Camp</div>
                <div className="text-lg font-bold mt-1 leading-tight">{c.firstName}</div>
                <div className="text-sm text-gray-600">{c.lastName}</div>
                {c.ageGroup && <div className="text-xs mt-1 bg-gray-100 rounded px-1">{c.ageGroup.name}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-berry-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <PrintContent />
    </Suspense>
  );
}
