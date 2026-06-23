"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/activities", label: "Activities", icon: "🎯" },
  { href: "/campers", label: "Campers", icon: "👦" },
  { href: "/schedule", label: "Schedule", icon: "📅" },
  { href: "/print", label: "Print Center", icon: "🖨️" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const campId = searchParams.get("campId") || activeCamp?.id || "";

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
    fetch("/api/camps")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCamps(data);
          const saved = localStorage.getItem("activeCampId");
          const found = data.find((c: Camp) => c.id === saved) || data[0];
          setActiveCamp(found);
        }
      })
      .catch(() => {});
  }, [user]);

  const handleCampChange = (camp: Camp) => {
    setActiveCamp(camp);
    localStorage.setItem("activeCampId", camp.id);
    // Update URL with new campId on camp-scoped pages
    const url = new URL(window.location.href);
    url.searchParams.set("campId", camp.id);
    router.replace(url.pathname + "?" + url.searchParams.toString());
  };

  const navHref = (href: string) => {
    if (href === "/dashboard") return "/dashboard";
    if (activeCamp?.id) return `${href}?campId=${activeCamp.id}`;
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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-60 bg-white border-r border-slate-200 flex flex-col z-30 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-forest-500 to-sky-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              🏕️
            </div>
            <span className="font-bold text-slate-800 text-base tracking-tight">Camp Creator</span>
          </Link>
        </div>

        {/* Camp selector */}
        {camps.length > 0 && (
          <div className="px-3 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">Active Camp</p>
            <div className="relative">
              <select
                value={activeCamp?.id || ""}
                onChange={(e) => {
                  const camp = camps.find((c) => c.id === e.target.value);
                  if (camp) handleCampChange(camp);
                }}
                className="w-full text-sm font-medium text-slate-700 bg-forest-50 border border-forest-200 rounded-xl px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-forest-500/30 cursor-pointer"
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
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={navHref(item.href)}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-forest-50 text-forest-700 border border-forest-200/60"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-forest-500" />}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-forest-400 to-sky-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
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
      <main className="flex-1 lg:ml-60 pt-14 lg:pt-0 min-h-screen flex justify-center">
        <div className="w-full max-w-7xl px-6 py-8">
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
