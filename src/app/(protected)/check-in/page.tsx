"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface AgeGroup { id: string; name: string; }
interface Attendance {
  id: string;
  campDate: string;
  status: "not_arrived" | "checked_in" | "checked_out" | "no_show" | "blocked";
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  pickupPersonName?: string | null;
  pickupRelationship?: string | null;
  pickupCodeVerified?: boolean;
  walkUp?: boolean;
  badgePrintedAt?: string | null;
  shirtPickedUpAt?: string | null;
  notes?: string | null;
}
interface Enrollment {
  session?: {
    course?: { name: string } | null;
    mandatorySession?: { title: string } | null;
    room?: { name: string } | null;
    sessionTemplate?: { label?: string | null; startTime?: string | null; endTime?: string | null } | null;
  } | null;
}
interface Camper {
  id: string;
  firstName: string;
  lastName: string;
  ageGroup?: AgeGroup | null;
  guardianName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  emergencyPhone?: string | null;
  paymentStatus?: string | null;
  totalPaidCents?: number;
  medicalNotes?: string | null;
  dietaryNotes?: string | null;
  tshirtSize?: string | null;
  enrollments?: Enrollment[];
  attendance?: Attendance | null;
}

type Filter = "ready" | "attention" | "checked_in" | "checked_out" | "still_here" | "not_arrived" | "all";

