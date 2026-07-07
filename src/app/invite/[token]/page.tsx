"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface InviteInfo {
  email: string;
  role: string;
  campName: string;
  campColor: string;
  token: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer",
};
const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin:  "Manage team, create & delete programs",
  editor: "Edit all content in this program",
  viewer: "View-only access",
};

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [invite, setInvite]     = useState<InviteInfo | null>(null);
  const [status, setStatus]     = useState<"loading" | "ready" | "accepting" | "done" | "error">("loading");
  const [errMsg, setErrMsg]     = useState("");
  const [name,   setName]       = useState("");
  const [pass,   setPass]       = useState("");
  const [needsSignup, setNeedsSignup] = useState(false);

  useEffect(() => {
    params.then(p => {
      setToken(p.token);
      fetch(`/api/invites/${p.token}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) { setErrMsg(d.error); setStatus("error"); return; }
          setInvite(d);
          setStatus("ready");
        })
        .catch(() => { setErrMsg("Failed to load invite"); setStatus("error"); });
    });
  }, [params]);

  const accept = async () => {
    setStatus("accepting");
    const res = await fetch(`/api/invites/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(needsSignup ? { name, password: pass } : {}),
    });
    const data = await res.json();
    if (data.needsSignup) { setNeedsSignup(true); setStatus("ready"); return; }
    if (data.error) { setErrMsg(data.error); setStatus("error"); return; }
    setStatus("done");
    setTimeout(() => router.push(`/dashboard?campId=${data.campId}`), 1800);
  };

  if (status === "loading") return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (status === "error") return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <span className="text-5xl mb-4 block">⚠️</span>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Invite Unavailable</h1>
        <p className="text-slate-500 text-sm mb-6">{errMsg}</p>
        <Link href={token ? `/login?next=${encodeURIComponent(`/invite/${token}`)}` : "/login"} className="inline-block px-5 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90">
          Go to Login
        </Link>
      </div>
    </div>
  );

  if (status === "done") return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <span className="text-5xl mb-4 block">🎉</span>
        <h1 className="text-xl font-bold text-slate-800 mb-2">You're in!</h1>
        <p className="text-slate-500 text-sm">Taking you to <strong>{invite?.campName}</strong>…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-sky-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-8 py-8 text-center border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-forest-500 to-sky-500 flex items-center justify-center text-white text-3xl mx-auto mb-4 shadow-lg">
            🏕️
          </div>
          <p className="text-slate-500 text-sm mb-1">You've been invited to join</p>
          <h1 className="text-2xl font-bold text-slate-800">{invite?.campName}</h1>
        </div>

        <div className="px-8 py-6 space-y-5">
          {/* Role info */}
          <div className="bg-forest-50 border border-forest-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎭</span>
              <div>
                <p className="text-sm font-bold text-forest-800">{ROLE_LABELS[invite?.role || "editor"]} Access</p>
                <p className="text-xs text-forest-600">{ROLE_DESCRIPTIONS[invite?.role || "editor"]}</p>
              </div>
            </div>
          </div>

          {/* Signup fields (only shown if user doesn't exist) */}
          {needsSignup && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                No account found for <strong>{invite?.email}</strong>. Create one to accept the invite:
              </p>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
              />
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="Choose a password"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
              />
            </div>
          )}

          {errMsg && <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{errMsg}</p>}

          <button
            onClick={accept}
            disabled={status === "accepting" || (needsSignup && (!name.trim() || !pass.trim()))}
            className="w-full px-5 py-3 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {status === "accepting"
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Accepting…</>
              : needsSignup ? "Create Account & Join Program" : "Accept Invitation & Join Program"}
          </button>

          <p className="text-center text-xs text-slate-400 space-y-2">
            <span className="block">Already have an account?{" "}
              <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="text-forest-600 hover:underline font-medium">
                Log in first
              </Link>
            </span>
            <span className="block">New to Simple Schedule Pro? Click the invite button above — we’ll create the right guest account for this email.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
