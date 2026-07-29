import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { claimSeat, CapacityError } from "@/lib/capacity";
import { prisma } from "@/lib/db";

/**
 * Real database concurrency proof for the global done-gate.
 *
 * Normal `npm test` skips this because it creates short-lived rows in the live
 * QA event. Run deliberately with:
 *
 *   RUN_DB_CONCURRENCY=1 npx vitest run src/lib/capacity.concurrency.test.ts
 *
 * Every fixture has a random UUID and the finally block deletes it even when an
 * assertion fails. No production event or participant data is edited.
 */
const run = process.env.RUN_DB_CONCURRENCY === "1" ? describe : describe.skip;

run("one remaining seat under two simultaneous claims", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("yields exactly one enrollment and one session_full rejection", async () => {
    const qa = await prisma.user.findUnique({
      where: { email: "print-qa-20260718@simpleschedulepro.test" },
      select: { campMembers: { select: { campId: true }, take: 1 } },
    });
    const campId = qa?.campMembers[0]?.campId;
    expect(campId, "The least-privilege QA user must own an isolated event").toBeTruthy();

    const suffix = randomUUID();
    const courseId = `concurrency-course-${suffix}`;
    const sessionId = `concurrency-session-${suffix}`;
    const camperAId = `concurrency-camper-a-${suffix}`;
    const camperBId = `concurrency-camper-b-${suffix}`;

    try {
      await prisma.course.create({
        data: {
          id: courseId,
          campId: campId!,
          name: `Concurrency probe ${suffix}`,
          cap: 1,
          minEnrollment: 1,
        },
      });
      await prisma.session.create({
        data: { id: sessionId, campId: campId!, courseId, enrolledCount: 0 },
      });
      await Promise.all([
        prisma.camper.create({
          data: { id: camperAId, campId: campId!, firstName: "Concurrency", lastName: "Probe A" },
        }),
        prisma.camper.create({
          data: { id: camperBId, campId: campId!, firstName: "Concurrency", lastName: "Probe B" },
        }),
      ]);

      // Do not await one before starting the other: both SQL statements are in
      // flight against the same Session row and its single remaining seat.
      const results = await Promise.allSettled([
        claimSeat({ campId: campId!, camperId: camperAId, sessionId }),
        claimSeat({ campId: campId!, camperId: camperBId, sessionId }),
      ]);

      const successes = results.filter((result) => result.status === "fulfilled");
      const failures = results.filter((result) => result.status === "rejected");
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect((failures[0] as PromiseRejectedResult).reason).toBeInstanceOf(CapacityError);
      expect((failures[0] as PromiseRejectedResult).reason.code).toBe("session_full");

      const [session, enrollmentCount] = await Promise.all([
        prisma.session.findUnique({ where: { id: sessionId }, select: { enrolledCount: true } }),
        prisma.enrollment.count({ where: { sessionId } }),
      ]);
      expect(session?.enrolledCount).toBe(1);
      expect(enrollmentCount).toBe(1);
    } finally {
      // Enrollment cascades from Session, but delete explicitly so cleanup is
      // understandable and remains safe if relation behavior changes.
      await prisma.enrollment.deleteMany({ where: { sessionId } });
      await prisma.session.deleteMany({ where: { id: sessionId } });
      await prisma.camper.deleteMany({ where: { id: { in: [camperAId, camperBId] } } });
      await prisma.course.deleteMany({ where: { id: courseId } });
    }
  }, 30_000);
});
