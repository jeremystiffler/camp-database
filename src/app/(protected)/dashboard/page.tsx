"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Stats {
  campers: number;
  activities: number;
  campYears: number;
  assignments: number;
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${color}`}>Live</span>
      </div>
      <div className="font-heading font-bold text-3xl text-cream mb-1">{value}</div>
      <div className="text-muted text-sm">{label}</div>
    </div>
  );
}

function QuickAction({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <Link href={href} className="glass-card rounded-2xl p-5 hover:border-ember-500/20 transition-all duration-300 group">
      <div className="flex items-start gap-4">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="font-heading font-semibold text-cream group-hover:text-ember-400 transition-colors">{title}</h3>
          <p className="text-muted text-sm mt-0.5">{desc}</p>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ campers: 0, activities: 0, campYears: 0, assignments: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/campers").then((r) => r.json()),
      fetch("/api/activities").then((r) => r.json()),
      fetch("/api/camp-years").then((r) => r.json()),
    ]).then(([campers, activities, campYears]) => {
      setStats({
        campers: Array.isArray(campers) ? campers.length : 0,
        activities: Array.isArray(activities) ? activities.length : 0,
        campYears: Array.isArray(campYears) ? campYears.length : 0,
        assignments: 0,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading font-bold text-3xl text-cream mb-2">Dashboard</h1>
        <p className="text-muted">Welcome back! Here&apos;s your camp overview.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-10 h-10 border-2 border-ember-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Campers" value={String(stats.campers)} icon="👦" color="bg-ember-500/10 text-ember-400" />
            <StatCard label="Activities" value={String(stats.activities)} icon="🎯" color="bg-gold-500/10 text-gold-500" />
            <StatCard label="Camp Years" value={String(stats.campYears)} icon="🏕️" color="bg-info/10 text-info" />
            <StatCard label="Assignments" value={String(stats.assignments)} icon="✅" color="bg-success/10 text-success" />
          </div>

          <h2 className="font-heading font-semibold text-xl text-cream mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <QuickAction href="/camp" icon="🏕️" title="Create Camp Year" desc="Set up a new camp season with dates and time slots" />
            <QuickAction href="/activities" icon="🎯" title="Add Activities" desc="Create activities with locations, teachers, and capacity" />
            <QuickAction href="/campers" icon="👦" title="Manage Campers" desc="View and manage registered campers" />
            <QuickAction href="/schedule" icon="📅" title="Schedule" desc="View and manage the full camp schedule" />
            <QuickAction href="/print" icon="🖨️" title="Print Materials" desc="Generate schedules, rosters, and badges" />
            <QuickAction href="/settings" icon="⚙️" title="Settings" desc="Manage your organization, billing, and preferences" />
          </div>
        </>
      )}
    </div>
  );
}
