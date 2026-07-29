import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { storedCapacity } from "@/lib/capacity-rules";
export { effectiveCapacity, publicCapacity, storedCapacity, hasUnsetLimit, exceedsRoom, formatCapacity } from "@/lib/capacity-rules";

export class CapacityError extends Error {
  status = 409;
  code: "session_full" | "session_has_no_room" | "capacity_reduction_blocked" | "invalid_capacity";
  details?: unknown;

  constructor(code: CapacityError["code"], message: string, details?: unknown) {
    super(message);
    this.name = "CapacityError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Seats for a class. Room is irrelevant: the class cap is the only limit.
 * Returns null when the class has no cap set (unlimited).
 */
export async function capacityForCourse(courseId: string): Promise<number | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { cap: true },
  });
  if (!course) throw new CapacityError("invalid_capacity", "Class not found");
  return storedCapacity(course);
}

type ClaimedEnrollment = {
  id: string;
  campId: string;
  participantId: string;
  sessionId: string;
  status: string;
  createdAt: Date;
};

/**
 * Atomically claims a seat and creates the enrollment in one PostgreSQL statement.
 * A duplicate enrollment or failed insert rolls back the seat increment with the CTE.
 */
export async function claimSeat(input: {
  campId: string;
  participantId: string;
  sessionId: string;
  status?: string;
  allowHeldSeat?: boolean;
}): Promise<ClaimedEnrollment> {
  const id = randomUUID();
  const heldSeatOffset = input.allowHeldSeat ? 0 : 1;
  const rows = await prisma.$queryRawUnsafe<ClaimedEnrollment[]>(
    `WITH claimed AS (
       UPDATE "Session" AS s
          SET "enrolledCount" = s."enrolledCount" + 1
         FROM "Course" AS c
        WHERE s."id" = $1
          AND s."campId" = $2
          AND c."id" = s."courseId"
          AND s."enrolledCount" < COALESCE(c."cap", 2147483647)
              - (CASE WHEN $3 = 1 THEN GREATEST(COALESCE(c."heldSeats", 0), 0) ELSE 0 END)
        RETURNING s."id"
     ), inserted AS (
       INSERT INTO "Enrollment" ("id", "campId", "participantId", "sessionId", "status", "createdAt")
       SELECT $4, $2, $5, claimed."id", $6, NOW()
         FROM claimed
       RETURNING *
     )
     SELECT * FROM inserted`,
    input.sessionId,
    input.campId,
    heldSeatOffset,
    id,
    input.participantId,
    input.status || "enrolled",
  );

  if (rows.length === 0) {
    const session = await prisma.session.findFirst({
      where: { id: input.sessionId, campId: input.campId },
      select: {
        course: { select: { name: true, cap: true, heldSeats: true } },
      },
    });
    const name = session?.course?.name || "This class";
    const cap = session?.course?.cap;
    throw new CapacityError(
      "session_full",
      `${name} is full${typeof cap === "number" ? ` (limit: ${cap})` : ""}. Choose a different class.`,
    );
  }
  return rows[0];
}

/** Atomically deletes one enrollment and releases its seat without underflow. */
export async function releaseEnrollment(enrollmentId: string, campId: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ sessionId: string }>>(
    `WITH deleted AS (
       DELETE FROM "Enrollment"
        WHERE "id" = $1 AND "campId" = $2
        RETURNING "sessionId"
     ), released AS (
       UPDATE "Session" AS s
          SET "enrolledCount" = GREATEST(s."enrolledCount" - 1, 0)
         FROM deleted
        WHERE s."id" = deleted."sessionId"
        RETURNING s."id" AS "sessionId"
     )
     SELECT "sessionId" FROM released`,
    enrollmentId,
    campId,
  );
  return rows.length > 0;
}

/** Releases every seat for a participant before deleting the participant record. */
export async function releaseParticipantEnrollments(participantId: string, campId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `WITH deleted AS (
       DELETE FROM "Enrollment"
        WHERE "participantId" = $1 AND "campId" = $2
        RETURNING "sessionId"
     ), counts AS (
       SELECT "sessionId", COUNT(*)::int AS n FROM deleted GROUP BY "sessionId"
     )
     UPDATE "Session" AS s
        SET "enrolledCount" = GREATEST(s."enrolledCount" - counts.n, 0)
       FROM counts
      WHERE s."id" = counts."sessionId"`,
    participantId,
    campId,
  );
}

export async function syncCourseSessionCapacities(courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { cap: true },
  });
  if (!course) return;
  const capacity = storedCapacity(course);
  if (capacity === null) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Session" SET "capacity" = NULL WHERE "courseId" = $1`,
      courseId,
    );
    return;
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "Session"
        SET "capacity" = GREATEST($2, "enrolledCount")
      WHERE "courseId" = $1`,
    courseId,
    capacity,
  );
}
