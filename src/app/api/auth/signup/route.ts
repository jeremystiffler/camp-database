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

    const result = await prisma.$transaction(async (tx) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") + "-" + Date.now();
      const org = await tx.organization.create({
        data: { name, slug },
      });

      const user = await tx.user.create({
        data: { email, name, passwordHash, role: "owner", organizationId: org.id },
      });

      const campSlug = "my-camp-" + Date.now();
      await tx.camp.create({
        data: {
          organizationId: org.id,
          name: "My Camp",
          slug: campSlug,
          status: "draft",
          members: { create: { userId: user.id, role: "admin" } },
        },
      });

      return { user, org };
    });

    const token = await signToken({
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name || email,
      organizationId: result.org.id,
    });

    await setSessionCookie(token);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Signup error:", msg);
    return NextResponse.json({ error: "Signup failed", detail: msg }, { status: 500 });
  }
}
