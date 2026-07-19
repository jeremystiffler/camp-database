import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Root authority is intentionally environment-owned. Platform Super Admins can
// manage promotions, but only the root owner can grant/revoke that authority.
const defaultRootAdmins = ["jeremystiffler@gmail.com"];

export function rootSuperAdminEmails() {
  return (process.env.ROOT_SUPER_ADMIN_EMAILS || defaultRootAdmins.join(","))
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isRootSuperAdminEmail(email?: string | null) {
  return !!email && rootSuperAdminEmails().includes(email.toLowerCase());
}

export async function requirePlatformAccess() {
  const session = await getSession();
  if (!session) return { session: null, user: null, authorized: false, root: false };
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, name: true, platformRole: true } });
  const root = isRootSuperAdminEmail(user?.email || session.email);
  return { session, user, root, authorized: root || user?.platformRole === "super_admin" };
}

export async function requireSuperAdmin() {
  return requirePlatformAccess();
}

export async function requireRootSuperAdmin() {
  const gate = await requirePlatformAccess();
  return { ...gate, authorized: gate.root };
}
