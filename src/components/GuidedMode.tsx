"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type GuidedModeContextValue = {
  guidedMode: boolean;
  ready: boolean;
  setGuidedMode: (enabled: boolean) => void;
  toggleGuidedMode: () => void;
};

const GuidedModeContext = createContext<GuidedModeContextValue | null>(null);

export function GuidedModeProvider({ children }: { children: React.ReactNode }) {
  const [guidedMode, setGuidedModeState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then(response => response.json())
      .then(data => {
        if (active && data.user) setGuidedModeState(Boolean(data.user.guidedMode));
      })
      .catch(() => {
        if (active) setGuidedModeState(localStorage.getItem("ssp-guided-mode") === "1");
      })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (ready) document.body.classList.toggle("guided-mode-on", guidedMode);
    return () => document.body.classList.remove("guided-mode-on");
  }, [guidedMode, ready]);

  const setGuidedMode = (enabled: boolean) => {
    setGuidedModeState(enabled);
    localStorage.setItem("ssp-guided-mode", enabled ? "1" : "0");
    fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guidedMode: enabled }),
    }).catch(() => undefined);
  };

  const value = useMemo(() => ({ guidedMode, ready, setGuidedMode, toggleGuidedMode: () => setGuidedMode(!guidedMode) }), [guidedMode, ready]);
  return <GuidedModeContext.Provider value={value}>{children}</GuidedModeContext.Provider>;
}

export function useGuidedMode() {
  return useContext(GuidedModeContext) || { guidedMode: false, ready: false, setGuidedMode: () => undefined, toggleGuidedMode: () => undefined };
}

export function GuidedModeToggle({ compact = false }: { compact?: boolean }) {
  const { guidedMode, toggleGuidedMode } = useGuidedMode();
  return <button type="button" onClick={toggleGuidedMode} aria-pressed={guidedMode} title={guidedMode ? "Switch to advanced view" : "Switch to the simpler guided view"} className={`rounded-xl border text-left font-black transition ${guidedMode ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"} ${compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs"}`}>
    <span className="block">{guidedMode ? "Keep it simple ✓" : "Show me everything"}</span>
    {!compact && <span className="mt-0.5 block text-[10px] font-semibold opacity-70">{guidedMode ? "Switch to advanced view." : "Switch to guided view."}</span>}
  </button>;
}

export function MoreOptions({ children, label = "More options", className = "" }: { children: React.ReactNode; label?: string; className?: string }) {
  return <details className={`rounded-xl border border-slate-200 bg-slate-50/70 ${className}`}>
    <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-600 marker:text-slate-400">▸ {label}</summary>
    <div className="border-t border-slate-200 p-4">{children}</div>
  </details>;
}
