import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await prisma.campMember.findFirst({ where: { campId, userId: session.userId } });
  if (!member) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (!hasPermission(member.role, "admin")) {
    return NextResponse.json({ error: "Only admins can view payments" }, { status: 403 });
  }

  const [payments, paidTotals] = await Promise.all([
    prisma.registrationPayment.findMany({
      where: { campId },
      select: {
        id: true,
        guardianEmail: true,
        amountCents: true,
        campPriceCents: true,
        discountCents: true,
        platformFeeCents: true,
        currency: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.registrationPayment.aggregate({
      where: { campId, status: "paid" },
      _sum: { amountCents: true, campPriceCents: true, platformFeeCents: true, discountCents: true },
      _count: true,
    }),
  ]);

  return NextResponse.json({
    payments,
    totals: {
      paidCount: paidTotals._count,
      grossCents: paidTotals._sum.amountCents || 0,
      eventRevenueCents: Math.max(0, (paidTotals._sum.campPriceCents || 0) - (paidTotals._sum.discountCents || 0)),
      platformFeeCents: paidTotals._sum.platformFeeCents || 0,
      discountCents: paidTotals._sum.discountCents || 0,
    },
  });
}
