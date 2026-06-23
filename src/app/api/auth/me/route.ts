import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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
    // Fallback to session data if DB is unavailable
    return NextResponse.json({
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: "owner",
        organizationId: session.organizationId || null,
      },
    });
  }
}

// Sign out
export async function DELETE() {
  const { clearSessionCookie } = await import("@/lib/auth");
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
