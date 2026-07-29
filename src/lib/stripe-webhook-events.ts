import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { completePendingRegistrationPayment, failPendingRegistrationPayment } from "@/lib/registration-payment-lifecycle";

function paymentIdFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  return metadata?.registrationPaymentId || null;
}

async function recordEvent(event: Stripe.Event, stripeAccountId: string | null) {
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
        stripeAccountId,
        payloadCreatedAt: event.created ? new Date(event.created * 1000) : null,
      },
    });
    return true;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return false;
    throw error;
  }
}

async function completeCheckout(session: Stripe.Checkout.Session, stripeAccountId: string | null) {
  const paymentId = paymentIdFromMetadata(session.metadata);
  if (session.metadata?.type !== "camper_registration" || !paymentId || !stripeAccountId || session.payment_status !== "paid") return;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  await completePendingRegistrationPayment({ paymentId, stripeAccountId, checkoutSessionId: session.id, paymentIntentId });
}

async function failCheckout(session: Stripe.Checkout.Session, stripeAccountId: string | null, code: string) {
  const paymentId = paymentIdFromMetadata(session.metadata);
  if (session.metadata?.type !== "camper_registration" || !paymentId || !stripeAccountId) return;
  await failPendingRegistrationPayment({ paymentId, stripeAccountId, code });
}

async function updatePaymentAndCampersByIntent(paymentIntentId: string, stripeAccountId: string, status: string, fullyRefunded = false) {
  const payments = await prisma.registrationPayment.findMany({
    where: { stripePaymentIntent: paymentIntentId, stripeConnectAccountId: stripeAccountId },
    select: { id: true, campers: { select: { camperId: true } } },
  });
  if (payments.length === 0) return;
  await prisma.registrationPayment.updateMany({
    where: { id: { in: payments.map(payment => payment.id) } },
    data: { status, ...(fullyRefunded ? { refundedAt: new Date() } : {}) },
  });
  await prisma.camper.updateMany({
    where: { id: { in: payments.flatMap(payment => payment.campers.map(link => link.camperId)) } },
    data: { paymentStatus: status, ...(fullyRefunded ? { totalPaidCents: 0 } : {}) },
  });
}

export async function handleConnectWebhookEvent(event: Stripe.Event) {
  const stripeAccountId = typeof event.account === "string" ? event.account : null;
  const firstAttempt = await recordEvent(event, stripeAccountId);
  if (!firstAttempt) return;

  try {
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await prisma.organization.updateMany({
          where: { stripeConnectAccountId: account.id },
          data: {
            stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
            stripeConnectChargesEnabled: Boolean(account.charges_enabled),
            stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
            stripeConnectCardPaymentsActive: account.capabilities?.card_payments === "active",
            stripeConnectDisabledReason: account.requirements?.disabled_reason || null,
            stripeConnectCountry: account.country || null,
            stripeConnectUpdatedAt: new Date(),
          },
        });
        break;
      }
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await completeCheckout(event.data.object as Stripe.Checkout.Session, stripeAccountId);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await failCheckout(event.data.object as Stripe.Checkout.Session, stripeAccountId, event.type);
        break;
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (paymentIntentId && stripeAccountId) await updatePaymentAndCampersByIntent(paymentIntentId, stripeAccountId, charge.refunded ? "refunded" : "partially_refunded", charge.refunded);
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
        if (paymentIntentId && stripeAccountId) await updatePaymentAndCampersByIntent(paymentIntentId, stripeAccountId, "disputed");
        break;
      }
    }
  } catch (error) {
    await prisma.stripeWebhookEvent.delete({ where: { id: event.id } }).catch(() => undefined);
    throw error;
  }
}
