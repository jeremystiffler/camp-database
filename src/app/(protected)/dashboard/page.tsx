"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import NewCampWizard from "@/components/NewCampWizard";
import { HelpCopy } from "@/components/HelpMode";
import type { GridAgeGroup, GridBlock, GridCourse } from "@/components/OperationsGrid";
import { EmptyHome, SetupPanel, type SetupLink } from "@/components/SetupPanel";
import { homeState, type HomeState } from "@/lib/homeState";
import type { Issue } from "@/lib/issues";
import { PROGRAM_PALETTES, paletteForPreset } from "@/lib/programPalettes";

interface Camp {
  id: string;
  name: string;
  status: string;
  registrationOpen?: boolean;
  /** Preset name — the source of truth for this event's colours. */
  themePreset?: string;
  primaryColor?: string;
  accentColor?: string;
  myRole?: "owner" | "admin" | "editor" | "viewer";
  startDate?: string;
  endDate?: string;
  _count?: { campers: number; courses: number };
}

interface DashboardSummary {
  /** The API has always returned this; the local type just never declared it. */
  camp?: { id: string; name: string; status?: string; registrationOpen?: boolean };
  /** Registration count per age group — the honest stand-in for expected size. */
  campersByAgeGroup?: Record<string, number>;
  stats: {
    registeredStudents: number;
    classes: number;
    teachers: number;
    ageGroups: number;
    rooms: number;
    scheduleBlocks: number;
    paymentCollectedCents: number;
    paidPaymentCount: number;
    pendingPaymentCount: number;
  };
  attention: {
    classesWithoutTeachers: number;
    unscheduledClasses: number;
    fullOrOverCapacityClasses: number;
    classesWithNoEnrollment: number;
    capsAboveRoomCapacity?: { courseId: string; message: string }[];
    classesWithNoRoom?: { courseId: string; message: string }[];
    classesWithNoLimit?: { courseId: string; message: string }[];
  };
  /** Every issue, from the one engine (phase 18b). Drives the summary strip. */
  issues?: Issue[];
  grid?: {
    courses: GridCourse[];
    blocks: GridBlock[];
    ageGroups: GridAgeGroup[];
  };
}

const roleRank = (role?: string) => ({ owner: 4, admin: 3, editor: 2, viewer: 1 }[role || "viewer"] || 1);
const canEditCamp = (camp?: Camp) => roleRank(camp?.myRole) >= 2;
const canAdminCamp = (camp?: Camp) => roleRank(camp?.myRole) >= 3;
function formatCampDate(value?: string) {
  if (!value) return "No dates set";
  const isoDate = value.slice(0, 10);
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return "No dates set";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCampDateRange(camp?: Camp) {
  if (!camp?.startDate && !camp?.endDate) return "Dates not set";
  if (camp.startDate && camp.endDate) return `${formatCampDate(camp.startDate)} – ${formatCampDate(camp.endDate)}`;
  return formatCampDate(camp.startDate || camp.endDate);
}

function campInitials(name: string) {
  const words = name.replace(/[^a-zA-Z\s]/g, " ").trim().split(/\s+/).filter((word) => /[a-zA-Z]/.test(word));
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join("") || "EV";
}

function formatCurrency(cents?: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((cents || 0) / 100);
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="tile-button px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-slate-900">{value}</div>
          <div className="text-xs font-semibold text-slate-700">{label}</div>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/70 bg-white/55 text-xs font-extrabold text-slate-700 shadow-sm">{icon}</span>
      </div>
    </div>
  );
}

interface QuickActionProps {
  href: string;
  icon: string;
  title: string;
  desc: string;
  iconClass: string;
}

