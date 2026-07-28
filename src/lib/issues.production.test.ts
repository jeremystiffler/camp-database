import { describe, expect, it } from "vitest";
import snapshot from "@/lib/__fixtures__/production-event.json";
import { canOpenRegistration, countsByCode, detectIssues, issueCounts } from "@/lib/issues";

/**
 * The engine against the real production event (2027 Creator's Camp), exported
 * from Neon. Verifies the rules against genuine data shapes rather than only the
 * fixtures I invented — 31 activities, 40 time blocks, 150 sessions.
 *
 * Ground truth from a PER-CAMP query against production on 2026-07-28. An earlier
 * version of this test asserted 5 roomless and 2 teacherless, which came from a
 * query that spanned EVERY camp in the database. Creator's Camp itself is clean;
 * those counts belonged to Summer Camp, Lionheart Dad Camp and Hermes QA Camp.
 * The engine was right and the assertion was wrong.
 *
 *   2027 Creator's Camp: 31 courses, 0 roomless, 0 teacherless, 0 unset limits,
 *                        0 sessions over cap, 0 room clashes
 */

describe("the issue engine against real production data", () => {
  const issues = detectIssues(snapshot as never);
  const byCode = countsByCode(issues);

  it("loads the real event", () => {
    expect(snapshot.courses.length).toBeGreaterThan(20);
    expect(snapshot.blocks.length).toBe(40);
  });

  it("finds no overflow, so registration may open", () => {
    // Matches SQL: zero rows where enrolledCount > cap.
    expect(byCode["over-capacity"] ?? 0).toBe(0);
    expect(canOpenRegistration(issues)).toBe(true);
  });

  it("reports no roomless activities, matching the per-camp query", () => {
    expect(byCode["roomless"] ?? 0).toBe(0);
  });

  it("reports no teacherless activities, matching the per-camp query", () => {
    expect(byCode["no-teacher"] ?? 0).toBe(0);
  });

  it("reports no unset limits, matching SQL", () => {
    expect(byCode["no-limit-set"] ?? 0).toBe(0);
  });

  it("reports no room clashes, matching SQL", () => {
    expect(byCode["room-clash"] ?? 0).toBe(0);
  });

  it("does not raise coverage gaps for the 10 whole-event blocks", () => {
    // Opening and Closing Assembly carry no activities by design. An earlier
    // version of the rule produced 30 false gap warnings on this exact data.
    expect(byCode["age-group-gap"] ?? 0).toBe(0);
    const mandatory = snapshot.blocks.filter((block: { mandatory?: boolean }) => block.mandatory);
    expect(mandatory.length).toBe(10);
  });

  it("finds the real event completely clean", () => {
    expect(issues).toEqual([]);
  });

  it("keeps every advisory out of the blocking set on real data", () => {
    const advisories = issues.filter((issue) => issue.severity === "advisory");
    expect(advisories.every((issue) => issue.code !== "over-capacity")).toBe(true);
    expect(canOpenRegistration(issues)).toBe(true);
  });

  it("still detects a planted overflow in the real event", () => {
    // Proves the clean result above is a real finding, not the engine failing to
    // look. Plant one over-capacity session into the production snapshot.
    const planted = JSON.parse(JSON.stringify(snapshot));
    const target = planted.courses.find((course: { cap: number | null; sessions: unknown[] }) =>
      course.cap !== null && course.sessions.length > 0,
    );
    target.sessions[0].enrolledCount = target.cap + 7;
    const found = detectIssues(planted);
    expect(found.some((issue) => issue.code === "over-capacity")).toBe(true);
    expect(canOpenRegistration(found)).toBe(false);
  });

  it("produces no duplicate keys across the whole real event", () => {
    const keys = issues.map((issue) => issue.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every issue a non-empty message naming its activity or block", () => {
    for (const issue of issues) {
      expect(issue.message.length).toBeGreaterThan(0);
      expect(issue.message).not.toContain("undefined");
      expect(issue.message).not.toContain("NaN");
      expect(issue.message).not.toContain("null");
      expect(issue.message).not.toContain("Infinity");
    }
  });

  it("is stable across repeated runs on real data", () => {
    expect(JSON.stringify(detectIssues(snapshot as never))).toBe(JSON.stringify(issues));
  });

  it("summarises without throwing on 31 activities and 40 blocks", () => {
    const counts = issueCounts(issues);
    expect(counts.blocking).toBe(0);
    expect(counts.warning + counts.advisory).toBe(issues.length);
  });
});
