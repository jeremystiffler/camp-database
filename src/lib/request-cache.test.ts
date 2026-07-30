import { afterEach, describe, expect, it, vi } from "vitest";
import { getJson, invalidateJson } from "@/lib/request-cache";
import fs from "node:fs";
import path from "node:path";

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

describe("protected shell request deduplication", () => {
  it("does not bypass the shared cache for auth or event-list GETs", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const child = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(child);
        else if (entry.name.endsWith(".tsx")) files.push(child);
      }
    };
    walk("src/app/(protected)");

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/fetch\("\/api\/(?:auth\/me|camps)"\)/);
    }
  });
});
