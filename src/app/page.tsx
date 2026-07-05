"use client";

import Link from "next/link";

const stats = [
  { value: "14", label: "day free trial" },
  { value: "$299", label: "camp-paid yearly plan" },
  { value: "3%", label: "camper-paid fee" },
  { value: "$25", label: "max platform fee" },
];

const features = [
  { icon: "👨‍👩‍👧‍👦", title: "Family Registration", desc: "One guardian can register multiple students, choose age groups and classes per camper, and pay once." },
  { icon: "🗓️", title: "Schedule Builder", desc: "Rooms, teachers, time slots, required blocks, capacity limits, and conflict checks stay tied together." },
  { icon: "🎨", title: "Activity Catalog", desc: "Build classes by age group, location, teacher, capacity, and schedule block without duct-taping spreadsheets." },
  { icon: "✅", title: "Check in/out", desc: "Run day-of-camp operations with QR/name lookup, family pickup numbers, and staff-friendly attendance state." },
  { icon: "🖨️", title: "Print Center", desc: "Generate rosters, teacher packets, camper class choices, pickup cards, and QR schedule lanyards." },
  { icon: "💳", title: "Payments", desc: "Choose whether the camp pays the platform or families pay registration plus a transparent platform fee." },
];

const timeline = [
  { time: "9:00", title: "Opening Assembly", tag: "Locked", color: "bg-indigo-100 text-indigo-700" },
  { time: "9:20", title: "Creative Studio", tag: "12/16", color: "bg-sky-100 text-sky-700" },
  { time: "9:45", title: "Outdoor Games", tag: "18/20", color: "bg-emerald-100 text-emerald-700" },
  { time: "10:10", title: "Snack + Small Groups", tag: "All", color: "bg-amber-100 text-amber-700" },
];

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-xl shadow-sm">{icon}</div>
      <h3 className="text-lg font-black text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
    </div>
  );
}

function PricingCard({
  eyebrow,
  title,
  price,
  desc,
  children,
  highlighted = false,
}: {
  eyebrow: string;
  title: string;
  price: string;
  desc: string;
  children: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div className={`rounded-3xl border p-7 shadow-sm ${highlighted ? "border-indigo-200 bg-gradient-to-b from-indigo-50 to-white ring-4 ring-indigo-100" : "border-slate-200 bg-white"}`}>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">{eyebrow}</p>
      <h3 className="mt-3 text-2xl font-black text-slate-900">{title}</h3>
      <p className="mt-4 text-4xl font-black tracking-tight text-slate-950">{price}</p>
      <p className="mt-3 min-h-12 text-sm leading-relaxed text-slate-600">{desc}</p>
      <div className="mt-6 space-y-3 text-sm font-semibold text-slate-700">{children}</div>
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 leading-relaxed"><span className="text-emerald-500">✓</span><span>{children}</span></p>
  );
}

