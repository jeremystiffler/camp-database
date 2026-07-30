"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { SetupNav, sectionsFromStats, type SetupNavState } from "@/components/SetupNav";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SSPLogo } from "@/components/SSPLogo";
import { Suspense } from "react";
import { HelpModeToggle } from "@/components/HelpMode";
import { themeTokens } from "@/lib/programPalettes";
import { eventRoleLabel } from "@/lib/eventRoles";
import { getJson, invalidateJson } from "@/lib/request-cache";
import { resolveAccessibleCamp } from "@/lib/camp-selection";

// Navigation vocabulary is frozen: one name per route, sentence case, no
// preference-driven variants. See simpleschedulepro-nav-and-toggle-removal.md.
// Visibility is role-gated only. Guided mode is deleted — do not reintroduce a
// nav-shaping preference of any kind.
const primaryNav = [
  { href: "/dashboard", label: "Home", icon: "compass", minRole: "viewer" },
  { href: "/setup", label: "Event setup", icon: "tent", minRole: "editor" },
  { href: "/activities", label: "Classes & teachers", icon: "clipboard", minRole: "viewer" },
  { href: "/schedule", label: "Schedule", icon: "calendar", minRole: "viewer" },
  { href: "/registration", label: "Registration form", icon: "clipboard", minRole: "editor" },
  { href: "/participants", label: "Participants", icon: "participants", minRole: "viewer" },
  { href: "/check-in", label: "Check in/out", icon: "check", minRole: "viewer" },
  { href: "/print", label: "Print center", icon: "printer", minRole: "viewer" },
] as const;

const moreNav = [
  { href: "/team", label: "Team", icon: "team", minRole: "viewer" },
  { href: "/import", label: "Import", icon: "upload", minRole: "editor" },
  { href: "/settings", label: "Settings", icon: "gear", minRole: "admin" },
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
  if (name === "participants") return <svg {...common}><circle cx="8" cy="8" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M3.5 19c.8-3 2.3-5 4.5-5s3.7 2 4.5 5" /><path d="M12.5 18.8c.6-2.4 1.8-4 3.5-4 2 0 3.4 1.7 4 4" /></svg>;
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
  isSuperAdmin?: boolean;
}

interface Camp {
  id: string;
  name: string;
  status: string;
  myRole?: string;
  /** Preset name — the source of truth for this event's colours. */
  themePreset?: string;
  primaryColor?: string;
  accentColor?: string;
}

function ProtectedLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [camps, setPrograms] = useState<Camp[]>([]);
  const [activeCamp, setActiveCamp] = useState<Camp | null>(null);
  const [lastKnownCampId, setLastKnownCampId] = useState("");
  // Setup section completion for the sidebar dots (§5.3). Sourced from the same
  // dashboard endpoint the issue engine feeds, so the sidebar and /setup cannot
  // form two different opinions about what is finished.
  const [setupNavState, setSetupNavState] = useState<SetupNavState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [campSwitcherOpen, setCampSwitcherOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState<{ requestedCampId: string; fallback: Camp | null } | null>(null);

  // Never let a stale bookmarked/local-storage program ID drive protected API calls.
  // Until the accessible program list has loaded, use the validated active program only.
  const requestedCampId = searchParams.get("campId") || "";
  const validatedUrlCampId = camps.some((camp) => camp.id === requestedCampId) ? requestedCampId : "";
  const campId = validatedUrlCampId || activeCamp?.id || (camps.length ? lastKnownCampId : "");

  useEffect(() => {
    if (!activeCamp?.id) { setSetupNavState(null); return; }
    let cancelled = false;
    fetch(`/api/camps/${activeCamp.id}/dashboard`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data?.stats) return;
        setSetupNavState({
          sections: sectionsFromStats(data.stats, {
            detailsDone: true,
            scheduleDone: (data.stats.classes ?? 0) > 0,
            registrationOpen: Boolean(data.camp?.registrationOpen),
          }),
          // Hover copy comes from the issue engine (§5.3), never a second
          // string table. Blocking schedule issues surface on Activities.
          reasons: (data.issues ?? []).some((issue: { severity?: string }) => issue.severity === "blocking")
            ? { activities: (data.issues ?? []).find((issue: { severity?: string; message?: string }) => issue.severity === "blocking")?.message }
            : {},
        });
      })
      .catch(() => { if (!cancelled) setSetupNavState(null); });
    return () => { cancelled = true; };
  }, [activeCamp?.id]);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("activeCampId") : "";
    if (saved) setLastKnownCampId(saved);
  }, []);

  useEffect(() => {
    const urlCampId = searchParams.get("campId");
    if (!urlCampId || camps.length === 0) {
      if (!urlCampId) setAccessDenied(null);
      return;
    }
    const campFromUrl = camps.find((camp) => camp.id === urlCampId);
    if (!campFromUrl) {
      // A stale/dead tenant id may fail once while the accessible event list is
      // loading, but it must never be retried or masquerade as an empty event.
      localStorage.removeItem("activeCampId");
      const fallback = camps[0] ?? null;
      setAccessDenied({ requestedCampId: urlCampId, fallback });
      if (fallback) {
        setActiveCamp(fallback);
        setLastKnownCampId(fallback.id);
        localStorage.setItem("activeCampId", fallback.id);
      }
      return;
    }
    setAccessDenied(null);
    if (activeCamp?.id === urlCampId) return;
    setActiveCamp(campFromUrl);
    setLastKnownCampId(campFromUrl.id);
    localStorage.setItem("activeCampId", campFromUrl.id);
  }, [searchParams, camps, activeCamp?.id, pathname, router]);

  // A shared program selection should also survive a bookmarked operational URL.
  // Do this only after the program list is known so an invalid URL is never masked.
  useEffect(() => {
    if (!activeCamp?.id || searchParams.get("campId") || pathname === "/super-admin") return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("campId", activeCamp.id);
    router.replace(`${pathname}?${params.toString()}`);
  }, [activeCamp?.id, pathname, router, searchParams]);

  useEffect(() => {
    getJson<{ user?: AuthUser }>("/api/auth/me", 30_000)
      .then(({ data }) => {
        if (data?.user) {
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

    const loadPrograms = () => {
      getJson<Camp[]>("/api/camps")
        .then(({ data }) => {
          if (Array.isArray(data) && data.length > 0) {
            setPrograms(data);
            const urlCampId = new URLSearchParams(window.location.search).get("campId");
            const saved = localStorage.getItem("activeCampId");
            const selection = resolveAccessibleCamp(data, urlCampId || "", saved || "");
            const found = selection.selected!;
            setActiveCamp(found);
            setLastKnownCampId(found.id);
            if (selection.deniedRequestedId) {
              localStorage.removeItem("activeCampId");
              setAccessDenied({ requestedCampId: selection.deniedRequestedId, fallback: found });
            }
            localStorage.setItem("activeCampId", found.id);
          } else {
            setPrograms([]);
            setActiveCamp(null);
          }
        })
        .catch(() => {});
    };

    loadPrograms();
    const refreshPrograms = () => { invalidateJson("/api/camps"); loadPrograms(); };
    window.addEventListener("camp:list-changed", refreshPrograms);
    window.addEventListener("focus", loadPrograms);
    return () => {
      window.removeEventListener("camp:list-changed", refreshPrograms);
      window.removeEventListener("focus", loadPrograms);
    };
  }, [user]);

  useEffect(() => {
    if (!campId) return;
    getJson<{ stats: { rooms: number; teachers: number; classes: number; scheduleBlocks: number } }>(`/api/camps/${campId}/dashboard`).then(({ data }) => {
      if (!data?.stats) return;
      // Help remains opt-out, but begins on only while the program is still early in setup.
      const setupSignals = [data.stats.rooms, data.stats.teachers, data.stats.classes, data.stats.scheduleBlocks];
      const readiness = setupSignals.filter((count: number) => count > 0).length / setupSignals.length;
      window.dispatchEvent(new CustomEvent("camp:help-default", { detail: { enabled: readiness < 0.5 } }));
    }).catch(() => {});
  }, [campId]);

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
    if (campId) return `${href}?campId=${campId}`;
    return href;
  };

  const isKioskShell = pathname.startsWith("/check-in") && searchParams.get("kiosk") === "1";
  // nextSteps / showBuildGuidance deleted with the banner (§5.2).
  const workspaceStyle = {
    background: "var(--canvas-sunk)",
    ...themeTokens(activeCamp?.primaryColor, activeCamp?.accentColor, activeCamp?.themePreset),
  } as CSSProperties;

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
    <div className="protected-shell min-h-dvh w-full flex items-stretch text-slate-900" style={workspaceStyle}>
      {/* Mobile overlay */}
      {sidebarOpen && !isKioskShell && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {!isKioskShell && <aside
        className={`fixed top-0 left-0 h-full w-64 border-r border-slate-200 bg-slate-50/95 text-slate-900 shadow-xl shadow-slate-200/50 backdrop-blur flex flex-col z-30 transition-transform duration-200 ${
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
            <p className="minimal-section-title px-2 mb-2">Current event</p>
            <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3 shadow-sm">
              <p className="text-sm font-extrabold text-slate-900 leading-snug break-words">
                {activeCamp?.name || "Select an event"}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mt-1">
                {activeCamp?.status || "No active event"}{activeCamp?.myRole ? ` • event access: ${eventRoleLabel(activeCamp.myRole)}` : ""}
              </p>
              <button
                type="button"
                onClick={() => setCampSwitcherOpen((open) => !open)}
                className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-slate-800"
              >
                Switch events
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
                      className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${selected ? "bg-slate-200 text-slate-900" : "text-slate-700 hover:bg-slate-100"}`}
                    >
                      <span className="block text-sm font-extrabold leading-tight">{camp.name}</span>
                      <span className={`block text-[11px] mt-0.5 ${selected ? "text-slate-600" : "text-slate-500"}`}>
                        {selected ? `Active now • ${eventRoleLabel(camp.myRole)}` : `Switch to ${camp.status} • ${eventRoleLabel(camp.myRole)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav aria-label="Event navigation" className="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
          <div>
            <p className="minimal-section-title px-3 mb-1.5">Build your event</p>
            <div className="space-y-1">{primaryNav.filter((item) => roleRank(activeCamp?.myRole) >= roleRank(item.minRole)).map((item) => {
              const isActive = pathname.startsWith(item.href);
              // Event setup expands directly into all setup sections with
              // status dots, so any destination is one click away.
              if (item.href === "/setup") {
                return (
                  <SetupNav
                    key={item.href}
                    href={navHref(item.href)}
                    active={isActive}
                    state={setupNavState}
                    onNavigate={() => setSidebarOpen(false)}
                  />
                );
              }
              return <Link key={item.href} href={navHref(item.href)} aria-current={isActive ? "page" : undefined} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${isActive ? "bg-slate-200 text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}><span className={`w-6 h-6 rounded-lg flex items-center justify-center ${isActive ? "bg-white text-slate-700" : "bg-slate-100 text-slate-500"}`}><SidebarIcon name={item.icon} /></span>{item.label}</Link>;
            })}</div>
          </div>
          <div>
            <button type="button" onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-extrabold text-slate-600 hover:bg-slate-50 hover:text-slate-900"><span>More</span><span aria-hidden="true">{moreOpen ? "▴" : "▾"}</span></button>
            {moreOpen && <div className="mt-1 space-y-1 border-l border-slate-200 pl-2">{moreNav.filter((item) => roleRank(activeCamp?.myRole) >= roleRank(item.minRole)).map((item) => {
              const isActive = pathname.startsWith(item.href);
              return <Link key={item.href} href={navHref(item.href)} aria-current={isActive ? "page" : undefined} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${isActive ? "bg-slate-200 text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}><span className={`w-6 h-6 rounded-lg flex items-center justify-center ${isActive ? "bg-white text-slate-700" : "bg-slate-100 text-slate-500"}`}><SidebarIcon name={item.icon} /></span>{item.label}</Link>;
            })}</div>}
          </div>
          {user.isSuperAdmin && <Link href="/super-admin" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${pathname.startsWith("/super-admin") ? "bg-slate-200 text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}><span className={`w-6 h-6 rounded-lg flex items-center justify-center ${pathname.startsWith("/super-admin") ? "bg-white text-slate-700" : "bg-slate-100 text-slate-500"}`}><SidebarIcon name="gear" /></span>Super admin</Link>}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-[#10B981] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {(user.name?.[0] || user.email[0]).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{user.name || user.email}</p>
              <div className="mt-2 flex flex-wrap gap-2"><HelpModeToggle compact /></div>
              <button
                onClick={async () => {
                  await fetch("/api/auth/me", { method: "DELETE" });
                  router.push("/login");
                }}
                className="text-xs text-slate-500 hover:text-rose-500 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>}

      {/* Mobile top bar */}
      {!isKioskShell && <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 flex items-center px-4 z-20 lg:hidden">
        <button aria-label="Open navigation" onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100">
          ☰
        </button>
        <span className="ml-3 font-bold text-slate-800">Simple Schedule Pro</span>
      </div>}
      <main className={`flex-1 min-h-dvh flex justify-center ${isKioskShell ? "pt-0" : "lg:ml-64 pt-14 lg:pt-0"}`} style={{ background: "var(--canvas-sunk)" }}>
        <div className={`w-full min-h-dvh px-3 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8 ${isKioskShell ? "max-w-none" : "max-w-7xl"}`}>
          {/* The sticky "NEXT STEP · Continue →" banner stood here and is
              deleted (§5.2). It was the fourth element on /setup answering
              "what's next", and the only one that navigated OUT of setup — to
              /activities, away from the flow it claimed to be guiding. The one
              surviving signal is the Save-and-continue button at the bottom of
              the setup body, which names its destination and stays put. */}
          {accessDenied ? (
            <section role="alert" className="mx-auto mt-10 max-w-xl rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
              <h1 className="text-xl font-extrabold text-[var(--text-strong)]">You don&apos;t have access to this event</h1>
              <p className="mx-auto mt-2 max-w-[48ch] text-sm leading-6 text-[var(--text-muted)]">
                The event may have been removed, or your account may not be part of its team. No event data was shown.
              </p>
              {accessDenied.fallback ? (
                <Link
                  href={`${pathname}?campId=${accessDenied.fallback.id}`}
                  className="mt-5 inline-flex rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-extrabold text-white"
                >
                  Open {accessDenied.fallback.name}
                </Link>
              ) : (
                <Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white">
                  Go to your events
                </Link>
              )}
            </section>
          ) : children}
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
