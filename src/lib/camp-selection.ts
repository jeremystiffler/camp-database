export type AccessibleCamp = { id: string };

/**
 * Select only from the caller's accessible event list.
 *
 * A requested URL id that is absent from that list is denied, never trusted as
 * an event selection. A stale saved id simply falls back to the first event.
 */
export function resolveAccessibleCamp<T extends AccessibleCamp>(
  camps: T[],
  requestedId: string,
  savedId: string,
): { selected: T | null; deniedRequestedId: string | null } {
  const requested = requestedId ? camps.find((camp) => camp.id === requestedId) ?? null : null;
  const saved = savedId ? camps.find((camp) => camp.id === savedId) ?? null : null;
  return {
    selected: requested ?? saved ?? camps[0] ?? null,
    deniedRequestedId: requestedId && !requested ? requestedId : null,
  };
}
