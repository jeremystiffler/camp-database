"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { SSPLogo } from "@/components/SSPLogo";

export default function SignupPage() {
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const getSafeNext = () => {
    if (typeof window === "undefined") return "/dashboard";
    const next = new URLSearchParams(window.location.search).get("next") || "/dashboard";
    return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  };

  const [inviteNext, setInviteNext] = useState("");

  useEffect(() => {
    setInviteNext(new URLSearchParams(window.location.search).get("next") || "");
  }, []);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const handleCredential = async (response: { credential: string }) => {
      if (!response.credential) {
        setError("Google sign-up failed — no credential returned.");
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
          window.location.href = getSafeNext();
        } else {
          const data = await res.json();
          setError(data.error || "Google sign-up failed");
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
          text: "signup_with",
          shape: "rectangular",
        });
      }
    };

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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (res.ok) {
        window.location.href = getSafeNext();
      } else {
        const data = await res.json();
        setError(data.error || "Sign up failed");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,.28),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,.18),transparent_38%),linear-gradient(135deg,#eff6ff,#f8fbff)] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-blue-100 bg-white/95 p-8 shadow-2xl shadow-blue-200/60 backdrop-blur">
        <div className="text-center mb-8">
          <span className="mb-4 block"><SSPLogo size={48} /></span>
          <h1 className="font-heading font-bold text-2xl text-slate-950 mb-2">Create your account</h1>
          <p className="text-slate-600">Start managing your event today</p>
          {inviteNext?.startsWith("/invite/") && (
            <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
              Create your account, then we’ll bring you back to accept the invitation.
            </p>
          )}
        </div>

        {/* Google Sign-Up button — rendered by GIS SDK */}
        <div
          ref={googleBtnRef}
          className="w-full mb-6 flex items-center justify-center min-h-[44px]"
        />

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-blue-100" />
          <span className="text-slate-500 text-xs">or sign up with email</span>
          <div className="flex-1 h-px bg-blue-100" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-error/10 border border-error/30 text-error text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
              placeholder="Min 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-slate-600 text-sm mt-6">
          Already have an account?{" "}
          <Link href={inviteNext ? `/login?next=${encodeURIComponent(inviteNext)}` : "/login"} className="font-semibold text-blue-600 hover:text-blue-700 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
