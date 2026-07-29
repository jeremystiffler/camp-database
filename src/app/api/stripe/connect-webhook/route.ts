import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/billing";
import { handleConnectWebhookEvent } from "@/lib/stripe-webhook-events";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe Connect webhook is not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid webhook" }, { status: 400 });
  }

  try {
    await handleConnectWebhookEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe Connect webhook handler failed", { eventId: event.id, type: event.type, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
