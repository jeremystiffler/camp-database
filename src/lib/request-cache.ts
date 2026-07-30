export type JsonResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
};

type CacheEntry = {
  expiresAt: number;
  promise: Promise<JsonResult<unknown>>;
};

const cache = new Map<string, CacheEntry>();

/**
 * Short-lived GET cache shared by client components.
 *
 * React route layouts and pages mount independently, but they often ask for the
 * same session, event list, and event summary during one navigation. Keeping the
 * in-flight promise here means one URL produces one network request while still
 * expiring quickly enough for operational screens.
 */
export function getJson<T>(url: string, dedupeMs = 1500): Promise<JsonResult<T>> {
  const now = Date.now();
  const existing = cache.get(url);
  if (existing && existing.expiresAt > now) return existing.promise as Promise<JsonResult<T>>;

  const promise = fetch(url, { method: "GET" })
    .then(async (response) => ({
      ok: response.ok,
      status: response.status,
      data: await response.json().catch(() => null) as T | null,
    }))
    .catch((error) => {
      cache.delete(url);
      throw error;
    });

  cache.set(url, { expiresAt: now + dedupeMs, promise: promise as Promise<JsonResult<unknown>> });
  return promise;
}

export function invalidateJson(url?: string) {
  if (!url) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key === url || key.startsWith(`${url}/`) || key.startsWith(`${url}?`)) cache.delete(key);
  }
}
