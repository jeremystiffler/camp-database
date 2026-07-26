import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken, setSessionCookie, verifyGoogleToken } from "@/lib/auth";
import { sendWelcomeTrialEmail } from "@/lib/trial-emails";

export async function POST(req: NextRequest) {
  try {
    const { credential } = await req.json();
    if (!credential) return NextResponse.json({ error: "Missing credential" }, { status: 400 });

    const googleUser = await verifyGoogleToken(credential);
    if (!googleUser) return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });

    let user = await prisma.user.findUnique({ where: { email: googleUser.email } });

    if (!user) {
      const slug = googleUser.name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now();
      const org = await prisma.organization.create({ data: { name: googleUser.name, slug } });

      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          avatar: googleUser.picture,
          role: "owner",
          organizationId: org.id,
          guidedMode: true,
        },
      });
      // Do not create a placeholder event: Dashboard will collect the real title and palette.
      await sendWelcomeTrialEmail({ ...user, organization: { ...org, camps: [] } });
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name || googleUser.email,
      organizationId: user.organizationId || undefined,
    });

    await setSessionCookie(token);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Google auth error:", err);
    return NextResponse.json({ error: "Google auth failed" }, { status: 500 });
  }
}
