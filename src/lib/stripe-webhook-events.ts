import Stripe from "stripe";
import { prisma } from "@/lib/db";

function camperIdsFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  if (metadata?.camperIds) return metadata.camperIds.split(",").map(id => id.trim()).filter(Boolean);
  return metadata?.camperId ? [metadata.camperId] : [];
}

async function setCampersPaymentStatus(camperIds: string[], paymentStatus: string) {
  if (camperIds.length === 0) return;
  await prisma.camper.updateMany({ where: { id: { in: camperIds } }, data: { paymentStatus } });
}

async function completeCheckout(session: Stripe.Checkout.Session, connectAccountId: string | null) {
  if (session.metadata?.type !== "camper_registration") return;
  if (session.payment_status !== "paid") return;
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  await prisma.registrationPayment.updateMany({
    where: { stripeCheckoutSession: session.id },
    data: {
      status: "paid",
      stripePaymentIntent: paymentIntent || undefined,
      stripeConnectAccountId: connectAccountId || undefined,
    },
  });
  await setCampersPaymentStatus(camperIdsFromMetadata(session.metadata), "paid");
}

async function failCheckout(session: Stripe.Checkout.Session) {
  if (session.metadata?.type !== "camper_registration") return;
  await prisma.registrationPayment.updateMany({
    where: { stripeCheckoutSession: session.id, status: "pending" },
    data: { status: "failed" },
  });
  await setCampersPaymentStatus(camperIdsFromMetadata(session.metadata), "failed");
}

export async function handleConnectWebhookEvent(event: Stripe.Event) {
  const connectAccountId = typeof event.account === "string" ? event.account : null;

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await prisma.organization.updateMany({
        where: { stripeConnectAccountId: account.id },
        data: {
          stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
          stripeConnectChargesEnabled: Boolean(account.charges_enabled),
          stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
          stripeConnectCountry: account.country || null,
          stripeConnectUpdatedAt: new Date(),
        },
      });
      break;
    }
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await completeCheckout(event.data.object as Stripe.Checkout.Session, connectAccountId);
      break;
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      await failCheckout(event.data.object as Stripe.Checkout.Session);
      break;
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (!paymentIntent) break;
      const status = charge.refunded ? "refunded" : "partially_refunded";
      const payments = await prisma.registrationPayment.findMany({ where: { stripePaymentIntent: paymentIntent }, select: { camperId: true } });
      await prisma.registrationPayment.updateMany({ where: { stripePaymentIntent: paymentIntent }, data: { status } });
      await setCampersPaymentStatus(payments.map(payment => payment.camperId).filter((id): id is string => Boolean(id)), status);
      break;
    }
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntent = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
      if (paymentIntent) await prisma.registrationPayment.updateMany({ where: { stripePaymentIntent: paymentIntent }, data: { status: "disputed" } });
      break;
    }
  }
}
