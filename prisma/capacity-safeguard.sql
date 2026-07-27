-- Capacity safeguard migration (idempotent after Prisma adds columns).
-- Legacy over-enrolments are preserved by grandfathering Session.capacity at the
-- current count. New claims also compare with live room/course capacity, so they
-- cannot grow until the overflow is resolved.

UPDATE "Session" AS s
   SET "capacity" = GREATEST(
     s."enrolledCount",
     LEAST(COALESCE(c."cap", 2147483647), r."capacity")
   )
  FROM "Course" AS c, "Room" AS r
 WHERE s."courseId" = c."id"
   AND r."id" = COALESCE(s."roomId", c."roomId")
   AND r."capacity" IS NOT NULL;

UPDATE "Session" AS s
   SET "capacity" = GREATEST(s."enrolledCount", r."capacity")
  FROM "Room" AS r
 WHERE s."courseId" IS NULL
   AND r."id" = s."roomId"
   AND r."capacity" IS NOT NULL;

ALTER TABLE "Course"
  DROP CONSTRAINT IF EXISTS "course_held_seats_nonnegative",
  ADD CONSTRAINT "course_held_seats_nonnegative" CHECK ("heldSeats" >= 0);

ALTER TABLE "Session"
  DROP CONSTRAINT IF EXISTS "session_capacity_never_exceeded",
  ADD CONSTRAINT "session_capacity_never_exceeded"
    CHECK ("enrolledCount" >= 0 AND "enrolledCount" <= "capacity");
