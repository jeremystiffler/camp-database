"use client";

import { useState, useEffect, Suspense } from "react";
import { PageBanner } from "@/components/PageBanner";
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
  billingMode: "campPays" | "participantFee";
  billingStatus: string;
  platformFeeCents: number;
  platformFeePercentBps: number;
  platformFeeMinCents: number;
  platformFeeCapCents: number;
  participantPriceCents: number;
  annualSubscriptionCents: number;
}

interface ConnectStatus {
  configured: boolean;
  connected: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  ready: boolean;
  country: string | null;
  currentlyDue: string[];
}

interface RegistrationPayment {
  id: string;
  guardianEmail: string | null;
  amountCents: number;
  campPriceCents: number;
  discountCents: number;
  platformFeeCents: number;
  status: string;
  createdAt: string;
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
        <h2 className="font-extrabold text-slate-900 text-base">{title}</h2>
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
  const [billing, setBilling] = useState<CampBilling>({ billingMode: "campPays", billingStatus: "trial", platformFeeCents: 300, platformFeePercentBps: 300, platformFeeMinCents: 200, platformFeeCapCents: 2500, participantPriceCents: 0, annualSubscriptionCents: 29900 });
  const [activeTab, setActiveTab] = useState<"profile" | "billing" | "appearance" | "utilities">(searchParams.get("tab") === "billing" ? "billing" : "profile");
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingMsg, setBillingMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [payments, setPayments] = useState<RegistrationPayment[]>([]);
  const [paymentTotals, setPaymentTotals] = useState({ paidCount: 0, grossCents: 0, eventRevenueCents: 0, platformFeeCents: 0, discountCents: 0 });
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponDraft, setCouponDraft] = useState<Coupon>({ code: "", description: "", discountType: "percent", percentOff: 10, amountOffCents: null, restrictedEmails: "", maxRedemptions: null, active: true, expiresAt: "" });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

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
          setCampName(d.name || "this event");
          setAppearance({
            primaryColor: d.primaryColor || "#64748B",
            accentColor:  d.accentColor  || "#475569",
            fontFamily:   d.fontFamily   || "Inter",
          });
          setBilling({
            billingMode: d.billingMode === "participantFee" ? "participantFee" : "campPays",
            billingStatus: d.billingStatus || "trial",
            platformFeeCents: Number(d.platformFeeCents || 300),
            platformFeePercentBps: Number(d.platformFeePercentBps || 300),
            platformFeeMinCents: Number(d.platformFeeMinCents || 200),
            platformFeeCapCents: Number(d.platformFeeCapCents || 2500),
            participantPriceCents: Number(d.participantPriceCents || 0),
            annualSubscriptionCents: Number(d.annualSubscriptionCents || 29900),
          });
        }
      });
    fetch(`/api/camps/${campId}/coupons`)
      .then(r => r.json())
      .then(d => setCoupons(Array.isArray(d.coupons) ? d.coupons : []))
      .catch(() => setCoupons([]));
    fetch(`/api/camps/${campId}/payments/connect`)
      .then(r => r.json())
      .then(d => { if (!d.error) setConnectStatus(d); })
      .catch(() => setConnectStatus(null));
    fetch(`/api/camps/${campId}/payments`)
      .then(r => r.json())
      .then(d => {
        setPayments(Array.isArray(d.payments) ? d.payments : []);
        if (d.totals) setPaymentTotals(d.totals);
      })
      .catch(() => setPayments([]));
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
      body: JSON.stringify({ fontFamily: appearance.fontFamily }),
    });
    const data = await res.json();
    setAppearanceSaving(false);
    if (res.ok) {
      // Refresh the protected layout's active event immediately so this event—not a later refresh—owns the new palette.
      window.dispatchEvent(new Event("camp:list-changed"));
      setAppearanceMsg({ type: "success", text: "Appearance saved and applied to this event." });
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
      body: JSON.stringify({ billingMode: billing.billingMode, participantPriceCents: billing.participantPriceCents }),
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

  const startConnectAction = async (action: "onboard" | "dashboard") => {
    if (!campId) return;
    setBillingSaving(true); setConnectError(null);
    const res = await fetch(`/api/camps/${campId}/payments/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setBillingSaving(false);
    if (res.ok && data.url) window.location.href = data.url;
    else setConnectError(data.error || "Stripe payout setup could not be opened.");
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
  const platformEstimate = Math.min(billing.platformFeeCapCents, Math.max(billing.platformFeeMinCents, Math.round(billing.participantPriceCents * billing.platformFeePercentBps / 10000)));

  const inputCls = "minimal-input";

  return (
    <div className="max-w-5xl">
      <PageBanner
        eyebrow="Account"
        title="Settings"
        description="Profile, billing, appearance, utilities, and event-level actions."
      />

      <div className="mb-6 flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-2" role="tablist" aria-label="Settings sections">
        {([
          ["profile", "Profile"], ["billing", "Billing"], ["appearance", "Appearance"], ["utilities", "Utilities"],
        ] as const).map(([tab, label]) => (
          <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`rounded-xl px-4 py-2 text-sm font-extrabold transition ${activeTab === tab ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label}</button>
        ))}
      </div>

      {activeTab === "profile" && (
      <Section title="Your Profile" subtitle="Update your name, email, and password">
        {user && (
          <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {(user.name?.[0] || user.email[0]).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{user.name || "—"}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
              <span className="text-xs bg-berry-100 text-berry-700 border border-berry-200 px-2 py-0.5 rounded-full font-semibold capitalize">Platform role: {user.role}</span>
              <p className="mt-1 text-[11px] font-medium text-slate-500">Your event access level is shown in the event switcher.</p>
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
            <p className="text-sm font-medium text-slate-700 mb-3">Change Password <span className="text-xs text-slate-500 font-normal">(leave blank to keep current)</span></p>
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
      )}

      {activeTab === "billing" && campId && (
        <Section title="Billing" subtitle="Choose who covers the platform cost for this event">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setBilling(prev => ({ ...prev, billingMode: "campPays" }))}
                className={`rounded-2xl border-2 p-4 text-left transition-all ${billing.billingMode === "campPays" ? "border-forest-400 bg-forest-50" : "border-slate-200 hover:border-slate-300"}`}>
                <p className="text-sm font-bold text-slate-800">Event pays yearly</p>
                <p className="mt-1 text-2xl font-extrabold text-forest-700">{money(billing.annualSubscriptionCents)}<span className="text-xs font-semibold text-slate-500">/year</span></p>
                <p className="mt-2 text-xs text-slate-500">Best when your event wants registration to feel completely free for families.</p>
              </button>
              <button type="button" onClick={() => setBilling(prev => ({ ...prev, billingMode: "participantFee" }))}
                className={`rounded-2xl border-2 p-4 text-left transition-all ${billing.billingMode === "participantFee" ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:border-slate-300"}`}>
                <p className="text-sm font-bold text-slate-800">Participants pay registration</p>
                <p className="mt-1 text-2xl font-extrabold text-sky-700">{money(billing.participantPriceCents + platformEstimate)}<span className="text-xs font-semibold text-slate-500">/participant</span></p>
                <p className="mt-2 text-xs text-slate-500">Families pay the event price plus our 3% platform fee, capped at {money(billing.platformFeeCapCents)}.</p>
              </button>
            </div>

            {billing.billingMode === "participantFee" && (
              <div className="space-y-4">
                <div className={`rounded-2xl border p-4 ${connectStatus?.ready ? "border-forest-200 bg-forest-50" : "border-amber-200 bg-amber-50"}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className={`text-sm font-extrabold ${connectStatus?.ready ? "text-forest-900" : "text-amber-950"}`}>Organizer payouts</p>
                      <p className={`mt-1 text-xs ${connectStatus?.ready ? "text-forest-800" : "text-amber-900"}`}>
                        {!connectStatus ? "Checking Stripe payout status…"
                          : !connectStatus.configured ? "Simple Schedule Pro must finish its Stripe platform configuration before organizers can connect."
                          : connectStatus.ready ? "Ready — Stripe can accept registration payments and deposit event proceeds into your bank account."
                          : connectStatus.connected ? "Continue Stripe onboarding. Paid registration stays closed until charges and payouts are enabled."
                          : "Connect a Stripe payout account before opening paid registration. Stripe securely collects your identity, tax, and bank details."}
                      </p>
                    </div>
                    {connectStatus?.ready ? (
                      <button type="button" onClick={() => startConnectAction("dashboard")} disabled={billingSaving} className="minimal-button-secondary whitespace-nowrap">Open Stripe dashboard</button>
                    ) : (
                      <button type="button" onClick={() => startConnectAction("onboard")} disabled={billingSaving || !connectStatus?.configured} className="minimal-button-primary whitespace-nowrap">
                        {connectStatus?.connected ? "Continue Stripe setup" : "Connect with Stripe"}
                      </button>
                    )}
                  </div>
                  {connectStatus?.currentlyDue?.length ? <p className="mt-3 text-xs font-semibold text-amber-900">Stripe still requires: {connectStatus.currentlyDue.map(item => item.replaceAll("_", " ")).join(", ")}.</p> : null}
                </div>
                {connectError && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {connectError}
                  </div>
                )}

                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 space-y-4">
                  <label className="block">
                    <span className="block text-xs font-bold uppercase tracking-wide text-sky-800 mb-1">Event price per participant</span>
                    <input type="number" min="0" step="1" value={billing.participantPriceCents / 100} onChange={e => setBilling(prev => ({ ...prev, participantPriceCents: Math.max(0, Math.round(Number(e.target.value) * 100 || 0)) }))} className={inputCls} />
                  </label>
                  <div className="rounded-xl bg-white border border-sky-100 px-4 py-3 text-sm text-sky-900">
                    Event price <strong>{money(billing.participantPriceCents)}</strong> + Simple Schedule Pro fee <strong>{money(platformEstimate)}</strong> = family pays <strong>{money(billing.participantPriceCents + platformEstimate)}</strong>. Simple Schedule Pro pays Stripe processing fees from the platform fee.
                  </div>
                  <p className="text-xs text-sky-900">The platform fee is set by Simple Schedule Pro at {(billing.platformFeePercentBps / 100).toFixed(2).replace(/\.00$/, "")}% (minimum {money(billing.platformFeeMinCents)}, capped at {money(billing.platformFeeCapCents)}). Organizers control only their event price.</p>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Current status: <span className="font-bold capitalize text-slate-800">{billing.billingStatus.replace(/_/g, " ")}</span>. Registration pages will show the {billing.billingMode === "participantFee" ? `${money(billing.participantPriceCents)} event price + platform fee` : "event-paid plan"} messaging.
            </div>

            {billing.billingMode === "participantFee" && (
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
                          <p className="font-bold text-slate-800">{coupon.code} <span className="text-xs font-medium text-slate-500">{coupon.active ? "active" : "inactive"}</span></p>
                          <p className="text-xs text-slate-500">{coupon.discountType === "percent" ? `${coupon.percentOff}% off` : coupon.discountType === "amount" ? `${money(coupon.amountOffCents || 0)} off` : coupon.discountType === "free" ? "Free registration" : "BOGO / half off"} · redeemed {coupon.redeemedCount || 0}{coupon.maxRedemptions ? `/${coupon.maxRedemptions}` : ""}</p>
                        </div>
                        <RowDeleteButton onDelete={() => deleteCoupon(coupon.id)} label={`coupon ${coupon.code}`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {billing.billingMode === "participantFee" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
                <div>
                  <p className="text-sm font-extrabold text-slate-900">Registration payments</p>
                  <p className="text-xs text-slate-500">Payment status is synchronized from Stripe webhooks. Bank payout timing is managed in the Stripe Express dashboard.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Paid orders</p><p className="mt-1 text-lg font-extrabold text-slate-900">{paymentTotals.paidCount}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Gross collected</p><p className="mt-1 text-lg font-extrabold text-slate-900">{money(paymentTotals.grossCents)}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Event revenue</p><p className="mt-1 text-lg font-extrabold text-slate-900">{money(paymentTotals.eventRevenueCents)}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Platform fees</p><p className="mt-1 text-lg font-extrabold text-slate-900">{money(paymentTotals.platformFeeCents)}</p></div>
                </div>
                {payments.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Guardian</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Event</th><th className="px-3 py-2">Status</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.map(payment => <tr key={payment.id}><td className="px-3 py-2 text-slate-600">{new Date(payment.createdAt).toLocaleDateString()}</td><td className="px-3 py-2 text-slate-700">{payment.guardianEmail || "—"}</td><td className="px-3 py-2 font-bold text-slate-900">{money(payment.amountCents)}</td><td className="px-3 py-2 text-slate-700">{money(Math.max(0, payment.campPriceCents - payment.discountCents))}</td><td className="px-3 py-2 font-bold capitalize text-slate-700">{payment.status.replaceAll("_", " ")}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">No registration payments yet.</p>}
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

      {activeTab === "appearance" && campId && (
        <Section title="Event Appearance" subtitle={`Customize how ${campName}'s registration page and print materials look`}>
          <div className="space-y-5">

            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">Event colors are chosen from the event card on the Home page — click the event&rsquo;s initials chip to pick a palette.</p>
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

      {activeTab === "utilities" && (
      <>
      <div id="utilities" className="camp-card p-5 border border-slate-200 bg-white mb-5 scroll-mt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0">
              I
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Bulk Import</p>
              <p className="text-xs text-slate-500 mt-0.5">Upload a spreadsheet to populate activities, teachers, rooms, and time blocks.</p>
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
            onClick={() => { setDeleteConfirmation(""); setDeleteConfirmOpen(true); }}
            className="px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            Delete This Event
          </button>
          {deleteConfirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/40" onClick={() => setDeleteConfirmOpen(false)} />
            <div role="dialog" aria-modal="true" aria-labelledby="delete-event-title" className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <h2 id="delete-event-title" className="text-xl font-extrabold text-slate-900">Delete this event?</h2>
              <p className="mt-2 text-sm text-slate-600">This permanently removes <strong>{campName}</strong>, its schedule, participants, and settings. Type the event name to continue.</p>
              <input autoFocus value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} placeholder={campName} className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Cancel</button>
                <button type="button" disabled={deleteConfirmation !== campName} onClick={async () => { const response = await fetch(`/api/camps/${campId}`, { method: "DELETE" }); if (response.ok) window.location.href = "/dashboard"; }} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Delete permanently</button>
              </div>
            </div>
          </div>}
        </Section>
      )}
      </>
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
