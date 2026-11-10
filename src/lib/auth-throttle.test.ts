import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const counts = new Map<string, number>();
vi.mock("./db", () => ({ prisma: {
  $queryRaw: vi.fn(async (_parts: TemplateStringsArray, id: string) => {
    const next = (counts.get(id) || 0) + 1;
    counts.set(id, next);
    return [{ attempts: next }];
  }),
  $executeRaw: vi.fn(async () => 0),
} }));
import { checkAuthThrottle } from "./auth-throttle";
beforeEach(() => { counts.clear(); process.env.AUTH_SECRET = "test-auth-secret-fully-random-32-bytes-long"; });
function request() { return new NextRequest("https://example.com/api/auth/login", { headers: { "x-vercel-forwarded-for": "192.0.2.42" } }); }
describe("shared auth throttle", () => {
  it("allows ten login attempts per address/identity then rejects", async () => {
    for (let i = 0; i < 10; i++) expect(await checkAuthThrottle(request(), "person@example.com", "login")).toBe(true);
    expect(await checkAuthThrottle(request(), "person@example.com", "login")).toBe(false);
    expect(await checkAuthThrottle(request(), "other@example.com", "login")).toBe(true);
  });
  it("limits signup separately and stores only opaque HMAC identifiers", async () => {
    for (let i = 0; i < 3; i++) expect(await checkAuthThrottle(request(), "person@example.com", "signup")).toBe(true);
    expect(await checkAuthThrottle(request(), "person@example.com", "signup")).toBe(false);
    expect([...counts.keys()].every(key => /^[a-f0-9]{64}$/.test(key))).toBe(true);
  });
});
