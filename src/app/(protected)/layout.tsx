"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const navItems = [
  { href: "/dashboard",    label: "Dashboard",      icon: "D" },
  { href: "/setup",        label: "Camp Setup",     icon: "S" },
  { href: "/campers",      label: "Campers",        icon: "C" },
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

  const campId = searchParams.get("campId") || activeCamp?.id || lastKnownCampId || "";

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("activeCampId") : "";
    if (saved) setLastKnownCampId(saved);
  }, []);

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
    <div className="min-h-screen bg-[#f7f7f5] flex text-slate-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white/95 backdrop-blur border-r border-slate-200 flex flex-col z-30 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xs font-black shadow-sm">
              CC
            </div>
            <span className="font-bold text-slate-900 text-base tracking-tight">Camp Creator</span>
          </Link>
        </div>

        {/* Camp selector */}
        {camps.length > 0 && (
          <div className="px-3 py-4 border-b border-slate-100">
            <p className="minimal-section-title px-2 mb-2">Active Camp</p>
            <div className="relative">
              <select
                value={activeCamp?.id || ""}
                onChange={(e) => {
                  const camp = camps.find((c) => c.id === e.target.value);
                  if (camp) handleCampChange(camp);
                }}
                className="w-full text-sm font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2.5 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-slate-300/50 cursor-pointer"
              >
                {camps.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▼</span>
            </div>
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
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${isActive ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {(user.name?.[0] || user.email[0]).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{user.name || user.email}</p>
              <button
                onClick={async () => {
                  await fetch("/api/auth/me", { method: "DELETE" });
                  router.push("/login");
                }}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center px-4 z-20 lg:hidden">
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100">
          ☰
        </button>
        <span className="ml-3 font-bold text-slate-800">Camp Creator</span>
      </div>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 min-h-screen flex justify-center">
        <div className="w-full max-w-7xl px-5 sm:px-8 py-8">
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
