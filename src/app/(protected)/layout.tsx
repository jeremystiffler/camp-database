"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/camp", label: "Camp Years", icon: "🏕️" },
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
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

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
  }, [pathname, router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-night-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-ember-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-night-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <span className="text-6xl mb-6 block">🏕️</span>
          <h1 className="font-heading font-bold text-2xl text-cream mb-3">
            Welcome to Camp Creator
          </h1>
          <p className="text-muted mb-8">
            Sign in to manage your camp. Create camp years, activities, schedules, and more.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3 text-sm font-semibold bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl hover:opacity-90 transition-opacity"
          >
            Sign In
          </Link>
          <p className="text-muted text-sm mt-4">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-ember-400 hover:text-ember-300 underline">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-night-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-night-800 border-r border-night-600 flex flex-col fixed h-full">
        <div className="px-5 py-5 border-b border-night-600">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="text-xl">🏕️</span>
            <span className="font-heading font-bold text-lg text-cream">
              Camp Creator
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-ember-500/10 text-ember-400 border-l-2 border-ember-500"
                    : "text-muted hover:text-cream hover:bg-night-700"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-night-600">
          <div className="flex items-center gap-3 px-3">
            <div className="w-8 h-8 rounded-full bg-ember-500/20 flex items-center justify-center text-ember-400 text-sm font-semibold">
              {user.name?.[0] || user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-cream truncate">{user.name || user.email}</p>
              <button
                onClick={async () => {
                  await fetch("/api/auth/me", { method: "DELETE" });
                  router.push("/login");
                }}
                className="text-xs text-muted hover:text-error transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}
