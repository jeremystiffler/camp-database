import Stripe from "stripe";
import { prisma } from "@/lib/db";

export type ConnectState = {
  accountId: string | null;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  country: string | null;
  currentlyDue: string[];
};

export function connectReady(state: Pick<ConnectState, "accountId" | "detailsSubmitted" | "chargesEnabled" | "payoutsEnabled">) {
  return Boolean(state.accountId && state.detailsSubmitted && state.chargesEnabled && state.payoutsEnabled);
}

export function connectStateFromOrganization(organization: {
  stripeConnectAccountId: string | null;
  stripeConnectDetailsSubmitted: boolean;
  stripeConnectChargesEnabled: boolean;
  stripeConnectPayoutsEnabled: boolean;
  stripeConnectCountry: string | null;
}): ConnectState {
  return {
    accountId: organization.stripeConnectAccountId,
    detailsSubmitted: organization.stripeConnectDetailsSubmitted,
    chargesEnabled: organization.stripeConnectChargesEnabled,
    payoutsEnabled: organization.stripeConnectPayoutsEnabled,
    country: organization.stripeConnectCountry,
    currentlyDue: [],
  };
}

export async function syncConnectedAccount(stripe: Stripe, organizationId: string, accountId: string) {
  const account = await stripe.accounts.retrieve(accountId);
  if (account.deleted) throw new Error("This connected Stripe account is no longer available.");

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
      stripeConnectChargesEnabled: Boolean(account.charges_enabled),
      stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
      stripeConnectCountry: account.country || null,
      stripeConnectUpdatedAt: new Date(),
    },
  });

  return {
    accountId,
    detailsSubmitted: Boolean(account.details_submitted),
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    country: account.country || null,
    currentlyDue: account.requirements?.currently_due || [],
  } satisfies ConnectState;
}

export function publicConnectState(state: ConnectState, configured: boolean) {
  return {
    configured,
    connected: Boolean(state.accountId),
    detailsSubmitted: state.detailsSubmitted,
    chargesEnabled: state.chargesEnabled,
    payoutsEnabled: state.payoutsEnabled,
    ready: connectReady(state),
    country: state.country,
    currentlyDue: state.currentlyDue,
  };
}
