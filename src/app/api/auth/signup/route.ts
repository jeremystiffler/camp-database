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
      data: { email, name, passwordHash, role: "owner", organizationId: org.id },
    });

    const campSlug = "my-camp-" + Date.now();
    const camp = await prisma.camp.create({
      data: {
        organizationId: org.id,
        name: "My Camp",
        slug: campSlug,
        status: "draft",
      },
    });
    // Separate create — nested creates use implicit transactions (not supported in HTTP mode)
    await prisma.campMember.create({
      data: { campId: camp.id, userId: user.id, role: "admin" },
    });

    await sendWelcomeTrialEmail({ ...user, organization: { ...org, camps: [{ ...camp, ageGroups: [], courses: [], sessionTemplates: [], registrationForms: [], campers: [] }] } });

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
