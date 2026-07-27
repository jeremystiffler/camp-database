export type CapacityCourse = { cap: number | null; heldSeats?: number | null };
export type CapacityRoom = { capacity: number | null };

/** The single authoritative capacity calculation. No room means no seats. */
export function effectiveCapacity(course: CapacityCourse, room: CapacityRoom | null | undefined): number {
  if (!room || room.capacity === null || !Number.isFinite(room.capacity) || room.capacity <= 0) return 0;
  const courseCap = course.cap === null || !Number.isFinite(course.cap) ? Number.POSITIVE_INFINITY : Math.max(0, course.cap);
  return Math.min(courseCap, room.capacity);
}

export function publicCapacity(course: CapacityCourse, room: CapacityRoom | null | undefined): number {
  return Math.max(0, effectiveCapacity(course, room) - Math.max(0, course.heldSeats ?? 0));
}
