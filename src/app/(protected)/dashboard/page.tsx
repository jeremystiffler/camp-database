"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import NewCampWizard from "@/components/NewCampWizard";
import { HelpCopy } from "@/components/HelpMode";

interface Camp {
  id: string;
  name: string;
  status: string;
  registrationOpen?: boolean;
  myRole?: "owner" | "admin" | "editor" | "viewer";
  startDate?: string;
  endDate?: string;
  _count?: { campers: number; courses: number };
}

interface DashboardSummary {
  stats: {
    registeredStudents: number;
    classes: number;
    teachers: number;
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

function formatCurrency(cents?: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((cents || 0) / 100);
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  gradient: string;
  sub?: string;
}

function StatCard({ label, value, icon, gradient, sub }: StatCardProps) {
  return (
    <div className={`${gradient} tile-button p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-3xl font-black tracking-tight text-slate-900 mb-1">{value}</div>
          <div className="text-sm font-semibold text-slate-700">{label}</div>
          {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
        </div>
        <span className="w-10 h-10 rounded-2xl border border-white/70 bg-white/55 flex items-center justify-center text-xs font-black text-slate-700 shadow-sm">{icon}</span>
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
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black flex-shrink-0 ${iconClass}`}>
        {icon}
      </div>
      <div>
        <h3 className="font-black text-slate-900 group-hover:text-slate-700 transition-colors text-sm">{title}</h3>
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
  { key: "includeTimeSlots",  label: "Time Slots",    desc: "Copy all session templates",           default: true  },
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
    if (!name.trim()) { setError("Program name is required"); return; }
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
          <h2 className="font-bold text-lg text-slate-800">Copy Program</h2>
          <p className="text-sm text-slate-500 mt-0.5">Copying from <strong>{sourceCamp.name}</strong></p>
        </div>

        {!result ? (
          <>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

              {/* New camp name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">New Program Name *</label>
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
                  💡 Participants & enrollments are never copied — those are specific to each program run.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleCopy} disabled={copying}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {copying
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Copying…</>
                  : "Copy Program"}
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
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
                Open New Program →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Camp Card ────────────────────────────────────────────────────────────────

function CampCard({ camp, active, onCopy }: { camp: Camp; active: boolean; onCopy: (camp: Camp) => void }) {
  const statusColors: Record<string, string> = {
    draft:    "bg-slate-100 text-slate-600",
    published:"bg-forest-100 text-forest-700",
    archived: "bg-slate-100 text-slate-400",
  };
  return (
    <div className={`camp-card p-5 relative group ${active ? "ring-2 ring-slate-900" : ""}`}>
      {/* Copy button */}
      {canEditCamp(camp) && (
        <button
          onClick={e => { e.preventDefault(); onCopy(camp); }}
          title="Copy this program"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-300 hover:text-sky-500 hover:bg-sky-50 transition-colors opacity-0 group-hover:opacity-100 text-sm z-10">
          ⧉
        </button>
      )}

      <Link
        href={`/activities?campId=${camp.id}`}
        onClick={() => localStorage.setItem("activeCampId", camp.id)}
        className="block"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 text-xs font-black">
            CC
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full mr-7 ${statusColors[camp.status] || "bg-slate-100 text-slate-600"}`}>
            {camp.status}
          </span>
        </div>
        <h3 className="font-bold text-slate-800 mb-1">{camp.name}</h3>
        {active && <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-900 mb-1">Active now</p>}
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
      {!active && (
        <Link
          href={`/dashboard?campId=${camp.id}`}
          onClick={() => localStorage.setItem("activeCampId", camp.id)}
          className="mt-4 block w-full rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-black text-white hover:bg-slate-700 transition-colors"
        >
          Switch to this program
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

  const saveCampName = async () => {
    if (!activeCamp) return;
    const name = renameValue.trim();
    if (!name) { setRenameMsg({ type: "error", text: "Program name cannot be blank." }); return; }
    if (name === activeCamp.name) { setRenameMsg({ type: "error", text: "No rename needed — that is already the program name." }); return; }
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
      setRenameMsg({ type: "success", text: "Program renamed." });
    } else {
      setRenameMsg({ type: "error", text: data.detail || data.error || "Could not rename program." });
    }
  };

  const attentionTotal = summary
    ? summary.attention.classesWithoutTeachers + summary.attention.unscheduledClasses + summary.attention.fullOrOverCapacityClasses
    : 0;
  const selectedStats = summary?.stats;
  const needsAttention = attentionTotal > 0;

  return (
    <div>
      {/* Program command header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <p className="minimal-section-title">Program workspace</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">{activeCamp ? activeCamp.name : "Your programs"}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {activeCamp ? "Your program readiness, next steps, and operating tools in one place." : "Choose a program to manage its setup, people, schedule, and registration."}
          </p>
        </div>
        {(camps.length === 0 || canAdminCamp(activeCamp)) && (
          <button onClick={() => setShowNewCamp(true)}
            className="minimal-button-primary flex items-center gap-2">
            <span>+</span> New Program
          </button>
        )}
      </div>

      {/* Selected program stats */}
      {activeCamp && (
        <div className="mb-8 space-y-4">
          <div className="camp-card relative overflow-visible border-indigo-100 bg-gradient-to-br from-white via-indigo-50/50 to-sky-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="minimal-section-title mb-2">Current program</p>
                <h2 className="truncate text-2xl font-black tracking-tight text-slate-950">{activeCamp.name}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">{formatCampDateRange(activeCamp)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-600">{activeCamp.status}</span>
                <span className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wide ${activeCamp.registrationOpen ? "border-forest-200 bg-forest-50 text-forest-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                  Registration {activeCamp.registrationOpen ? "open" : "closed"}
                </span>
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-600">{activeCamp.myRole || "viewer"}</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActionsOpen(v => !v)}
                    aria-expanded={actionsOpen}
                    className="rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-black text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    Manage ▾
                  </button>
                  {actionsOpen && (
                    <div className="absolute right-0 top-10 z-30 w-[min(92vw,340px)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                      {canEditCamp(activeCamp) ? (
                        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600">Rename program</label>
                          <div className="flex gap-2">
                            <input value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void saveCampName(); }} className="minimal-input min-w-0 flex-1 bg-white" />
                            <button onClick={saveCampName} disabled={renameSaving} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-700 disabled:opacity-60">{renameSaving ? "Saving…" : "Save"}</button>
                          </div>
                          {renameMsg && <p className={`mt-2 text-xs font-semibold ${renameMsg?.type === "success" ? "text-forest-700" : "text-red-600"}`}>{renameMsg?.text}</p>}
                        </div>
                      ) : <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">This shared program is read-only for your account.</p>}
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Registered Students" value={summaryLoading ? "–" : (selectedStats?.registeredStudents ?? activeCamp._count?.campers ?? 0)} icon="R" gradient="stat-forest" />
            <StatCard label="Classes" value={summaryLoading ? "–" : (selectedStats?.classes ?? activeCamp._count?.courses ?? 0)} icon="C" gradient="stat-sky" sub={`${selectedStats?.teachers ?? 0} teachers • ${selectedStats?.rooms ?? 0} rooms`} />
            <StatCard label="Payments Collected" value={summaryLoading ? "–" : formatCurrency(selectedStats?.paymentCollectedCents)} icon="$" gradient="stat-sunset" sub={`${selectedStats?.paidPaymentCount ?? 0} paid • ${selectedStats?.pendingPaymentCount ?? 0} pending`} />
            <StatCard label="Classes Needing Attention" value={summaryLoading ? "–" : attentionTotal} icon="!" gradient="stat-berry" sub="Teacher, schedule, or capacity issues" />
          </div>

          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-2xl font-black text-slate-900">{summary.attention.classesWithoutTeachers}</p>
                <p className="text-xs font-bold text-slate-600">Classes without teachers</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-2xl font-black text-slate-900">{summary.attention.unscheduledClasses}</p>
                <p className="text-xs font-bold text-slate-600">Classes not on schedule</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-2xl font-black text-slate-900">{summary.attention.fullOrOverCapacityClasses}</p>
                <p className="text-xs font-bold text-slate-600">Full or over capacity</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-2xl font-black text-slate-900">{summary.attention.classesWithNoEnrollment}</p>
                <p className="text-xs font-bold text-slate-600">Classes with no enrollments</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Operational focus */}
      {activeCamp && (
        <div className={`camp-card mb-8 p-5 ${needsAttention ? "border-amber-200 bg-amber-50/60" : "border-forest-200 bg-forest-50/60"}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className={`mb-2 text-xs font-black uppercase tracking-[0.18em] ${needsAttention ? "text-amber-700" : "text-forest-700"}`}>{needsAttention ? "Needs your attention" : "Program is in good shape"}</p>
              <h2 className="text-lg font-black text-slate-950">{needsAttention ? `${attentionTotal} class ${attentionTotal === 1 ? "needs" : "need"} a quick look` : "No teacher, schedule, or capacity issues found."}</h2>
              <p className="mt-1 max-w-2xl text-sm font-semibold leading-relaxed text-slate-700">
                {needsAttention ? "Review teachers, unscheduled activities, and capacity before you open the doors." : canEditCamp(activeCamp) ? "Use the tools below to keep registration, check-in, and printed materials ready." : "You can review the program’s live schedule, rosters, and printable materials."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEditCamp(activeCamp) ? <Link href={`/activities?campId=${activeCamp.id}`} className="minimal-button-primary">Review activities</Link> : <Link href={`/schedule?campId=${activeCamp.id}`} className="minimal-button-primary">View schedule</Link>}
              <Link href={canEditCamp(activeCamp) ? `/setup?campId=${activeCamp.id}` : `/team?campId=${activeCamp.id}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-slate-400">{canEditCamp(activeCamp) ? "Setup checklist" : "View team role"}</Link>
            </div>
          </div>
        </div>
      )}

      {/* Program switcher */}
      <div className="mb-8 border-t border-slate-200 pt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="minimal-section-title">Program switcher</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Your programs</h2>
          </div>
          <p className="text-sm font-semibold text-slate-500">Choose a card to make it your active workspace.</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : camps.length === 0 ? (
          <div className="camp-card p-12 text-center">
            <span className="text-5xl mb-4 block"></span>
            <h3 className="font-bold text-slate-700 mb-2">No programs yet</h3>
            <p className="text-slate-400 text-sm mb-5">Create your first program to get started.</p>
            <button onClick={() => setShowNewCamp(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
              + Create Your First Program
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {camps.map((camp) => (
              <CampCard key={camp.id} camp={camp} active={camp.id === activeCamp?.id} onCopy={setCopyingCamp} />
            ))}
            {canAdminCamp(activeCamp) && (
              <button onClick={() => setShowNewCamp(true)}
                className="camp-card p-5 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-forest-600 hover:border-forest-200 transition-colors min-h-[160px] border-dashed">
                <span className="text-3xl">+</span>
                <span className="text-sm font-medium">Add Program</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Core work areas */}
      {activeCamp && (
        <div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="minimal-section-title">Run this program</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Daily work areas</h2>
            </div>
            <p className="text-sm font-semibold text-slate-500">Everything below stays scoped to {activeCamp.name}.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {canEditCamp(activeCamp) && <QuickAction href={`/setup?campId=${activeCamp.id}`} icon="1" title="Setup" desc="Program dates, age groups, rooms, time blocks, and readiness" iconClass="icon-badge-forest" />}
            <QuickAction href={`/registration?campId=${activeCamp.id}`} icon="R" title="Registration" desc="Form settings, public link, family choices, and confirmation" iconClass="icon-badge-berry" />
            <QuickAction href={`/campers?campId=${activeCamp.id}`} icon="P" title="Participants" desc="Registrations, families, and selected class choices" iconClass="icon-badge-sky" />
            <QuickAction href={`/check-in?campId=${activeCamp.id}`} icon="✓" title="Check in/out" desc="Live attendance, pickup, and QR scanning" iconClass="icon-badge-forest" />
            <QuickAction href={`/schedule?campId=${activeCamp.id}`} icon="S" title="Schedule" desc="Time blocks, activity assignments, and schedule health" iconClass="icon-badge-sunset" />
            <QuickAction href={`/print?campId=${activeCamp.id}`} icon="P" title="Print Center" desc="Rosters, schedules, badges, and operational printouts" iconClass="icon-badge-berry" />
            {canEditCamp(activeCamp) && <QuickAction href={`/activities?campId=${activeCamp.id}`} icon="A" title="Activities" desc="Classes, teachers, rooms, capacity, and assignments" iconClass="icon-badge-sky" />}
            <QuickAction href={`/team?campId=${activeCamp.id}`} icon="T" title="Team" desc="People, access levels, and invitations" iconClass="icon-badge-forest" />
            {canAdminCamp(activeCamp) && <QuickAction href={`/settings?campId=${activeCamp.id}`} icon="⚙" title="Settings" desc="Appearance, billing, and protected program settings" iconClass="icon-badge-sunset" />}
            {canEditCamp(activeCamp) && (
              <button onClick={() => setCopyingCamp(activeCamp)} className="camp-card flex items-start gap-3 p-4 text-left transition hover:border-indigo-200 hover:shadow-sm">
                <div className="icon-badge-sky flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-xs font-black">Cp</div>
                <div><h3 className="text-sm font-black text-slate-900">Copy program</h3><p className="mt-1 text-xs leading-relaxed text-slate-600">Clone this structure for a new season.</p></div>
              </button>
            )}
          </div>
        </div>
      )}

      {showNewCamp && (
        <NewCampWizard
          onClose={() => setShowNewCamp(false)}
          onCreated={(newCampId) => {
            setShowNewCamp(false);
            localStorage.setItem("activeCampId", newCampId);
            window.dispatchEvent(new Event("camp:list-changed"));
            reloadPrograms();
            router.push(`/setup?campId=${newCampId}`);
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
