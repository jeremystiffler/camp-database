import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken, setSessionCookie, hashPassword } from "@/lib/auth";

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
    await prisma.camp.create({
      data: {
        organizationId: org.id,
        name: "My Camp",
        slug: campSlug,
        status: "draft",
        members: { create: { userId: user.id, role: "admin" } },
      },
    });

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name || email,
      organizationId: org.id,
    });

    await setSessionCookie(token);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Signup error:", msg);
    return NextResponse.json({ error: "Signup failed", detail: msg }, { status: 500 });
  }
}
