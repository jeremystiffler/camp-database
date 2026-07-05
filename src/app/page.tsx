"use client";

import Link from "next/link";

const particles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: `${(i * 37) % 100}%`,
  delay: `${(i * 0.43) % 8}s`,
  duration: `${7 + (i % 6)}s`,
  size: `${2 + (i % 4)}px`,
}));

function EmberParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="ember-particle"
          style={{
            left: p.left,
            bottom: "-10px",
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

function FeatureCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="glass-card rounded-2xl p-6 hover:border-ember-500/20 transition-all duration-300 group">
      <div className="flex items-start gap-4">
        <span className="text-3xl font-heading font-bold text-ember-500/40 group-hover:text-ember-500/70 transition-colors">
          {num}
        </span>
        <div>
          <h3 className="font-heading font-semibold text-lg text-cream mb-1">{title}</h3>
          <p className="text-muted text-sm leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function PricingCard({
  badge,
  title,
  price,
  subtitle,
  children,
  highlighted = false,
}: {
  badge: string;
  title: string;
  price: string;
  subtitle: string;
  children: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div className={`rounded-3xl p-7 ${highlighted ? "bg-gradient-to-b from-ember-500/20 to-night-800 border border-ember-500/40 ember-glow" : "glass-card"}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="font-heading text-2xl font-bold text-cream">{title}</h3>
        <span className="rounded-full border border-ember-500/30 bg-ember-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ember-300">{badge}</span>
      </div>
      <p className="font-heading text-4xl font-black text-cream">{price}</p>
      <p className="mt-2 min-h-12 text-sm leading-relaxed text-muted">{subtitle}</p>
      <div className="mt-6 space-y-3 text-sm text-muted">{children}</div>
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 leading-relaxed"><span className="text-success">✓</span><span>{children}</span></p>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-night-900 relative">
      <EmberParticles />

      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏕️</span>
          <span className="font-heading font-bold text-xl text-cream">Camp Creator Pro</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="#pricing" className="hidden px-4 py-2 text-sm text-muted hover:text-cream transition-colors sm:inline-block">Pricing</a>
          <Link href="/login" className="px-4 py-2 text-sm text-muted hover:text-cream transition-colors">Log in</Link>
          <Link href="/signup" className="px-5 py-2 text-sm font-medium bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl hover:opacity-90 transition-opacity">Start Free Trial</Link>
        </div>
      </nav>

      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ember-500/10 border border-ember-500/20 text-ember-400 text-sm mb-8">
          <span className="w-2 h-2 rounded-full bg-ember-500 animate-pulse" />
          Free trial • no credit card required • built for real camp operations
        </div>
        <h1 className="font-heading font-bold text-5xl md:text-7xl text-cream mb-6 leading-tight">
          Run your camp
          <br />
          <span className="bg-gradient-to-r from-ember-500 to-gold-500 bg-clip-text text-transparent">without the spreadsheet circus</span>
        </h1>
        <p className="text-muted text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed">
          Registrations, family signups, activity scheduling, camper management, assignments, rosters, name tags, and payment collection — one calm command center for the week where everything usually catches fire.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/signup" className="px-8 py-3.5 text-base font-semibold bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl ember-glow transition-all hover:scale-105">Start Free Trial</Link>
          <a href="#pricing" className="px-8 py-3.5 text-base font-medium text-cream border border-night-500 rounded-xl hover:border-ember-500/50 transition-colors">See pricing</a>
        </div>
      </section>

      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: "14", label: "day free trial" },
            { value: "$299", label: "camp-paid yearly plan" },
            { value: "3%", label: "camper-paid platform fee" },
            { value: "$25", label: "max platform fee" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-2xl p-6 text-center">
              <div className="font-heading font-bold text-3xl text-ember-500 mb-1">{stat.value}</div>
              <div className="text-muted text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <h2 className="font-heading font-bold text-3xl text-cream text-center mb-12">Everything you need</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <FeatureCard num="01" title="Family Registration" desc="One guardian can register multiple students, choose age groups/classes per camper, and pay once." />
          <FeatureCard num="02" title="Schedule Builder" desc="Rooms, teachers, time slots, required blocks, capacity limits, and conflict checks stay tied together." />
          <FeatureCard num="03" title="Activity Catalog" desc="Create classes by age group, location, teacher, capacity, and schedule block without duct-taping spreadsheets." />
          <FeatureCard num="04" title="Camper Operations" desc="Manage campers, enrollments, rosters, public forms, confirmation emails, and print-ready materials." />
          <FeatureCard num="05" title="Team Access" desc="Invite admins, editors, and viewers so your whole team can work without sharing one sacred password scroll." />
          <FeatureCard num="06" title="Stripe Payments" desc="Choose whether your camp pays the platform or families cover registration plus the platform fee at checkout." />
        </div>
      </section>

      <section id="pricing" className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="mb-10 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-ember-400">Pricing</p>
          <h2 className="mt-3 font-heading text-4xl font-black text-cream">Simple pricing, two ways to run it</h2>
          <p className="mx-auto mt-4 max-w-3xl text-muted leading-relaxed">
            Start with a free trial. When you are ready to open registration, pick the model that fits your camp: the camp pays one yearly subscription, or families pay through registration with a transparent platform fee.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <PricingCard badge="Free trial" title="Try it first" price="$0" subtitle="Build your camp before you commit. No credit card required to get started.">
            <Check>Use the setup wizard, create age groups, rooms, teachers, activities, time slots, and schedules.</Check>
            <Check>Preview registration forms and test your operational workflow.</Check>
            <Check>Upgrade when you are ready to collect real registrations or payments.</Check>
          </PricingCard>

          <PricingCard badge="Best for camp budgets" title="Camp pays" price="$299/year" subtitle="Your organization pays once per year. Families register without a platform fee added at checkout." highlighted>
            <Check>One annual platform subscription for the camp.</Check>
            <Check>Great when registration is free, already paid elsewhere, or you want the cleanest family experience.</Check>
            <Check>Registration pages can still collect camper information, class choices, emergency info, and confirmations.</Check>
          </PricingCard>

          <PricingCard badge="Best for paid camps" title="Camper pays" price="Your price + fee" subtitle="Set your camper registration price. Families pay that amount plus the platform fee during checkout.">
            <Check>You choose the camp price per camper in Settings.</Check>
            <Check>Platform fee is 3% of the registration price, with a $2 minimum and $25 maximum.</Check>
            <Check>Works with family registration: totals multiply by student count, then coupons and fees are calculated.</Check>
          </PricingCard>
        </div>

        <div className="mt-6 rounded-3xl border border-night-600 bg-night-800/70 p-6">
          <h3 className="font-heading text-xl font-bold text-cream">How camper-paid checkout works</h3>
          <div className="mt-4 grid gap-4 text-sm text-muted md:grid-cols-3">
            <div className="rounded-2xl bg-night-900/60 p-4"><strong className="text-cream">1. Set camp price</strong><br />Example: you charge $100 per camper.</div>
            <div className="rounded-2xl bg-night-900/60 p-4"><strong className="text-cream">2. Add platform fee</strong><br />3% would be $3, so the family pays $103.</div>
            <div className="rounded-2xl bg-night-900/60 p-4"><strong className="text-cream">3. Fee guardrails</strong><br />The fee is never below $2 and never above $25.</div>
          </div>
          <p className="mt-4 text-sm text-muted">
            Coupons are supported too: percent, fixed amount, free registration, BOGO-style discounts, and guardian-email restricted codes. Confirmation emails can include guardian info, student details, classes, emergency data, and payment summary.
          </p>
        </div>
      </section>

      <section className="relative z-10 max-w-3xl mx-auto px-6 pb-32 text-center">
        <div className="glass-card rounded-3xl p-12 border-ember-500/20">
          <h2 className="font-heading font-bold text-3xl text-cream mb-4">Ready to launch your camp?</h2>
          <p className="text-muted mb-8">Start free, build the whole camp, and choose your pricing model when you are ready.</p>
          <Link href="/signup" className="inline-block px-8 py-3.5 text-base font-semibold bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl ember-glow transition-all hover:scale-105">Start Free Trial</Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-night-700 py-8 text-center text-muted text-sm">
        <p>Camp Creator Pro — Built with 🔥 for camp directors, volunteers, and the blessed souls who used to own the spreadsheet.</p>
      </footer>
    </div>
  );
}
