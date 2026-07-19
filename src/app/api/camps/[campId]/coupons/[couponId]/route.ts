import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ campId: string; couponId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId, couponId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "admin")) return NextResponse.json({ error: "Only camp admins can delete registration coupons" }, { status: 403 });
  await prisma.campCoupon.deleteMany({ where: { id: couponId, campId } });
  return NextResponse.json({ success: true });
}