const STATUS_COPY: Record<string, { label: string; cls: string }> = {
  not_arrived: { label: "Not arrived", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  checked_in: { label: "Checked in", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  checked_out: { label: "Checked out", cls: "bg-sky-100 text-sky-800 border-sky-200" },
  no_show: { label: "No show", cls: "bg-slate-200 text-slate-600 border-slate-300" },
  blocked: { label: "Blocked", cls: "bg-rose-100 text-rose-800 border-rose-200" },
};

function fullName(camper: Camper) { return `${camper.firstName} ${camper.lastName}`.trim(); }
function money(cents = 0) { return `$${(cents / 100).toFixed(2)}`; }
function todayValue() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function attendanceStatus(camper: Camper) { return camper.attendance?.status || "not_arrived"; }
function paymentCleared(camper: Camper) {
  return ["paid", "not_required", "comped"].includes(camper.paymentStatus || "not_required");
}
function missingInfo(camper: Camper) {
  const missing = [];
  if (!camper.guardianName) missing.push("guardian name");
  if (!camper.guardianPhone && !camper.guardianEmail) missing.push("guardian contact");
  if (!camper.emergencyPhone) missing.push("emergency phone");
  return missing;
}
function readiness(camper: Camper) {
  const missing = missingInfo(camper);
  if (!paymentCleared(camper)) return { label: "Needs payment", cls: "bg-amber-100 text-amber-900 border-amber-200", missing };
  if (missing.length) return { label: "Missing info", cls: "bg-orange-100 text-orange-900 border-orange-200", missing };
  return { label: "Ready", cls: "bg-emerald-100 text-emerald-800 border-emerald-200", missing };
}
function sessionSummary(camper: Camper) {
  const names = new Set<string>();
  for (const enrollment of camper.enrollments || []) {
    const session = enrollment.session;
    const title = session?.course?.name || session?.mandatorySession?.title;
    if (title) names.add(title);
  }
  return [...names].slice(0, 4).join(" · ") || "No classes selected";
}
function timestamp(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function CheckInContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";
  const [campDate, setCampDate] = useState(todayValue());
  const [campers, setCampers] = useState<Camper[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [filter, setFilter] = useState<Filter>("ready");
  const [query, setQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const load = () => {
    if (!campId) return;
    setLoading(true);
    fetch(`/api/camps/${campId}/attendance?date=${encodeURIComponent(campDate)}`)
      .then(r => r.json())
      .then(data => setCampers(Array.isArray(data.campers) ? data.campers : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [campId, campDate]);

  useEffect(() => {
    if (!scannerOpen) return;
    let stopped = false;
    const start = async () => {
      try {
        const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
        if (!Detector) {
          setScanError("This iPad/browser does not support camera QR scanning yet. Use search, or try Safari/Chrome update.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new Detector({ formats: ["qr_code"] });
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              const raw = codes[0].rawValue;
              setQuery(raw);
              setScannerOpen(false);
              setScanError("");
              return;
            }
          } catch {}
          requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setScanError("Could not open the camera. Check iPad camera permission and try again.");
      }
    };
    start();
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, [scannerOpen]);

  const counts = useMemo(() => {
    const checkedIn = campers.filter(c => attendanceStatus(c) === "checked_in").length;
    return {
      ready: campers.filter(c => attendanceStatus(c) === "not_arrived" && paymentCleared(c) && missingInfo(c).length === 0).length,
      attention: campers.filter(c => attendanceStatus(c) !== "checked_out" && (!paymentCleared(c) || missingInfo(c).length > 0)).length,
      checked_in: checkedIn,
      checked_out: campers.filter(c => attendanceStatus(c) === "checked_out").length,
      still_here: checkedIn,
      not_arrived: campers.filter(c => attendanceStatus(c) === "not_arrived").length,
      all: campers.length,
    };
  }, [campers]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleCampers = campers.filter(camper => {
    const status = attendanceStatus(camper);
    const isAttention = status !== "checked_out" && (!paymentCleared(camper) || missingInfo(camper).length > 0);
    const isReady = status === "not_arrived" && paymentCleared(camper) && missingInfo(camper).length === 0;
    if (filter === "ready" && !isReady) return false;
    if (filter === "attention" && !isAttention) return false;
    if (filter === "checked_in" && status !== "checked_in") return false;
    if (filter === "checked_out" && status !== "checked_out") return false;
    if (filter === "still_here" && status !== "checked_in") return false;
    if (filter === "not_arrived" && status !== "not_arrived") return false;
    if (!normalizedQuery) return true;
    const haystack = [camper.id, fullName(camper), camper.guardianName, camper.guardianEmail, camper.guardianPhone, camper.emergencyPhone, camper.ageGroup?.name].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const updateAttendance = async (camper: Camper, action: string, extra: Record<string, unknown> = {}) => {
    setSavingId(camper.id);
    const res = await fetch(`/api/camps/${campId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ camperId: camper.id, action, date: campDate, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingId("");
    if (!res.ok) {
      alert(data.detail || data.error || "Could not update attendance.");
      return;
    }
    if (data.camper) setCampers(prev => prev.map(item => item.id === data.camper.id ? data.camper : item));
  };

  const checkout = (camper: Camper) => {
    const pickupPersonName = window.prompt(`Who is picking up ${fullName(camper)}?`, camper.guardianName || "");
    if (pickupPersonName === null) return;
    const pickupRelationship = window.prompt("Relationship / note (optional)", "Guardian") || "";
    updateAttendance(camper, "check_out", { pickupPersonName, pickupRelationship });
  };

  if (!campId) return <div className="flex h-64 items-center justify-center text-slate-400">Select a camp to open check-in mode.</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Day-of-camp operations</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Check-In / Check-Out</h1>
          <p className="mt-1 text-sm text-slate-500">iPad-friendly scan/search, paid-status triage, walk-up routing, and “no one left behind” checkout.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={campDate} onChange={e => setCampDate(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm" />
          <button onClick={load} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50">Refresh</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <button onClick={() => setFilter("ready")} className={`rounded-3xl p-4 text-left shadow-sm transition ${filter === "ready" ? "bg-emerald-600 text-white" : "border border-emerald-200 bg-emerald-50 text-emerald-900"}`}><p className="text-3xl font-black">{counts.ready}</p><p className="text-sm font-black">Ready to check in</p></button>
        <button onClick={() => setFilter("attention")} className={`rounded-3xl p-4 text-left shadow-sm transition ${filter === "attention" ? "bg-amber-500 text-white" : "border border-amber-200 bg-amber-50 text-amber-900"}`}><p className="text-3xl font-black">{counts.attention}</p><p className="text-sm font-black">Needs attention</p></button>
        <button onClick={() => setFilter("still_here")} className={`rounded-3xl p-4 text-left shadow-sm transition ${filter === "still_here" ? "bg-slate-900 text-white" : "border border-sky-200 bg-sky-50 text-sky-900"}`}><p className="text-3xl font-black">{counts.still_here}</p><p className="text-sm font-black">Still on campus</p></button>
        <button onClick={() => setFilter("checked_out")} className={`rounded-3xl p-4 text-left shadow-sm transition ${filter === "checked_out" ? "bg-sky-600 text-white" : "border border-slate-200 bg-white text-slate-900"}`}><p className="text-3xl font-black">{counts.checked_out}</p><p className="text-sm font-black">Checked out</p></button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Scan QR or search camper, guardian, phone, email..." className="min-h-14 flex-1 rounded-2xl border border-slate-200 px-4 text-lg font-bold text-slate-800 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" autoFocus />
          <button onClick={() => { setScannerOpen(true); setScanError(""); }} className="min-h-14 rounded-2xl bg-slate-900 px-6 text-base font-black text-white hover:bg-slate-700">Scan with iPad Camera</button>
          <Link href={`/campers?campId=${campId}`} className="flex min-h-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-6 text-base font-black text-slate-700 hover:bg-slate-100">+ Walk-Up / Add Camper</Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["ready", "attention", "checked_in", "checked_out", "not_arrived", "all"] as Filter[]).map(item => (
            <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-3 py-1.5 text-xs font-black ${filter === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{item.replace(/_/g, " ")} · {counts[item]}</button>
          ))}
        </div>
        {scanError && <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{scanError}</p>}
      </div>

      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black text-slate-900">Scan QR Code</h2><button onClick={() => setScannerOpen(false)} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600">Close</button></div>
            <video ref={videoRef} className="aspect-video w-full rounded-2xl bg-slate-900 object-cover" playsInline muted />
            <p className="mt-3 text-sm font-semibold text-slate-500">Point the iPad camera at a family confirmation QR or camper badge QR.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-forest-500 border-t-transparent" /></div>
      ) : visibleCampers.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-400">No campers match this view.</div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleCampers.map(camper => {
            const status = attendanceStatus(camper);
            const statusMeta = STATUS_COPY[status] || STATUS_COPY.not_arrived;
            const ready = readiness(camper);
            const saving = savingId === camper.id;
            return (
              <div key={camper.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-xl font-black text-slate-900">{fullName(camper)}</h2>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusMeta.cls}`}>{statusMeta.label}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${ready.cls}`}>{ready.label}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{camper.ageGroup?.name || "No age group"} · Guardian: {camper.guardianName || "—"} · {camper.guardianPhone || camper.guardianEmail || "No contact"}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">Classes: {sessionSummary(camper)}</p>
                    {(camper.medicalNotes || camper.dietaryNotes) && <p className="mt-2 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-800">⚕ Medical/dietary note on file</p>}
                    {ready.missing.length > 0 && <p className="mt-2 rounded-2xl bg-orange-50 px-3 py-2 text-xs font-bold text-orange-900">Missing: {ready.missing.join(", ")}</p>}
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-sm font-black text-slate-800">Payment: {camper.paymentStatus || "not_required"}</p>
                    <p className="text-xs font-semibold text-slate-400">Paid: {money(camper.totalPaidCents || 0)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">In: {timestamp(camper.attendance?.checkedInAt)} · Out: {timestamp(camper.attendance?.checkedOutAt)}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {status !== "checked_in" && status !== "checked_out" && <button disabled={saving} onClick={() => updateAttendance(camper, "check_in")} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Check In"}</button>}
                  {status === "checked_in" && <button disabled={saving} onClick={() => checkout(camper)} className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Check Out"}</button>}
                  {!paymentCleared(camper) && <button disabled={saving} onClick={() => updateAttendance(camper, "mark_paid", { note: "Marked paid during check-in" })} className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50">Mark Paid</button>}
                  <button disabled={saving} onClick={() => updateAttendance(camper, "badge_printed")} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-50">Badge Printed</button>
                  <button disabled={saving} onClick={() => updateAttendance(camper, "shirt_picked_up")} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-50">Shirt Picked Up</button>
                  {status !== "not_arrived" && <button disabled={saving} onClick={() => updateAttendance(camper, "reset")} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-500 disabled:opacity-50">Reset</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-forest-500 border-t-transparent" /></div>}>
      <CheckInContent />
    </Suspense>
  );
}
