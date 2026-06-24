import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, signToken, setSessionCookie } from "@/lib/auth";

// GET — look up invite details (public — no auth required)
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invite = await prisma.campInvite.findUnique({
    where: { token },
    include: { camp: { select: { name: true, primaryColor: true } } },
  });

  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.acceptedAt) return NextResponse.json({ error: "Invite already accepted" }, { status: 410 });
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    campName: invite.camp.name,
    campColor: invite.camp.primaryColor,
    token: invite.token,
  });
}

// POST — accept an invite (user must be logged in or will be created)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invite = await prisma.campInvite.findUnique({ where: { token } });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.acceptedAt) return NextResponse.json({ error: "Already accepted" }, { status: 410 });
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  // Get or create user
  let userId: string;
  let userName: string;
  let userEmail: string;
  let organizationId: string | undefined;

  const session = await getSession();

  if (session) {
    // Logged in — use current user
    userId = session.userId;
    userName = session.name;
    userEmail = session.email;
    organizationId = session.organizationId;
  } else {
    // Not logged in — try to find by invite email or require signup data
    const body = await req.json().catch(() => ({})) as { password?: string; name?: string };
    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) {
      return NextResponse.json({ error: "Please log in with your existing account first, then click the invite link again." }, { status: 409 });
    }
    if (!body.password || !body.name) {
      return NextResponse.json({ needsSignup: true, email: invite.email }, { status: 200 });
    }
    // Create account
    const { hashPassword } = await import("@/lib/auth");
    const passwordHash = await hashPassword(body.password);
    const { prisma: db } = await import("@/lib/db");

    // Create org
    const slug = invite.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now();
    const org = await db.organization.create({ data: { name: body.name + "'s Org", slug } });
    const newUser = await db.user.create({
      data: { email: invite.email, name: body.name, passwordHash, organizationId: org.id, role: "owner" },
    });
    userId = newUser.id;
    userName = newUser.name || invite.email;
    userEmail = newUser.email;
    organizationId = org.id;
  }

  // Add to camp
  const existing = await prisma.campMember.findFirst({ where: { campId: invite.campId, userId } });
  if (!existing) {
    await prisma.campMember.create({ data: { campId: invite.campId, userId, role: invite.role } });
  }

  // Mark invite accepted
  await prisma.campInvite.update({ where: { token }, data: { acceptedAt: new Date() } });

  // Issue / refresh JWT
  const jwtToken = await signToken({ userId, email: userEmail, name: userName, organizationId });
  await setSessionCookie(jwtToken);

  return NextResponse.json({ success: true, campId: invite.campId });
}
