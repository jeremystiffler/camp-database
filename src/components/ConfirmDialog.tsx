"use client";

import { useCallback, useEffect } from "react";
import { createRoot } from "react-dom/client";

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
        <h2 id="confirm-dialog-title" className="text-xl font-extrabold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy} onClick={onConfirm} className={`rounded-xl px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50 ${destructive ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-700"}`}>{busy ? "Working…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

type Confirmation = Pick<ConfirmDialogProps, "title" | "description" | "confirmLabel" | "destructive">;

/** Promise-based confirmation for event handlers; renders the same in-app dialog. */
export function useConfirmation() {
  return { confirm: useCallback((options: Confirmation) => new Promise<boolean>(resolve => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const finish = (confirmed: boolean) => {
      root.unmount();
      host.remove();
      resolve(confirmed);
    };
    root.render(<ConfirmDialog open title={options.title} description={options.description} confirmLabel={options.confirmLabel} destructive={options.destructive} onCancel={() => finish(false)} onConfirm={() => finish(true)} />);
  }), []) };
}
