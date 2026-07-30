import { describe, expect, it } from "vitest";
import { effectiveRegistrationState } from "@/lib/registrationState";

describe("effective registration state", () => {
  it("opens only when the event, form, capacity, and payment gates agree", () => {
    expect(effectiveRegistrationState({ eventOpen: true, formStatus: "public" })).toEqual({ open: true, reason: null });
    expect(effectiveRegistrationState({ eventOpen: true, formStatus: "linkOnly" })).toEqual({ open: true, reason: null });
  });

  it.each([
    [{ eventOpen: false, formStatus: "public" }, "Registration is closed."],
    [{ eventOpen: true, formStatus: null }, "This registration form is not available."],
    [{ eventOpen: true, formStatus: "draft" }, "This registration form is not available."],
    [{ eventOpen: true, formStatus: "public", capacityBlocked: true }, "Registration is paused until event capacity issues are resolved."],
    [{ eventOpen: true, formStatus: "public", paymentReady: false }, "Registration is paused until the event organizer finishes Stripe payout setup."],
  ])("blocks %j with a specific reason", (input, reason) => {
    expect(effectiveRegistrationState(input)).toEqual({ open: false, reason });
  });
});
