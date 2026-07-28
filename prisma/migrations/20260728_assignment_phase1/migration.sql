-- Phase 1 of the assignment & balancing spec: the floor, class status,
-- enrolment provenance, and optional participant preferences.
--
-- Backfill note: every EXISTING enrolment becomes source = 'admin'. The spec
-- requires this ("so nothing gets rebalanced unexpectedly"). Historic rows have
-- no recorded provenance, so treating them as deliberate human placements is the
-- only safe reading — a rebalance will leave every one of them alone.

-- Course: the floor alongside the ceiling, plus lifecycle status.
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "minEnrollment" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

-- A class cannot require more participants than it can hold. Unlimited classes
-- (cap IS NULL) are exempt: any floor is satisfiable when there is no ceiling.
ALTER TABLE "Course" DROP CONSTRAINT IF EXISTS course_min_enrollment_sane;
ALTER TABLE "Course" ADD CONSTRAINT course_min_enrollment_sane
  CHECK ("minEnrollment" >= 0 AND ("cap" IS NULL OR "minEnrollment" <= "cap"));

ALTER TABLE "Course" DROP CONSTRAINT IF EXISTS course_status_known;
ALTER TABLE "Course" ADD CONSTRAINT course_status_known
  CHECK ("status" IN ('active', 'hidden', 'cancelled'));

-- Enrollment provenance. Added nullable first so the backfill is explicit and
-- visible in this migration rather than an invisible consequence of a DEFAULT.
ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "source" TEXT;
UPDATE "Enrollment" SET "source" = 'admin' WHERE "source" IS NULL;
ALTER TABLE "Enrollment" ALTER COLUMN "source" SET DEFAULT 'admin';
ALTER TABLE "Enrollment" ALTER COLUMN "source" SET NOT NULL;

ALTER TABLE "Enrollment" DROP CONSTRAINT IF EXISTS enrollment_source_known;
ALTER TABLE "Enrollment" ADD CONSTRAINT enrollment_source_known
  CHECK ("source" IN ('auto', 'family', 'admin'));

CREATE INDEX IF NOT EXISTS "Enrollment_sessionId_source_idx"
  ON "Enrollment" ("sessionId", "source");

-- Participant preferences: optional, up to three course ids, soft input only.
ALTER TABLE "Camper" ADD COLUMN IF NOT EXISTS "preferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Camper" DROP CONSTRAINT IF EXISTS camper_preferences_max_three;
ALTER TABLE "Camper" ADD CONSTRAINT camper_preferences_max_three
  CHECK (array_length("preferences", 1) IS NULL OR array_length("preferences", 1) <= 3);
