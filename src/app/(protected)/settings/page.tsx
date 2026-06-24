"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="camp-card p-6 mb-5">
      <h2 className="font-bold text-slate-800 mb-4 text-base">{title}</h2>
      {children}
    </div>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";
  const [campName, setCampName] = useState("this camp");

  useEffect(() => {
    if (!campId) return;
    fetch(`/api/camps/${campId}`)
      .then(r => r.json())
      .then(d => { if (d.name) setCampName(d.name); })
      .catch(() => {});
  }, [campId]);

  if (!campId) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center">
        <span className="text-4xl mb-3 block">⚙️</span>
        <p>Select a camp to manage its settings.</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Danger zone and camp-level actions</p>
      </div>

      {/* Import shortcut */}
      <div className="camp-card p-5 border-2 border-dashed border-slate-200 bg-slate-50/50 mb-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-forest-400 flex items-center justify-center text-white text-xl flex-shrink-0">
              📥
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Bulk Import</p>
              <p className="text-xs text-slate-500 mt-0.5">Upload a spreadsheet to populate activities, teachers, rooms, and time slots.</p>
            </div>
          </div>
          <Link href={`/import?campId=${campId}`}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2 whitespace-nowrap flex-shrink-0">
            Go to Import →
          </Link>
        </div>
      </div>

      <Section title="⚠️ Danger Zone">
        <p className="text-slate-500 text-sm mb-4">These actions are permanent and cannot be undone.</p>
        <button
          onClick={() => {
            if (confirm(`Delete "${campName}" and all its data? This cannot be undone.`)) {
              fetch(`/api/camps/${campId}`, { method: "DELETE" }).then(() => {
                window.location.href = "/dashboard";
              });
            }
          }}
          className="px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors"
        >
          🗑️ Delete This Camp
        </button>
      </Section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-berry-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}
