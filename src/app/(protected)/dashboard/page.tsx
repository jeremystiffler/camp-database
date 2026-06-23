"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

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
    <div className={`${gradient} rounded-2xl p-5 text-white shadow-md`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">Live</span>
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm font-medium opacity-90">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-1">{sub}</div>}
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
  return (
    <Link href={href} className="camp-card p-5 flex items-start gap-4 group block">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${iconClass}`}>
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-slate-800 group-hover:text-forest-600 transition-colors text-sm">{title}</h3>
        <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </Link>
  );
}

function CampCard({ camp }: { camp: Camp }) {
  const statusColors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    published: "bg-forest-100 text-forest-700",
    archived: "bg-slate-100 text-slate-400",
  };
  return (
    <Link href={`/activities?campId=${camp.id}`} className="camp-card p-5 block">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-forest-500 to-sky-500 flex items-center justify-center text-white text-lg">
          🏕️
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[camp.status] || "bg-slate-100 text-slate-600"}`}>
          {camp.status}
        </span>
      </div>
      <h3 className="font-bold text-slate-800 mb-1">{camp.name}</h3>
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
  );
}

function NewCampModal({ onClose, onCreated }: { onClose: () => void; onCreated: (camp: Camp) => void }) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/camps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, startDate: startDate || undefined, endDate: endDate || undefined }),
      });
      if (res.ok) {
        const camp = await res.json();
        onCreated(camp);
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create camp");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="font-bold text-xl text-slate-800 mb-5">Create New Camp</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Camp Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Creator's Camp 2027"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create Camp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCamp, setShowNewCamp] = useState(false);

  const campId = searchParams.get("campId") || "";
  const activeCamp = camps.find((c) => c.id === campId) || camps[0];

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCamps(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const totalCampers = camps.reduce((s, c) => s + (c._count?.campers ?? 0), 0);
  const totalActivities = camps.reduce((s, c) => s + (c._count?.courses ?? 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Welcome back! Here&apos;s your camp overview.</p>
        </div>
        <button
          onClick={() => setShowNewCamp(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold shadow-sm shadow-forest-500/20 hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <span>+</span> New Camp
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Campers" value={loading ? "–" : totalCampers} icon="👦" gradient="stat-forest" />
        <StatCard label="Activities" value={loading ? "–" : totalActivities} icon="🎯" gradient="stat-sky" />
        <StatCard label="Camps" value={loading ? "–" : camps.length} icon="🏕️" gradient="stat-sunset" />
        <StatCard label="This Season" value={loading ? "–" : (activeCamp?.status === "published" ? "LIVE" : "Draft")} icon="✅" gradient="stat-berry" />
      </div>

      {/* Camp list */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-slate-700 mb-4">Your Camps</h2>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : camps.length === 0 ? (
          <div className="camp-card p-12 text-center">
            <span className="text-5xl mb-4 block">🏕️</span>
            <h3 className="font-bold text-slate-700 mb-2">No camps yet</h3>
            <p className="text-slate-400 text-sm mb-5">Create your first camp to get started managing registrations, activities, and schedules.</p>
            <button
              onClick={() => setShowNewCamp(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              + Create Your First Camp
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {camps.map((camp) => <CampCard key={camp.id} camp={camp} />)}
            <button
              onClick={() => setShowNewCamp(true)}
              className="camp-card p-5 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-forest-600 hover:border-forest-200 transition-colors min-h-[160px] border-dashed"
            >
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
            <QuickAction href={`/activities?campId=${activeCamp.id}`} icon="🎯" title="Activities" desc="Create and manage camp activities, teachers, rooms, and capacity" iconClass="icon-badge-forest" />
            <QuickAction href={`/campers?campId=${activeCamp.id}`} icon="👦" title="Campers" desc="View all registered campers, search, and manage enrollments" iconClass="icon-badge-sky" />
            <QuickAction href={`/schedule?campId=${activeCamp.id}`} icon="📅" title="Schedule" desc="View the full camp schedule grid by time slot" iconClass="icon-badge-sunset" />
            <QuickAction href={`/print?campId=${activeCamp.id}`} icon="🖨️" title="Print Center" desc="Generate schedules, rosters, and name badges" iconClass="icon-badge-berry" />
            <QuickAction href={`/settings?campId=${activeCamp.id}`} icon="⚙️" title="Settings" desc="Camp details, age groups, rooms, and registration links" iconClass="icon-badge-forest" />
          </div>
        </div>
      )}

      {showNewCamp && (
        <NewCampModal
          onClose={() => setShowNewCamp(false)}
          onCreated={(camp) => {
            setCamps((prev) => [camp, ...prev]);
            router.push(`/activities?campId=${camp.id}`);
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
