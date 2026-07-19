import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Platform governance is deliberately separate from camp-level roles. Keep this
// allowlist in the deployment environment when adding another trusted operator.
const defaultAdmins = ["jeremystiffler@gmail.com"];

export function superAdminEmails() {
  return (process.env.SUPER_ADMIN_EMAILS || defaultAdmins.join(","))
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email?: string | null) {
  return !!email && superAdminEmails().includes(email.toLowerCase());
}

export async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) return { session: null, user: null, authorized: false };
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, name: true } });
  return { session, user, authorized: isSuperAdminEmail(user?.email || session.email) };
}
