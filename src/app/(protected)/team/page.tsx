"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_COLORS, ASSIGNABLE_ROLES, type CampRole } from "@/lib/permissions";

interface TeamMember {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string; avatar: string | null };
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string | null;
}

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_COLORS[role as CampRole] || "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {ROLE_LABELS[role as CampRole] || role}
    </span>
  );
}

function TeamContent() {
  const searchParams = useSearchParams();
  const campId = searchParams.get("campId") || "";

  const [members,  setMembers]  = useState<TeamMember[]>([]);
  const [invites,  setInvites]  = useState<PendingInvite[]>([]);
  const [myRole,   setMyRole]   = useState<string>("viewer");
  const [loading,  setLoading]  = useState(true);

  // Invite form
  const [inviteEmail, setInviteEmail]   = useState("");
  const [inviteRole,  setInviteRole]    = useState<CampRole>("editor");
  const [inviting,    setInviting]      = useState(false);
  const [inviteMsg,   setInviteMsg]     = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canManage = myRole === "owner" || myRole === "admin";

  const load = () => {
    if (!campId) return;
    setLoading(true);
    fetch(`/api/camps/${campId}/members`)
      .then(r => r.json())
      .then(d => {
        setMembers(Array.isArray(d.members) ? d.members : []);
        setInvites(Array.isArray(d.invites) ? d.invites : []);
        setMyRole(d.myRole || "viewer");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [campId]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true); setInviteMsg(null);
    const res = await fetch(`/api/camps/${campId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), inviteRole }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.added) {
        setInviteMsg({ type: "success", text: `${data.user.name || data.user.email} was added to the team immediately (they already have an account).` });
      } else {
        setInviteMsg({ type: "success", text: `Invite sent to ${inviteEmail}! They'll receive an email with a link to join.` });
      }
      setInviteEmail("");
      load();
    } else {
      setInviteMsg({ type: "error", text: data.error || "Failed to send invite" });
    }
    setInviting(false);
  };

  const changeRole = async (memberId: string, role: string) => {
    await fetch(`/api/camps/${campId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    load();
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Remove this person from the camp?")) return;
    await fetch(`/api/camps/${campId}/members/${memberId}`, { method: "DELETE" });
    load();
  };

  const cancelInvite = async (inviteId: string) => {
    if (!confirm("Cancel this invite?")) return;
    await fetch(`/api/camps/${campId}/members/${inviteId}`, { method: "DELETE" });
    load();
  };

  if (!campId) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center"><span className="text-4xl mb-3 block">👥</span><p>Select a camp to manage its team.</p></div>
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Team</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage who has access to this camp and their permissions.</p>
      </div>

      {/* Role legend */}
      <div className="camp-card p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Permission Levels</h2>
        <div className="grid grid-cols-2 gap-2">
          {(["owner", "admin", "editor", "viewer"] as CampRole[]).map(r => (
            <div key={r} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <RoleBadge role={r} />
              <p className="text-xs text-slate-500 leading-snug">{ROLE_DESCRIPTIONS[r]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invite form */}
      {canManage && (
        <div className="camp-card p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Invite Someone</h2>
          <form onSubmit={sendInvite} className="flex gap-2 flex-wrap">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              required
              className="flex-1 min-w-48 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-400"
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as CampRole)}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30"
            >
              {ASSIGNABLE_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="px-4 py-2.5 bg-gradient-to-r from-forest-500 to-forest-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
            >
              {inviting ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</> : "✉️ Send Invite"}
            </button>
          </form>
          {inviteMsg && (
            <div className={`mt-3 px-4 py-2.5 rounded-xl text-sm ${inviteMsg.type === "success" ? "bg-forest-50 text-forest-700 border border-forest-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
              {inviteMsg.text}
            </div>
          )}
        </div>
      )}

      {/* Members list */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="camp-card overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Members <span className="text-slate-400 font-normal">({members.length})</span></h2>
            </div>
            <div className="divide-y divide-slate-50">
              {members.map(m => {
                const isMe = m.user.id === undefined; // will compare via email match below
                const isOwner = m.role === "owner";
                return (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-berry-400 to-sky-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {(m.user.name?.[0] || m.user.email[0]).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{m.user.name || m.user.email}</p>
                      <p className="text-xs text-slate-400 truncate">{m.user.email}</p>
                    </div>
                    {/* Role selector */}
                    {canManage && !isOwner ? (
                      <select
                        value={m.role}
                        onChange={e => changeRole(m.id, e.target.value)}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-forest-500/30"
                      >
                        {ASSIGNABLE_ROLES.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge role={m.role} />
                    )}
                    {/* Remove button */}
                    {canManage && !isOwner && (
                      <button
                        onClick={() => removeMember(m.id)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Remove member"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending invites */}
          {invites.length > 0 && (
            <div className="camp-card overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-700">Pending Invites <span className="text-slate-400 font-normal">({invites.length})</span></h2>
              </div>
              <div className="divide-y divide-slate-50">
                {invites.map(inv => (
                  <div key={inv.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm flex-shrink-0">
                      ✉️
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{inv.email}</p>
                      <p className="text-xs text-slate-400">
                        Invite sent · {inv.expiresAt ? `expires ${new Date(inv.expiresAt).toLocaleDateString()}` : "no expiry"}
                      </p>
                    </div>
                    <RoleBadge role={inv.role} />
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Pending</span>
                    {canManage && (
                      <button
                        onClick={() => cancelInvite(inv.id)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Cancel invite"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <TeamContent />
    </Suspense>
  );
}
