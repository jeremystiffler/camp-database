import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { effectiveCapacity } from "@/lib/capacity-rules";
export { effectiveCapacity, publicCapacity } from "@/lib/capacity-rules";

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

export async function capacityForCourse(courseId: string, roomId?: string | null): Promise<number> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { cap: true, roomId: true, room: { select: { capacity: true } } },
  });
  if (!course) throw new CapacityError("invalid_capacity", "Class not found");
  const room = roomId && roomId !== course.roomId
    ? await prisma.room.findUnique({ where: { id: roomId }, select: { capacity: true } })
    : course.room;
  return effectiveCapacity(course, room);
}

type ClaimedEnrollment = {
  id: string;
  campId: string;
  camperId: string;
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
  camperId: string;
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
         FROM "Room" AS r
         LEFT JOIN "Course" AS c
           ON c."id" = (SELECT x."courseId" FROM "Session" AS x WHERE x."id" = $1)
        WHERE s."id" = $1
          AND s."campId" = $2
          AND r."id" = COALESCE(s."roomId", c."roomId")
          AND r."capacity" IS NOT NULL
          AND s."enrolledCount" < LEAST(
                COALESCE(c."cap", 2147483647),
                r."capacity",
                s."capacity"
              ) - (CASE WHEN $3 = 1 THEN GREATEST(COALESCE(c."heldSeats", 0), 0) ELSE 0 END)
        RETURNING s."id"
     ), inserted AS (
       INSERT INTO "Enrollment" ("id", "campId", "camperId", "sessionId", "status", "createdAt")
       SELECT $4, $2, $5, claimed."id", $6, NOW()
         FROM claimed
       RETURNING *
     )
     SELECT * FROM inserted`,
    input.sessionId,
    input.campId,
    heldSeatOffset,
    id,
    input.camperId,
    input.status || "enrolled",
  );

  if (rows.length === 0) {
    const session = await prisma.session.findFirst({
      where: { id: input.sessionId, campId: input.campId },
      select: {
        roomId: true,
        course: { select: { name: true, roomId: true, cap: true, heldSeats: true, room: { select: { name: true, capacity: true } } } },
      },
    });
    if (!session?.course?.roomId && !session?.roomId) {
      throw new CapacityError("session_has_no_room", `${session?.course?.name || "This class"} has no room assigned and cannot accept enrollment.`);
    }
    const roomName = session?.course?.room?.name;
    const roomCapacity = session?.course?.room?.capacity;
    throw new CapacityError(
      "session_full",
      `${session?.course?.name || "This class"} is full${roomCapacity ? ` (${roomName || "room"} limit: ${roomCapacity})` : ""}. Choose a different class.`,
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

/** Releases every seat for a camper before deleting the camper record. */
export async function releaseCamperEnrollments(camperId: string, campId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `WITH deleted AS (
       DELETE FROM "Enrollment"
        WHERE "camperId" = $1 AND "campId" = $2
        RETURNING "sessionId"
     ), counts AS (
       SELECT "sessionId", COUNT(*)::int AS n FROM deleted GROUP BY "sessionId"
     )
     UPDATE "Session" AS s
        SET "enrolledCount" = GREATEST(s."enrolledCount" - counts.n, 0)
       FROM counts
      WHERE s."id" = counts."sessionId"`,
    camperId,
    campId,
  );
}

export async function syncCourseSessionCapacities(courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { cap: true, room: { select: { capacity: true } } },
  });
  if (!course) return;
  const capacity = effectiveCapacity(course, course.room);
  await prisma.$executeRawUnsafe(
    `UPDATE "Session"
        SET "capacity" = GREATEST($2, "enrolledCount")
      WHERE "courseId" = $1`,
    courseId,
    capacity,
  );
}
