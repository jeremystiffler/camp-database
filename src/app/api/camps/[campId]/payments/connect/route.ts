import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBaseUrl, getStripe } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { connectStateFromOrganization, publicConnectState, syncConnectedAccount } from "@/lib/stripe-connect";

async function contextFor(userId: string, campId: string) {
  const member = await prisma.campMember.findFirst({ where: { campId, userId } });
  if (!member || !hasPermission(member.role, "admin")) return null;
  const camp = await prisma.camp.findUnique({
    where: { id: campId },
    select: { organization: true },
  });
  return camp ? { member, organization: camp.organization } : null;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const context = await contextFor(session.userId, campId);
  if (!context) return NextResponse.json({ error: "Only admins can manage payouts" }, { status: 403 });

  const stripe = getStripe();
  let state = connectStateFromOrganization(context.organization);
  if (stripe && state.accountId) {
    try {
      state = await syncConnectedAccount(stripe, context.organization.id, state.accountId);
    } catch (error) {
      console.error("Stripe Connect status refresh failed", error instanceof Error ? error.message : String(error));
    }
  }
  return NextResponse.json(publicConnectState(state, Boolean(stripe)));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ campId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campId } = await params;
  const context = await contextFor(session.userId, campId);
  if (!context) return NextResponse.json({ error: "Only admins can manage payouts" }, { status: 403 });

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe Connect is not configured yet" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const action = body.action === "dashboard" ? "dashboard" : "onboard";
  let accountId = context.organization.stripeConnectAccountId;

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        country: process.env.STRIPE_CONNECT_COUNTRY || "US",
        email: session.email,
        controller: {
          requirement_collection: "stripe",
          stripe_dashboard: { type: "express" },
          fees: { payer: "application" },
          losses: { payments: "application" },
        },
        business_profile: {
          name: context.organization.name,
          product_description: "Event registrations sold with Simple Schedule Pro",
          url: getBaseUrl(),
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { organizationId: context.organization.id, platform: "simple-schedule-pro" },
      }, { idempotencyKey: `connect-organization-${context.organization.id}` });
      accountId = account.id;
      await prisma.organization.update({
        where: { id: context.organization.id },
        data: { stripeConnectAccountId: accountId, stripeConnectCountry: account.country || null, stripeConnectUpdatedAt: new Date() },
      });
    }

    if (action === "dashboard") {
      const link = await stripe.accounts.createLoginLink(accountId);
      return NextResponse.json({ url: link.url });
    }

    const baseUrl = getBaseUrl();
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      collection_options: { fields: "eventually_due", future_requirements: "include" },
      refresh_url: `${baseUrl}/settings?campId=${encodeURIComponent(campId)}&tab=billing&connect=refresh`,
      return_url: `${baseUrl}/settings?campId=${encodeURIComponent(campId)}&tab=billing&connect=complete`,
    });
    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe could not start payout setup.";
    console.error("Stripe Connect action failed", { organizationId: context.organization.id, action, message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
