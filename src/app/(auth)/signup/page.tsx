"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Load GIS script for Google button
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    if (document.querySelector('script[src*="accounts.google.com/gsi"]')) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  const handleGoogleSignUp = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError("Google sign-up is not configured yet");
      return;
    }
    setLoading(true);
    setError("");
    const client = window.google?.accounts?.oauth2.initTokenClient({
      client_id: clientId,
      callback: async (response: { credential: string; error?: string }) => {
        if (response.error) {
          setError("Google sign-up failed. Please try again.");
          setLoading(false);
          return;
        }
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
            setError(data.error || "Google sign-up failed");
          }
        } catch {
          setError("Something went wrong. Please try again.");
        } finally {
          setLoading(false);
        }
      },
      scope: "openid email profile",
    });
    client?.requestAccessToken();
  };

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
        window.location.href = "/dashboard";
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
    <div className="min-h-screen bg-night-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-4xl mb-4 block">🏕️</span>
          <h1 className="font-heading font-bold text-2xl text-cream mb-2">Create your account</h1>
          <p className="text-muted">Start managing your camp today</p>
        </div>

        {/* Google Sign Up Button */}
        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignUp}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-night-700 border border-night-500 rounded-xl text-cream text-sm font-medium hover:bg-night-600 transition-colors disabled:opacity-50 mb-6"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign up with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-night-600" />
          <span className="text-muted text-xs">or sign up with email</span>
          <div className="flex-1 h-px bg-night-600" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-error/10 border border-error/30 text-error text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-muted mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-night-800 border border-night-500 rounded-xl text-cream text-sm placeholder:text-muted/40 focus:border-ember-500 focus:outline-none"
              placeholder="Your name"
            />
          </div>

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
              minLength={6}
              className="w-full px-4 py-2.5 bg-night-800 border border-night-500 rounded-xl text-cream text-sm placeholder:text-muted/40 focus:border-ember-500 focus:outline-none"
              placeholder="Min 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-ember-500 to-gold-500 text-night-900 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-ember-400 hover:text-ember-300 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
