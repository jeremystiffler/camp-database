"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import jsQR from "jsqr";
import CamperScannableCode from "@/components/CamperScannableCode";
import { HelpCopy } from "@/components/HelpMode";

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
  pickupNumber?: string | null;
  scanCode?: string | null;
  scanCodeGeneratedAt?: string | null;
  pickupCardPrintedAt?: string | null;
  badgePrintedAt?: string | null;
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
function todayValue() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function attendanceStatus(camper: Camper) { return camper.attendance?.status || "not_arrived"; }
function paymentCleared(camper: Camper) {
  return ["paid", "not_required", "comped"].includes(camper.paymentStatus || "not_required");
}
function paymentNeededLabel(camper: Camper) {
  return paymentCleared(camper) ? "No" : "Yes";
}
function paymentNeededClass(camper: Camper) {
  return paymentCleared(camper) ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-900 border-amber-200";
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
function compactApprovedPickup(contacts: Contact[]) {
  return contacts.map(contact => [contact.name, contact.relationship ? `(${contact.relationship})` : ""].filter(Boolean).join(" ")).join(", ");
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
    camper.scanCode || "",
    camper.pickupNumber || "",
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

function CheckInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const campId = searchParams.get("campId") || "";
  const kioskParam = searchParams.get("kiosk") === "1";
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
  const [codeCamper, setCodeCamper] = useState<Camper | null>(null);
  const [kioskMode, setKioskMode] = useState(false);
  const [kioskExitPassword, setKioskExitPassword] = useState("");
  const [kioskExitError, setKioskExitError] = useState("");
  const [showKioskExitPrompt, setShowKioskExitPrompt] = useState(false);
  const [settingKioskPassword, setSettingKioskPassword] = useState(false);
  const [newKioskPassword, setNewKioskPassword] = useState("");
  const [kioskSetupError, setKioskSetupError] = useState("");
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

  useEffect(() => {
    if (typeof window === "undefined" || !campId) return;
    const savedPassword = sessionStorage.getItem(`camp-kiosk-password:${campId}`);
    if (sessionStorage.getItem(`camp-kiosk-active:${campId}`) === "1" || (kioskParam && savedPassword)) {
      setKioskMode(true);
      if (!kioskParam) withKioskUrl(true);
      return;
    }
    if (kioskParam && !savedPassword) setSettingKioskPassword(true);
  }, [campId, kioskParam]);

  const withKioskUrl = (enabled: boolean) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (enabled) url.searchParams.set("kiosk", "1");
    else url.searchParams.delete("kiosk");
    router.replace(url.pathname + "?" + url.searchParams.toString());
  };

  const startKioskSetup = () => {
    setKioskSetupError("");
    setNewKioskPassword("");
    setSettingKioskPassword(true);
  };

  const enterKioskMode = () => {
    const password = newKioskPassword.trim();
    if (password.length < 4) {
      setKioskSetupError("Use at least 4 characters so this isn't defeated by a curious toddler with a snack cup.");
      return;
    }
    sessionStorage.setItem(`camp-kiosk-password:${campId}`, password);
    sessionStorage.setItem(`camp-kiosk-active:${campId}`, "1");
    setKioskMode(true);
    setSettingKioskPassword(false);
    setNewKioskPassword("");
    setKioskExitPassword("");
    setScanMessage("");
    setQuery("");
    withKioskUrl(true);
  };

  const exitKioskMode = () => {
    const saved = sessionStorage.getItem(`camp-kiosk-password:${campId}`) || "";
    if (!saved || kioskExitPassword !== saved) {
      setKioskExitError("That password did not match.");
      return;
    }
    sessionStorage.removeItem(`camp-kiosk-active:${campId}`);
    setKioskMode(false);
    setShowKioskExitPrompt(false);
    setKioskExitPassword("");
    setKioskExitError("");
    withKioskUrl(false);
  };

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
      if (kioskMode) {
        setScanMessage("We couldn't match that code. Please ask a staff member for help.");
      } else {
        setQuery(raw);
        setView("all");
        setScanMessage(matches.length ? `${matches.length} possible matches — choose the child below.` : "No exact match. I put the scanned text in search.");
      }
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
      note: kioskMode ? `Self-serve kiosk QR ${action === "check_in" ? "check-in" : "check-out"}` : (action === "check_in" ? "Auto checked in by QR scan" : "Auto checked out by QR scan"),
    });
    scanLockRef.current = false;
    if (ok) {
      setQuery("");
      setActiveLetter("");
      setView(action === "check_in" ? "checked_in" : "checked_out");
      setScanMessage(kioskMode ? `${fullName(camper)} is ${action === "check_in" ? "checked in" : "checked out"}.` : `${fullName(camper)} ${action === "check_in" ? "checked in" : "checked out"} by QR scan.`);
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
  }, [scannerOpen, campers, campDate, campId, lastScanned, kioskMode]);

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
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    campers.filter(c => attendanceStatus(c) === "not_arrived").forEach(c => {
      const firstInitial = (c.firstName || "").slice(0, 1).toUpperCase();
      const lastInitial = (c.lastName || "").slice(0, 1).toUpperCase();
      if (firstInitial) letters.add(firstInitial);
      if (lastInitial) letters.add(lastInitial);
    });
    return letters;
  }, [campers]);
  const visibleCampers = campers.filter(camper => {
    const status = attendanceStatus(camper);
    const isAttention = status !== "checked_out" && (!paymentCleared(camper) || missingInfo(camper).length > 0);
    if (view === "walk_up" && status !== "not_arrived") return false;
    if (view === "checked_in" && status !== "checked_in") return false;
    if (view === "checked_out" && status !== "checked_out") return false;
    if (view === "attention" && !isAttention) return false;
    if (activeLetter && status === "not_arrived") {
      const firstInitial = (camper.firstName || "").slice(0, 1).toUpperCase();
      const lastInitial = (camper.lastName || "").slice(0, 1).toUpperCase();
      if (firstInitial !== activeLetter && lastInitial !== activeLetter) return false;
    }
    if (!normalizedQuery) return true;
    if (normalizedQuery.length === 1 && /^[a-z0-9]$/.test(normalizedQuery)) {
      const firstInitial = (camper.firstName || "").slice(0, 1).toLowerCase();
      const lastInitial = (camper.lastName || "").slice(0, 1).toLowerCase();
      if (firstInitial === normalizedQuery || lastInitial === normalizedQuery) return true;
    }
    const haystack = [camper.scanCode, camper.pickupNumber, camper.id, fullName(camper), `${camper.lastName} ${camper.firstName}`, camper.guardianName, camper.guardianEmail, camper.guardianPhone, camper.emergencyPhone, camper.ageGroup?.name, customValueText(parseCustomData(camper.customData))].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  }).sort((a, b) => `${a.lastName}|${a.firstName}`.localeCompare(`${b.lastName}|${b.firstName}`));

  const checkout = (camper: Camper, pickupPersonName?: string) => {
    const contacts = contactInfo(camper);
    const fallback = pickupPersonName || camper.guardianName || contacts.approved[0]?.name || "";
    const chosen = window.prompt(`Who is picking up ${fullName(camper)}?`, fallback);
    if (chosen === null) return;
    updateAttendance(camper, "check_out", { pickupPersonName: chosen, pickupRelationship: "Reviewed approved pickup list", pickupCodeVerified: true });
  };

  const checkInAndShowCheckout = async (camper: Camper) => {
    const ok = await updateAttendance(camper, "check_in");
    if (ok) {
      setQuery("");
      setActiveLetter("");
      setView("checked_in");
      setScanMessage(`${fullName(camper)} is checked in and ready in the Check Out tab.`);
    }
  };

  const manualScanSubmit = () => {
    if (!query.trim()) return;
    void autoHandleScan(query.trim());
  };

  const kioskSearchText = query.trim().toLowerCase();
  const kioskNameMatches = kioskSearchText.length >= 2
    ? campers
      .filter(camper => [fullName(camper), `${camper.lastName} ${camper.firstName}`, camper.guardianName || ""].join(" ").toLowerCase().includes(kioskSearchText))
      .sort((a, b) => `${a.lastName}|${a.firstName}`.localeCompare(`${b.lastName}|${b.firstName}`))
      .slice(0, 8)
    : [];

  const kioskToggleCamper = async (camper: Camper) => {
    const action = nextScanAction(camper);
    const contacts = contactInfo(camper);
    const ok = await updateAttendance(camper, action, {
      pickupPersonName: action === "check_out" ? (camper.guardianName || contacts.approved[0]?.name || "Kiosk name search") : undefined,
      pickupRelationship: action === "check_out" ? "Kiosk name search" : undefined,
      pickupCodeVerified: false,
      note: `Self-serve kiosk name ${action === "check_in" ? "check-in" : "check-out"}`,
    });
    if (ok) {
      setScanMessage(`${fullName(camper)} is ${action === "check_in" ? "checked in" : "checked out"}.`);
      setQuery("");
    }
  };

  const kioskSearchSubmit = async () => {
    const raw = query.trim();
    if (!raw) return;
    const scanMatchesForQuery = campers.filter(camper => scanMatches(camper, raw));
    if (scanMatchesForQuery.length === 1) {
      await autoHandleScan(raw);
      return;
    }
    if (kioskNameMatches.length === 1) {
      await kioskToggleCamper(kioskNameMatches[0]);
      return;
    }
    setScanMessage(kioskNameMatches.length > 1 ? "Choose the matching child below." : "No match found. Please ask a staff member for help.");
  };

  if (!campId) return <div className="flex h-64 items-center justify-center text-slate-400">Select a camp to open Check in/out.</div>;

  if (kioskMode) {
    return (
      <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50 px-4 py-6 sm:px-6">
        <button
          type="button"
          onClick={() => { setShowKioskExitPrompt(true); setKioskExitPassword(""); setKioskExitError(""); }}
          className="fixed right-4 top-4 z-50 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 text-sm font-black text-slate-700 shadow-sm backdrop-blur hover:bg-slate-50"
        >
          Exit kiosk
        </button>
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl flex-col justify-center space-y-6 py-8">
        <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Kiosk mode</p>
          <h1 className="mt-2 text-4xl font-black text-slate-950 sm:text-5xl">Self Check In/Out</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base font-semibold text-slate-600">Check children in or out by scanning their QR code, searching for the adult/guardian name, or finding the child's name. Admin menus, participant records, schedules, and private details stay hidden.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button onClick={() => { setScannerOpen(true); setScanError(""); setScanMessage(""); }} className="min-h-48 rounded-[2rem] bg-slate-950 p-8 text-left text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800">
            <span className="text-5xl">▣</span>
            <span className="mt-5 block text-2xl font-black">Scan QR Code</span>
            <span className="mt-2 block text-sm font-semibold text-white/70">Scans check in if not arrived, or check out if already checked in.</span>
          </button>
          <div className="min-h-48 rounded-[2rem] border border-sky-200 bg-sky-50 p-8 text-left text-sky-950 shadow-sm">
            <span className="text-5xl">⌕</span>
            <span className="mt-5 block text-2xl font-black">Find by Name</span>
            <span className="mt-2 block text-sm font-semibold text-sky-800/70">Type at least two letters of the adult or child name, then tap Check In or Check Out.</span>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <label className="text-xs font-black uppercase tracking-wide text-slate-400">Scan code or find a name</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void kioskSearchSubmit(); }} placeholder="Type adult/guardian name, child name, paste QR text, or scan from a USB scanner..." className="min-h-14 flex-1 rounded-2xl border border-slate-200 px-4 text-lg font-bold text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" autoFocus />
            <button onClick={() => void kioskSearchSubmit()} className="min-h-14 rounded-2xl bg-emerald-600 px-6 text-base font-black text-white hover:bg-emerald-700">Search / Use Scan</button>
          </div>
          {kioskNameMatches.length > 0 && <div className="mt-4 space-y-2">
            {kioskNameMatches.map(camper => {
              const status = attendanceStatus(camper);
              const canCheckOut = status === "checked_in";
              const done = status === "checked_out";
              return <div key={camper.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-black text-slate-900">{fullName(camper)}</p>
                  <p className="text-xs font-bold text-slate-500">Status: {STATUS_COPY[status]?.label || "Not arrived"}</p>
                </div>
                <div className="flex gap-2">
                  {!canCheckOut && !done && <button disabled={savingId === camper.id} onClick={() => void kioskToggleCamper(camper)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Check In</button>}
                  {canCheckOut && <button disabled={savingId === camper.id} onClick={() => void kioskToggleCamper(camper)} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Check Out</button>}
                  {done && <span className="rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-400">Checked Out</span>}
                </div>
              </div>;
            })}
          </div>}
          {scanMessage && <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">{scanMessage}</p>}
          {scanError && <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{scanError}</p>}
        </div>

        </div>

        {showKioskExitPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
            <div className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Staff only</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">Exit kiosk mode</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-500">Enter the staff password to restore the admin sidebar and navigation.</p>
                </div>
                <button onClick={() => { setShowKioskExitPrompt(false); setKioskExitPassword(""); setKioskExitError(""); }} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600">Close</button>
              </div>
              <input type="password" value={kioskExitPassword} onChange={e => { setKioskExitPassword(e.target.value); setKioskExitError(""); }} onKeyDown={e => { if (e.key === "Enter") exitKioskMode(); }} placeholder="Password to exit kiosk" className="mt-5 min-h-14 w-full rounded-2xl border border-slate-200 px-4 text-base font-bold text-slate-800 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" autoFocus />
              {kioskExitError && <p className="mt-2 text-sm font-bold text-rose-600">{kioskExitError}</p>}
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button onClick={() => { setShowKioskExitPrompt(false); setKioskExitPassword(""); setKioskExitError(""); }} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={exitKioskMode} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800">Exit kiosk</button>
              </div>
            </div>
          </div>
        )}

        {scannerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><h2 className="text-lg font-black text-slate-900">Scan child QR</h2><p className="text-xs font-semibold text-slate-500">Point the camera at the QR code. No child information will be displayed.</p></div>
                <button onClick={() => setScannerOpen(false)} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600">Close</button>
              </div>
              <video ref={videoRef} className="aspect-video w-full rounded-2xl bg-slate-900 object-cover" playsInline muted autoPlay />
              <canvas ref={canvasRef} className="hidden" />
              <p className="mt-3 text-sm font-semibold text-slate-500">{scanMode === "camera" ? "Camera is live." : "Opening camera…"}</p>
              {scanError && <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{scanError}</p>}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Day-of operations</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Fast Check-In / Check-Out</h1>
          <HelpCopy title="Check in/out workflow" className="mt-1 text-sm text-slate-500">Use Check In for arrivals. Once a child is checked in, they immediately move to Check Out so staff can release them from the still-on-campus list.</HelpCopy>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={campDate} onChange={e => setCampDate(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm" />
          <button onClick={load} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50">Refresh</button>
          <button onClick={startKioskSetup} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800">Kiosk mode</button>
        </div>
      </div>

      {settingKioskPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Kiosk mode</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Start self check in/out</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">Families can scan a QR code or search by adult/guardian name or child name. The app chrome and private admin details will be hidden until staff enters this exit password.</p>
              </div>
              <button onClick={() => { setSettingKioskPassword(false); setKioskSetupError(""); }} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600">Close</button>
            </div>
            <label className="mt-5 block text-xs font-black uppercase tracking-wide text-slate-400">Staff exit password</label>
            <input type="password" value={newKioskPassword} onChange={e => { setNewKioskPassword(e.target.value); setKioskSetupError(""); }} onKeyDown={e => { if (e.key === "Enter") enterKioskMode(); }} placeholder="Set a password staff can use to exit" className="mt-2 min-h-14 w-full rounded-2xl border border-slate-200 px-4 text-base font-bold text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" autoFocus />
            {kioskSetupError && <p className="mt-2 text-sm font-bold text-rose-600">{kioskSetupError}</p>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => { setSettingKioskPassword(false); setKioskSetupError(""); }} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={enterKioskMode} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">Enter kiosk mode</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <button onClick={() => setView("walk_up")} className={`rounded-3xl p-4 text-left shadow-sm transition ${view === "walk_up" ? "bg-emerald-600 text-white" : "border border-emerald-200 bg-emerald-50 text-emerald-900"}`}><p className="text-3xl font-black">{counts.walk_up}</p><p className="text-sm font-black">Check In</p><p className="text-xs font-semibold opacity-75">Not arrived</p></button>
        <button onClick={() => setView("checked_in")} className={`rounded-3xl p-4 text-left shadow-sm transition ${view === "checked_in" ? "bg-slate-900 text-white" : "border border-sky-200 bg-sky-50 text-sky-900"}`}><p className="text-3xl font-black">{counts.checked_in}</p><p className="text-sm font-black">Check Out</p><p className="text-xs font-semibold opacity-75">Still on campus</p></button>
        <button onClick={() => setView("attention")} className={`rounded-3xl p-4 text-left shadow-sm transition ${view === "attention" ? "bg-amber-500 text-white" : "border border-amber-200 bg-amber-50 text-amber-900"}`}><p className="text-3xl font-black">{counts.attention}</p><p className="text-sm font-black">Needs Attention</p><p className="text-xs font-semibold opacity-75">Payment/contact gaps</p></button>
        <button onClick={() => setView("checked_out")} className={`rounded-3xl p-4 text-left shadow-sm transition ${view === "checked_out" ? "bg-sky-600 text-white" : "border border-slate-200 bg-white text-slate-900"}`}><p className="text-3xl font-black">{counts.checked_out}</p><p className="text-sm font-black">Checked Out</p><p className="text-xs font-semibold opacity-75">Done for the day</p></button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") manualScanSubmit(); }} placeholder={view === "checked_in" ? "Search who is still on campus, guardian phone, or paste/scan QR text..." : "Quick search: participant, guardian, phone, email, or paste/scan QR text..."} className="min-h-14 flex-1 rounded-2xl border border-slate-200 px-4 text-lg font-bold text-slate-800 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" autoFocus />
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
            <p className="mt-3 text-sm font-semibold text-slate-500">{scanMode === "camera" ? "Camera is live. Point it at a confirmation QR or participant badge QR." : "Opening camera…"}</p>
            {scanError && <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{scanError}</p>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-forest-500 border-t-transparent" /></div>
      ) : visibleCampers.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-black text-slate-800">{view === "walk_up" ? "Everyone is either checked in or checked out." : view === "checked_in" ? "No one is currently waiting for checkout." : view === "attention" ? "No participants need attention right now." : "No participants match this view."}</p>
          <p className="mt-1 text-sm font-semibold text-slate-400">{query ? "Try clearing the search or switching tabs." : "Nice and tidy — like a clipboard after a miracle."}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.1fr_1fr_1.35fr_0.9fr] gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-400 max-lg:hidden">
            <div>Camper</div><div>Guardian</div><div>Approved pickup</div><div>Check-in</div>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleCampers.map(camper => {
              const status = attendanceStatus(camper);
              const statusMeta = STATUS_COPY[status] || STATUS_COPY.not_arrived;
              const saving = savingId === camper.id;
              const contacts = contactInfo(camper);
              const pickupList = compactApprovedPickup(contacts.approved) || "—";
              const inOut = `${timestamp(camper.attendance?.checkedInAt)} / ${timestamp(camper.attendance?.checkedOutAt)}`;
              return (
                <div key={camper.id} className="grid gap-4 px-4 py-4 text-sm lg:grid-cols-[1.1fr_1fr_1.35fr_0.9fr] lg:items-start">
                  <div className="min-w-0 space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 lg:hidden">Camper</p>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-black text-slate-900">{fullName(camper)}</h2>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-black ${statusMeta.cls}`}>{statusMeta.label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                      <span>Payment needed?</span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${paymentNeededClass(camper)}`}>{paymentNeededLabel(camper)}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-500">Pickup #: <span className="font-black text-slate-800">{camper.pickupNumber || "—"}</span></p>
                    <p className="text-xs font-bold text-slate-500">Checked in/out: <span className="font-black text-slate-800">{inOut}</span></p>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 lg:hidden">Guardian</p>
                    <p className="truncate text-base font-black text-slate-900">{camper.guardianName || "—"}</p>
                    <p className="text-xs font-bold text-slate-500">Guardian phone</p>
                    {camper.guardianPhone ? <a className="block truncate font-black text-sky-700 hover:underline" href={`tel:${camper.guardianPhone}`}>{camper.guardianPhone}</a> : <span className="font-bold text-slate-400">—</span>}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 lg:hidden">Approved pickup</p>
                    <p className="text-xs font-bold text-slate-500">Approved pickup names</p>
                    <p className="font-semibold leading-6 text-slate-700" title={pickupList}>{pickupList}</p>
                    <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">Including guardian</p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
                    {status !== "checked_in" && status !== "checked_out" && <button disabled={saving} onClick={() => checkInAndShowCheckout(camper)} className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Check In"}</button>}
                    {status === "checked_in" && <button disabled={saving} onClick={() => checkout(camper)} className="rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Check Out"}</button>}
                    {status === "checked_out" && <button disabled className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-400">Checked Out</button>}
                    {!paymentCleared(camper) && <button disabled={saving} onClick={() => updateAttendance(camper, "mark_paid", { note: "Marked paid during check-in" })} className="rounded-2xl bg-amber-500 px-3 py-2.5 text-sm font-black text-white disabled:opacity-50">Mark Paid</button>}
                    <button type="button" onClick={() => setCodeCamper(camper)} className="rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-black text-indigo-800 hover:bg-indigo-100">QR / Pickup</button>
                    {status !== "not_arrived" && <button disabled={saving} onClick={() => updateAttendance(camper, "reset")} className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-black text-slate-500 disabled:opacity-50">Reset</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {codeCamper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Scannable codes</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">{fullName(codeCamper)}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">Pickup #{codeCamper.pickupNumber || "—"} · {codeCamper.lastName.toUpperCase()} FAMILY</p>
              </div>
              <button onClick={() => setCodeCamper(null)} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600">Close</button>
            </div>
            <div className="mt-5 flex justify-center"><CamperScannableCode value={codeCamper.scanCode} label="Camper QR" size={180} /></div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black">
              <Link href={`/print?campId=${campId}`} className="rounded-xl border border-slate-200 px-3 py-2 text-center text-slate-700 hover:bg-slate-50">Open Print Center</Link>
              <button onClick={() => navigator.clipboard?.writeText(codeCamper.scanCode || "")} className="rounded-xl bg-slate-900 px-3 py-2 text-white">Copy scan code</button>
            </div>
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
