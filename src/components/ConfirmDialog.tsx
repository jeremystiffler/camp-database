"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Accessible in-app confirmation. Use this instead of window.confirm for destructive actions. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Continue",
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 id="confirm-dialog-title" className="text-xl font-black text-slate-950">{title}</h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy} onClick={onConfirm} className={`rounded-xl px-4 py-2.5 text-sm font-black text-white disabled:opacity-50 ${destructive ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-700"}`}>{busy ? "Working…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

type Confirmation = Pick<ConfirmDialogProps, "title" | "description" | "confirmLabel" | "destructive">;

/** Promise-based confirmation for event handlers; renders the same in-app dialog. */
export function useConfirmation() {
  const [pending, setPending] = useState<Confirmation | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const confirm = useCallback((options: Confirmation) => new Promise<boolean>(resolve => {
    resolver.current = resolve;
    setPending(options);
  }), []);
  const resolve = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setPending(null);
  }, []);
  const dialog = <ConfirmDialog open={Boolean(pending)} title={pending?.title || "Are you sure?"} description={pending?.description || ""} confirmLabel={pending?.confirmLabel} destructive={pending?.destructive} onCancel={() => resolve(false)} onConfirm={() => resolve(true)} />;
  return { confirm, dialog };
}
