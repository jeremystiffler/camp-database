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
  startDate?: string;
  endDate?: string;
  _count?: { campers: number; courses: number };
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
    if (!name.trim()) { setError("Camp name is required"); return; }
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
      <button
        onClick={e => { e.preventDefault(); onCopy(camp); }}
        title="Copy this program"
        className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-300 hover:text-sky-500 hover:bg-sky-50 transition-colors opacity-0 group-hover:opacity-100 text-sm z-10">
        
      </button>

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
          {camp.startDate
            ? new Date(camp.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "No dates set"}
        </p>
        <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
          <div className="text-center">
            <div className="font-bold text-slate-700">{camp._count?.campers ?? 0}</div>
            <div className="text-xs text-slate-400">Campers</div>
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
  const [camps,        setCamps]        = useState<Camp[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showNewCamp,  setShowNewCamp]  = useState(false);
  const [copyingCamp,  setCopyingCamp]  = useState<Camp | null>(null);
  const [renameValue,  setRenameValue]  = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameMsg,    setRenameMsg]    = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savedCampId,  setSavedCampId]  = useState("");

  const campId     = searchParams.get("campId") || savedCampId || "";
  const activeCamp = camps.find((c) => c.id === campId) || camps[0];

  useEffect(() => {
    const saved = localStorage.getItem("activeCampId") || "";
    setSavedCampId(saved);
  }, []);

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCamps(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    setRenameValue(activeCamp?.name || "");
    setRenameMsg(null);
    if (activeCamp?.id) localStorage.setItem("activeCampId", activeCamp.id);
  }, [activeCamp?.id, activeCamp?.name]);

  const reloadCamps = () => {
    fetch("/api/camps").then(r => r.json()).then(d => { if (Array.isArray(d)) setCamps(d); });
  };

  const saveCampName = async () => {
    if (!activeCamp) return;
    const name = renameValue.trim();
    if (!name) { setRenameMsg({ type: "error", text: "Camp name cannot be blank." }); return; }
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
      setCamps(prev => prev.map(c => c.id === activeCamp.id ? { ...c, name } : c));
      window.dispatchEvent(new Event("camp:list-changed"));
      setRenameMsg({ type: "success", text: "Camp renamed." });
    } else {
      setRenameMsg({ type: "error", text: data.detail || data.error || "Could not rename camp." });
    }
  };

  const totalCampers    = camps.reduce((s, c) => s + (c._count?.campers   ?? 0), 0);
  const totalActivities = camps.reduce((s, c) => s + (c._count?.courses   ?? 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Welcome back! Here&apos;s your camp overview.</p>
        </div>
        <button onClick={() => setShowNewCamp(true)}
          className="minimal-button-primary flex items-center gap-2">
          <span>+</span> New Program
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Campers"  value={loading ? "–" : totalCampers}    icon="C" gradient="stat-forest" />
        <StatCard label="Activities"     value={loading ? "–" : totalActivities} icon="A" gradient="stat-sky" />
        <StatCard label="Camps"          value={loading ? "–" : camps.length}    icon="N" gradient="stat-sunset" />
        <StatCard label="This Season"    value={loading ? "–" : (activeCamp?.status === "published" ? "Live" : "Draft")} icon="S" gradient="stat-berry" />
      </div>

      {activeCamp && (
        <div className="camp-card p-5 mb-8 bg-white">
          <div className="flex flex-col lg:flex-row lg:items-end gap-5 justify-between">
            <div className="flex-1 min-w-0">
              <p className="minimal-section-title mb-2">Active camp</p>
              <p className="text-sm font-black text-slate-900 mb-3">{activeCamp.name}</p>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Rename camp</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void saveCampName(); }} className="minimal-input flex-1" />
                <button onClick={saveCampName} disabled={renameSaving} className="minimal-button-primary">
                  {renameSaving ? "Saving…" : "Save Name"}
                </button>
              </div>
              {renameMsg && <p className={`mt-2 text-xs font-semibold ${renameMsg.type === "success" ? "text-forest-700" : "text-red-600"}`}>{renameMsg.text}</p>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:w-[560px]">
              <Link href={`/setup?campId=${activeCamp.id}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-xs font-bold text-slate-700 hover:border-slate-400 hover:text-slate-950">Setup</Link>
              <Link href={`/teachers?campId=${activeCamp.id}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-xs font-bold text-slate-700 hover:border-slate-400 hover:text-slate-950">Teachers</Link>
              <Link href={`/registration?campId=${activeCamp.id}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-xs font-bold text-slate-700 hover:border-slate-400 hover:text-slate-950">Registration</Link>
              <Link href={`/schedule?campId=${activeCamp.id}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-xs font-bold text-slate-700 hover:border-slate-400 hover:text-slate-950">Schedule</Link>
            </div>
          </div>
        </div>
      )}

      {/* Camp list */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-slate-700 mb-4">Your Camps</h2>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : camps.length === 0 ? (
          <div className="camp-card p-12 text-center">
            <span className="text-5xl mb-4 block"></span>
            <h3 className="font-bold text-slate-700 mb-2">No camps yet</h3>
            <p className="text-slate-400 text-sm mb-5">Create your first program to get started.</p>
            <button onClick={() => setShowNewCamp(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
              + Create Your First Camp
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {camps.map((camp) => (
              <CampCard key={camp.id} camp={camp} active={camp.id === activeCamp?.id} onCopy={setCopyingCamp} />
            ))}
            <button onClick={() => setShowNewCamp(true)}
              className="camp-card p-5 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-forest-600 hover:border-forest-200 transition-colors min-h-[160px] border-dashed">
              <span className="text-3xl">+</span>
              <span className="text-sm font-medium">Add Camp</span>
            </button>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {activeCamp && (
        <div>
          <h2 className="text-base font-bold text-slate-700 mb-4">
            Quick Actions — <span className="text-forest-600">{activeCamp.name}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickAction href={`/activities?campId=${activeCamp.id}`}  icon="A" title="Activities"   desc="Create and manage activities, teachers, rooms, and capacity"  iconClass="icon-badge-forest" />
            <QuickAction href={`/campers?campId=${activeCamp.id}`}     icon="C" title="Campers"      desc="View registrations, search, and manage enrollments"       iconClass="icon-badge-sky" />
            <QuickAction href={`/schedule?campId=${activeCamp.id}`}    icon="S" title="Schedule"     desc="View the full camp schedule grid by time slot"                     iconClass="icon-badge-sunset" />
            <QuickAction href={`/print?campId=${activeCamp.id}`}       icon="P" title="Print Center" desc="Generate schedules, rosters, and name badges"                      iconClass="icon-badge-berry" />
            <QuickAction href={`/settings?campId=${activeCamp.id}`}    icon="Se" title="Settings"     desc="Profile, appearance, billing, and camp-level actions"              iconClass="icon-badge-forest" />
            <button onClick={() => setCopyingCamp(activeCamp)}
              className="camp-card p-4 flex items-start gap-3 group text-left">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 icon-badge-sky">Cp</div>
              <div>
                <h3 className="font-bold text-slate-900 group-hover:text-slate-700 transition-colors text-sm">Copy Program</h3>
                <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">Clone this program&apos;s structure for a new season</p>
              </div>
            </button>
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
            reloadCamps();
            router.push(`/setup?campId=${newCampId}`);
            router.refresh();
          }}
        />
      )}

      {copyingCamp && (
        <CopyCampModal
          sourceCamp={copyingCamp}
          onClose={() => { setCopyingCamp(null); reloadCamps(); }}
          onCopied={(newCampId) => {
            setCopyingCamp(null);
            localStorage.setItem("activeCampId", newCampId);
            window.dispatchEvent(new Event("camp:list-changed"));
            reloadCamps();
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
