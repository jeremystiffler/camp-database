import { NextRequest, NextResponse, after } from "next/server";
import { randomBytes } from "node:crypto";
import { DEFAULT_PROGRAM_PALETTE } from "@/lib/programPalettes";
import { prisma } from "@/lib/db";
import { signToken, setSessionCookie, verifyGoogleToken } from "@/lib/auth";
import { checkAuthThrottle } from "@/lib/auth-throttle";
import { sendWelcomeTrialEmail } from "@/lib/trial-emails";

export async function POST(req: NextRequest) {
  const created: { orgId?: string; userId?: string; campId?: string; complete?: boolean } = {};
  try {
    const { credential } = await req.json();
    if (typeof credential !== "string" || credential.length > 10000 || !credential) return NextResponse.json({ error: "Missing credential" }, { status: 400 });
    // Validate the Google token before looking up an account or creating records.
    const googleUser = await verifyGoogleToken(credential);
    if (!googleUser) return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
    const email = googleUser.email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      if (!await checkAuthThrottle(req, email, "signup")) return NextResponse.json({ error: "Too many sign-up attempts. Try again in 15 minutes." }, { status: 429 });
      const suffix = randomBytes(8).toString("hex");
      const slug = googleUser.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 50).replace(/-$/, "") + "-" + suffix;
      const org = await prisma.organization.create({ data: { name: googleUser.name, slug } });
      created.orgId = org.id;
      user = await prisma.user.create({ data: { email, name: googleUser.name, avatar: googleUser.picture, role: "owner", organizationId: org.id } });
      created.userId = user.id;
      const newCamp = await prisma.camp.create({ data: {
        organizationId: org.id, name: "My Event", slug: "my-event-" + suffix,
        status: "draft", themePreset: DEFAULT_PROGRAM_PALETTE.id,
        primaryColor: DEFAULT_PROGRAM_PALETTE.primaryColor, accentColor: DEFAULT_PROGRAM_PALETTE.accentColor,
      } });
      created.campId = newCamp.id;
      await prisma.campMember.create({ data: { campId: newCamp.id, userId: user.id, role: "owner" } });
      const token = await signToken({ userId: user.id, email, name: user.name || email, organizationId: org.id });
      await setSessionCookie(token);
      created.complete = true;
      after(async () => {
        try {
          await sendWelcomeTrialEmail({ ...user!, organization: { ...org, camps: [{ ...newCamp, ageGroups: [], courses: [], sessionTemplates: [], registrationForms: [], participants: [] }] } });
        } catch (err) { console.error("Welcome email failed:", err instanceof Error ? err.message : String(err)); }
      });
    } else {
      const token = await signToken({ userId: user.id, email: user.email, name: user.name || email, organizationId: user.organizationId || undefined });
      await setSessionCookie(token);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    if (!created.complete) {
      if (created.campId) await prisma.camp.delete({ where: { id: created.campId } }).catch(() => {});
      if (created.userId) await prisma.user.delete({ where: { id: created.userId } }).catch(() => {});
      if (created.orgId) await prisma.organization.delete({ where: { id: created.orgId } }).catch(() => {});
    }
    console.error("Google auth error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Google auth failed" }, { status: 500 });
  }
}
