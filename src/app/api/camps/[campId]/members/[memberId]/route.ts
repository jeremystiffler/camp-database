import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

async function getMemberRole(userId: string, campId: string): Promise<string | null> {
  const m = await prisma.campMember.findFirst({ where: { campId, userId } });
  return m?.role ?? null;
}

// PATCH — change a member's role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ campId: string; memberId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, memberId } = await params;
  const myRole = await getMemberRole(session.userId, campId);
  if (!myRole || !hasPermission(myRole, "admin")) {
    return NextResponse.json({ error: "Only admins can change roles" }, { status: 403 });
  }

  const member = await prisma.campMember.findFirst({ where: { id: memberId, campId } });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Can't change an owner's role
  if (member.role === "owner") return NextResponse.json({ error: "Cannot change owner role" }, { status: 403 });
  // Can't promote someone higher than yourself
  const { role } = await req.json();
  if (hasPermission(role, "admin") && !hasPermission(myRole, "admin")) {
    return NextResponse.json({ error: "Cannot grant a role higher than your own" }, { status: 403 });
  }

  const updated = await prisma.campMember.update({ where: { id: memberId }, data: { role } });
  return NextResponse.json(updated);
}

// DELETE — remove a member (or cancel a pending invite)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ campId: string; memberId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, memberId } = await params;
  const myRole = await getMemberRole(session.userId, campId);

  // Check if memberId is an invite token
  const invite = await prisma.campInvite.findFirst({ where: { id: memberId, campId } });
  if (invite) {
    if (!myRole || !hasPermission(myRole, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.campInvite.delete({ where: { id: memberId } });
    return NextResponse.json({ success: true });
  }

  const member = await prisma.campMember.findFirst({ where: { id: memberId, campId } });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Can't remove owner
  if (member.role === "owner") return NextResponse.json({ error: "Cannot remove the owner" }, { status: 403 });

  // Can remove yourself, or admin can remove others
  if (member.userId !== session.userId) {
    if (!myRole || !hasPermission(myRole, "admin")) {
      return NextResponse.json({ error: "Only admins can remove members" }, { status: 403 });
    }
  }

  await prisma.campMember.delete({ where: { id: memberId } });
  return NextResponse.json({ success: true });
}
