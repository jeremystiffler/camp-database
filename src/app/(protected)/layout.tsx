"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { HelpModeToggle } from "@/components/HelpMode";

const navItems = [
  { href: "/dashboard",    label: "Dashboard",      icon: "D" },
  { href: "/setup",        label: "Camp Setup",     icon: "S" },
  { href: "/campers",      label: "Campers",        icon: "C" },
  { href: "/check-in",     label: "Check in/out",   icon: "✓" },
  { href: "/schedule",     label: "Schedule",       icon: "Sc" },
  { href: "/registration", label: "Registration",   icon: "R" },
  { href: "/print",        label: "Print Center",   icon: "P" },
  { href: "/team",         label: "Team",           icon: "T" },
  { href: "/import",       label: "Import",         icon: "I" },
  { href: "/settings",     label: "Settings",       icon: "Se" },
];

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
        className={`fixed top-0 left-0 h-full w-64 border-r border-white/10 bg-[#102033] text-[#FFF7ED] shadow-2xl shadow-slate-950/20 flex flex-col z-30 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#F97316] to-[#FACC15] flex items-center justify-center text-[#102033] text-xs font-black shadow-sm">
              CC
            </div>
            <span className="font-bold text-[#FFF7ED] text-base tracking-tight">Camp Creator</span>
          </Link>
        </div>

        {/* Camp switcher */}
        {camps.length > 0 && (
          <div className="px-3 py-4 border-b border-white/10">
            <p className="px-2 mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-orange-200/80">Current camp</p>
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-3 shadow-sm">
              <p className="text-sm font-black text-white leading-snug break-words">
                {activeCamp?.name || "Select a camp"}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100/60 mt-1">
                {activeCamp?.status || "No active camp"}
              </p>
              <button
                type="button"
                onClick={() => setCampSwitcherOpen((open) => !open)}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-[#F97316] to-[#FACC15] px-3 py-2 text-xs font-black text-[#102033] shadow-sm hover:brightness-105 transition-all"
              >
                Switch camps
              </button>
            </div>

            {campSwitcherOpen && (
              <div className="mt-2 rounded-2xl border border-orange-100/20 bg-[#17293d] p-2 shadow-lg space-y-1 max-h-72 overflow-y-auto">
                {camps.map((camp) => {
                  const selected = camp.id === activeCamp?.id;
                  return (
                    <button
                      key={camp.id}
                      type="button"
                      onClick={() => handleCampChange(camp)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${selected ? "bg-white text-[#102033]" : "text-orange-50/85 hover:bg-white/10"}`}
                    >
                      <span className="block text-sm font-black leading-tight">{camp.name}</span>
                      <span className={`block text-[11px] mt-0.5 ${selected ? "text-slate-500" : "text-orange-100/50"}`}>
                        {selected ? "Active now" : `Switch to ${camp.status}`}
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
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={navHref(item.href)}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-gradient-to-r from-[#F97316] to-[#FACC15] text-[#102033] shadow-sm"
                    : "text-orange-50/75 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${isActive ? "bg-white/35 text-[#102033]" : "bg-white/10 text-orange-100/75"}`}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-[#2F855A] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {(user.name?.[0] || user.email[0]).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-orange-50 truncate">{user.name || user.email}</p>
              <div className="mt-2"><HelpModeToggle compact /></div>
              <button
                onClick={async () => {
                  await fetch("/api/auth/me", { method: "DELETE" });
                  router.push("/login");
                }}
                className="text-xs text-orange-100/50 hover:text-orange-200 transition-colors"
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
        <span className="ml-3 font-bold text-slate-800">Camp Creator</span>
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
