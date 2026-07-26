"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import NewCampWizard from "@/components/NewCampWizard";
import { HelpCopy } from "@/components/HelpMode";
import { MoreOptions, useGuidedMode } from "@/components/GuidedMode";

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
}

function StatCard({ label, value, icon, gradient }: StatCardProps) {
  return (
    <div className={`${gradient} tile-button px-4 py-3`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-black tracking-tight text-slate-900">{value}</div>
          <div className="text-xs font-semibold text-slate-700">{label}</div>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/70 bg-white/55 text-xs font-black text-slate-700 shadow-sm">{icon}</span>
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
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
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
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
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

function CampCard({ camp, active, onCopy }: { camp: Camp; active: boolean; onCopy: (camp: Camp) => void }) {
  const statusColors: Record<string, string> = {
    draft:    "bg-slate-100 text-slate-600",
    published:"bg-forest-100 text-forest-700",
    archived: "bg-slate-100 text-slate-400",
  };
  return (
    <div className={`camp-card p-5 relative group ${active ? "ring-2 ring-slate-900" : ""}`}>

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
      {canEditCamp(camp) && (
        <button
          type="button"
          onClick={() => onCopy(camp)}
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-800 hover:border-slate-400 hover:bg-slate-50">
          Duplicate
        </button>
      )}
      {!active && (
        <Link
          href={`/dashboard?campId=${camp.id}`}
          onClick={() => localStorage.setItem("activeCampId", camp.id)}
          className="mt-4 block w-full rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-black text-white hover:bg-slate-700 transition-colors"
        >
          Switch to this event
        </Link>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardContent() {
  const { guidedMode } = useGuidedMode();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [camps,        setPrograms]        = useState<Camp[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showNewCamp,  setShowNewCamp]  = useState(false);
  const [firstProgramPromptHandled, setFirstProgramPromptHandled] = useState(false);
  const [copyingCamp,  setCopyingCamp]  = useState<Camp | null>(null);
  const [summary,      setSummary]      = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [actionsOpen,  setActionsOpen]  = useState(false);
  const [healthOpen,   setHealthOpen]   = useState(false);
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

  // A brand-new account should land directly on the one decision it needs to make.
  // Closing the prompt leaves the dashboard usable; a later login will ask again until a program exists.
  useEffect(() => {
    if (!loading && camps.length === 0 && !firstProgramPromptHandled) {
      setShowNewCamp(true);
      setFirstProgramPromptHandled(true);
    }
  }, [loading, camps.length, firstProgramPromptHandled]);

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

  const attentionTotal = summary
    ? summary!.attention.classesWithoutTeachers + summary!.attention.unscheduledClasses + summary!.attention.fullOrOverCapacityClasses
    : 0;
  const selectedStats = summary?.stats;
  const needsAttention = attentionTotal > 0;

  if (guidedMode) {
    const registered = selectedStats?.registeredStudents ?? activeCamp?._count?.campers ?? 0;
    const progress = [
      { done: Boolean(activeCamp?.name && activeCamp?.startDate && activeCamp?.endDate), label: "Name your event and set the dates", step: "details", description: "Give your event a name and choose its start and end dates." },
      { done: (selectedStats?.ageGroups ?? 0) > 0, label: "Who’s it for?", step: "ages", description: "Add an age group so every activity is built for the right kids." },
      { done: (selectedStats?.rooms ?? 0) > 0, label: "Where things happen", step: "rooms", description: "Add at least one room or location." },
      { done: (selectedStats?.scheduleBlocks ?? 0) > 0, label: "When things happen", step: "times", description: "Create the time blocks that shape each day." },
      { done: (selectedStats?.teachers ?? 0) > 0, label: "Grown-ups in charge", step: "teachers", description: "Add the teachers and helpers who will lead the activities." },
      { done: (selectedStats?.classes ?? 0) > 0, label: "Things to do", step: "activities", description: "Create the activities participants can choose from." },
      { done: (selectedStats?.classes ?? 0) > 0 && (summary?.attention.unscheduledClasses ?? 1) === 0, label: "Make the daily plan", step: "schedule", description: "Put every activity into its time block." },
      { done: Boolean(activeCamp?.registrationOpen), label: "Open for sign-ups", step: "registration", description: "Review your sign-up page, then open registration for families." },
      { done: registered > 0, label: "Families are signed up", step: "campers", description: "You’re ready to welcome your first participant." },
    ];
    const nextProgress = progress.find((item) => !item.done) || progress[progress.length - 1];
    const nextHref = activeCamp ? `/${nextProgress.step === "campers" ? "campers" : "setup"}?campId=${activeCamp.id}${nextProgress.step === "campers" ? "" : `&step=${nextProgress.step}`}` : "/dashboard";
    return <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-indigo-600">Home</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">{activeCamp ? `Your event: ${activeCamp.name}` : "Start your event"}</h1><p className="mt-2 text-sm font-semibold text-slate-600">{activeCamp ? `${activeCamp.status === "draft" ? "Draft" : activeCamp.status} · ${activeCamp.registrationOpen ? "open for sign-ups" : "not open for sign-ups yet"} · ${registered} signed up` : "Create your first event when you’re ready."}</p></div>{(camps.length === 0 || canAdminCamp(activeCamp)) && <button onClick={() => setShowNewCamp(true)} className="minimal-button-primary whitespace-nowrap">+ Start a new event</button>}</div>
      {activeCamp ? <><section className="rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-sky-50 p-7 shadow-sm"><p className="text-xs font-black uppercase tracking-[.16em] !text-white">👉 Next</p><h2 className="mt-2 text-2xl font-black !text-white">Finish setting up your event</h2><p className="mt-2 max-w-xl text-sm font-semibold leading-relaxed !text-white">{nextProgress.description}</p>{canEditCamp(activeCamp) && <Link href={nextHref} className="minimal-button-primary hero-next-button mt-5 inline-flex">Let’s do it →</Link>}</section>
      <section className="camp-card p-6"><h2 className="text-lg font-black text-slate-900">Your progress</h2><div className="mt-4 space-y-3">{progress.map((item) => <div key={item.step} className="flex items-center gap-3 text-sm font-bold text-slate-700"><span className={item.done ? "text-emerald-600" : "text-slate-400"}>{item.done ? "✓" : "○"}</span>{item.label}{!item.done && item.step === nextProgress.step && <span className="text-xs font-semibold text-indigo-600">up next</span>}</div>)}</div></section>
      <MoreOptions label="More options (stats, all tools)"><div className="grid grid-cols-2 gap-3 text-sm font-bold text-slate-700"><span>{registered} signed up</span><span>{selectedStats?.classes ?? 0} activities</span><span>{selectedStats?.teachers ?? 0} grown-ups</span><span>{summaryLoading ? "Checking details…" : `${attentionTotal} things need attention`}</span></div></MoreOptions>
      {camps.length >= 2 && <section><h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Switch event</h2><div className="flex flex-wrap gap-2">{camps.map(c => <Link key={c.id} href={`/dashboard?campId=${c.id}`} className={`rounded-xl border px-3 py-2 text-sm font-bold ${c.id === activeCamp.id ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 bg-white text-slate-600"}`}>{c.name}</Link>)}</div></section>}</> : <section className="camp-card p-8 text-center"><h2 className="text-xl font-black text-slate-900">Let’s make your first event</h2><p className="mt-2 text-sm text-slate-600">Name it, add a few activities, and we’ll help you open sign-ups.</p><button onClick={() => setShowNewCamp(true)} className="minimal-button-primary mt-5">Start an event</button></section>}
      {showNewCamp && <NewCampWizard firstProgram={camps.length === 0} onClose={() => setShowNewCamp(false)} onCreated={(newCampId) => { setShowNewCamp(false); localStorage.setItem("activeCampId", newCampId); router.push(`/setup?campId=${newCampId}`); }} />}
    </div>;
  }

  return (
    <div>
      {(camps.length === 0 || canAdminCamp(activeCamp)) && <div className="mb-4 flex justify-end"><button onClick={() => setShowNewCamp(true)} className="minimal-button-primary flex items-center gap-2"><span>+</span> New Event</button></div>}
      {/* Unified program workspace header */}
      <div className="camp-card relative mb-8 overflow-visible border-indigo-100 bg-gradient-to-br from-white via-indigo-50/50 to-sky-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="minimal-section-title mb-2 !text-white">Event workspace</p>
            <h1 className="truncate text-3xl font-black tracking-tight text-white">{activeCamp ? activeCamp.name : "Your events"}</h1>
            <p className="mt-1 text-sm font-semibold !text-white">{activeCamp ? formatCampDateRange(activeCamp) : "Choose an event to manage its setup, people, schedule, and registration."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeCamp && <p className="mr-1 text-xs font-black uppercase tracking-wide !text-white">Status: {activeCamp.status} · Registration {activeCamp.registrationOpen ? "open" : "closed"}</p>}
            {activeCamp && <div className="relative">
              <button type="button" onClick={() => setActionsOpen(v => !v)} aria-expanded={actionsOpen} className="rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-black !text-slate-950 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50">Manage ▾</button>
              {actionsOpen && <div className="absolute right-0 top-10 z-30 w-[min(92vw,340px)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                {canEditCamp(activeCamp) ? <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><label className="mb-1.5 block text-xs font-black uppercase tracking-wide !text-slate-800">Rename event</label><div className="flex gap-2"><input value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void saveCampName(); }} className="minimal-input min-w-0 flex-1 bg-white" /><button onClick={saveCampName} disabled={renameSaving} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-700 disabled:opacity-60">{renameSaving ? "Saving…" : "Save"}</button></div>{renameMsg && <p className={`mt-2 text-xs font-semibold ${renameMsg?.type === "success" ? "text-forest-700" : "text-red-600"}`}>{renameMsg?.text}</p>}</div> : <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold !text-slate-800">This shared event is read-only for your account.</p>}
                <div className="grid gap-1">{(canEditCamp(activeCamp) ? [["Setup", `/setup?campId=${activeCamp.id}`], ["Teachers", `/teachers?campId=${activeCamp.id}`], ["Registration", `/registration?campId=${activeCamp.id}`], ["Schedule", `/schedule?campId=${activeCamp.id}`], ["Team", `/team?campId=${activeCamp.id}`]] : [["Participants", `/campers?campId=${activeCamp.id}`], ["Schedule", `/schedule?campId=${activeCamp.id}`], ["Print", `/print?campId=${activeCamp.id}`], ["Team", `/team?campId=${activeCamp.id}`]]).map(([label, href]) => <Link key={label} href={href} onClick={() => setActionsOpen(false)} className="rounded-xl px-3 py-2 text-sm font-bold !text-slate-800 hover:bg-slate-50 hover:!text-slate-950">{label}</Link>)}</div>
                {activeCamp && <div className="mt-2 border-t border-slate-200 pt-2"><button type="button" onClick={() => { setActionsOpen(false); setCopyingCamp(activeCamp); }} className="w-full rounded-xl px-3 py-2 text-left text-sm font-black !text-slate-800 hover:bg-slate-50">Duplicate</button></div>}
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
                <h2 className="truncate text-2xl font-black tracking-tight text-slate-950">{activeCamp.name}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">{formatCampDateRange(activeCamp)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-1 text-xs font-black uppercase tracking-wide text-slate-600">Status: {activeCamp.status} · Registration {activeCamp.registrationOpen ? "open" : "closed"}</p>
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
                          <label className="mb-1.5 block text-xs font-black uppercase tracking-wide !text-slate-800">Rename event</label>
                          <div className="flex gap-2">
                            <input value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void saveCampName(); }} className="minimal-input min-w-0 flex-1 bg-white" />
                            <button onClick={saveCampName} disabled={renameSaving} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-700 disabled:opacity-60">{renameSaving ? "Saving…" : "Save"}</button>
                          </div>
                          {renameMsg && <p className={`mt-2 text-xs font-semibold ${renameMsg?.type === "success" ? "text-forest-700" : "text-red-600"}`}>{renameMsg?.text}</p>}
                        </div>
                      ) : <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold !text-slate-800">This shared event is read-only for your account.</p>}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard label="Registered Participants" value={summaryLoading ? "–" : (selectedStats?.registeredStudents ?? activeCamp._count?.campers ?? 0)} icon="R" gradient="stat-forest" />
            <StatCard label="Payments Collected" value={summaryLoading ? "–" : formatCurrency(selectedStats?.paymentCollectedCents)} icon="$" gradient="stat-sunset" />
          </div>

          {summary && (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <button type="button" onClick={() => setHealthOpen(value => !value)} aria-expanded={healthOpen} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-black text-slate-800 hover:bg-slate-50">
                <span>Health details</span><span aria-hidden="true">{healthOpen ? "▴" : "▾"}</span>
              </button>
              {healthOpen && <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-4 md:grid-cols-4">
                <div><p className="text-2xl font-black text-slate-900">{summary!.attention.classesWithoutTeachers}</p><p className="text-xs font-bold text-slate-600">Activities without teachers</p></div>
                <div><p className="text-2xl font-black text-slate-900">{summary!.attention.unscheduledClasses}</p><p className="text-xs font-bold text-slate-600">Activities not on schedule</p></div>
                <div><p className="text-2xl font-black text-slate-900">{summary!.attention.fullOrOverCapacityClasses}</p><p className="text-xs font-bold text-slate-600">Full or over capacity</p></div>
                <div><p className="text-2xl font-black text-slate-900">{summary!.attention.classesWithNoEnrollment}</p><p className="text-xs font-bold text-slate-600">Activities with no enrollments</p></div>
              </div>}
            </div>
          )}
        </div>
      )}

      {/* Operational focus */}
      {activeCamp && (
        <div className={`camp-card mb-8 p-5 ${needsAttention ? "border-amber-200 bg-amber-50/60" : "border-forest-200 bg-forest-50/60"}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className={`mb-2 text-xs font-black uppercase tracking-[0.18em] ${needsAttention ? "text-amber-700" : "text-forest-700"}`}>{needsAttention ? "Needs your attention" : "Event is in good shape"}</p>
              <h2 className="text-lg font-black text-slate-950">{needsAttention ? "A few activity details need a decision" : "No teacher, schedule, or capacity issues found."}</h2>
              {needsAttention && summary ? <div className="mt-3 flex flex-wrap gap-2">{summary!.attention.classesWithoutTeachers > 0 && <span className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700">{summary!.attention.classesWithoutTeachers} need a teacher</span>}{summary!.attention.unscheduledClasses > 0 && <span className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700">{summary!.attention.unscheduledClasses} are not scheduled</span>}{summary!.attention.fullOrOverCapacityClasses > 0 && <span className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700">{summary!.attention.fullOrOverCapacityClasses} are at capacity</span>}</div> : <p className="mt-1 max-w-2xl text-sm font-semibold leading-relaxed text-slate-700">{canEditCamp(activeCamp) ? "Use the tools below to keep registration, check-in, and printed materials ready." : "You can review the event’s live schedule, rosters, and printable materials."}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {canEditCamp(activeCamp) ? <Link href={`/activities?campId=${activeCamp.id}`} className="minimal-button-primary">Review activities</Link> : <Link href={`/schedule?campId=${activeCamp.id}`} className="minimal-button-primary">View schedule</Link>}
              <Link href={canEditCamp(activeCamp) ? `/setup?campId=${activeCamp.id}` : `/team?campId=${activeCamp.id}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-slate-400">{canEditCamp(activeCamp) ? "Setup checklist" : "View team role"}</Link>
            </div>
          </div>
        </div>
      )}

      {camps.length > 1 && (
        <div className="mb-8 border-t border-slate-200 pt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="minimal-section-title">Event switcher</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Your events</h2>
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
              className="px-5 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
              + Create Your First Event
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {camps.map((camp) => (
              <CampCard key={camp.id} camp={camp} active={camp.id === activeCamp?.id} onCopy={setCopyingCamp} />
            ))}

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
