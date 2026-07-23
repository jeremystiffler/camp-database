"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { RowDeleteButton } from "@/components/InlineEditing";

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

interface CampBilling {
  billingMode: "campPays" | "camperFee";
  billingStatus: string;
  platformFeeCents: number;
  platformFeePercentBps: number;
  platformFeeMinCents: number;
  platformFeeCapCents: number;
  camperPriceCents: number;
  annualSubscriptionCents: number;
}

interface Coupon {
  id?: string;
  code: string;
  description: string;
  discountType: "percent" | "amount" | "free" | "bogo";
  percentOff: number | null;
  amountOffCents: number | null;
  restrictedEmails: string;
  maxRedemptions: number | null;
  redeemedCount?: number;
  active: boolean;
  expiresAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLOR_THEMES = [
  { name: "Slate",      primary: "#64748B", accent: "#475569", preview: ["#64748B","#475569"] },
  { name: "Stone",      primary: "#78716C", accent: "#57534E", preview: ["#78716C","#57534E"] },
  { name: "Sage",       primary: "#6B7D5F", accent: "#4F6F56", preview: ["#6B7D5F","#4F6F56"] },
  { name: "Moss",       primary: "#7A8060", accent: "#5F6548", preview: ["#7A8060","#5F6548"] },
  { name: "Clay",       primary: "#A1624A", accent: "#7C4A3A", preview: ["#A1624A","#7C4A3A"] },
  { name: "Blue Gray",  primary: "#607A8C", accent: "#465E6F", preview: ["#607A8C","#465E6F"] },
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
    <section id={title.toLowerCase().replace(/[^a-z0-9]+/g, "-")} className="camp-card p-6 mb-5 scroll-mt-6">
      <div className="mb-4">
        <h2 className="font-black text-slate-900 text-base">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
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
  const [appearance,      setAppearance]      = useState<CampAppearance>({ primaryColor: "#64748B", accentColor: "#475569", fontFamily: "Inter" });
  const [campName,        setCampName]        = useState("this camp");
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceMsg,   setAppearanceMsg]   = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [billing, setBilling] = useState<CampBilling>({ billingMode: "campPays", billingStatus: "trial", platformFeeCents: 300, platformFeePercentBps: 300, platformFeeMinCents: 200, platformFeeCapCents: 2500, camperPriceCents: 0, annualSubscriptionCents: 29900 });
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingMsg, setBillingMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponDraft, setCouponDraft] = useState<Coupon>({ code: "", description: "", discountType: "percent", percentOff: 10, amountOffCents: null, restrictedEmails: "", maxRedemptions: null, active: true, expiresAt: "" });

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
          setCampName(d.name || "this program");
          setAppearance({
            primaryColor: d.primaryColor || "#64748B",
            accentColor:  d.accentColor  || "#475569",
            fontFamily:   d.fontFamily   || "Inter",
          });
          setBilling({
            billingMode: d.billingMode === "camperFee" ? "camperFee" : "campPays",
            billingStatus: d.billingStatus || "trial",
            platformFeeCents: Number(d.platformFeeCents || 300),
            platformFeePercentBps: Number(d.platformFeePercentBps || 300),
            platformFeeMinCents: Number(d.platformFeeMinCents || 200),
            platformFeeCapCents: Number(d.platformFeeCapCents || 2500),
            camperPriceCents: Number(d.camperPriceCents || 0),
            annualSubscriptionCents: Number(d.annualSubscriptionCents || 29900),
          });
        }
      });
    fetch(`/api/camps/${campId}/coupons`)
      .then(r => r.json())
      .then(d => setCoupons(Array.isArray(d.coupons) ? d.coupons : []))
      .catch(() => setCoupons([]));
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
    const data = await res.json();
    setAppearanceSaving(false);
    if (res.ok) {
      setAppearanceMsg({ type: "success", text: "Appearance saved!" });
    } else {
      setAppearanceMsg({ type: "error", text: data.detail || data.error || "Failed to save appearance" });
    }
    setTimeout(() => setAppearanceMsg(null), 3000);
  };

  const saveBilling = async () => {
    if (!campId) return;
    setBillingSaving(true); setBillingMsg(null);
    const res = await fetch(`/api/camps/${campId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(billing),
    });
    const data = await res.json().catch(() => ({}));
    setBillingSaving(false);
    setBillingMsg(res.ok ? { type: "success", text: "Billing preference saved." } : { type: "error", text: data.detail || data.error || "Failed to save billing" });
    setTimeout(() => setBillingMsg(null), 3500);
  };

  const startCampCheckout = async () => {
    if (!campId) return;
    setBillingSaving(true); setBillingMsg(null);
    const res = await fetch(`/api/camps/${campId}/billing/checkout`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBillingSaving(false);
    if (res.ok && data.url) window.location.href = data.url;
    else setBillingMsg({ type: "error", text: data.error || "Stripe checkout is not ready yet." });
  };

  const saveCoupon = async () => {
    if (!campId || !couponDraft.code.trim()) return;
    setBillingSaving(true); setBillingMsg(null);
    const res = await fetch(`/api/camps/${campId}/coupons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(couponDraft),
    });
    const data = await res.json().catch(() => ({}));
    setBillingSaving(false);
    if (res.ok) {
      setCoupons(prev => [data.coupon, ...prev.filter(c => c.id !== data.coupon.id && c.code !== data.coupon.code)]);
      setCouponDraft({ code: "", description: "", discountType: "percent", percentOff: 10, amountOffCents: null, restrictedEmails: "", maxRedemptions: null, active: true, expiresAt: "" });
      setBillingMsg({ type: "success", text: "Coupon saved." });
    } else {
      setBillingMsg({ type: "error", text: data.detail || data.error || "Failed to save coupon" });
    }
  };

  const deleteCoupon = async (couponId?: string) => {
    if (!campId || !couponId) return;
    const res = await fetch(`/api/camps/${campId}/coupons/${couponId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Could not delete coupon");
    setCoupons(prev => prev.filter(c => c.id !== couponId));
  };

  const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
  const platformEstimate = Math.min(billing.platformFeeCapCents, Math.max(billing.platformFeeMinCents, Math.round(billing.camperPriceCents * billing.platformFeePercentBps / 10000)));

  const inputCls = "minimal-input";

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <p className="minimal-section-title mb-2">Program administration</p>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Profile, billing, appearance, utilities, and program-level actions.</p>
      </div>

      {campId && (
        <div className="camp-card p-4 mb-5">
          <p className="minimal-section-title mb-3">Jump to</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <a href="#your-profile" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:border-slate-400 hover:text-slate-950">Profile</a>
            <a href="#billing" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:border-slate-400 hover:text-slate-950">Billing</a>
            <a href="#program-appearance" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:border-slate-400 hover:text-slate-950">Appearance</a>
            <a href="#utilities" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:border-slate-400 hover:text-slate-950">Utilities</a>
          </div>

        </div>
      )}

      {/* ── Your Profile ── */}
      <Section title="Your Profile" subtitle="Update your name, email, and password">
        {user && (
          <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {(user.name?.[0] || user.email[0]).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{user.name || "—"}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
              <span className="text-xs bg-berry-100 text-berry-700 border border-berry-200 px-2 py-0.5 rounded-full font-semibold capitalize">{user.role}</span>
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
            className="minimal-button-primary">
            {profileSaving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </Section>

      {/* ── Camp Billing ── */}
      {campId && (
        <Section title="Billing" subtitle="Choose who covers the platform cost for this program">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setBilling(prev => ({ ...prev, billingMode: "campPays" }))}
                className={`rounded-2xl border-2 p-4 text-left transition-all ${billing.billingMode === "campPays" ? "border-forest-400 bg-forest-50" : "border-slate-200 hover:border-slate-300"}`}>
                <p className="text-sm font-bold text-slate-800">Program pays yearly</p>
                <p className="mt-1 text-2xl font-black text-forest-700">{money(billing.annualSubscriptionCents)}<span className="text-xs font-semibold text-slate-500">/year</span></p>
                <p className="mt-2 text-xs text-slate-500">Best when your program wants registration to feel completely free for families.</p>
              </button>
              <button type="button" onClick={() => setBilling(prev => ({ ...prev, billingMode: "camperFee" }))}
                className={`rounded-2xl border-2 p-4 text-left transition-all ${billing.billingMode === "camperFee" ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:border-slate-300"}`}>
                <p className="text-sm font-bold text-slate-800">Participants pay registration</p>
                <p className="mt-1 text-2xl font-black text-sky-700">{money(billing.camperPriceCents + platformEstimate)}<span className="text-xs font-semibold text-slate-500">/participant</span></p>
                <p className="mt-2 text-xs text-slate-500">Families pay the program price plus our 3% platform fee, capped at {money(billing.platformFeeCapCents)}.</p>
              </button>
            </div>

            {billing.billingMode === "camperFee" && (
              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-xs font-bold uppercase tracking-wide text-sky-800 mb-1">Program price per participant</span>
                    <input type="number" min="0" step="1" value={billing.camperPriceCents / 100} onChange={e => setBilling(prev => ({ ...prev, camperPriceCents: Math.max(0, Math.round(Number(e.target.value) * 100 || 0)) }))} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-bold uppercase tracking-wide text-sky-800 mb-1">Our percentage</span>
                    <input type="number" min="0" max="100" step="0.1" value={billing.platformFeePercentBps / 100} onChange={e => setBilling(prev => ({ ...prev, platformFeePercentBps: Math.max(0, Math.round(Number(e.target.value) * 100 || 0)) }))} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-bold uppercase tracking-wide text-sky-800 mb-1">Minimum platform fee</span>
                    <input type="number" min="0" step="1" value={billing.platformFeeMinCents / 100} onChange={e => setBilling(prev => ({ ...prev, platformFeeMinCents: Math.max(0, Math.round(Number(e.target.value) * 100 || 0)) }))} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-bold uppercase tracking-wide text-sky-800 mb-1">Maximum platform fee cap</span>
                    <input type="number" min="0" step="1" value={billing.platformFeeCapCents / 100} onChange={e => setBilling(prev => ({ ...prev, platformFeeCapCents: Math.max(0, Math.round(Number(e.target.value) * 100 || 0)) }))} className={inputCls} />
                  </label>
                </div>
                <div className="rounded-xl bg-white border border-sky-100 px-4 py-3 text-sm text-sky-900">
                  Example checkout today: program price <strong>{money(billing.camperPriceCents)}</strong> + platform fee <strong>{money(platformEstimate)}</strong> = family pays <strong>{money(billing.camperPriceCents + platformEstimate)}</strong>.
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Current status: <span className="font-bold capitalize text-slate-800">{billing.billingStatus.replace(/_/g, " ")}</span>. Registration pages will show the {billing.billingMode === "camperFee" ? `${money(billing.camperPriceCents)} program price + platform fee` : "program-paid plan"} messaging.
            </div>

            {billing.billingMode === "camperFee" && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 space-y-3">
                <div>
                  <p className="text-sm font-bold text-amber-900">Coupon codes</p>
                  <p className="text-xs text-amber-800">Create percent, dollar-off, free, BOGO, or specific-family codes. BOGO discounts this registration 50%.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input placeholder="Code e.g. STAFFFREE" value={couponDraft.code} onChange={e => setCouponDraft(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} className={inputCls} />
                  <select value={couponDraft.discountType} onChange={e => setCouponDraft(prev => ({ ...prev, discountType: e.target.value as Coupon["discountType"] }))} className={inputCls}>
                    <option value="percent">Percent off</option>
                    <option value="amount">Dollar amount off</option>
                    <option value="free">Free registration</option>
                    <option value="bogo">BOGO / half off</option>
                  </select>
                  {couponDraft.discountType === "percent" && <input type="number" min="1" max="100" placeholder="Percent off" value={couponDraft.percentOff || ""} onChange={e => setCouponDraft(prev => ({ ...prev, percentOff: Number(e.target.value) || null }))} className={inputCls} />}
                  {couponDraft.discountType === "amount" && <input type="number" min="0" placeholder="Dollar amount off" value={(couponDraft.amountOffCents || 0) / 100 || ""} onChange={e => setCouponDraft(prev => ({ ...prev, amountOffCents: Math.round(Number(e.target.value) * 100 || 0) }))} className={inputCls} />}
                  <input placeholder="Description (optional)" value={couponDraft.description} onChange={e => setCouponDraft(prev => ({ ...prev, description: e.target.value }))} className={inputCls} />
                  <input type="number" min="1" placeholder="Max redemptions (blank = unlimited)" value={couponDraft.maxRedemptions || ""} onChange={e => setCouponDraft(prev => ({ ...prev, maxRedemptions: e.target.value ? Number(e.target.value) : null }))} className={inputCls} />
                  <input type="date" value={couponDraft.expiresAt} onChange={e => setCouponDraft(prev => ({ ...prev, expiresAt: e.target.value }))} className={inputCls} />
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={couponDraft.active} onChange={e => setCouponDraft(prev => ({ ...prev, active: e.target.checked }))} /> Active</label>
                </div>
                <textarea rows={2} placeholder="Restrict to specific guardian emails (optional, one per line or comma-separated)" value={couponDraft.restrictedEmails} onChange={e => setCouponDraft(prev => ({ ...prev, restrictedEmails: e.target.value }))} className={inputCls + " resize-none"} />
                <button type="button" onClick={saveCoupon} disabled={billingSaving || !couponDraft.code.trim()} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 disabled:opacity-60">Save Coupon</button>
                {coupons.length > 0 && (
                  <div className="divide-y divide-amber-100 rounded-xl border border-amber-100 bg-white overflow-hidden">
                    {coupons.map(coupon => (
                      <div key={coupon.id || coupon.code} className="flex items-center justify-between gap-3 p-3 text-sm">
                        <div>
                          <p className="font-bold text-slate-800">{coupon.code} <span className="text-xs font-medium text-slate-400">{coupon.active ? "active" : "inactive"}</span></p>
                          <p className="text-xs text-slate-500">{coupon.discountType === "percent" ? `${coupon.percentOff}% off` : coupon.discountType === "amount" ? `${money(coupon.amountOffCents || 0)} off` : coupon.discountType === "free" ? "Free registration" : "BOGO / half off"} · redeemed {coupon.redeemedCount || 0}{coupon.maxRedemptions ? `/${coupon.maxRedemptions}` : ""}</p>
                        </div>
                        <RowDeleteButton onDelete={() => deleteCoupon(coupon.id)} label={`coupon ${coupon.code}`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {billingMsg && (
              <div className={`px-4 py-2.5 rounded-xl text-sm ${billingMsg.type === "success" ? "bg-forest-50 text-forest-700 border border-forest-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                {billingMsg.text}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button onClick={saveBilling} disabled={billingSaving}
                className="minimal-button-primary">
                {billingSaving ? "Saving..." : "Save Billing Settings"}
              </button>
              {billing.billingMode === "campPays" && (
                <button onClick={startCampCheckout} disabled={billingSaving}
                  className="minimal-button-secondary">
                  Pay {money(billing.annualSubscriptionCents)}/year with Stripe
                </button>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ── Program Appearance ── */}
      {campId && (
        <Section title="Program Appearance" subtitle={`Customize how ${campName}'s registration page and print materials look`}>
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

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Live registration preview</p>
              <div className="overflow-hidden rounded-xl bg-white shadow-sm" style={{ fontFamily: `${appearance.fontFamily}, sans-serif` }}>
                <div className="p-4 text-white" style={{ background: `linear-gradient(135deg, ${appearance.primaryColor}, ${appearance.accentColor})` }}>
                  <p className="text-lg font-bold">{campName}</p>
                  <p className="text-sm opacity-90">Participant Registration</p>
                </div>
                <div className="space-y-2 p-4">
                  <div className="h-3 w-2/5 rounded bg-slate-200" />
                  <div className="h-10 rounded-lg border border-slate-200 bg-slate-50" />
                  <div className="rounded-lg px-3 py-2 text-center text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${appearance.primaryColor}, ${appearance.accentColor})` }}>Continue</div>
                </div>
              </div>
              <a href={`/register/${campId}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-bold text-sky-700 hover:text-sky-900">Open full registration preview ↗</a>
            </div>

            {appearanceMsg && (
              <div className={`px-4 py-2.5 rounded-xl text-sm ${appearanceMsg.type === "success" ? "bg-forest-50 text-forest-700 border border-forest-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                {appearanceMsg.text}
              </div>
            )}

            <button onClick={saveAppearance} disabled={appearanceSaving}
              className="minimal-button-primary">
              {appearanceSaving ? "Saving..." : "Save Appearance"}
            </button>
          </div>
        </Section>
      )}

      {/* ── Import shortcut ── */}
      <div id="utilities" className="camp-card p-5 border border-slate-200 bg-white mb-5 scroll-mt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-sm font-black flex-shrink-0">
              I
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
        <Section title="Danger Zone" subtitle="These actions are permanent and cannot be undone">
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
            Delete This Program
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
