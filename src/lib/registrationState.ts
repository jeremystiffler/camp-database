export type EffectiveRegistrationInput = {
  eventOpen: boolean;
  formStatus?: string | null;
  capacityBlocked?: boolean;
  paymentReady?: boolean;
};

export type EffectiveRegistrationState = {
  open: boolean;
  reason: string | null;
};

/** One trust decision shared by public read and write paths. */
export function effectiveRegistrationState({
  eventOpen,
  formStatus,
  capacityBlocked = false,
  paymentReady = true,
}: EffectiveRegistrationInput): EffectiveRegistrationState {
  if (!eventOpen) return { open: false, reason: "Registration is closed." };
  if (!formStatus || formStatus === "draft") {
    return { open: false, reason: "This registration form is not available." };
  }
  if (capacityBlocked) {
    return { open: false, reason: "Registration is paused until event capacity issues are resolved." };
  }
  if (!paymentReady) {
    return { open: false, reason: "Registration is paused until the event organizer finishes Stripe payout setup." };
  }
  return { open: true, reason: null };
}
