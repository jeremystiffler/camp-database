"use client";

import { FormEvent, useEffect, useState } from "react";

type Promotion = { id: string; code: string; active: boolean; timesRedeemed: number; maxRedemptions: number | null; expiresAt: string | null; firstTimeTransaction: boolean; percentOff: number | null; amountOff: number | null; currency: string | null; duration: string };
const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-forest-500";

export default function SuperAdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: "", discountType: "percent", percentOff: "100", amountOffCents: "", duration: "once", durationInMonths: "1", maxRedemptions: "", expiresAt: "", firstTimeOnly: true });
  const load = async () => {
    const me = await fetch("/api/auth/me").then(r => r.json());
    if (!me.user?.isSuperAdmin) { setAllowed(false); return; }
    setAllowed(true);
    const result = await fetch("/api/platform/promotions").then(r => r.json());
    if (result.error) setMessage(result.error); else setPromotions(result.promotions || []);
  };
  useEffect(() => { load(); }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage("");
    const response = await fetch("/api/platform/promotions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, percentOff: Number(form.percentOff), amountOffCents: Math.round(Number(form.amountOffCents) * 100), durationInMonths: Number(form.durationInMonths), maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null }) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(data.error || "Could not create promotion."); return; }
    setMessage(`Created ${data.promotion.code}. It is now available at Stripe Checkout.`); setForm({ ...form, code: "" }); load();
  };
  const disable = async (id: string, code: string) => {
    if (!confirm(`Deactivate ${code}? It can no longer be redeemed.`)) return;
    const response = await fetch(`/api/platform/promotions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await response.json(); setMessage(response.ok ? `${code} deactivated.` : data.error || "Could not deactivate promotion."); load();
  };
  if (allowed === null) return <div className="p-8 text-slate-500">Checking platform access…</div>;
  if (!allowed) return <div className="p-8"><h1 className="text-2xl font-black">Platform access required</h1><p className="mt-2 text-slate-600">This area is reserved for the Simple Schedule Pro Super Admin.</p></div>;
  return <main className="mx-auto max-w-6xl p-6 md:p-10"><div className="mb-8"><p className="text-xs font-black uppercase tracking-widest text-forest-600">Simple Schedule Pro</p><h1 className="mt-1 text-3xl font-black text-slate-950">Super Admin</h1><p className="mt-2 max-w-2xl text-slate-600">Control site-wide tester and subscription promotions. These are separate from camp registration coupons, and only the platform Super Admin can manage them.</p></div>
    <div className="grid gap-6 lg:grid-cols-[390px_1fr]"><form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"><div><h2 className="font-black">Create tester promotion</h2><p className="mt-1 text-xs text-slate-500">Creates a Stripe coupon and promotion code. It appears automatically at checkout.</p></div><label className="block text-sm font-bold">Code<input required className={input + " mt-1 uppercase"} placeholder="BETA100" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">Discount<select className={input + " mt-1"} value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value })}><option value="percent">Percent off</option><option value="amount">Dollar amount</option></select></label><label className="text-sm font-bold">{form.discountType === "percent" ? "Percent" : "Dollar amount"}<input required className={input + " mt-1"} type="number" min="1" max={form.discountType === "percent" ? "100" : undefined} value={form.discountType === "percent" ? form.percentOff : form.amountOffCents} onChange={e => setForm({ ...form, [form.discountType === "percent" ? "percentOff" : "amountOffCents"]: e.target.value })} /></label></div><div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">Applies<select className={input + " mt-1"} value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })}><option value="once">First payment</option><option value="repeating">Multiple months</option></select></label>{form.duration === "repeating" && <label className="text-sm font-bold">Months<input className={input + " mt-1"} type="number" min="1" max="24" value={form.durationInMonths} onChange={e => setForm({ ...form, durationInMonths: e.target.value })} /></label>}</div><label className="block text-sm font-bold">Maximum redemptions <span className="font-normal text-slate-400">(blank = unlimited)</span><input className={input + " mt-1"} type="number" min="1" value={form.maxRedemptions} onChange={e => setForm({ ...form, maxRedemptions: e.target.value })} /></label><label className="block text-sm font-bold">Expires <span className="font-normal text-slate-400">(optional)</span><input className={input + " mt-1"} type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} /></label><label className="flex gap-2 text-sm font-semibold"><input type="checkbox" checked={form.firstTimeOnly} onChange={e => setForm({ ...form, firstTimeOnly: e.target.checked })} /> First-time customers only</label><button disabled={saving} className="w-full rounded-xl bg-forest-600 px-4 py-2.5 text-sm font-black text-white hover:bg-forest-700 disabled:opacity-60">{saving ? "Creating…" : "Create Promotion"}</button>{message && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{message}</p>}</form>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="font-black">Active platform promotions</h2><p className="mt-1 text-xs text-slate-500">Redemptions and expiration are recorded by Stripe.</p></div>{promotions.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No active promotions yet.</p> : <div className="overflow-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-2">Code</th><th className="p-2">Discount</th><th className="p-2">Use</th><th className="p-2">Expires</th><th className="p-2"></th></tr></thead><tbody>{promotions.map(p => <tr key={p.id} className="border-b last:border-0"><td className="p-2 font-black">{p.code}{p.firstTimeTransaction && <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700">NEW</span>}</td><td className="p-2">{p.percentOff ? `${p.percentOff}% off` : `$${((p.amountOff || 0) / 100).toFixed(2)} off`} <span className="text-slate-400">· {p.duration}</span></td><td className="p-2">{p.timesRedeemed}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""}</td><td className="p-2">{p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : "No expiry"}</td><td className="p-2 text-right"><button onClick={() => disable(p.id, p.code)} className="font-bold text-rose-600 hover:underline">Deactivate</button></td></tr>)}</tbody></table></div>}</section></div></main>;
}
