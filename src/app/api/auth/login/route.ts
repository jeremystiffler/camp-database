import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken, setSessionCookie, verifyPassword, hashPassword } from "@/lib/auth";
import { checkAuthThrottle } from "@/lib/auth-throttle";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 1024 || !email.trim() || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!await checkAuthThrottle(req, normalizedEmail, "login")) return NextResponse.json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, { status: 429, headers: { "Retry-After": "900" } });
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (!user.passwordHash.startsWith("scrypt:v1:")) {
      const upgraded = await hashPassword(password);
      await prisma.user.update({ where: { id: user.id, passwordHash: user.passwordHash }, data: { passwordHash: upgraded } }).catch(() => {
        // A concurrent login may already have upgraded this account; authentication still succeeds.
      });
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name || email,
      organizationId: user.organizationId || undefined,
    });

    await setSessionCookie(token);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
