import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getBaseUrl, getStripe } from "@/lib/billing";
import { hasPermission } from "@/lib/permissions";

async function getMember(userId: string, campId: string) {
  return prisma.campMember.findFirst({ where: { campId, userId } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const member = await getMember(session.userId, campId);
  if (!member || !hasPermission(member.role, "admin")) {
    return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
  }

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured yet" }, { status: 503 });

  const camp = await prisma.camp.findUnique({
    where: { id: campId },
    include: { organization: true },
  });
  if (!camp) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  const baseUrl = getBaseUrl();
  const priceId = process.env.STRIPE_CAMP_ANNUAL_PRICE_ID || camp.stripePriceId;
  const customerEmail = session.email;

  let checkout;
  if (priceId) {
    checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      allow_promotion_codes: true,
      customer_email: customerEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/settings?campId=${campId}&billing=success`,
      cancel_url: `${baseUrl}/settings?campId=${campId}&billing=cancelled`,
      metadata: { campId, organizationId: camp.organizationId, type: "camp_subscription" },
    });
  } else {
    checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      customer_email: customerEmail,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: camp.annualSubscriptionCents || 29900,
          product_data: { name: `${camp.name} annual Simple Schedule Pro subscription` },
        },
        quantity: 1,
      }],
      success_url: `${baseUrl}/settings?campId=${campId}&billing=success`,
      cancel_url: `${baseUrl}/settings?campId=${campId}&billing=cancelled`,
      metadata: { campId, organizationId: camp.organizationId, type: "camp_subscription_one_time" },
    });
  }

  await prisma.camp.update({
    where: { id: campId },
    data: { billingMode: "campPays", billingStatus: "trial", stripePriceId: priceId || camp.stripePriceId },
  });

  return NextResponse.json({ url: checkout.url });
}