function QuickAction({ href, icon, title, desc, iconClass }: QuickActionProps) {
  const tileClass = iconClass.includes("forest") ? "tile-sage" : iconClass.includes("sky") ? "tile-denim" : iconClass.includes("sunset") ? "tile-clay" : iconClass.includes("berry") ? "tile-lavender" : "tile-aqua";
  return (
    <Link href={href} className={`tile-button ${tileClass} p-4 flex items-start gap-3 group block`}>
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${iconClass}`}>
        {icon}
      </div>
      <div>
        <h3 className="font-extrabold text-slate-900 group-hover:text-slate-700 transition-colors text-sm">{title}</h3>
        <HelpCopy title={title} className="text-slate-600 text-xs mt-1 leading-relaxed">{desc}</HelpCopy>
      </div>
    </Link>
  );
}

// ─── Copy Camp Modal ──────────────────────────────────────────────────────────

interface CopyOption {
  key: string;
  label: string;
  desc: string;
  default: boolean;
}

const COPY_OPTIONS: CopyOption[] = [
  { key: "includeAgeGroups",  label: "Age Groups",    desc: "Copy all age group definitions",       default: true  },
  { key: "includeRooms",      label: "Rooms",         desc: "Copy all room / location records",     default: true  },
  { key: "includeTeachers",   label: "Teachers",      desc: "Copy teacher & assistant profiles",    default: true  },
  { key: "includeTimeSlots",  label: "Time Blocks",   desc: "Copy all time blocks",                 default: true  },
  { key: "includeActivities", label: "Activities",    desc: "Copy all activities with assignments", default: true  },
  { key: "includeRegForm",    label: "Reg. Form",     desc: "Copy the registration form layout",   default: true  },
];

function CopyCampModal({ sourceCamp, onClose, onCopied }: {
  sourceCamp: Camp;
  onClose: () => void;
  onCopied: (newCampId: string) => void;
}) {
  const [name,      setName]      = useState(`${sourceCamp.name} (Copy)`);
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [options,   setOptions]   = useState<Record<string, boolean>>(
    Object.fromEntries(COPY_OPTIONS.map(o => [o.key, o.default]))
  );
  const [copying,   setCopying]   = useState(false);
  const [error,     setError]     = useState("");
  const [result,    setResult]    = useState<{ campId: string; campName: string; counts: Record<string, number> } | null>(null);

  const toggle = (key: string) => setOptions(prev => ({ ...prev, [key]: !prev[key] }));

  const handleCopy = async () => {
    if (!name.trim()) { setError("Event name is required"); return; }
    setCopying(true); setError("");
    try {
      const res  = await fetch(`/api/camps/${sourceCamp.id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), startDate: startDate || undefined, endDate: endDate || undefined, ...options }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else setError(data.error || "Copy failed");
    } catch { setError("Something went wrong"); }
    finally   { setCopying(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="font-bold text-lg text-slate-800">Copy Event</h2>
          <p className="text-sm text-slate-500 mt-0.5">Copying from <strong>{sourceCamp.name}</strong></p>
        </div>

        {!result ? (
          <>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

              {/* New camp name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">New Event Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400" />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30" />
                </div>
              </div>

              {/* What to copy */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">What to copy over</label>
                <div className="space-y-2">
                  {COPY_OPTIONS.map(opt => (
                    <label key={opt.key}
                      className={`flex items-start gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${options[opt.key] ? "border-forest-400 bg-forest-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"}`}>
                      <input type="checkbox" checked={options[opt.key]} onChange={() => toggle(opt.key)}
                        className="w-4 h-4 mt-0.5 accent-forest-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{opt.label}</p>
                        <p className="text-xs text-slate-500">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2 pl-1">
                  💡 Participants & enrollments are never copied — those are specific to each event run.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleCopy} disabled={copying}
                className="flex-1 px-4 py-2.5 bg-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {copying
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Copying…</>
                  : "Copy Event"}
              </button>
            </div>
          </>
        ) : (
          /* Success screen */
          <>
            <div className="px-6 py-8 text-center space-y-4">
              <span className="text-5xl block">🎉</span>
              <h3 className="font-bold text-lg text-slate-800">{result.campName} created!</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                {Object.entries(result.counts).filter(([,v]) => v > 0).map(([k, v]) => (
                  <div key={k} className="bg-slate-50 border border-slate-100 rounded-xl py-3">
                    <p className="text-lg font-bold text-slate-800">{v}</p>
                    <p className="text-xs text-slate-500 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
                Stay Here
              </button>
              <button onClick={() => onCopied(result.campId)}
                className="flex-1 px-4 py-2.5 bg-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
                Open New Event →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Camp Card ────────────────────────────────────────────────────────────────

function CampCard({ camp, active, onCopy, onDelete, onColorChange }: { camp: Camp; active: boolean; onCopy: (camp: Camp) => void; onDelete: (camp: Camp) => void; onColorChange: (camp: Camp, themePreset: string) => Promise<boolean> }) {
  // Fall back to the event's preset, never to a raw blue that belongs to no
  // palette (done-gate: #2563EB appears nowhere but the Harbor definition).
  const cardPalette = paletteForPreset(camp.themePreset, camp.primaryColor, camp.accentColor);
  const primaryColor = camp.primaryColor || cardPalette.primaryColor;
  const accentColor = camp.accentColor || cardPalette.accentColor;
  const [colorOpen, setColorOpen] = useState(false);
  const [colorSaving, setColorSaving] = useState(false);
  const statusColors: Record<string, string> = {
    draft:    "bg-slate-100 text-slate-600",
    published:"bg-forest-100 text-forest-700",
    archived: "bg-slate-100 text-slate-400",
  };
  const pickColor = async (presetId: string) => {
    if (colorSaving) return;
    setColorSaving(true);
    const ok = await onColorChange(camp, presetId);
    setColorSaving(false);
    if (ok) setColorOpen(false);
  };
  return (
    <div
      className="camp-card relative group overflow-hidden p-5"
      style={{
        borderColor: active ? primaryColor : "var(--border)",
        borderWidth: active ? 2 : 1,
        background: "var(--canvas)",
      }}
    >
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: primaryColor }} />

      <Link
        href={`/activities?campId=${camp.id}`}
        onClick={() => localStorage.setItem("activeCampId", camp.id)}
        className="block"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10" aria-hidden />
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full mr-7 ${statusColors[camp.status] || "bg-slate-100 text-slate-600"}`}>
            {camp.status}
          </span>
        </div>
        <h3 className="font-bold text-slate-800 mb-1">{camp.name}</h3>
        {active && <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] mb-1" style={{ color: primaryColor }}>Active now</p>}
        <p className="text-slate-500 text-xs">
          {formatCampDate(camp.startDate)}
        </p>
        <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
          <div className="text-center">
            <div className="font-bold text-slate-700">{camp._count?.campers ?? 0}</div>
            <div className="text-xs text-slate-400">Participants</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-slate-700">{camp._count?.courses ?? 0}</div>
            <div className="text-xs text-slate-400">Activities</div>
          </div>
        </div>
      </Link>
      {/* Initials chip doubles as the event color chooser (editors and up). */}
      <div className="absolute left-5 top-[25px]">
        {canEditCamp(camp) ? (
          <button
            type="button"
            onClick={() => setColorOpen(open => !open)}
            title="Change event color"
            aria-expanded={colorOpen}
            className="w-10 h-10 rounded-xl border border-white/40 flex items-center justify-center text-white text-xs font-extrabold shadow-sm transition hover:scale-105 hover:ring-2 hover:ring-slate-300"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
          >
            {campInitials(camp.name)}
          </button>
        ) : (
          <div className="w-10 h-10 rounded-xl border border-white/40 flex items-center justify-center text-white text-xs font-extrabold shadow-sm" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}>
            {campInitials(camp.name)}
          </div>
        )}
        {colorOpen && (
          <div className="absolute left-0 top-12 z-30 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-500">Event color</p>
            <div className="grid grid-cols-3 gap-2">
              {PROGRAM_PALETTES.map(palette => {
                const selected = palette.id === paletteForPreset(camp.themePreset, camp.primaryColor, camp.accentColor).id;
                return (
                  <button
                    key={palette.id}
                    type="button"
                    title={palette.name}
                    disabled={colorSaving}
                    onClick={() => pickColor(palette.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition ${selected ? "border-slate-900 bg-slate-50" : "border-transparent hover:border-slate-300"} ${colorSaving ? "opacity-50" : ""}`}
                  >
                    <span className="h-6 w-6 rounded-full" style={{ background: `linear-gradient(135deg, ${palette.preview[0]}, ${palette.preview[1]})` }} />
                    <span className="text-[10px] font-bold text-slate-600">{palette.name}</span>
                  </button>
                );
              })}
            </div>
            {colorSaving && <p className="mt-2 text-[10px] font-bold text-slate-500">Saving…</p>}
          </div>
        )}
      </div>
      {canEditCamp(camp) && (
        <button
          type="button"
          onClick={() => onCopy(camp)}
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold text-slate-800 hover:border-slate-400 hover:bg-slate-50">
          Duplicate
        </button>
      )}
      {canAdminCamp(camp) && (
        <button
          type="button"
          onClick={() => onDelete(camp)}
          className="mt-2 w-full rounded-xl border border-red-200 bg-white/80 px-3 py-2 text-xs font-extrabold text-red-600 transition hover:border-red-300 hover:bg-red-50"
        >
          Delete event
        </button>
      )}
      {!active && (
        <Link
          href={`/dashboard?campId=${camp.id}`}
          onClick={() => localStorage.setItem("activeCampId", camp.id)}
          className="mt-4 block w-full rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-extrabold text-white hover:bg-slate-700 transition-colors"
        >
          Switch to this event
        </Link>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [camps,        setPrograms]        = useState<Camp[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showNewCamp,  setShowNewCamp]  = useState(false);
  const [copyingCamp,  setCopyingCamp]  = useState<Camp | null>(null);
  const [deletingCamp, setDeletingCamp] = useState<Camp | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [summary,      setSummary]      = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [actionsOpen,  setActionsOpen]  = useState(false);


  const [renameValue,  setRenameValue]  = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameMsg,    setRenameMsg]    = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savedCampId,  setSavedCampId]  = useState("");
  const [savedCampReady, setSavedCampReady] = useState(false);

  const campId     = searchParams.get("campId") || savedCampId || "";
  // Do not briefly choose the first/alphabetical program before the saved workspace is restored.
  const activeCamp = camps.find((c) => c.id === campId) || (savedCampReady ? camps[0] : undefined);

  useEffect(() => {
    const saved = localStorage.getItem("activeCampId") || "";
    setSavedCampId(saved);
    setSavedCampReady(true);
  }, []);

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPrograms(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    setRenameValue(activeCamp?.name || "");
    setRenameMsg(null);
    setActionsOpen(false);
    if (activeCamp?.id) localStorage.setItem("activeCampId", activeCamp.id);
  }, [activeCamp?.id, activeCamp?.name]);


  useEffect(() => {
    if (!activeCamp?.id) {
      setSummary(null);
      return;
    }
    setSummaryLoading(true);
    fetch(`/api/camps/${activeCamp.id}/dashboard`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setSummary(data && data.stats ? data : null))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [activeCamp?.id]);


  const reloadPrograms = () => {
    fetch("/api/camps").then(r => r.json()).then(d => { if (Array.isArray(d)) setPrograms(d); });
  };

  const requestDeleteCamp = (camp: Camp) => {
    setDeleteConfirmation("");
    setDeleteError("");
    setDeletingCamp(camp);
  };

  const changeCampColor = async (camp: Camp, themePreset: string) => {
    // Send the preset by NAME. The hex columns are its rendered output, derived
    // server-side, so the two can never drift apart.
    const response = await fetch(`/api/camps/${camp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themePreset }),
    });
    if (!response.ok) return false;
    const palette = PROGRAM_PALETTES.find((option) => option.id === themePreset);
    const primaryColor = palette?.primaryColor ?? camp.primaryColor;
    const accentColor = palette?.accentColor ?? camp.accentColor;
    // Update the card immediately and let the layout (sidebar, header) pick up the change.
    setPrograms(prev => prev.map(c => c.id === camp.id ? { ...c, themePreset, primaryColor, accentColor } : c));
    window.dispatchEvent(new Event("camp:list-changed"));
    return true;
  };

  const deleteCamp = async () => {
    if (!deletingCamp || deleteConfirmation !== deletingCamp.name) return;
    setDeleteSaving(true);
    setDeleteError("");
    const response = await fetch(`/api/camps/${deletingCamp.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setDeleteSaving(false);
    if (!response.ok) {
      setDeleteError(data.detail || data.error || "Could not delete this event.");
      return;
    }

    const remaining = camps.filter(camp => camp.id !== deletingCamp.id);
    setPrograms(remaining);
    setDeletingCamp(null);
    window.dispatchEvent(new Event("camp:list-changed"));
    if (activeCamp?.id === deletingCamp.id) {
      const nextCamp = remaining[0];
      if (nextCamp) {
        localStorage.setItem("activeCampId", nextCamp.id);
        router.replace(`/dashboard?campId=${nextCamp.id}`);
      } else {
        localStorage.removeItem("activeCampId");
        router.replace("/dashboard");
      }
    }
    router.refresh();
  };

  const deleteDialog = deletingCamp ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50" onClick={() => !deleteSaving && setDeletingCamp(null)} />
      <div role="dialog" aria-modal="true" aria-labelledby="delete-switcher-event-title" className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 id="delete-switcher-event-title" className="text-xl font-extrabold text-slate-900">Delete this event?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">This permanently removes <strong>{deletingCamp.name}</strong>, including its schedule, participants, and settings. Type the event name to continue.</p>
        <input autoFocus value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} placeholder={deletingCamp.name} className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
        {deleteError && <p className="mt-2 text-sm font-semibold text-red-600">{deleteError}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={() => setDeletingCamp(null)} disabled={deleteSaving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={deleteCamp} disabled={deleteSaving || deleteConfirmation !== deletingCamp.name} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">{deleteSaving ? "Deleting…" : "Delete permanently"}</button>
        </div>
      </div>
    </div>
  ) : null;

  const saveCampName = async () => {
    if (!activeCamp) return;
    const name = renameValue.trim();
    if (!name) { setRenameMsg({ type: "error", text: "Event name cannot be blank." }); return; }
    if (name === activeCamp.name) { setRenameMsg({ type: "error", text: "No rename needed — that is already the event name." }); return; }
    setRenameSaving(true); setRenameMsg(null);
    const res = await fetch(`/api/camps/${activeCamp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    setRenameSaving(false);
    if (res.ok) {
      setPrograms(prev => prev.map(c => c.id === activeCamp.id ? { ...c, name } : c));
      window.dispatchEvent(new Event("camp:list-changed"));
      setRenameMsg({ type: "success", text: "Event renamed." });
    } else {
      setRenameMsg({ type: "error", text: data.detail || data.error || "Could not rename event." });
    }
  };

  const selectedStats = summary?.stats;
  // Derived from the one engine (phase 18b), not from a second tally. The old
  // arithmetic here counted a full 9/9 class as a problem and knew nothing of
  // room or teacher clashes, so this headline could contradict the summary strip
  // sitting a few hundred pixels above it.
  const needsAttention = (summary?.issues?.length ?? 0) > 0;

  // Home's four states (spec §5, phase 18g). Derived every render — never
  // stored, so it cannot fall out of step with the event it describes.
  const registrationOpen = Boolean(summary?.camp?.registrationOpen);

  const state: HomeState = homeState({
    activityCount: summary?.grid?.courses.length ?? 0,
    blockCount: summary?.grid?.blocks.length ?? 0,
    issues: summary?.issues ?? [],
    registrationOpen,
  });
  const blockingCount = (summary?.issues ?? []).filter((issue) => issue.severity === "blocking").length;

  const setupLinks: SetupLink[] = activeCamp
    ? [
        { label: "Age groups", href: `/setup?campId=${activeCamp.id}&step=ages`, done: (summary?.stats?.ageGroups ?? 0) > 0 },
        { label: "Rooms", href: `/setup?campId=${activeCamp.id}&step=rooms`, done: (summary?.stats?.rooms ?? 0) > 0 },
        { label: "Time blocks", href: `/setup?campId=${activeCamp.id}&step=times`, done: (summary?.stats?.scheduleBlocks ?? 0) > 0 },
        { label: "Teachers", href: `/setup?campId=${activeCamp.id}&step=teachers`, done: (summary?.stats?.teachers ?? 0) > 0 },
        { label: "Activities", href: `/setup?campId=${activeCamp.id}&step=activities`, done: (summary?.stats?.classes ?? 0) > 0 },
        { label: "Registration form", href: `/setup?campId=${activeCamp.id}&step=registration`, done: registrationOpen },
      ]
    : [];

  // §5.2: setup must open the FIRST INCOMPLETE section. Landing a returning
  // organiser on finished work is the defect underneath that whole screen.
  const firstIncomplete = setupLinks.find((link) => !link.done);

  const setupPanel = activeCamp ? (
    <SetupPanel
      state={state}
      blockingCount={blockingCount}
      links={setupLinks}
      registrationOpen={registrationOpen}
      firstIncompleteHref={firstIncomplete?.href ?? `/setup?campId=${activeCamp.id}`}
    />
  ) : null;

  return (
    <div>
      {(camps.length === 0 || canAdminCamp(activeCamp)) && <div className="mb-4 flex justify-end"><button onClick={() => setShowNewCamp(true)} className="minimal-button-primary flex items-center gap-2"><span>+</span> New Event</button></div>}
      {/* Unified program workspace header */}
      <div className="page-banner mb-8 overflow-visible">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="page-banner__eyebrow">Event workspace</p>
            <h1 className="page-banner__title truncate">{activeCamp ? activeCamp.name : "Your events"}</h1>
            <p className="page-banner__desc">{activeCamp ? formatCampDateRange(activeCamp) : "Choose an event to manage its setup, people, schedule, and registration."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeCamp && <p className="page-banner__eyebrow mr-1">Status: {activeCamp.status} · Registration {activeCamp.registrationOpen ? "open" : "closed"}</p>}
            {activeCamp && <div className="relative">
              <button type="button" onClick={() => setActionsOpen(v => !v)} aria-expanded={actionsOpen} className="page-banner__action page-banner__action--quiet text-xs">Manage ▾</button>
              {actionsOpen && <div className="absolute right-0 top-10 z-30 w-[min(92vw,340px)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                {canEditCamp(activeCamp) ? <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-800">Rename event</label><div className="flex gap-2"><input value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void saveCampName(); }} className="minimal-input min-w-0 flex-1 bg-white" /><button onClick={saveCampName} disabled={renameSaving} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-slate-700 disabled:opacity-60">{renameSaving ? "Saving…" : "Save"}</button></div>{renameMsg && <p className={`mt-2 text-xs font-semibold ${renameMsg?.type === "success" ? "text-forest-700" : "text-red-600"}`}>{renameMsg?.text}</p>}</div> : <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">This shared event is read-only for your account.</p>}
                <div className="grid gap-1">{(canEditCamp(activeCamp) ? [["Setup", `/setup?campId=${activeCamp.id}`], ["Teachers", `/teachers?campId=${activeCamp.id}`], ["Registration", `/registration?campId=${activeCamp.id}`], ["Schedule", `/schedule?campId=${activeCamp.id}`], ["Team", `/team?campId=${activeCamp.id}`]] : [["Participants", `/campers?campId=${activeCamp.id}`], ["Schedule", `/schedule?campId=${activeCamp.id}`], ["Print", `/print?campId=${activeCamp.id}`], ["Team", `/team?campId=${activeCamp.id}`]]).map(([label, href]) => <Link key={label} href={href} onClick={() => setActionsOpen(false)} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 hover:text-slate-950">{label}</Link>)}</div>
                {activeCamp && <div className="mt-2 border-t border-slate-200 pt-2"><button type="button" onClick={() => { setActionsOpen(false); setCopyingCamp(activeCamp); }} className="w-full rounded-xl px-3 py-2 text-left text-sm font-extrabold text-slate-800 hover:bg-slate-50">Duplicate</button></div>}
              </div>}
            </div>}

          </div>
        </div>
      </div>

      {/* Selected program stats */}
      {activeCamp && (
        <div className="mb-8 space-y-4">
          {/* Program identity, status, dates, and management controls are unified in the header above. */}
          <div className="hidden">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="minimal-section-title mb-2">Current event</p>
                <h2 className="truncate text-2xl font-extrabold tracking-tight text-slate-950">{activeCamp.name}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">{formatCampDateRange(activeCamp)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-1 text-xs font-extrabold uppercase tracking-wide text-slate-600">Status: {activeCamp.status} · Registration {activeCamp.registrationOpen ? "open" : "closed"}</p>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActionsOpen(v => !v)}
                    aria-expanded={actionsOpen}
                    className="rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-extrabold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    Manage ▾
                  </button>
                  {actionsOpen && (
                    <div className="absolute right-0 top-10 z-30 w-[min(92vw,340px)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                      {canEditCamp(activeCamp) ? (
                        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-800">Rename event</label>
                          <div className="flex gap-2">
                            <input value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void saveCampName(); }} className="minimal-input min-w-0 flex-1 bg-white" />
                            <button onClick={saveCampName} disabled={renameSaving} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-slate-700 disabled:opacity-60">{renameSaving ? "Saving…" : "Save"}</button>
                          </div>
                          {renameMsg && <p className={`mt-2 text-xs font-semibold ${renameMsg?.type === "success" ? "text-forest-700" : "text-red-600"}`}>{renameMsg?.text}</p>}
                        </div>
                      ) : <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">This shared event is read-only for your account.</p>}
                      <div className="grid gap-1">
                        {(canEditCamp(activeCamp) ? [["Setup", `/setup?campId=${activeCamp.id}`], ["Teachers", `/teachers?campId=${activeCamp.id}`], ["Registration", `/registration?campId=${activeCamp.id}`], ["Schedule", `/schedule?campId=${activeCamp.id}`], ["Team", `/team?campId=${activeCamp.id}`]] : [["Participants", `/campers?campId=${activeCamp.id}`], ["Schedule", `/schedule?campId=${activeCamp.id}`], ["Print", `/print?campId=${activeCamp.id}`], ["Team", `/team?campId=${activeCamp.id}`]]).map(([label, href]) => (
                          <Link key={label} href={href} onClick={() => setActionsOpen(false)} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-950">{label}</Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Home's four states (spec §5, phase 18g). The ORDER changes;
              nothing is ever hidden, and there is no mode toggle — the state is
              derived from the issue engine on every render. */}
          {summary && state === "empty" && (
            <EmptyHome
              campName={activeCamp.name}
              onStart={() => router.push(`/setup?campId=${activeCamp.id}`)}
            />
          )}

          {summary && state === "building" && setupPanel}


          {summary && (state === "ready" || state === "running") && setupPanel}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard label="Registered Participants" value={summaryLoading ? "–" : (selectedStats?.registeredStudents ?? activeCamp._count?.campers ?? 0)} icon="R" />
            <StatCard label="Payments Collected" value={summaryLoading ? "–" : formatCurrency(selectedStats?.paymentCollectedCents)} icon="$" />
          </div>


        </div>
      )}

      {/* Operational focus */}
      {activeCamp && (
        <div className={`camp-card mb-8 p-5 ${needsAttention ? "border-amber-200 bg-amber-50/60" : "border-forest-200 bg-forest-50/60"}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className={`mb-2 text-xs font-extrabold uppercase tracking-[0.18em] ${needsAttention ? "text-amber-700" : "text-forest-700"}`}>{needsAttention ? "Needs your attention" : "Event is in good shape"}</p>
              <h2 className="text-lg font-extrabold text-slate-950">{needsAttention ? "A few activity details need a decision" : "No teacher, schedule, or capacity issues found."}</h2>
              {/* The issue chips that stood here are deleted (phase 18f). They
                  were a SECOND issue display with its own arithmetic, and it
                  disagreed with the summary strip: on a room+teacher clash it
                  reported "1 issue" (counting a full 9/9 class as a problem)
                  while the engine correctly reported 2 blocking. Its buttons
                  also router.push'd to /activities, which §3 forbids. One
                  engine, one display: the strip above the grid. */}
              <p className="mt-1 max-w-2xl text-sm font-semibold leading-relaxed text-slate-700">{canEditCamp(activeCamp) ? "Use the tools below to keep registration, check-in, and printed materials ready." : "You can review the event\u2019s live schedule, rosters, and printable materials."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEditCamp(activeCamp) ? <Link href={`/activities?campId=${activeCamp.id}`} className="minimal-button-primary">Review activities</Link> : <Link href={`/schedule?campId=${activeCamp.id}`} className="minimal-button-primary">View schedule</Link>}
              <Link href={canEditCamp(activeCamp) ? `/setup?campId=${activeCamp.id}` : `/team?campId=${activeCamp.id}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-slate-400">{canEditCamp(activeCamp) ? "Setup checklist" : "View team role"}</Link>
            </div>
          </div>
        </div>
      )}

      {camps.length > 0 && (
        <div className="mb-8 border-t border-slate-200 pt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="minimal-section-title">Event switcher</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">Your events</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3"><p className="text-sm font-semibold text-slate-500">Choose a card to make it your active workspace or create a new one.</p>{canAdminCamp(activeCamp) && <button onClick={() => setShowNewCamp(true)} className="minimal-button-primary">+ Add Event</button>}</div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : camps.length === 0 ? (
          <div className="camp-card p-12 text-center">
            <span className="text-5xl mb-4 block"></span>
            <h3 className="font-bold text-slate-700 mb-2">No events yet</h3>
            <p className="text-slate-400 text-sm mb-5">Create your first event to get started.</p>
            <button onClick={() => setShowNewCamp(true)}
              className="px-5 py-2.5 bg-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
              + Create Your First Event
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {camps.map((camp) => (
              <CampCard key={camp.id} camp={camp} active={camp.id === activeCamp?.id} onCopy={setCopyingCamp} onDelete={requestDeleteCamp} onColorChange={changeCampColor} />
            ))}
            {camps.some(canAdminCamp) && (
              <button
                type="button"
                onClick={() => setShowNewCamp(true)}
                className="flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/70 p-5 text-center transition hover:border-slate-400 hover:bg-slate-50"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-extrabold text-white">+</span>
                <span className="mt-4 text-base font-extrabold text-slate-800">Add a new event</span>
                <span className="mt-1 text-sm font-semibold text-slate-500">Choose its name, dates, and colors.</span>
              </button>
            )}

          </div>
        )}
        </div>
      )}


      {showNewCamp && (
        <NewCampWizard
          firstProgram={camps.length === 0}
          onClose={() => setShowNewCamp(false)}
          onCreated={(newCampId) => {
            setShowNewCamp(false);
            localStorage.setItem("activeCampId", newCampId);
            window.dispatchEvent(new Event("camp:list-changed"));
            reloadPrograms();
            router.push(`/setup?campId=${newCampId}&step=details`);
            router.refresh();
          }}
        />
      )}

{copyingCamp && (
        <CopyCampModal
          sourceCamp={copyingCamp}
          onClose={() => { setCopyingCamp(null); reloadPrograms(); }}
          onCopied={(newCampId) => {
            setCopyingCamp(null);
            localStorage.setItem("activeCampId", newCampId);
            window.dispatchEvent(new Event("camp:list-changed"));
            reloadPrograms();
            router.push(`/setup?campId=${newCampId}`);
            router.refresh();
          }}
        />
      )}

      {deleteDialog}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}
