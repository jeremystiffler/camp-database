import { NextRequest, NextResponse } from "next/server";
import { getSession, signToken, setSessionCookie, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true, role: true, organizationId: true },
    });
    if (!user) return NextResponse.json({ user: null }, { status: 401 });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({
      user: { id: session.userId, email: session.email, name: session.name, role: "owner", organizationId: session.organizationId || null },
    });
  }
}

// Update profile: name, email, password
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, email, currentPassword, newPassword } = await req.json();

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const updates: Record<string, string> = {};

  if (name?.trim()) updates.name = name.trim();

  if (email?.trim() && email.trim() !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (existing) return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    updates.email = email.trim();
  }

  if (newPassword) {
    if (!currentPassword) return NextResponse.json({ error: "Current password required to set a new one" }, { status: 400 });
    if (user.passwordHash) {
      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    if (newPassword.length < 6) return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    updates.passwordHash = await hashPassword(newPassword);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id: session.userId }, data: updates });

  // Re-issue JWT with updated name/email
  const token = await signToken({
    userId: updated.id,
    email: updated.email,
    name: updated.name || updated.email,
    organizationId: updated.organizationId || undefined,
  });
  await setSessionCookie(token);

  return NextResponse.json({ success: true, name: updated.name, email: updated.email });
}

// Sign out
export async function DELETE() {
  const { clearSessionCookie } = await import("@/lib/auth");
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
