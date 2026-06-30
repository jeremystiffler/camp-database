"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Camper {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  tshirtSize?: string;
  ageGroup?: { name: string; color: string } | null;
  guardianName: string;
  guardianEmail: string;
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

  return (
    <>
      {/* Print styles injected into head via style tag */}
      <style>{`
        @media print {
          aside, nav, .no-print { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; }
          .print-doc { display: block !important; }
          body { background: white !important; }
        }
        .print-doc { display: none; }
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
                id: "roster",
                icon: "",
                title: "Camper Roster",
                desc: `Full alphabetical list of ${campers.length} campers with guardian info and age groups.`,
                gradient: "stat-forest",
                available: campers.length > 0,
              },
              {
                id: "tshirts",
                icon: "👕",
                title: "T-Shirt List",
                desc: `${campers.length} campers sorted by shirt size. Perfect for distribution day.`,
                gradient: "stat-sky",
                available: campers.length > 0,
              },
              {
                id: "activities",
                icon: "",
                title: "Activity List",
                desc: `${courses.length} activities with rooms, teachers, and capacity.`,
                gradient: "stat-sunset",
                available: courses.length > 0,
              },
              {
                id: "badges",
                icon: "🪪",
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
              {[...campers].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((c) => (
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
            {[...campers].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((c) => (
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
