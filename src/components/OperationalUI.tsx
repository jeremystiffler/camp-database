"use client";

import Link from "next/link";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, primaryAction, secondaryAction }: PageHeaderProps) {
  return <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="minimal-section-title">{eyebrow || "Program workspace"}</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{title}</h1>{description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>}</div>{(primaryAction || secondaryAction) && <div className="flex flex-wrap gap-2">{secondaryAction}{primaryAction}</div>}</header>;
}

export function EmptyState({ title, description, actionHref, actionLabel }: { title: string; description: string; actionHref?: string; actionLabel?: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-lg">✦</div><h2 className="text-base font-black text-slate-900">{title}</h2><p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{description}</p>{actionHref && actionLabel && <Link href={actionHref} className="mt-5 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">{actionLabel}</Link>}</div>;
}

export function SaveState({ saving, saved, error }: { saving?: boolean; saved?: boolean; error?: string }) {
  if (error) return <p role="alert" className="text-xs font-semibold text-rose-600">Could not save: {error}</p>;
  if (saving) return <p aria-live="polite" className="text-xs font-semibold text-slate-500">Saving…</p>;
  if (saved) return <p aria-live="polite" className="text-xs font-semibold text-emerald-700">✓ All changes saved</p>;
  return null;
}
