"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { SSPLogo } from "@/components/SSPLogo";
import { OperationsGrid, type GridAgeGroup, type GridBlock, type GridCourse } from "@/components/OperationsGrid";

const pricingPlans = [
  {
    eyebrow: "Starter",
    title: "Starter",
    monthly: "$29",
    annual: "$299",
    desc: "For one active event at a time.",
    checks: [
      "1 active event",
      "Unlimited participants",
      "1 location",
      "3 team members",
      "Every feature included",
    ],
  },
  {
    eyebrow: "Most popular",
    title: "Standard",
    monthly: "$79",
    annual: "$799",
    desc: "For organizations running several events.",
    highlighted: true,
    checks: [
      "5 active events",
      "Unlimited participants",
      "1 location",
      "10 team members",
      "Every feature included",
    ],
  },
  {
    eyebrow: "Unlimited",
    title: "Unlimited",
    monthly: "$149",
    annual: "$1,499",
    desc: "For multi-site organizations without limits.",
    checks: [
      "Unlimited active events",
      "Unlimited participants",
      "Multiple locations",
      "Unlimited team members",
      "Every feature included",
    ],
  },
];

const features = [
  { icon: "👨‍👩‍👧‍👦", title: "Family Registration", desc: "One guardian can register multiple students, choose age groups and classes per participant, and pay once." },
  { icon: "🗓️", title: "Schedule Builder", desc: "Rooms, teachers, time blocks, required blocks, capacity limits, and conflict checks stay tied together." },
  { icon: "🎨", title: "Activity Catalog", desc: "Build classes by age group, location, teacher, capacity, and schedule block without duct-taping spreadsheets." },
  { icon: "✅", title: "Check in/out", desc: "Run day-of operations with QR/name lookup, family pickup numbers, and staff-friendly attendance state." },
  { icon: "🖨️", title: "Print Center", desc: "Generate rosters, teacher packets, participant class choices, pickup cards, and QR schedule lanyards." },
  { icon: "💳", title: "Payments", desc: "Choose whether your event pays the platform or families pay registration plus a transparent platform fee." },
];

const sampleBlocks: GridBlock[] = [
  { id: "sample-1", label: "Period 1", startTime: "09:00", endTime: "09:40" },
  { id: "sample-2", label: "Period 2", startTime: "09:45", endTime: "10:25" },
  { id: "sample-3", label: "Period 3", startTime: "10:30", endTime: "11:10" },
  { id: "sample-4", label: "Period 4", startTime: "11:15", endTime: "11:55" },
];

const sampleAgeGroups: GridAgeGroup[] = [
  { id: "younger", name: "Younger", color: "#2F6FB8" },
  { id: "older", name: "Older", color: "#A75836" },
];

const sampleCourses: GridCourse[] = [
  { id: "craft", name: "Creative Studio", cap: 16, color: "#2F6FB8", ageGroupId: "younger", room: { id: "art", name: "Art room", capacity: 18 }, sessions: [{ id: "craft-1", sessionTemplateId: "sample-1", enrolledCount: 12 }] },
  { id: "games", name: "Outdoor Games", cap: 20, color: "#A75836", ageGroupId: "older", room: { id: "field", name: "Field", capacity: 30 }, sessions: [{ id: "games-2", sessionTemplateId: "sample-2", enrolledCount: 18 }] },
  { id: "music", name: "Music Lab", cap: 14, color: "#6C5AA8", ageGroupId: "younger", room: { id: "music", name: "Music room", capacity: 16 }, sessions: [{ id: "music-3", sessionTemplateId: "sample-3", enrolledCount: 10 }] },
  { id: "science", name: "Discovery Lab", cap: 12, color: "#347A65", ageGroupId: "older", room: { id: "lab", name: "Lab", capacity: 12 }, sessions: [{ id: "science-4", sessionTemplateId: "sample-4", enrolledCount: 12 }] },
];

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-xl shadow-sm">{icon}</div>
      <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
    </div>
  );
}

