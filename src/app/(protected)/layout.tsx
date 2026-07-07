"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SSPLogo } from "@/components/SSPLogo";
import { Suspense } from "react";
import { HelpModeToggle } from "@/components/HelpMode";

const navItems = [
  { href: "/dashboard",    label: "Dashboard",      icon: "compass", minRole: "viewer" },
  { href: "/setup",        label: "Camp Setup",     icon: "tent", minRole: "viewer" },
  { href: "/campers",      label: "Participants",   icon: "campers", minRole: "viewer" },
  { href: "/check-in",     label: "Check in/out",   icon: "check", minRole: "viewer" },
  { href: "/schedule",     label: "Schedule",       icon: "calendar", minRole: "viewer" },
  { href: "/registration", label: "Registration",   icon: "clipboard", minRole: "editor" },
  { href: "/print",        label: "Print Center",   icon: "printer", minRole: "viewer" },
  { href: "/team",         label: "Team",           icon: "team", minRole: "viewer" },
  { href: "/import",       label: "Import",         icon: "upload", minRole: "editor" },
  { href: "/settings",     label: "Settings",       icon: "gear", minRole: "admin" },
] as const;

const roleRank = (role?: string) => ({ owner: 4, admin: 3, editor: 2, viewer: 1 }[role || "viewer"] || 1);

function SidebarIcon({ name }: { name: string }) {
  const common = {
    className: "h-4 w-4",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "compass") return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="m14.6 9.4-1.7 3.5-3.5 1.7 1.7-3.5 3.5-1.7Z" /></svg>;
  if (name === "tent") return <svg {...common}><path d="M3 19h18" /><path d="M12 4 4 19" /><path d="m12 4 8 15" /><path d="M12 4v15" /><path d="m9.5 19 2.5-5 2.5 5" /></svg>;
  if (name === "campers") return <svg {...common}><circle cx="8" cy="8" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M3.5 19c.8-3 2.3-5 4.5-5s3.7 2 4.5 5" /><path d="M12.5 18.8c.6-2.4 1.8-4 3.5-4 2 0 3.4 1.7 4 4" /></svg>;
  if (name === "check") return <svg {...common}><path d="M4 12.5 9 17l11-11" /><path d="M5 5h5" /><path d="M5 9h3" /><path d="M15 17h4" /></svg>;
  if (name === "calendar") return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M4 10h16" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /></svg>;
  if (name === "clipboard") return <svg {...common}><path d="M9 4h6l1 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l1-2Z" /><path d="M9 6h6" /><path d="M8 12h8" /><path d="M8 16h5" /></svg>;
  if (name === "printer") return <svg {...common}><path d="M7 8V4h10v4" /><rect x="6" y="14" width="12" height="6" rx="1" /><path d="M6 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1" /><path d="M17 12h.01" /></svg>;
  if (name === "team") return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.9-3 2.8-5 5.5-5s4.6 2 5.5 5" /><path d="M16 11a2.5 2.5 0 1 0-.7-4.9" /><path d="M16.5 14.5c1.7.5 3 2.1 3.8 4.5" /></svg>;
  if (name === "upload") return <svg {...common}><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3-.2-.1a1.7 1.7 0 0 0-2 .2 1.7 1.7 0 0 0-.8 1.7V22h-3.6v-.2a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.2.1-2-3 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1.1H4v-3.6h.2a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9L5.3 8l2-3 .2.1a1.7 1.7 0 0 0 1.9-.3 1.7 1.7 0 0 0 1-1.6V3h3.6v.2a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.9-.3l.2-.1 2 3-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1.1h.2v3.6h-.2a1.7 1.7 0 0 0-1.5.9Z" /></svg>;
}

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  organizationId?: string | null;
}

interface Camp {
  id: string;
  name: string;
  status: string;
  myRole?: string;
}

function ProtectedLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [activeCamp, setActiveCamp] = useState<Camp | null>(null);
  const [lastKnownCampId, setLastKnownCampId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [campSwitcherOpen, setCampSwitcherOpen] = useState(false);

  const campId = searchParams.get("campId") || activeCamp?.id || lastKnownCampId || "";

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("activeCampId") : "";
    if (saved) setLastKnownCampId(saved);
  }, []);

  useEffect(() => {
    const urlCampId = searchParams.get("campId");
    if (!urlCampId || camps.length === 0 || activeCamp?.id === urlCampId) return;
    const campFromUrl = camps.find((camp) => camp.id === urlCampId);
    if (!campFromUrl) return;
    setActiveCamp(campFromUrl);
    setLastKnownCampId(campFromUrl.id);
    localStorage.setItem("activeCampId", campFromUrl.id);
  }, [searchParams, camps, activeCamp?.id]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        } else {
          router.push("/login");
        }
        setChecking(false);
      })
      .catch(() => {
        router.push("/login");
        setChecking(false);
      });
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const loadCamps = () => {
      fetch("/api/camps")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setCamps(data);
            const urlCampId = new URLSearchParams(window.location.search).get("campId");
            const saved = localStorage.getItem("activeCampId");
            const found = data.find((c: Camp) => c.id === urlCampId) || data.find((c: Camp) => c.id === saved) || data[0];
            setActiveCamp(found);
            setLastKnownCampId(found.id);
            localStorage.setItem("activeCampId", found.id);
          } else {
            setCamps([]);
            setActiveCamp(null);
          }
        })
        .catch(() => {});
    };

    loadCamps();
    window.addEventListener("camp:list-changed", loadCamps);
    window.addEventListener("focus", loadCamps);
    return () => {
      window.removeEventListener("camp:list-changed", loadCamps);
      window.removeEventListener("focus", loadCamps);
    };
  }, [user]);

  const handleCampChange = (camp: Camp) => {
    setActiveCamp(camp);
    setLastKnownCampId(camp.id);
    setCampSwitcherOpen(false);
    localStorage.setItem("activeCampId", camp.id);
    // Update URL with new campId on camp-scoped pages, then force server/client data to refetch.
    const url = new URL(window.location.href);
    url.searchParams.set("campId", camp.id);
    router.replace(url.pathname + "?" + url.searchParams.toString());
    router.refresh();
  };

  const navHref = (href: string) => {
    if (href === "/dashboard") return "/dashboard";
    if (campId) return `${href}?campId=${campId}`;
    return href;
  };

  const isKioskShell = pathname.startsWith("/check-in") && searchParams.get("kiosk") === "1";

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-forest-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex text-slate-900" style={{ background: "var(--ui-bg)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && !isKioskShell && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {!isKioskShell && <aside
        className={`fixed top-0 left-0 h-full w-64 border-r border-slate-200 bg-white/95 text-slate-900 shadow-xl shadow-slate-200/50 backdrop-blur flex flex-col z-30 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <SSPLogo size={32} />
            <span className="font-bold text-slate-900 text-base tracking-tight">Simple Schedule Pro</span>
          </Link>
        </div>

        {/* Camp switcher */}
        {camps.length > 0 && (
          <div className="px-3 py-4 border-b border-slate-100">
            <p className="minimal-section-title px-2 mb-2">Current camp</p>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3 shadow-sm">
              <p className="text-sm font-black text-slate-900 leading-snug break-words">
                {activeCamp?.name || "Select a camp"}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-500/70 mt-1">
                {activeCamp?.status || "No active camp"} {activeCamp?.myRole ? `• ${activeCamp.myRole}` : ""}
              </p>
              <button
                type="button"
                onClick={() => setCampSwitcherOpen((open) => !open)}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#0EA5E9] px-3 py-2 text-xs font-black text-white shadow-sm hover:brightness-105 transition-all"
              >
                Switch camps
              </button>
            </div>

            {campSwitcherOpen && (
              <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg space-y-1 max-h-72 overflow-y-auto">
                {camps.map((camp) => {
                  const selected = camp.id === activeCamp?.id;
                  return (
                    <button
                      key={camp.id}
                      type="button"
                      onClick={() => handleCampChange(camp)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${selected ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-indigo-50"}`}
                    >
                      <span className="block text-sm font-black leading-tight">{camp.name}</span>
                      <span className={`block text-[11px] mt-0.5 ${selected ? "text-white/75" : "text-slate-400"}`}>
                        {selected ? `Active now • ${camp.myRole || "viewer"}` : `Switch to ${camp.status} • ${camp.myRole || "viewer"}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.filter((item) => roleRank(activeCamp?.myRole) >= roleRank(item.minRole)).map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={navHref(item.href)}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-gradient-to-r from-[#4F46E5] to-[#0EA5E9] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-indigo-50"
                }`}
              >
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  <SidebarIcon name={item.icon} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-[#10B981] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {(user.name?.[0] || user.email[0]).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{user.name || user.email}</p>
              <div className="mt-2"><HelpModeToggle compact /></div>
              <button
                onClick={async () => {
                  await fetch("/api/auth/me", { method: "DELETE" });
                  router.push("/login");
                }}
                className="text-xs text-slate-400 hover:text-rose-500 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>}

      {/* Mobile top bar */}
      {!isKioskShell && <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center px-4 z-20 lg:hidden">
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100">
          ☰
        </button>
        <span className="ml-3 font-bold text-slate-800">Simple Schedule Pro</span>
      </div>}
      <main className={`flex-1 min-h-screen flex justify-center ${isKioskShell ? "pt-0" : "lg:ml-64 pt-14 lg:pt-0"}`}>
        <div className={`w-full px-3 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8 ${isKioskShell ? "max-w-none" : "max-w-7xl"}`}>
          {children}
        </div>
      </main>
    </div>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ProtectedLayoutInner>{children}</ProtectedLayoutInner>
    </Suspense>
  );
}
