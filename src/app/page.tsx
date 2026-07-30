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
  { icon: "family", title: "Family Registration", desc: "One guardian registers every child, chooses classes, and pays once." },
  { icon: "calendar", title: "Schedule Builder", desc: "Keep rooms, teachers, time blocks, capacity, and conflicts in one schedule." },
  { icon: "activity", title: "Activity Catalog", desc: "Create classes by age group, location, teacher, limit, and time block." },
  { icon: "check", title: "Check in/out", desc: "Find families by QR code or name and keep pickup clear for every volunteer." },
  { icon: "print", title: "Print Center", desc: "Print rosters, teacher packets, badges, pickup cards, and QR schedules." },
  { icon: "payment", title: "Payments", desc: "Let your event or the registering family cover the transparent platform fee." },
] as const;

const audiences = [
  { title: "VBS & Church Programs", caption: "Craft rotations, age groups, volunteers, and pickup in one plan.", image: "/images/audiences/vbs-crafts.jpg", alt: "Child making a paper craft with adults at a workshop table", credit: "MIKI Yoshihito · CC BY 2.0", creditHref: "https://commons.wikimedia.org/wiki/File:SAKURAKO_attended_a_workshop._(8707727596).jpg" },
  { title: "Summer & Day Camps", caption: "Keep active groups moving safely from one block to the next.", image: "/images/audiences/camps-game.jpg", alt: "Children and adult leaders playing a cooperative parachute game outdoors", credit: "U.S. Marine Corps · Public domain", creditHref: "https://commons.wikimedia.org/wiki/File:USMC-100401-M-5728E-055.jpg" },
  { title: "Homeschool Co-ops", caption: "Make class choices and shared-room schedules easy for every family.", image: "/images/audiences/homeschool-coops.jpg", alt: "Students learning together around classroom tables", credit: "Unsplash", creditHref: "https://unsplash.com/license" },
  { title: "Conferences & Workshops", caption: "Coordinate sessions, rooms, leaders, attendance, and printed packets.", image: "/images/audiences/conferences.jpg", alt: "Large workshop audience watching a presenter on stage", credit: "Unsplash", creditHref: "https://unsplash.com/license" },
  { title: "Small Groups & Classes", caption: "Give every facilitator and participant one clear place to be.", image: "/images/audiences/small-groups.jpg", alt: "Adults discussing a project together around a table", credit: "Unsplash", creditHref: "https://unsplash.com/license" },
] as const;

