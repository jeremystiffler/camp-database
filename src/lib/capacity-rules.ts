export type CapacityCourse = { cap: number | null; heldSeats?: number | null };
export type CapacityRoom = { capacity: number | null };

/** Sentinel for "no limit" when a value must be stored or compared as an integer. */
export const UNLIMITED = 2147483647;

/**
 * The single authoritative capacity calculation.
 *
 * The class cap is the ONLY thing that limits enrollment. Room capacity is
 * advisory: it describes the space, it does not gate registration. A class in a
 * room that holds 20 with a cap of 9 takes 9 campers; a class with no room at
 * all still takes its full cap. A blank cap means unlimited.
 */
export function effectiveCapacity(course: CapacityCourse): number {
  if (course.cap === null || course.cap === undefined || !Number.isFinite(course.cap)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, course.cap);
}

/** Seats offered to families: the class cap minus any seats held back by staff. */
export function publicCapacity(course: CapacityCourse): number {
  const capacity = effectiveCapacity(course);
  if (!Number.isFinite(capacity)) return Number.POSITIVE_INFINITY;
  return Math.max(0, capacity - Math.max(0, course.heldSeats ?? 0));
}

/** True when this class has no limit set and will accept unlimited registration. */
export function hasUnsetLimit(course: CapacityCourse): boolean {
  return !Number.isFinite(effectiveCapacity(course));
}

/**
 * Value for the denormalized Session.capacity column. Null means unlimited so
 * the column mirrors the class cap exactly rather than inventing a ceiling.
 */
export function storedCapacity(course: CapacityCourse): number | null {
  const capacity = effectiveCapacity(course);
  return Number.isFinite(capacity) ? capacity : null;
}

/**
 * Advisory only: the class is allowed to enroll more people than the room fits.
 * Surfaced as a warning so a stale room number is visible without blocking
 * anyone from being scheduled.
 */
export function exceedsRoom(course: CapacityCourse, room: CapacityRoom | null | undefined): boolean {
  if (!room || room.capacity === null || !Number.isFinite(room.capacity)) return false;
  const capacity = effectiveCapacity(course);
  if (!Number.isFinite(capacity)) return true;
  return capacity > room.capacity;
}

/** Human-readable seat count for UI. */
export function formatCapacity(course: CapacityCourse): string {
  const capacity = effectiveCapacity(course);
  return Number.isFinite(capacity) ? String(capacity) : "No limit";
}
