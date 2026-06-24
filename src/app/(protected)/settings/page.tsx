"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface CampAppearance {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLOR_THEMES = [
  { name: "Forest & Sky",   primary: "#22C55E", accent: "#0EA5E9", preview: ["#22C55E","#0EA5E9"] },
  { name: "Sunset Blaze",   primary: "#F97316", accent: "#EAB308", preview: ["#F97316","#EAB308"] },
  { name: "Berry & Violet", primary: "#A855F7", accent: "#EC4899", preview: ["#A855F7","#EC4899"] },
  { name: "Ocean Deep",     primary: "#0EA5E9", accent: "#14B8A6", preview: ["#0EA5E9","#14B8A6"] },
  { name: "Campfire",       primary: "#F0894A", accent: "#E8A84C", preview: ["#F0894A","#E8A84C"] },
  { name: "Midnight",       primary: "#6366F1", accent: "#8B5CF6", preview: ["#6366F1","#8B5CF6"] },
];

const FONT_OPTIONS = [
  { id: "Inter",       label: "Inter",        sample: "The quick brown fox",        style: { fontFamily: "Inter, sans-serif" } },
  { id: "Poppins",     label: "Poppins",       sample: "The quick brown fox",        style: { fontFamily: "Poppins, sans-serif" } },
  { id: "Georgia",     label: "Georgia",       sample: "The quick brown fox",        style: { fontFamily: "Georgia, serif" } },
  { id: "Merriweather",label: "Merriweather",  sample: "The quick brown fox",        style: { fontFamily: "'Merriweather', serif" } },
  { id: "Courier New", label: "Courier New",   sample: "The quick brown fox",        style: { fontFamily: "'Courier New', monospace" } },
  { id: "Trebuchet MS",label: "Trebuchet MS",  sample: "The quick brown fox",        style: { fontFamily: "'Trebuchet MS', sans-serif" } },
];

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="camp-card p-6 mb-5">
      <div className="mb-4">
        <h2 className="font-bold text-slate-800 text-base">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function SettingsContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  // ── User profile state ──
  const [user,            setUser]            = useState<UserProfile | null>(null);
  const [profileName,     setProfileName]     = useState("");
  const [profileEmail,    setProfileEmail]    = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileSaving,   setProfileSaving]   = useState(false);
  const [profileMsg,      setProfileMsg]      = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Camp appearance state ──
  const [appearance,      setAppearance]      = useState<CampAppearance>({ primaryColor: "#22C55E", accentColor: "#0EA5E9", fontFamily: "Inter" });
  const [campName,        setCampName]        = useState("this camp");
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceMsg,   setAppearanceMsg]   = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    // Load user profile
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          setUser(d.user);
          setProfileName(d.user.name || "");
          setProfileEmail(d.user.email || "");
        }
      });

    // Load camp appearance
    if (!campId) return;
    fetch(`/api/camps/${campId}`)
      .then(r => r.json())
      .then(d => {
        if (d && !d.error) {
          setCampName(d.name || "this camp");
          setAppearance({
            primaryColor: d.primaryColor || "#22C55E",
            accentColor:  d.accentColor  || "#0EA5E9",
            fontFamily:   d.fontFamily   || "Inter",
          });
        }
      });
  }, [campId]);

  const saveProfile = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      setProfileMsg({ type: "error", text: "New passwords don't match" });
      return;
    }
    setProfileSaving(true); setProfileMsg(null);
    const body: Record<string, string> = {};
    if (profileName.trim()  !== (user?.name  || "")) body.name  = profileName.trim();
    if (profileEmail.trim() !== (user?.email || "")) body.email = profileEmail.trim();
    if (newPassword) { body.currentPassword = currentPassword; body.newPassword = newPassword; }
    if (Object.keys(body).length === 0) {
      setProfileMsg({ type: "error", text: "No changes to save" });
      setProfileSaving(false);
      return;
    }
    const res  = await fetch("/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setProfileSaving(false);
    if (res.ok) {
      setProfileMsg({ type: "success", text: "Profile updated successfully!" });
      setUser(prev => prev ? { ...prev, name: data.name, email: data.email } : prev);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } else {
      setProfileMsg({ type: "error", text: data.error || "Failed to update profile" });
    }
  };

  const saveAppearance = async () => {
    if (!campId) return;
    setAppearanceSaving(true); setAppearanceMsg(null);
    const res = await fetch(`/api/camps/${campId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryColor: appearance.primaryColor, accentColor: appearance.accentColor, fontFamily: appearance.fontFamily }),
    });
    setAppearanceSaving(false);
    if (res.ok) setAppearanceMsg({ type: "success", text: "Appearance saved!" });
    else setAppearanceMsg({ type: "error", text: "Failed to save appearance" });
    setTimeout(() => setAppearanceMsg(null), 2500);
  };

  const inputCls = "w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-berry-500/30 focus:border-berry-400";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Your profile, camp appearance, and account actions</p>
      </div>

      {/* ── Your Profile ── */}
      <Section title="👤 Your Profile" subtitle="Update your name, email, and password">
        {user && (
          <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-berry-400 to-sky-400 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {(user.name?.[0] || user.email[0]).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{user.name || "—"}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
              <span className="text-xs bg-berry-100 text-berry-700 border border-berry-200 px-2 py-0.5 rounded-full font-medium capitalize">{user.role}</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
              <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)}
                placeholder="Your name" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
              <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)}
                placeholder="you@example.com" className={inputCls} />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <p className="text-sm font-medium text-slate-700 mb-3">Change Password <span className="text-xs text-slate-400 font-normal">(leave blank to keep current)</span></p>
            <div className="grid grid-cols-1 gap-3">
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Current password" className={inputCls} />
              <div className="grid grid-cols-2 gap-3">
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password (min 6)" className={inputCls} />
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password" className={inputCls} />
              </div>
            </div>
          </div>

          {profileMsg && (
            <div className={`px-4 py-2.5 rounded-xl text-sm ${profileMsg.type === "success" ? "bg-forest-50 text-forest-700 border border-forest-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
              {profileMsg.text}
            </div>
          )}

          <button onClick={saveProfile} disabled={profileSaving}
            className="px-5 py-2.5 bg-gradient-to-r from-berry-500 to-berry-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60">
            {profileSaving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </Section>

      {/* ── Camp Appearance ── */}
      {campId && (
        <Section title="🎨 Camp Appearance" subtitle={`Customize how ${campName}'s registration page and print materials look`}>
          <div className="space-y-5">

            {/* Color themes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Color Theme</label>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_THEMES.map(theme => {
                  const active = appearance.primaryColor === theme.primary && appearance.accentColor === theme.accent;
                  return (
                    <button key={theme.name} type="button"
                      onClick={() => setAppearance(prev => ({ ...prev, primaryColor: theme.primary, accentColor: theme.accent }))}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${active ? "border-slate-800 shadow-sm bg-slate-50" : "border-slate-200 hover:border-slate-300"}`}>
                      <div className="flex gap-1 flex-shrink-0">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.preview[0] }} />
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.preview[1] }} />
                      </div>
                      <span className="text-xs font-medium text-slate-700 truncate">{theme.name}</span>
                      {active && <span className="ml-auto text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom colors */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Custom Colors</label>
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="color" value={appearance.primaryColor}
                    onChange={e => setAppearance(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-10 h-10 border border-slate-200 rounded-xl cursor-pointer p-0.5" />
                  <div>
                    <p className="text-xs font-medium text-slate-700">Primary</p>
                    <p className="text-xs text-slate-400 font-mono">{appearance.primaryColor}</p>
                  </div>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="color" value={appearance.accentColor}
                    onChange={e => setAppearance(prev => ({ ...prev, accentColor: e.target.value }))}
                    className="w-10 h-10 border border-slate-200 rounded-xl cursor-pointer p-0.5" />
                  <div>
                    <p className="text-xs font-medium text-slate-700">Accent</p>
                    <p className="text-xs text-slate-400 font-mono">{appearance.accentColor}</p>
                  </div>
                </label>
                {/* Live preview swatch */}
                <div className="flex items-center gap-2 ml-2">
                  <div className="h-10 w-24 rounded-xl flex items-center justify-center text-white text-xs font-semibold shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${appearance.primaryColor}, ${appearance.accentColor})` }}>
                    Preview
                  </div>
                </div>
              </div>
            </div>

            {/* Font family */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Font Family</label>
              <div className="space-y-2">
                {FONT_OPTIONS.map(font => {
                  const active = appearance.fontFamily === font.id;
                  return (
                    <label key={font.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${active ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:border-slate-300"}`}>
                      <input type="radio" checked={active} onChange={() => setAppearance(prev => ({ ...prev, fontFamily: font.id }))}
                        className="w-4 h-4 accent-sky-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-slate-600 block">{font.label}</span>
                        <span className="text-sm text-slate-700 truncate block" style={font.style}>{font.sample}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {appearanceMsg && (
              <div className={`px-4 py-2.5 rounded-xl text-sm ${appearanceMsg.type === "success" ? "bg-forest-50 text-forest-700 border border-forest-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                {appearanceMsg.text}
              </div>
            )}

            <button onClick={saveAppearance} disabled={appearanceSaving}
              className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60">
              {appearanceSaving ? "Saving..." : "Save Appearance"}
            </button>
          </div>
        </Section>
      )}

      {/* ── Import shortcut ── */}
      <div className="camp-card p-5 border-2 border-dashed border-slate-200 bg-slate-50/50 mb-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-forest-400 flex items-center justify-center text-white text-xl flex-shrink-0">
              📥
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Bulk Import</p>
              <p className="text-xs text-slate-500 mt-0.5">Upload a spreadsheet to populate activities, teachers, rooms, and time slots.</p>
            </div>
          </div>
          <Link href={`/import${campId ? `?campId=${campId}` : ""}`}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2 whitespace-nowrap flex-shrink-0">
            Go to Import →
          </Link>
        </div>
      </div>

      {/* ── Danger Zone ── */}
      {campId && (
        <Section title="⚠️ Danger Zone" subtitle="These actions are permanent and cannot be undone">
          <button
            onClick={() => {
              if (confirm(`Delete "${campName}" and all its data? This cannot be undone.`)) {
                fetch(`/api/camps/${campId}`, { method: "DELETE" }).then(() => {
                  window.location.href = "/dashboard";
                });
              }
            }}
            className="px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            🗑️ Delete This Camp
          </button>
        </Section>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-berry-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}
