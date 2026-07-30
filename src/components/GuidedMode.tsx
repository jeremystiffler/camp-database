"use client";

// Guided mode was removed (see simpleschedulepro-nav-and-toggle-removal.md).
// Only the MoreOptions disclosure survives — it is a plain presentational
// component with no mode, no storage, and no navigation effects.

export function MoreOptions({ children, label = "More options", className = "" }: { children: React.ReactNode; label?: string; className?: string }) {
  return <details className={`rounded-xl border border-slate-200 bg-slate-50/70 ${className}`}>
    <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-600 marker:text-slate-500">▸ {label}</summary>
    <div className="border-t border-slate-200 p-4">{children}</div>
  </details>;
}
