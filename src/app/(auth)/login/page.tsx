"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { SSPLogo } from "@/components/SSPLogo";

export default function LoginPage() {
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const googleBtnRef  = useRef<HTMLDivElement>(null);

  // ── Load GIS and render the real Google Sign-In button ──────────────────
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const handleCredential = async (response: { credential: string }) => {
      if (!response.credential) {
        setError("Google sign-in failed — no credential returned.");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        });
        if (res.ok) {
          window.location.href = "/dashboard";
        } else {
          const data = await res.json();
          setError(data.error || "Google sign-in failed");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        ux_mode: "popup",
      });
      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          width: googleBtnRef.current.offsetWidth || 400,
          text: "continue_with",
          shape: "rectangular",
        });
      }
    };

    // If script already loaded (e.g. hot reload)
    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const data = await res.json();
        setError(data.error || "Sign in failed");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-night-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="mb-4 block"><SSPLogo size={48} /></span>
          <h1 className="font-heading font-bold text-2xl text-cream mb-2">Welcome back</h1>
          <p className="text-muted">Sign in to your Simple Schedule Pro account</p>
        </div>

        {/* Google Sign-In button — rendered by GIS SDK */}
        <div
          ref={googleBtnRef}
          className="w-full mb-6 flex items-center justify-center min-h-[44px]"
        />

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-night-600" />
          <span className="text-muted text-xs">or sign in with email</span>
          <div className="flex-1 h-px bg-night-600" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-error/10 border border-error/30 text-error text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-muted mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-night-800 border border-night-500 rounded-xl text-cream text-sm placeholder:text-muted/40 focus:border-ember-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-night-800 border border-night-500 rounded-xl text-cream text-sm placeholder:text-muted/40 focus:border-ember-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-ember-400 hover:text-ember-300 underline">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}
