import { NextRequest, NextResponse, after } from "next/server";
import { randomBytes } from "node:crypto";
import { DEFAULT_PROGRAM_PALETTE } from "@/lib/programPalettes";
import { prisma } from "@/lib/db";
import { signToken, setSessionCookie, hashPassword } from "@/lib/auth";
import { sendWelcomeTrialEmail } from "@/lib/trial-emails";
import { checkAuthThrottle } from "@/lib/auth-throttle";

export async function POST(req: NextRequest) {
  let created: { orgId?: string; userId?: string; campId?: string; complete?: boolean } = {};
  try {
    const input = await req.json();
    const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    const password = input?.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 100 || typeof password !== "string" || password.length < 12 || password.length > 1024) {
      return NextResponse.json({ error: "Enter a valid email and name, and use a password of at least 12 characters." }, { status: 400 });
    }
    if (!await checkAuthThrottle(req, email, "signup")) return NextResponse.json({ error: "Too many sign-up attempts. Try again in 15 minutes." }, { status: 429, headers: { "Retry-After": "900" } });
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

    const passwordHash = await hashPassword(password);
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 50).replace(/-$/, "") + "-" + randomBytes(8).toString("hex");
    const org = await prisma.organization.create({ data: { name, slug } });
    created.orgId = org.id;
    const user = await prisma.user.create({ data: { email, name, passwordHash, role: "owner", organizationId: org.id } });
    created.userId = user.id;
    const camp = await prisma.camp.create({
      data: {
        organizationId: org.id, name: "My Event", slug: "my-event-" + randomBytes(8).toString("hex"),
        status: "draft", themePreset: DEFAULT_PROGRAM_PALETTE.id,
        primaryColor: DEFAULT_PROGRAM_PALETTE.primaryColor,
        accentColor: DEFAULT_PROGRAM_PALETTE.accentColor,
      },
    });
    created.campId = camp.id;
    await prisma.campMember.create({ data: { campId: camp.id, userId: user.id, role: "owner" } });
    const token = await signToken({ userId: user.id, email: user.email, name: user.name || email, organizationId: org.id });
    await setSessionCookie(token);
    created.complete = true;
    after(async () => {
      try {
        await sendWelcomeTrialEmail({ ...user, organization: { ...org, camps: [{ ...camp, ageGroups: [], courses: [], sessionTemplates: [], registrationForms: [], participants: [] }] } });
      } catch (err) {
        console.error("Welcome email failed:", err instanceof Error ? err.message : String(err));
      }
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    // The HTTP database adapter cannot transact. Compensate only objects created by THIS request,
    // in reverse dependency order, so a retry can reuse the email after a partial failure.
    if (!created.complete) {
      if (created.campId) await prisma.camp.delete({ where: { id: created.campId } }).catch(() => {});
      if (created.userId) await prisma.user.delete({ where: { id: created.userId } }).catch(() => {});
      if (created.orgId) await prisma.organization.delete({ where: { id: created.orgId } }).catch(() => {});
    }
    console.error("Signup error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
