import { afterEach, describe, expect, it, vi } from "vitest";
import { getJson, invalidateJson } from "@/lib/request-cache";

describe("short-lived request cache", () => {
  afterEach(() => {
    invalidateJson();
    vi.unstubAllGlobals();
  });

  it("deduplicates concurrent and immediately repeated GETs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "camp-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      getJson<{ id: string }>("/api/camps/camp-1"),
      getJson<{ id: string }>("/api/camps/camp-1"),
    ]);
    const third = await getJson<{ id: string }>("/api/camps/camp-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.data?.id).toBe("camp-1");
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("refetches after mutation invalidation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getJson("/api/camps/camp-1/dashboard");
    invalidateJson("/api/camps/camp-1");
    await getJson("/api/camps/camp-1/dashboard");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
