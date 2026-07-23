"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type HelpModeContextValue = {
  helpMode: boolean;
  setHelpMode: (enabled: boolean) => void;
  toggleHelpMode: () => void;
};

const HelpModeContext = createContext<HelpModeContextValue | null>(null);

export function HelpModeProvider({ children }: { children: React.ReactNode }) {
  const [helpMode, setHelpModeState] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("camp-help-mode");
    // An explicit user choice always wins over lifecycle-aware defaults.
    const applyProgramDefault = (event: Event) => {
      if (localStorage.getItem("camp-help-mode") !== null) return;
      setHelpModeState((event as CustomEvent<{ enabled: boolean }>).detail.enabled);
    };
    window.addEventListener("camp:help-default", applyProgramDefault);
    setHelpModeState(stored === null ? true : stored === "1");
    return () => window.removeEventListener("camp:help-default", applyProgramDefault);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("help-mode-on", helpMode);
    document.body.classList.toggle("help-mode-off", !helpMode);
  }, [helpMode]);

  const setHelpMode = (enabled: boolean) => {
    setHelpModeState(enabled);
    if (typeof window !== "undefined") localStorage.setItem("camp-help-mode", enabled ? "1" : "0");
  };

  const value = useMemo(() => ({
    helpMode,
    setHelpMode,
    toggleHelpMode: () => setHelpMode(!helpMode),
  }), [helpMode]);

  return <HelpModeContext.Provider value={value}>{children}</HelpModeContext.Provider>;
}

export function useHelpMode() {
  const value = useContext(HelpModeContext);
  if (!value) return { helpMode: false, setHelpMode: () => undefined, toggleHelpMode: () => undefined };
  return value;
}

export function HelpModeToggle({ compact = false }: { compact?: boolean }) {
  const { helpMode, toggleHelpMode } = useHelpMode();
  return (
    <button
      type="button"
      onClick={toggleHelpMode}
      aria-pressed={helpMode}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border text-xs font-black transition ${helpMode ? "border-sky-200 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"} ${compact ? "px-2.5 py-1.5" : "px-3 py-2"}`}
      title={helpMode ? "Hide extra help text" : "Show extra help text"}
    >
      <span>{helpMode ? "Help on" : "Help off"}</span>
      <span className="rounded-full bg-current/10 px-1.5 text-[10px]">?</span>
    </button>
  );
}

export function HelpTip({ title = "Help", children }: { title?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] font-black text-slate-500 shadow-sm hover:border-sky-200 hover:text-sky-700"
        aria-label={title}
      >
        ?
      </button>
      {open && (
        <span className="absolute right-0 top-6 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-3 text-left text-xs font-semibold leading-5 text-slate-600 shadow-xl">
          <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-400">{title}</span>
          {children}
        </span>
      )}
    </span>
  );
}

export function HelpCopy({ children, title = "More info", className = "" }: { children: React.ReactNode; title?: string; className?: string }) {
  const { helpMode } = useHelpMode();
  if (helpMode) return <p className={className}>{children}</p>;
  return <HelpTip title={title}>{children}</HelpTip>;
}
