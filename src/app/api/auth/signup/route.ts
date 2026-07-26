import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken, setSessionCookie, hashPassword } from "@/lib/auth";
import { sendWelcomeTrialEmail } from "@/lib/trial-emails";

export async function POST(req: NextRequest) {
  try {
    const { email, name, password } = await req.json();
    if (!email || !name || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    // Sequential creates — PrismaNeonHttp doesn't support transactions
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") + "-" + Date.now();
    const org = await prisma.organization.create({
      data: { name, slug },
    });

    const user = await prisma.user.create({
      // New accounts begin in Guided Mode; existing accounts retain the schema default.
      data: { email, name, passwordHash, role: "owner", organizationId: org.id, guidedMode: true },
    });

    // A new account deliberately starts without an event. The Dashboard opens the
    // title-and-palette prompt immediately after sign-in, rather than creating a generic draft.
    await sendWelcomeTrialEmail({ ...user, organization: { ...org, camps: [] } });

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name || email,
      organizationId: org.id,
    });

    await setSessionCookie(token);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Signup error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
