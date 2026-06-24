import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

async function getMemberRole(userId: string, campId: string): Promise<string | null> {
  const m = await prisma.campMember.findFirst({ where: { campId, userId } });
  return m?.role ?? null;
}

// GET — list all members + pending invites
export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const role = await getMemberRole(session.userId, campId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await prisma.campMember.findMany({
    where: { campId },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    orderBy: { createdAt: "asc" },
  });

  const invites = await prisma.campInvite.findMany({
    where: { campId, acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ members, invites, myRole: role });
}

// POST — invite by email
export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const role = await getMemberRole(session.userId, campId);
  if (!role || !hasPermission(role, "admin")) {
    return NextResponse.json({ error: "Only admins can invite members" }, { status: 403 });
  }

  const { email, inviteRole = "editor" } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // Check if already a member
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const alreadyMember = await prisma.campMember.findFirst({ where: { campId, userId: existing.id } });
    if (alreadyMember) return NextResponse.json({ error: "User is already a member" }, { status: 409 });

    // Add immediately — no email needed
    await prisma.campMember.create({ data: { campId, userId: existing.id, role: inviteRole } });
    return NextResponse.json({ added: true, user: { email: existing.email, name: existing.name } });
  }

  // New user — create invite record + send email
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const invite = await prisma.campInvite.create({
    data: { campId, email, role: inviteRole, invitedById: session.userId, expiresAt },
  });

  const camp = await prisma.camp.findUnique({ where: { id: campId }, select: { name: true } });
  const inviteUrl = `${process.env.NEXTAUTH_URL || "https://camp-database.vercel.app"}/invite/${invite.token}`;

  // Send invite email if Resend configured
  let emailSent = false;
  let emailError = "";
  if (process.env.RESEND_API_KEY) {
    try {
      const { getResend } = await import("@/lib/email");
      const resend = getResend();
      // Must use a verified domain — onboarding@resend.dev is sandbox only
      const fromEmail = process.env.RESEND_FROM_EMAIL || "Camp Creator <noreply@camp-database.vercel.app>";
      const result = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: `You're invited to join ${camp?.name || "a camp"} on Camp Creator`,
        html: buildInviteEmail({ email, campName: camp?.name || "a camp", role: inviteRole, inviteUrl, inviterName: session.name }),
      });
      if (result.error) {
        emailError = result.error.message;
      } else {
        emailSent = true;
      }
    } catch (e) {
      emailError = e instanceof Error ? e.message : "Email send failed";
    }
  }

  return NextResponse.json({
    invited: true,
    token: invite.token,
    inviteUrl,
    emailSent,
    emailError: emailError || undefined,
    // Always return the invite URL so admin can share it manually
    manualInstructions: !emailSent ? `Share this link directly: ${inviteUrl}` : undefined,
  });
}

function buildInviteEmail({ email, campName, role, inviteUrl, inviterName }: {
  email: string; campName: string; role: string; inviteUrl: string; inviterName: string;
}) {
  const roleDesc: Record<string, string> = {
    admin:  "Admin — manage team, create & delete camps",
    editor: "Editor — edit all content",
    viewer: "Viewer — view-only access",
  };
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,#22c55e,#0ea5e9);border-radius:16px;padding:28px 32px;margin-bottom:24px;color:#fff;text-align:center;">
      <div style="font-size:48px;margin-bottom:8px;">🏕️</div>
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;">You're Invited!</h1>
      <p style="margin:0;opacity:0.9;">${inviterName} invited you to join <strong>${campName}</strong></p>
    </div>
    <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;border:1px solid #e2e8f0;">
      <p style="margin:0 0 16px;color:#374151;">Hi ${email.split("@")[0]},</p>
      <p style="margin:0 0 16px;color:#64748b;">You've been invited to collaborate on <strong style="color:#1e293b;">${campName}</strong> as a:</p>
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0;font-weight:700;color:#15803d;font-size:16px;">${role.charAt(0).toUpperCase() + role.slice(1)}</p>
        <p style="margin:4px 0 0;color:#166534;font-size:13px;">${roleDesc[role] || ""}</p>
      </div>
      <a href="${inviteUrl}" style="display:block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;text-align:center;padding:14px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;">
        Accept Invitation →
      </a>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;text-align:center;">Expires in 7 days. If you didn't expect this invite, you can ignore it.</p>
    </div>
  </div>
</body></html>`;
}