function PricingCard({
  eyebrow,
  title,
  monthly,
  annual,
  billingPeriod,
  desc,
  children,
  highlighted = false,
}: {
  eyebrow: string;
  title: string;
  monthly: string;
  annual: string;
  billingPeriod: "annual" | "monthly";
  desc: string;
  children: React.ReactNode;
  highlighted?: boolean;
}) {
  const annualBilling = billingPeriod === "annual";
  return (
    <div className={`relative rounded-3xl bg-white p-7 shadow-sm ${highlighted ? "border-2 border-[var(--brand-strong)]" : "border border-[var(--border)]"}`}>
      {highlighted ? <span className="absolute right-5 top-5 rounded-full bg-[var(--brand-wash)] px-3 py-1 text-xs font-extrabold text-[var(--brand-ink)]">Most popular</span> : null}
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--brand-ink)]">{eyebrow}</p>
      <h3 className="mt-3 text-2xl font-extrabold text-slate-900">{title}</h3>
      <div className="mt-4 flex items-baseline gap-1">
        <p className="t-stat text-slate-950">{annualBilling ? annual : monthly}</p>
        <p className="t-small text-[var(--text-muted)]">/{annualBilling ? "yr" : "mo"}</p>
      </div>
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
    <div className="relative mx-auto min-w-0 max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-3 shadow-2xl shadow-indigo-100/70">
      <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="inline-flex rounded-md bg-[var(--brand-wash)] px-1.5 py-0.5 text-xs font-extrabold uppercase tracking-wide text-[var(--brand-ink)]">Live sample event</p>
            <h3 className="text-lg font-extrabold text-slate-900">Activity × time grid</h3>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-700">Real product grid</span>
        </div>
        <OperationsGrid courses={sampleCourses} blocks={sampleBlocks} ageGroups={sampleAgeGroups} emptyMessage="Sample schedule unavailable." />
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [billingPeriod, setBillingPeriod] = useState<"annual" | "monthly">("annual");

  return (
    <div className="min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top_left,rgba(47,111,184,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(127,182,212,0.26),transparent_30%),linear-gradient(180deg,#ffffff,rgba(248,250,252,0))]" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <SSPLogo size={40} />
          <span className="text-lg font-extrabold tracking-tight text-slate-950">Simple Schedule Pro</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <a href="#features" className="hidden rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-900 sm:inline-block">Features</a>
          <a href="#pricing" className="hidden rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-900 sm:inline-block">Pricing</a>
          <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-900">Log in</Link>
          <Link href="/signup" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">Start Free</Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-4 py-2 text-sm font-extrabold text-indigo-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            14-day free trial • no credit card required
          </div>
          <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
            Registration, scheduling, and check-in — finally in one place.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
            Simple Schedule Pro gives youth events, workshops, leagues, and classes a single command center for family sign-ups, class choices, conflict-safe schedules, rosters, badges, pickup cards, and payments — no spreadsheet required.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="rounded-2xl bg-[var(--info)] px-7 py-4 text-center text-base font-extrabold text-white shadow-xl shadow-indigo-200 transition hover:-translate-y-1">Start Free Trial</Link>
            <a href="#pricing" className="rounded-2xl border border-slate-200 bg-transparent px-7 py-4 text-center text-base font-extrabold text-slate-700 transition hover:border-slate-300 hover:bg-white">See pricing</a>
          </div>
        </div>
        <ProductMockup />
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-indigo-500">Everything in one place</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-950">Built for the week when everything usually catches fire.</h2>
          <p className="mt-4 text-slate-600">Keep setup, registration, schedules, check-in, and printed materials connected instead of spread across ten tabs and one heroic clipboard.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
        </div>
      </section>

      <section aria-labelledby="real-programs-heading" className="relative z-10 mx-auto max-w-7xl px-6 py-10">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="grid md:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-center p-8 lg:p-12">
              <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-sky-600">Made for real people</p>
              <h2 id="real-programs-heading" className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Less time wrestling spreadsheets. More time running the day.</h2>
              <p className="mt-4 leading-7 text-slate-600">From the first welcome to the final pickup, your team gets one clear schedule and families get a smoother experience.</p>
            </div>
            <div className="grid min-h-80 grid-cols-2 gap-2 bg-[var(--canvas-sunk)] p-2">
              <Image src="https://images.unsplash.com/photo-1472162072942-cd5147eb3902?auto=format&fit=crop&w=900&q=82" alt="Child enjoying a story during an outdoor program" width={900} height={675} sizes="(min-width: 768px) 36vw, 50vw" className="h-full min-h-80 w-full rounded-2xl bg-[var(--canvas-sunk)] object-cover" />
              <div className="grid gap-2">
                <Image src="https://images.unsplash.com/photo-1504151932400-72d4384f04b3?auto=format&fit=crop&w=700&q=82" alt="Parent reading with a young child" width={700} height={525} sizes="(min-width: 768px) 28vw, 50vw" className="h-full min-h-0 w-full rounded-2xl bg-[var(--canvas-sunk)] object-cover" />
                <Image src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=700&q=82" alt="Friends gathered together outdoors" width={700} height={525} sizes="(min-width: 768px) 28vw, 50vw" className="h-full min-h-0 w-full rounded-2xl bg-[var(--canvas-sunk)] object-cover" />
              </div>
            </div>
          </div>
          <p className="px-5 py-2 text-right text-[10px] font-semibold text-slate-500">Photography via <a href="https://unsplash.com/license" target="_blank" rel="noreferrer" className="underline">Unsplash</a></p>
        </div>
      </section>

      <section id="pricing" className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-indigo-500">Pricing</p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-950">Simple pricing for events just getting started — and ready to grow.</h2>
          </div>
          <p className="max-w-2xl text-slate-600">Choose the number of active events your organization needs. Participants are unlimited and every operational feature is included on every plan.</p>
        </div>
        <div className="mb-7 flex flex-col items-center gap-3">
          <div className="inline-flex rounded-2xl border border-[var(--border)] bg-white p-1 shadow-sm" role="group" aria-label="Billing period">
            <button type="button" aria-pressed={billingPeriod === "annual"} onClick={() => setBillingPeriod("annual")} className={`rounded-xl px-4 py-2 text-sm font-extrabold transition ${billingPeriod === "annual" ? "bg-[var(--brand-strong)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--canvas-sunk)]"}`}>Annual <span className={billingPeriod === "annual" ? "text-white/80" : "text-[var(--brand-ink)]"}>· Save 2 months</span></button>
            <button type="button" aria-pressed={billingPeriod === "monthly"} onClick={() => setBillingPeriod("monthly")} className={`rounded-xl px-4 py-2 text-sm font-extrabold transition ${billingPeriod === "monthly" ? "bg-[var(--brand-strong)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--canvas-sunk)]"}`}>Monthly</button>
          </div>
          <p className="text-sm font-semibold text-[var(--text-muted)]">14-day free trial · no credit card required</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <PricingCard key={plan.title} eyebrow={plan.eyebrow} title={plan.title} monthly={plan.monthly} annual={plan.annual} billingPeriod={billingPeriod} desc={plan.desc} highlighted={plan.highlighted}>
              {plan.checks.map((check) => <Check key={check}>{check}</Check>)}
            </PricingCard>
          ))}
        </div>
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-2">
            <div className="rounded-2xl bg-sky-50 p-4"><strong className="text-slate-950">3% paid-registration fee</strong><br />Usually passed to registrants. Events can choose to absorb it.</div>
            <div className="rounded-2xl bg-emerald-50 p-4"><strong className="text-slate-950">Free stays free</strong><br />Free registrations and scholarship-only registrations have no platform fee.</div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20 text-center">
        <div className="rounded-[2rem] bg-[var(--info)] p-10 text-white shadow-2xl shadow-indigo-200">
          <h2 className="text-4xl font-extrabold tracking-tight">Ready to run your event without the spreadsheet circus?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/85">Start your 14-day no-card trial today. Build the event, test registration, and invite your team before choosing a plan.</p>
          <Link href="/signup" className="mt-8 inline-block rounded-2xl bg-white px-8 py-4 text-base font-extrabold text-slate-950 shadow-lg transition hover:-translate-y-1">Start Free Trial</Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-slate-200 bg-white px-6 py-8 text-center text-sm font-semibold text-slate-500">
        <p>Simple Schedule Pro — Built for event directors, volunteers, and the blessed souls who used to own the spreadsheet.</p>
      </footer>
    </div>
  );
}