function ProductMockup() {
  return (
    <div className="relative mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-3 shadow-2xl shadow-indigo-100/70">
      <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Today’s camp</p>
            <h3 className="text-lg font-black text-slate-900">Daily schedule</h3>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">Ready</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_0.85fr]">
          <div className="space-y-2">
            {timeline.map((item) => (
              <div key={item.time} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-slate-400">{item.time}</p>
                    <p className="text-sm font-black text-slate-800">{item.title}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-black ${item.color}`}>{item.tag}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Operations</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-indigo-50 p-3"><p className="text-2xl font-black text-indigo-600">84</p><p className="text-xs font-bold text-slate-500">registered campers</p></div>
              <div className="rounded-2xl bg-sky-50 p-3"><p className="text-2xl font-black text-sky-600">6</p><p className="text-xs font-bold text-slate-500">printable packets</p></div>
              <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-2xl font-black text-emerald-600">0</p><p className="text-xs font-bold text-slate-500">schedule conflicts</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.20),transparent_34%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.22),transparent_30%),linear-gradient(180deg,#ffffff,rgba(248,250,252,0))]" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-lg shadow-sm">🏕️</span>
          <span className="text-lg font-black tracking-tight text-slate-950">Camp Creator Pro</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <a href="#features" className="hidden rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-900 sm:inline-block">Features</a>
          <a href="#pricing" className="hidden rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-900 sm:inline-block">Pricing</a>
          <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-900">Log in</Link>
          <Link href="/signup" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">Start Free</Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-4 py-2 text-sm font-black text-indigo-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            14-day free trial • no credit card required
          </div>
          <h1 className="max-w-4xl text-5xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
            Run camp registration, schedules, and check-in from one calm command center.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
            Camp Creator Pro replaces the spreadsheet circus with family registration, class choices, conflict-safe scheduling, rosters, badges, pickup cards, and payment options built for real camp operations.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="rounded-2xl bg-gradient-to-r from-indigo-500 to-sky-500 px-7 py-4 text-center text-base font-black text-white shadow-xl shadow-indigo-200 transition hover:-translate-y-1">Start Free Trial</Link>
            <a href="#pricing" className="rounded-2xl border border-slate-200 bg-white px-7 py-4 text-center text-base font-black text-slate-700 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">See pricing</a>
          </div>
          <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
                <p className="text-2xl font-black text-slate-950">{stat.value}</p>
                <p className="mt-1 text-xs font-bold leading-tight text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        <ProductMockup />
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-indigo-500">Everything in one place</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Built for the week when everything usually catches fire.</h2>
          <p className="mt-4 text-slate-600">Keep setup, registration, schedules, check-in, and printed materials connected instead of spread across ten tabs and one heroic clipboard.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
        </div>
      </section>

      <section id="pricing" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-indigo-500">Pricing</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Start free. Pick the model when you’re ready.</h2>
          </div>
          <p className="max-w-2xl text-slate-600">Use the full setup workflow first. When you open real registration, choose whether the camp pays the yearly subscription or families pay through registration with a transparent platform fee.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <PricingCard eyebrow="Free trial" title="Try it first" price="$0" desc="Build your camp before you commit. No credit card required to get started.">
            <Check>Create age groups, rooms, teachers, activities, time slots, and schedules.</Check>
            <Check>Preview registration forms and test your workflow.</Check>
            <Check>Upgrade only when you are ready to collect real registrations or payments.</Check>
          </PricingCard>
          <PricingCard eyebrow="Best for camp budgets" title="Camp pays" price="$299/year" desc="Your organization pays once per year. Families register without a platform fee added at checkout." highlighted>
            <Check>One annual platform subscription for the camp.</Check>
            <Check>Best for free camps, already-paid registrations, or the cleanest family experience.</Check>
            <Check>Registration can still collect camper info, class choices, emergency info, and confirmations.</Check>
          </PricingCard>
          <PricingCard eyebrow="Best for paid camps" title="Camper pays" price="Your price + fee" desc="Set your camper registration price. Families pay that amount plus the platform fee during checkout.">
            <Check>You choose the camp price per camper in Settings.</Check>
            <Check>Platform fee is 3%, with a $2 minimum and $25 maximum.</Check>
            <Check>Family registration, coupons, and confirmation emails are supported.</Check>
          </PricingCard>
        </div>
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-3">
            <div className="rounded-2xl bg-indigo-50 p-4"><strong className="text-slate-950">1. Set camp price</strong><br />Example: you charge $100 per camper.</div>
            <div className="rounded-2xl bg-sky-50 p-4"><strong className="text-slate-950">2. Add platform fee</strong><br />3% would be $3, so the family pays $103.</div>
            <div className="rounded-2xl bg-emerald-50 p-4"><strong className="text-slate-950">3. Fee guardrails</strong><br />The fee is never below $2 and never above $25.</div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20 text-center">
        <div className="rounded-[2rem] bg-gradient-to-r from-indigo-500 to-sky-500 p-10 text-white shadow-2xl shadow-indigo-200">
          <h2 className="text-4xl font-black tracking-tight">Ready to launch your camp without the spreadsheet circus?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/85">Start free, build the whole camp, and choose your pricing model when you are ready.</p>
          <Link href="/signup" className="mt-8 inline-block rounded-2xl bg-white px-8 py-4 text-base font-black text-indigo-600 shadow-lg transition hover:-translate-y-1">Start Free Trial</Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-slate-200 bg-white px-6 py-8 text-center text-sm font-semibold text-slate-500">
        <p>Camp Creator Pro — Built for camp directors, volunteers, and the blessed souls who used to own the spreadsheet.</p>
      </footer>
    </div>
  );
}
