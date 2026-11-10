import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { SignJWT } from "jose";
vi.mock("./db", () => ({ prisma: {} }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import { hashPassword, verifyPassword, signToken, verifyToken } from "./auth";
const oldKey = "legacy-test-key-for-migration-only";
const newKey = "new-unique-signing-key-at-least-32-characters";
beforeEach(() => {
  process.env.JWT_SECRET = oldKey;
  process.env.AUTH_SECRET = newKey;
});
afterEach(() => {
  delete process.env.JWT_SECRET;
  delete process.env.AUTH_SECRET;
});
describe("password and session migration", () => {
  it("salts passwords independently and rejects wrong guesses", async () => {
    const first = await hashPassword("some-long-test-passphrase");
    const second = await hashPassword("some-long-test-passphrase");
    expect(first).not.toBe(second);
    expect(first).toMatch(/^scrypt:v1:16384:/);
    expect(await verifyPassword("some-long-test-passphrase", first)).toBe(true);
    expect(await verifyPassword("wrong", first)).toBe(false);
    expect(await verifyPassword("some-long-test-passphrase", "scrypt:v1:16384:garbage")).toBe(false);
  });
  it("verifies old HMACs only using the legacy key", async () => {
    const legacy = createHmac("sha256", oldKey).update("old-password").digest("base64");
    expect(await verifyPassword("old-password", legacy)).toBe(true);
    expect(await verifyPassword("wrong", legacy)).toBe(false);
  });
  it("signs and validates new sessions with the new key", async () => {
    const token = await signToken({ userId: "a", email: "a@example.com", name: "A" });
    expect((await verifyToken(token))?.userId).toBe("a");
    expect(await verifyToken("malformed")).toBeNull();
  });
  it("honors previously issued, still-unexpired sessions", async () => {
    const legacy = await new SignJWT({ userId: "old-user", email: "old@example.com", name: "Old" })
      .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d")
      .sign(new TextEncoder().encode(oldKey));
    expect((await verifyToken(legacy))?.userId).toBe("old-user");
  });
  it("rejects signing with a missing or short production signing key", async () => {
    try {
      delete process.env.AUTH_SECRET;
      vi.stubEnv("NODE_ENV", "production");
      await expect(signToken({ userId: "a", email: "a@example.com", name: "A" })).rejects.toThrow("AUTH_SECRET");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
