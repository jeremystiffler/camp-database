import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isRootSuperAdminEmail, requireRootSuperAdmin } from "@/lib/platform-admin";

export async function GET() {
  const gate = await requireRootSuperAdmin();
  if (!gate.session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!gate.authorized) return NextResponse.json({ error: "Root Super Admin access required" }, { status: 403 });
  const admins = await prisma.user.findMany({
    where: { OR: [{ platformRole: "super_admin" }, { email: { in: ["jeremystiffler@gmail.com"], mode: "insensitive" } }] },
    select: { id: true, email: true, name: true, platformRole: true, createdAt: true },
    orderBy: { email: "asc" },
  });
  return NextResponse.json({ admins: admins.map(admin => ({ ...admin, root: isRootSuperAdminEmail(admin.email) })) });
}

export async function POST(req: NextRequest) {
  const gate = await requireRootSuperAdmin();
  if (!gate.session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!gate.authorized) return NextResponse.json({ error: "Only the root Super Admin can add administrators" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "That person needs a Simple Schedule Pro account before you can promote them." }, { status: 404 });
  const updated = await prisma.user.update({ where: { id: user.id }, data: { platformRole: "super_admin" }, select: { id: true, email: true, name: true } });
  return NextResponse.json({ success: true, admin: { ...updated, root: isRootSuperAdminEmail(updated.email) } });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireRootSuperAdmin();
  if (!gate.session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!gate.authorized) return NextResponse.json({ error: "Only the root Super Admin can remove administrators" }, { status: 403 });
  const email = String(new URL(req.url).searchParams.get("email") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (isRootSuperAdminEmail(email)) return NextResponse.json({ error: "The root Super Admin is environment-protected and cannot be removed here." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Administrator not found" }, { status: 404 });
  await prisma.user.update({ where: { id: user.id }, data: { platformRole: "user" } });
  return NextResponse.json({ success: true });
}
