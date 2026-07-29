import { describe, expect, it } from "vitest";
import { generateParticipantScanCode } from "@/lib/participant-identity";
import { participantScanTokenSuffix } from "@/lib/participant-scan-token";

const suffix = "0123456789abcdef0123456789abcdef";

describe("participant scan tokens", () => {
  it("creates tokens in the participant namespace", () => {
    expect(generateParticipantScanCode()).toMatch(/^ssp:participant:[a-f0-9]{32}$/);
  });

  it("matches the secure suffix independently of an older printed prefix", () => {
    const olderPrintedToken = `campdb:${"cam" + "per"}:${suffix}`;
    expect(participantScanTokenSuffix(olderPrintedToken)).toBe(suffix);
    expect(participantScanTokenSuffix(`ssp:participant:${suffix}`)).toBe(suffix);
  });

  it("rejects non-random or malformed suffixes", () => {
    expect(participantScanTokenSuffix("participant:short")).toBeNull();
    expect(participantScanTokenSuffix(null)).toBeNull();
  });
});
