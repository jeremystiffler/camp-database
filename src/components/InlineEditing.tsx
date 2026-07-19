"use client";

import { KeyboardEvent, useEffect, useState } from "react";

type InlineTextProps = {
  value: string | null | undefined;
  onSave: (value: string) => Promise<void> | void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
  multiline?: boolean;
  /** Optional error hook; the displayed value is retained when a save fails. */
  onError?: (error: unknown) => void;
};

/** Consistent click-to-edit control for operational data. Saves on blur or Enter. */
export function InlineText({ value, onSave, placeholder = "—", className = "", inputClassName = "", ariaLabel, multiline = false, onError }: InlineTextProps) {
  const original = value || "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(original);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!editing) setDraft(original); }, [original, editing]);
  const save = async () => {
    if (!editing || saving) return;
    setEditing(false);
    if (draft === original) return;
    setSaving(true);
    try { await onSave(draft.trim()); }
    catch (error) { setDraft(original); onError?.(error); }
    finally { setSaving(false); }
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Escape") { setDraft(original); setEditing(false); }
    if (event.key === "Enter" && !multiline) { event.preventDefault(); void save(); }
  };
  if (editing) return multiline ? <textarea autoFocus aria-label={ariaLabel} value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => void save()} onKeyDown={keyDown} className={`min-h-20 w-full rounded border border-forest-400 bg-white px-2 py-1 outline-none ${inputClassName}`} /> : <input autoFocus aria-label={ariaLabel} value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => void save()} onKeyDown={keyDown} className={`w-full rounded border border-forest-400 bg-white px-2 py-1 outline-none ${inputClassName}`} />;
  return <button type="button" aria-label={ariaLabel || "Edit value"} onClick={() => setEditing(true)} className={`min-h-7 rounded px-1 text-left hover:bg-forest-50 focus:bg-forest-50 focus:outline-none ${saving ? "opacity-50" : ""} ${className}`} title="Click to edit">{value || <span className="text-slate-400">{placeholder}</span>}</button>;
}

type RowDeleteButtonProps = { onDelete: () => Promise<void> | void; label: string; disabled?: boolean; className?: string };
/** A uniform destructive action with an explicit confirmation for operational rows. */
export function RowDeleteButton({ onDelete, label, disabled, className = "" }: RowDeleteButtonProps) {
  const [working, setWorking] = useState(false);
  const remove = async () => {
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setWorking(true); try { await onDelete(); } catch { alert(`Could not delete ${label}. Please try again.`); } finally { setWorking(false); }
  };
  return <button type="button" onClick={() => void remove()} disabled={disabled || working} aria-label={`Delete ${label}`} title={`Delete ${label}`} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50 ${className}`}><span aria-hidden="true">🗑</span></button>;
}
