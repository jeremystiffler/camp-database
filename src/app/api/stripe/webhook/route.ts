import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = webhookSecret && signature
      ? stripe.webhooks.constructEvent(body, signature, webhookSecret)
      : JSON.parse(body);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid webhook" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const campId = session.metadata?.campId;
    const type = session.metadata?.type;

    if (type === "camper_platform_fee" || type === "camper_registration") {
      const payments = await prisma.registrationPayment.findMany({
        where: { stripeCheckoutSession: session.id },
        select: { id: true },
      });
      await Promise.all(payments.map(payment =>
        prisma.registrationPayment.update({
          where: { id: payment.id },
          data: { status: "paid", stripePaymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : undefined },
        })
      ));
      const camperIds = typeof session.metadata?.camperIds === "string" && session.metadata.camperIds
        ? session.metadata.camperIds.split(",").map((id: string) => id.trim()).filter(Boolean)
        : typeof session.metadata?.camperId === "string" && session.metadata.camperId
          ? [session.metadata.camperId]
          : [];
      await Promise.all(camperIds.map((camperId: string) =>
        prisma.camper.update({ where: { id: camperId }, data: { paymentStatus: "paid" } })
      ));
    }

    if (type === "camp_subscription" || type === "camp_subscription_one_time") {
      await prisma.camp.updateMany({
        where: { id: campId || "" },
        data: {
          billingMode: "campPays",
          billingStatus: "active",
          stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : undefined,
        },
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    await prisma.camp.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { billingStatus: "unpaid" },
    });
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object;
    const status = subscription.status === "active" || subscription.status === "trialing" ? "active" : subscription.status === "past_due" ? "past_due" : "unpaid";
    await prisma.camp.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { billingStatus: status },
    });
  }

  return NextResponse.json({ received: true });
}
