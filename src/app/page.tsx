"use client";

import Link from "next/link";

function EmberParticles() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 8}s`,
    duration: `${6 + Math.random() * 8}s`,
    size: `${2 + Math.random() * 4}px`,
  }));

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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-night-900 relative">
      <EmberParticles />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏕️</span>
          <span className="font-heading font-bold text-xl text-cream">Camp Creator</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm text-muted hover:text-cream transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2 text-sm font-medium bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ember-500/10 border border-ember-500/20 text-ember-400 text-sm mb-8">
          <span className="w-2 h-2 rounded-full bg-ember-500 animate-pulse" />
          Multi-tenant camp management
        </div>
        <h1 className="font-heading font-bold text-5xl md:text-7xl text-cream mb-6 leading-tight">
          Run your camp
          <br />
          <span className="bg-gradient-to-r from-ember-500 to-gold-500 bg-clip-text text-transparent">
            like a pro
          </span>
        </h1>
        <p className="text-muted text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Registrations, activity scheduling, camper management, assignments, and print
          materials — all in one beautiful platform. Built for camp directors who care.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="px-8 py-3.5 text-base font-semibold bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl ember-glow transition-all hover:scale-105"
          >
            Start Free Trial
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 text-base font-medium text-cream border border-night-500 rounded-xl hover:border-ember-500/50 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: "100%", label: "Customizable" },
            { value: "6", label: "Time Slots" },
            { value: "∞", label: "Campers" },
            { value: "5★", label: "Experience" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card rounded-2xl p-6 text-center">
              <div className="font-heading font-bold text-3xl text-ember-500 mb-1">{stat.value}</div>
              <div className="text-muted text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-32">
        <h2 className="font-heading font-bold text-3xl text-cream text-center mb-12">Everything you need</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <FeatureCard num="01" title="Multi-Tenant" desc="Each organization gets its own space. Brand it, manage it, bill it separately." />
          <FeatureCard num="02" title="Smart Registration" desc="Multi-step parent form with activity preferences. Jotform-style, but built in." />
          <FeatureCard num="03" title="Activity Builder" desc="Create activities with time slots, locations, teachers, and capacity limits." />
          <FeatureCard num="04" title="Auto-Assignment" desc="Campers are matched to activities based on preferences. Manual override always available." />
          <FeatureCard num="05" title="Print Center" desc="Generate schedules, rosters, and badges. Customizable per organization." />
          <FeatureCard num="06" title="Stripe Billing" desc="One-time per camp or recurring subscription. Organizations pay, not parents." />
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pb-32 text-center">
        <div className="glass-card rounded-3xl p-12 border-ember-500/20">
          <h2 className="font-heading font-bold text-3xl text-cream mb-4">Ready to launch your camp?</h2>
          <p className="text-muted mb-8">Set up in minutes. No credit card required for trial.</p>
          <Link
            href="/signup"
            className="inline-block px-8 py-3.5 text-base font-semibold bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl ember-glow transition-all hover:scale-105"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-night-700 py-8 text-center text-muted text-sm">
        <p>Camp Creator — Built with 🔥 for camp directors everywhere</p>
      </footer>
    </div>
  );
}