const sampleBlocks: GridBlock[] = [
  { id: "sample-1", label: "Time Block 1", startTime: "09:00", endTime: "09:40" },
  { id: "sample-2", label: "Time Block 2", startTime: "09:45", endTime: "10:25" },
  { id: "sample-3", label: "Time Block 3", startTime: "10:30", endTime: "11:10" },
  { id: "sample-4", label: "Time Block 4", startTime: "11:15", endTime: "11:55" },
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

function FeatureIcon({ name }: { name: (typeof features)[number]["icon"] }) {
  const paths = {
    family: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18M8 15h.01M12 15h.01M16 15h.01" /></>,
    activity: <><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="9" /><path d="m8 8 8 8M16 8l-8 8" /></>,
    check: <><path d="M20 6 9 17l-5-5" /><path d="M21 12a9 9 0 1 1-5.3-8.2" /></>,
    print: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="7" /></>,
    payment: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h2" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">{paths[name]}</svg>;
}

function FeatureCard({ icon, title, desc }: (typeof features)[number]) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-white shadow-sm"><FeatureIcon name={icon} /></div>
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
          <Link href="/signup" className="rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--brand-primary-hover)] hover:shadow-lg">Start Free</Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-24">
        <div>
          <h1 className="max-w-4xl text-[clamp(2.75rem,5vw,3.5rem)] font-bold leading-[1.02] tracking-[-0.032em] text-slate-950">
            Registration, scheduling, and check-in — finally in one place.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
            Simple Schedule Pro gives youth events, workshops, leagues, and classes a single command center for family sign-ups, class choices, conflict-safe schedules, rosters, badges, pickup cards, and payments — no spreadsheet required.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="rounded-xl bg-[var(--brand-primary)] px-7 py-4 text-center text-base font-extrabold text-white shadow-xl shadow-slate-200 transition hover:-translate-y-1 hover:bg-[var(--brand-primary-hover)]">Start Free Trial</Link>
            <Link href="/sample" className="rounded-2xl border border-slate-200 bg-transparent px-7 py-4 text-center text-base font-extrabold text-slate-700 transition hover:border-slate-300 hover:bg-white">Try it with sample data</Link>
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

      <section aria-labelledby="comparison-heading" className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[var(--brand-ink)]">See the difference</p>
          <h2 id="comparison-heading" className="mt-3 text-4xl font-extrabold tracking-tight text-slate-950">Your spreadsheet was never built for this.</h2>
          <p className="mt-4 text-slate-600">The same morning schedule: one version needs decoding, the other shows the answer.</p>
        </div>
        <div className="mt-10 grid items-start gap-6 xl:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm" aria-labelledby="spreadsheet-heading">
            <div className="border-b border-slate-200 bg-slate-100 px-4 py-3">
              <h3 id="spreadsheet-heading" className="font-extrabold text-slate-900">Spreadsheet</h3>
              <p className="text-sm text-slate-600">Narrow columns, duplicate labels, and one conflict hiding in plain sight.</p>
            </div>
            <div className="overflow-x-auto p-3">
              <table className="min-w-[620px] border-collapse text-[11px] text-slate-700">
                <thead><tr>{["Group", "9:00", "9:45", "10:30", "11:15", "Room", "Leader"].map(label => <th key={label} className="border border-slate-300 bg-slate-100 px-2 py-2 text-left font-bold">{label}</th>)}</tr></thead>
                <tbody>
                  <tr><td className="border border-slate-300 px-2 py-2">Younger</td><td className="border border-slate-300 px-2 py-2">Art</td><td className="border border-slate-300 px-2 py-2">Music</td><td className="border border-slate-300 px-2 py-2">Art</td><td className="border border-slate-300 px-2 py-2">Games</td><td className="border border-slate-300 px-2 py-2">101</td><td className="border border-slate-300 px-2 py-2">Jamie</td></tr>
                  <tr><td className="border border-slate-300 px-2 py-2">Older</td><td className="border border-slate-300 px-2 py-2">Lab</td><td className="border border-slate-300 bg-red-100 px-2 py-2 font-bold text-red-800">Games — Field?</td><td className="border border-slate-300 px-2 py-2">Music</td><td className="border border-slate-300 px-2 py-2">Lab</td><td className="border border-slate-300 bg-red-100 px-2 py-2 font-bold text-red-800">101 / Field</td><td className="border border-slate-300 px-2 py-2">Jamie</td></tr>
                  <tr><td className="border border-slate-300 px-2 py-2">Older B</td><td className="border border-slate-300 px-2 py-2">Lab</td><td className="border border-slate-300 px-2 py-2">Games</td><td className="border border-slate-300 px-2 py-2">Music</td><td className="border border-slate-300 px-2 py-2">Lab</td><td className="border border-slate-300 px-2 py-2">Lab</td><td className="border border-slate-300 px-2 py-2">J. Smith</td></tr>
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">Which room is double-booked? Time to compare cells.</p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm" aria-labelledby="ssp-comparison-heading">
            <div className="mb-4">
              <h3 id="ssp-comparison-heading" className="font-extrabold text-slate-900">Simple Schedule Pro</h3>
              <p className="text-sm text-slate-600">Activities, time blocks, enrollment, rooms, and conflicts in one shared view.</p>
            </div>
            <OperationsGrid courses={sampleCourses} blocks={sampleBlocks} ageGroups={sampleAgeGroups} />
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">No room conflict. Every activity has one clear place.</p>
          </article>
        </div>
      </section>

      <section aria-labelledby="real-programs-heading" className="relative z-10 mx-auto max-w-7xl px-6 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-sky-600">Made for real programs</p>
          <h2 id="real-programs-heading" className="mt-3 text-4xl font-extrabold tracking-tight text-slate-950">One clear operating plan, whatever you organize.</h2>
          <p className="mt-4 text-slate-600">Simple Schedule Pro fits recurring classes and high-energy event days without forcing either one into a spreadsheet-shaped box.</p>
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {audiences.map(audience => (
            <article key={audience.title} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <Image src={audience.image} alt={audience.alt} width={640} height={420} sizes="(min-width: 1024px) 20vw, (min-width: 640px) 50vw, 100vw" className="aspect-[4/3] w-full bg-[var(--canvas-sunk)] object-cover transition duration-300 group-hover:scale-[1.02]" />
              <div className="p-4">
                <h3 className="font-extrabold text-slate-950">{audience.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{audience.caption}</p>
                <a href={audience.creditHref} target="_blank" rel="noreferrer" className="mt-3 block text-[10px] font-semibold text-slate-500 underline decoration-slate-300 underline-offset-2">Photo: {audience.credit}</a>
              </div>
            </article>
          ))}
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
            <button type="button" aria-pressed={billingPeriod === "annual"} onClick={() => setBillingPeriod("annual")} className={`rounded-xl px-4 py-2 text-sm font-extrabold transition ${billingPeriod === "annual" ? "bg-[var(--brand-primary)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--canvas-sunk)]"}`}>Annual <span className={billingPeriod === "annual" ? "text-white/80" : "text-[var(--accent)]"}>· Save 2 months</span></button>
            <button type="button" aria-pressed={billingPeriod === "monthly"} onClick={() => setBillingPeriod("monthly")} className={`rounded-xl px-4 py-2 text-sm font-extrabold transition ${billingPeriod === "monthly" ? "bg-[var(--brand-primary)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--canvas-sunk)]"}`}>Monthly</button>
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
        <div className="rounded-xl bg-[var(--brand-primary)] p-10 text-white shadow-2xl shadow-slate-200">
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
