"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import jsQR from "jsqr";

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
  customData?: string | null;
  enrollments?: Enrollment[];
  attendance?: Attendance | null;
}

type View = "walk_up" | "checked_in" | "checked_out" | "attention" | "all";
type ScanMode = "idle" | "camera";

type Contact = { name: string; phone?: string; relationship?: string; source: string };

const STATUS_COPY: Record<string, { label: string; cls: string }> = {
  not_arrived: { label: "Not arrived", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  checked_in: { label: "Checked in", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  checked_out: { label: "Checked out", cls: "bg-sky-100 text-sky-800 border-sky-200" },
  no_show: { label: "No show", cls: "bg-slate-200 text-slate-600 border-slate-300" },
  blocked: { label: "Blocked", cls: "bg-rose-100 text-rose-800 border-rose-200" },
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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
function parseCustomData(raw?: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}
function humanizeKey(key: string) {
  return key.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();
}
function customValueText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(customValueText).filter(Boolean).join(", ");
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${humanizeKey(k)}: ${customValueText(v)}`).join("; ");
  return String(value).trim();
}
function customMatches(data: Record<string, unknown>, words: string[]) {
  return Object.entries(data).filter(([key, value]) => {
    const label = humanizeKey(key).toLowerCase();
    return words.some(word => label.includes(word)) && customValueText(value);
  });
}
function valueForCustomLabel(data: Record<string, unknown>, words: string[]) {
  const match = customMatches(data, words).find(([, value]) => customValueText(value));
  return match ? customValueText(match[1]) : "";
}
function splitContactText(text: string): Contact {
  const phoneMatch = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
  const phone = phoneMatch?.[0]?.trim();
  const name = text.replace(phoneMatch?.[0] || "", "").replace(/\b(phone|number|tel|cell|mobile|name|contact|emergency|alternate|relationship)\b/gi, "").replace(/[;:,|]+/g, " ").replace(/\s+/g, " ").trim();
  return { name: name || "Emergency contact", phone, source: "Custom form" };
}
function contactInfo(camper: Camper) {
  const data = parseCustomData(camper.customData);
  const approved: Contact[] = [];
  if (camper.guardianName || camper.guardianPhone) approved.push({ name: camper.guardianName || "Parent / guardian", phone: camper.guardianPhone || undefined, relationship: "Guardian", source: "Registration" });
  for (const [, value] of customMatches(data, ["pickup", "pick up", "approved", "authorized", "release"])) {
    const text = customValueText(value);
    if (text && !approved.some(contact => contact.name.toLowerCase() === text.toLowerCase())) approved.push({ name: text, relationship: "Approved pickup", source: "Custom form" });
  }
  const emergency: Contact[] = [];
  const emergencyName = valueForCustomLabel(data, ["emergency contact name", "emergency name", "alternate contact name", "backup contact name"]);
  const emergencyRelationship = valueForCustomLabel(data, ["emergency relationship", "alternate relationship", "backup relationship"]);
  const emergencyPhone = camper.emergencyPhone || valueForCustomLabel(data, ["emergency phone", "emergency number", "alternate phone", "backup phone"]);
  if (emergencyName || emergencyPhone) emergency.push({ name: emergencyName || camper.guardianName || "Emergency contact", phone: emergencyPhone || undefined, relationship: emergencyRelationship || undefined, source: "Registration" });
  for (const [, value] of customMatches(data, ["emergency", "alternate", "doctor", "contact phone"])) {
    const text = customValueText(value);
    if (!text) continue;
    const parsed = splitContactText(text);
    const combined = `${parsed.name} ${parsed.phone || ""}`.toLowerCase();
    if (!emergency.some(contact => `${contact.name} ${contact.phone || ""}`.toLowerCase().includes(combined) || combined.includes(`${contact.name} ${contact.phone || ""}`.toLowerCase()))) emergency.push(parsed);
  }
  return { approved, emergency };
}
function scheduleRows(camper: Camper) {
  const rows = new Map<string, { title: string; time: string; room: string }>();
  for (const enrollment of camper.enrollments || []) {
    const session = enrollment.session;
    const title = session?.course?.name || session?.mandatorySession?.title || "Untitled session";
    const start = session?.sessionTemplate?.startTime || "";
    const end = session?.sessionTemplate?.endTime || "";
    const label = session?.sessionTemplate?.label || "";
    const time = [label, start && end ? `${start}–${end}` : start || end].filter(Boolean).join(" · ") || "Time TBD";
    const room = session?.room?.name || "Room TBD";
    rows.set(`${title}|${time}|${room}`, { title, time, room });
  }
  return [...rows.values()].sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
}
function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tokensFromScan(raw: string) {
  const values = new Set<string>();
  const trimmed = raw.trim();
  if (!trimmed) return [];
  values.add(trimmed);
  try {
    const url = new URL(trimmed);
    for (const key of ["camperId", "camper", "id", "cid", "studentId", "registrationId"]) {
      const found = url.searchParams.get(key);
      if (found) values.add(found);
    }
    const parts = url.pathname.split("/").filter(Boolean);
    for (const part of parts) if (part.length >= 8) values.add(decodeURIComponent(part));
  } catch {}
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      for (const key of ["camperId", "camper", "id", "cid", "studentId"]) {
        const found = (parsed as Record<string, unknown>)[key];
        if (typeof found === "string") values.add(found);
      }
    }
  } catch {}
  return [...values].map(normalize).filter(Boolean);
}
function scanMatches(camper: Camper, raw: string) {
  const scanTokens = tokensFromScan(raw);
  if (!scanTokens.length) return false;
  const haystacks = [
    camper.id,
    fullName(camper),
    `${camper.lastName} ${camper.firstName}`,
    camper.guardianName || "",
    camper.guardianEmail || "",
    camper.guardianPhone || "",
    camper.emergencyPhone || "",
    camper.ageGroup?.name || "",
  ].map(normalize).filter(Boolean);
  return scanTokens.some(token => haystacks.some(hay => hay === token || hay.includes(token) || token.includes(hay)));
}
function nextScanAction(camper: Camper) {
  return attendanceStatus(camper) === "checked_in" ? "check_out" : "check_in";
}

function ContactList({ title, contacts, empty }: { title: string; contacts: Contact[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-3 py-2 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{title}</p>
      {contacts.length ? <ul className="mt-1.5 space-y-1.5">{contacts.slice(0, 5).map((contact, index) => (
        <li key={`${contact.name}-${index}`} className="text-xs text-slate-700">
          <span className="font-black text-slate-900">{contact.name}</span>
          {contact.relationship && <span className="text-slate-400"> · {contact.relationship}</span>}
          {contact.phone && <a className="ml-1 font-black text-sky-700 hover:underline" href={`tel:${contact.phone}`}>{contact.phone}</a>}
        </li>
      ))}</ul> : <p className="mt-1 text-xs font-semibold text-rose-600">{empty}</p>}
    </div>
  );
}

function CheckInContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";
  const [campDate, setCampDate] = useState(todayValue());
  const [campers, setCampers] = useState<Camper[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [view, setView] = useState<View>("walk_up");
  const [query, setQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("idle");
  const [scanError, setScanError] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [lastScanned, setLastScanned] = useState("");
  const [scheduleOpenId, setScheduleOpenId] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLockRef = useRef(false);

  const load = () => {
    if (!campId) return;
    setLoading(true);
    fetch(`/api/camps/${campId}/attendance?date=${encodeURIComponent(campDate)}`)
      .then(r => r.json())
      .then(data => setCampers(Array.isArray(data.campers) ? data.campers : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [campId, campDate]);

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
      return false;
    }
    if (data.camper) setCampers(prev => prev.map(item => item.id === data.camper.id ? data.camper : item));
    return true;
  };

  const autoHandleScan = async (raw: string) => {
    if (scanLockRef.current) return;
    const matches = campers.filter(camper => scanMatches(camper, raw));
    if (matches.length !== 1) {
      setQuery(raw);
      setView("all");
      setScanMessage(matches.length ? `${matches.length} possible matches — choose the child below.` : "No exact match. I put the scanned text in search.");
      setScannerOpen(false);
      return;
    }
    const camper = matches[0];
    const action = nextScanAction(camper);
    const contacts = contactInfo(camper);
    scanLockRef.current = true;
    setLastScanned(raw);
    const ok = await updateAttendance(camper, action, {
      pickupPersonName: action === "check_out" ? (camper.guardianName || contacts.approved[0]?.name || "QR self checkout") : undefined,
      pickupRelationship: action === "check_out" ? "QR scan" : undefined,
      pickupCodeVerified: true,
      note: action === "check_in" ? "Auto checked in by QR scan" : "Auto checked out by QR scan",
    });
    scanLockRef.current = false;
    if (ok) {
      setQuery("");
      setActiveLetter("");
      setView(action === "check_in" ? "checked_in" : "checked_out");
      setScanMessage(`${fullName(camper)} ${action === "check_in" ? "checked in" : "checked out"} by QR scan.`);
      setScannerOpen(false);
    }
  };

  useEffect(() => {
    if (!scannerOpen) return;
    let stopped = false;
    let raf = 0;
    scanLockRef.current = false;
    const stopCamera = () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setScanMode("idle");
    };
    const decodeFrame = async (detector?: { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> }) => {
      if (stopped || !videoRef.current) return;
      const video = videoRef.current;
      try {
        if (detector) {
          const codes = await detector.detect(video);
          if (codes[0]?.rawValue && codes[0].rawValue !== lastScanned) {
            await autoHandleScan(codes[0].rawValue);
            return;
          }
        }
        const canvas = canvasRef.current;
        if (canvas && video.videoWidth && video.videoHeight) {
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const result = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
            if (result?.data && result.data !== lastScanned) {
              await autoHandleScan(result.data);
              return;
            }
          }
        }
      } catch {}
      raf = requestAnimationFrame(() => { void decodeFrame(detector); });
    };
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScanError("This browser cannot open a camera. Use the search list on this device.");
        return;
      }
      try {
        setScanError("");
        setScanMessage("");
        const constraints: MediaStreamConstraints[] = [
          { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
          { video: { facingMode: "environment" }, audio: false },
          { video: true, audio: false },
        ];
        let stream: MediaStream | null = null;
        let lastError: unknown = null;
        for (const constraint of constraints) {
          try { stream = await navigator.mediaDevices.getUserMedia(constraint); break; } catch (err) { lastError = err; }
        }
        if (!stream) throw lastError || new Error("Camera unavailable");
        streamRef.current = stream;
        setScanMode("camera");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
        }
        const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
        const detector = Detector ? new Detector({ formats: ["qr_code"] }) : undefined;
        raf = requestAnimationFrame(() => { void decodeFrame(detector); });
      } catch (err) {
        setScanError(err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission is blocked. In iPad Settings/Safari, allow camera for this site, then reopen scanner."
          : "Could not open the camera. I left search ready as the backup fast lane.");
      }
    };
    void start();
    return stopCamera;
  }, [scannerOpen, campers, campDate, campId, lastScanned]);

  const counts = useMemo(() => {
    const checkedIn = campers.filter(c => attendanceStatus(c) === "checked_in").length;
    return {
      walk_up: campers.filter(c => attendanceStatus(c) === "not_arrived").length,
      attention: campers.filter(c => attendanceStatus(c) !== "checked_out" && (!paymentCleared(c) || missingInfo(c).length > 0)).length,
      checked_in: checkedIn,
      checked_out: campers.filter(c => attendanceStatus(c) === "checked_out").length,
      all: campers.length,
    };
  }, [campers]);

  const normalizedQuery = query.trim().toLowerCase();
  const availableLetters = useMemo(() => new Set(campers.filter(c => attendanceStatus(c) === "not_arrived").map(c => (c.lastName || c.firstName || "").slice(0, 1).toUpperCase()).filter(Boolean)), [campers]);
  const visibleCampers = campers.filter(camper => {
    const status = attendanceStatus(camper);
    const isAttention = status !== "checked_out" && (!paymentCleared(camper) || missingInfo(camper).length > 0);
    if (view === "walk_up" && status !== "not_arrived") return false;
    if (view === "checked_in" && status !== "checked_in") return false;
    if (view === "checked_out" && status !== "checked_out") return false;
    if (view === "attention" && !isAttention) return false;
    if (activeLetter && status === "not_arrived" && !(camper.lastName || camper.firstName || "").toUpperCase().startsWith(activeLetter)) return false;
    if (!normalizedQuery) return true;
    const haystack = [camper.id, fullName(camper), `${camper.lastName} ${camper.firstName}`, camper.guardianName, camper.guardianEmail, camper.guardianPhone, camper.emergencyPhone, camper.ageGroup?.name, customValueText(parseCustomData(camper.customData))].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  }).sort((a, b) => `${a.lastName}|${a.firstName}`.localeCompare(`${b.lastName}|${b.firstName}`));

  const checkout = (camper: Camper, pickupPersonName?: string) => {
    const contacts = contactInfo(camper);
    const fallback = pickupPersonName || camper.guardianName || contacts.approved[0]?.name || "";
    const chosen = window.prompt(`Who is picking up ${fullName(camper)}?`, fallback);
    if (chosen === null) return;
    updateAttendance(camper, "check_out", { pickupPersonName: chosen, pickupRelationship: "Reviewed approved pickup list", pickupCodeVerified: true });
  };

  const manualScanSubmit = () => {
    if (!query.trim()) return;
    void autoHandleScan(query.trim());
  };

  if (!campId) return <div className="flex h-64 items-center justify-center text-slate-400">Select a camp to open check-in mode.</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Day-of-camp operations</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Fast Check-In / Check-Out</h1>
          <p className="mt-1 text-sm text-slate-500">Search by name, tap a letter, or scan a QR. Scans immediately check a child in; if already in, they check out.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={campDate} onChange={e => setCampDate(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm" />
          <button onClick={load} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50">Refresh</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <button onClick={() => setView("walk_up")} className={`rounded-3xl p-4 text-left shadow-sm transition ${view === "walk_up" ? "bg-emerald-600 text-white" : "border border-emerald-200 bg-emerald-50 text-emerald-900"}`}><p className="text-3xl font-black">{counts.walk_up}</p><p className="text-sm font-black">Walk-up list</p><p className="text-xs font-semibold opacity-75">Not arrived</p></button>
        <button onClick={() => setView("checked_in")} className={`rounded-3xl p-4 text-left shadow-sm transition ${view === "checked_in" ? "bg-slate-900 text-white" : "border border-sky-200 bg-sky-50 text-sky-900"}`}><p className="text-3xl font-black">{counts.checked_in}</p><p className="text-sm font-black">Checked-in tab</p><p className="text-xs font-semibold opacity-75">Still on campus</p></button>
        <button onClick={() => setView("attention")} className={`rounded-3xl p-4 text-left shadow-sm transition ${view === "attention" ? "bg-amber-500 text-white" : "border border-amber-200 bg-amber-50 text-amber-900"}`}><p className="text-3xl font-black">{counts.attention}</p><p className="text-sm font-black">Needs attention</p><p className="text-xs font-semibold opacity-75">Payment/contact gaps</p></button>
        <button onClick={() => setView("checked_out")} className={`rounded-3xl p-4 text-left shadow-sm transition ${view === "checked_out" ? "bg-sky-600 text-white" : "border border-slate-200 bg-white text-slate-900"}`}><p className="text-3xl font-black">{counts.checked_out}</p><p className="text-sm font-black">Checked out</p><p className="text-xs font-semibold opacity-75">Done for the day</p></button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") manualScanSubmit(); }} placeholder="Quick search: camper, guardian, phone, email, or paste/scan QR text..." className="min-h-14 flex-1 rounded-2xl border border-slate-200 px-4 text-lg font-bold text-slate-800 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" autoFocus />
          <button onClick={manualScanSubmit} className="min-h-14 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-base font-black text-emerald-800 hover:bg-emerald-100">Use as Scan</button>
          <button onClick={() => { setScannerOpen(true); setScanError(""); setScanMessage(""); }} className="min-h-14 rounded-2xl bg-slate-900 px-6 text-base font-black text-white hover:bg-slate-700">Open Camera</button>
          <Link href={`/campers?campId=${campId}`} className="flex min-h-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-6 text-base font-black text-slate-700 hover:bg-slate-100">+ Walk-Up</Link>
        </div>
        {view === "walk_up" && <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          <button onClick={() => setActiveLetter("")} className={`rounded-full px-3 py-1.5 text-xs font-black ${!activeLetter ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>All</button>
          {LETTERS.map(letter => <button key={letter} disabled={!availableLetters.has(letter)} onClick={() => setActiveLetter(letter)} className={`rounded-full px-3 py-1.5 text-xs font-black ${activeLetter === letter ? "bg-sky-600 text-white" : availableLetters.has(letter) ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-slate-50 text-slate-300"}`}>{letter}</button>)}
        </div>}
        {scanMessage && <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">{scanMessage}</p>}
        {scanError && <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{scanError}</p>}
      </div>

      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-black text-slate-900">Scan child QR</h2><p className="text-xs font-semibold text-slate-500">Camera uses native QR detection when available, plus a JS fallback for iPad Safari.</p></div>
              <button onClick={() => setScannerOpen(false)} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600">Close</button>
            </div>
            <video ref={videoRef} className="aspect-video w-full rounded-2xl bg-slate-900 object-cover" playsInline muted autoPlay />
            <canvas ref={canvasRef} className="hidden" />
            <p className="mt-3 text-sm font-semibold text-slate-500">{scanMode === "camera" ? "Camera is live. Point it at a confirmation QR or camper badge QR." : "Opening camera…"}</p>
            {scanError && <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{scanError}</p>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-forest-500 border-t-transparent" /></div>
      ) : visibleCampers.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-400">No campers match this view.</div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.35fr_1.25fr_1fr_auto] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-400 max-lg:hidden">
            <div>Camper info</div><div>Contacts</div><div>{view === "checked_in" ? "Checkout info" : "Day status"}</div><div>Action</div>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleCampers.map(camper => {
              const status = attendanceStatus(camper);
              const statusMeta = STATUS_COPY[status] || STATUS_COPY.not_arrived;
              const ready = readiness(camper);
              const saving = savingId === camper.id;
              const contacts = contactInfo(camper);
              return (
                <div key={camper.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.35fr_1.25fr_1fr_auto] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-xl font-black text-slate-900">{fullName(camper)}</h2>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${statusMeta.cls}`}>{statusMeta.label}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${ready.cls}`}>{ready.label}</span>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-3 py-2"><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Age group</p><p className="font-black text-slate-800">{camper.ageGroup?.name || "No age group"}</p></div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2"><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Guardian</p><p className="truncate font-black text-slate-800">{camper.guardianName || "—"}</p></div>
                    </div>
                    {(camper.medicalNotes || camper.dietaryNotes) && <p className="mt-2 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-800">Medical/dietary note on file</p>}
                    <button onClick={() => setScheduleOpenId(scheduleOpenId === camper.id ? "" : camper.id)} className="mt-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50">
                      {scheduleOpenId === camper.id ? "Hide schedule" : `Show schedule (${scheduleRows(camper).length || 0})`}
                    </button>
                    {scheduleOpenId === camper.id && <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Schedule</p>
                      {scheduleRows(camper).length ? <div className="mt-2 divide-y divide-slate-100">{scheduleRows(camper).map((row, index) => (
                        <div key={`${row.title}-${index}`} className="grid gap-1 py-2 text-xs sm:grid-cols-[0.9fr_1.2fr_0.8fr]">
                          <span className="font-black text-slate-500">{row.time}</span><span className="font-black text-slate-900">{row.title}</span><span className="text-slate-500">{row.room}</span>
                        </div>
                      ))}</div> : <p className="mt-1 text-xs font-semibold text-slate-500">No classes selected</p>}
                    </div>}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    <ContactList title="Emergency contact" contacts={contacts.emergency} empty="No emergency contact on file" />
                    <ContactList title="Approved pickup" contacts={contacts.approved} empty="No approved pickup listed" />
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600 lg:bg-slate-50">
                    <p><span className="text-slate-400">Phone</span> <a className="font-black text-sky-700 hover:underline" href={camper.guardianPhone ? `tel:${camper.guardianPhone}` : undefined}>{camper.guardianPhone || "—"}</a></p>
                    <p className="mt-1 truncate"><span className="text-slate-400">Email</span> {camper.guardianEmail || "—"}</p>
                    <p className="mt-2 text-xs text-slate-400">In: {timestamp(camper.attendance?.checkedInAt)} · Out: {timestamp(camper.attendance?.checkedOutAt)}</p>
                    <p className="text-xs text-slate-400">Payment: {camper.paymentStatus || "not_required"} · {money(camper.totalPaidCents || 0)}</p>
                    {ready.missing.length > 0 && <p className="mt-2 rounded-xl bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700">Missing: {ready.missing.join(", ")}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {status !== "checked_in" && status !== "checked_out" && <button disabled={saving} onClick={() => updateAttendance(camper, "check_in")} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Check In"}</button>}
                    {status === "checked_in" && <button disabled={saving} onClick={() => checkout(camper)} className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Check Out"}</button>}
                    {!paymentCleared(camper) && <button disabled={saving} onClick={() => updateAttendance(camper, "mark_paid", { note: "Marked paid during check-in" })} className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50">Mark Paid</button>}
                    {status !== "not_arrived" && <button disabled={saving} onClick={() => updateAttendance(camper, "reset")} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-500 disabled:opacity-50">Reset</button>}
                  </div>
                </div>
              );
            })}
          </div>
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
