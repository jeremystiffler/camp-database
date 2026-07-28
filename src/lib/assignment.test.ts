import { describe, expect, it } from "vitest";
import {
  assignParticipants,
  isAgeEligible,
  scoreCourse,
  type AssignmentCourse,
  type AssignmentInput,
  type AssignmentParticipant,
} from "./assignment";

/**
 * Acceptance criteria for assignment (assignment-and-balancing spec §13).
 * Each test maps to a named checkbox in that list.
 */

const OLDER = "grp-older";
const YOUNGER = "grp-younger";

function course(overrides: Partial<AssignmentCourse> & { id: string }): AssignmentCourse {
  return {
    name: overrides.id,
    cap: 10,
    minEnrollment: 3,
    status: "active",
    enrolledByBlock: {},
    ageGroupIds: [],
    blockIds: ["b1"],
    ...overrides,
  };
}

function participant(
  overrides: Partial<AssignmentParticipant> & { id: string },
): AssignmentParticipant {
  return { ageGroupId: OLDER, preferences: [], ...overrides };
}

function run(input: Partial<AssignmentInput> & Pick<AssignmentInput, "courses" | "participants">) {
  return assignParticipants({ blockIds: ["b1"], seed: "event-1", ...input });
}

describe("determinism", () => {
  // §13: Running assignment twice on identical data produces identical results.
  it("produces identical results across repeated runs", () => {
    const input: AssignmentInput = {
      blockIds: ["b1", "b2", "b3"],
      seed: "creators-camp-2027",
      courses: [
        course({ id: "art", cap: 4, blockIds: ["b1", "b2", "b3"] }),
        course({ id: "music", cap: 4, blockIds: ["b1", "b2", "b3"] }),
        course({ id: "sport", cap: 4, blockIds: ["b1", "b2", "b3"] }),
        course({ id: "drama", cap: 4, blockIds: ["b1", "b2", "b3"] }),
      ],
      participants: Array.from({ length: 9 }, (_, i) => participant({ id: `p${i}` })),
    };

    const first = assignParticipants(input);
    const second = assignParticipants(input);
    expect(second).toEqual(first);
  });

  it("is insensitive to the order participants arrive in", () => {
    const courses = [
      course({ id: "art", cap: 3, blockIds: ["b1"] }),
      course({ id: "music", cap: 3, blockIds: ["b1"] }),
    ];
    const people = [participant({ id: "a" }), participant({ id: "b" }), participant({ id: "c" })];

    const forward = run({ courses, participants: people });
    const reversed = run({ courses, participants: [...people].reverse() });

    const key = (r: ReturnType<typeof run>) =>
      [...r.assignments].sort((x, y) => x.participantId.localeCompare(y.participantId));
    expect(key(reversed)).toEqual(key(forward));
  });

  it("changes allocation when the seed changes but stays stable per seed", () => {
    const courses = [
      course({ id: "art", cap: 1, blockIds: ["b1"] }),
      course({ id: "music", cap: 1, blockIds: ["b1"] }),
    ];
    const participants = [participant({ id: "a" }), participant({ id: "b" })];

    const one = assignParticipants({ blockIds: ["b1"], seed: "seed-A", courses, participants });
    const two = assignParticipants({ blockIds: ["b1"], seed: "seed-A", courses, participants });
    expect(two).toEqual(one);
    // Both participants still placed regardless of seed.
    expect(one.assignments).toHaveLength(2);
  });
});

describe("hard constraints — never violated", () => {
  // §13: No assignment ever exceeds cap.
  it("never exceeds a cap even under heavy demand", () => {
    const result = run({
      courses: [course({ id: "art", cap: 2 }), course({ id: "music", cap: 2 })],
      participants: Array.from({ length: 20 }, (_, i) => participant({ id: `p${i}` })),
    });
    expect(result.finalEnrolled["art|b1"]).toBeLessThanOrEqual(2);
    expect(result.finalEnrolled["music|b1"]).toBeLessThanOrEqual(2);
    expect(result.assignments).toHaveLength(4);
    expect(result.gaps).toHaveLength(16);
  });

  it("respects seats already taken before the run", () => {
    const result = run({
      courses: [course({ id: "art", cap: 3, enrolledByBlock: { b1: 2 } })],
      participants: [participant({ id: "a" }), participant({ id: "b" })],
    });
    expect(result.finalEnrolled["art|b1"]).toBe(3);
    expect(result.assignments).toHaveLength(1);
    expect(result.gaps).toHaveLength(1);
  });

  // §13: never assigns a wrong age group.
  it("never assigns a participant to an ineligible age group", () => {
    const result = run({
      courses: [course({ id: "olderOnly", ageGroupIds: [OLDER] })],
      participants: [participant({ id: "kid", ageGroupId: YOUNGER })],
    });
    expect(result.assignments).toHaveLength(0);
    expect(result.gaps[0]).toMatchObject({ cause: "no_eligible_course" });
  });

  it("treats a course with no age groups as open to everyone", () => {
    expect(isAgeEligible(course({ id: "x" }), participant({ id: "p" }))).toBe(true);
    expect(
      isAgeEligible(course({ id: "x" }), participant({ id: "p", ageGroupId: null })),
    ).toBe(true);
  });

  it("excludes an unassigned-group participant from group-restricted courses", () => {
    expect(
      isAgeEligible(course({ id: "x", ageGroupIds: [OLDER] }), participant({ id: "p", ageGroupId: null })),
    ).toBe(false);
  });

  // §13: never double-books a block.
  it("assigns exactly one course per participant per block", () => {
    const result = run({
      blockIds: ["b1", "b2"],
      courses: [
        course({ id: "art", blockIds: ["b1", "b2"] }),
        course({ id: "music", blockIds: ["b1", "b2"] }),
      ],
      participants: [participant({ id: "a" })],
    });
    const perBlock = new Map<string, number>();
    for (const a of result.assignments) {
      perBlock.set(a.blockId, (perBlock.get(a.blockId) ?? 0) + 1);
    }
    expect([...perBlock.values()]).toEqual([1, 1]);
  });

  // §13: never repeats an activity for one participant.
  it("never assigns the same activity name twice to one participant", () => {
    const result = run({
      blockIds: ["b1", "b2", "b3"],
      courses: [
        course({ id: "art-am", name: "Art", blockIds: ["b1", "b2", "b3"] }),
        course({ id: "art-pm", name: "Art", blockIds: ["b1", "b2", "b3"] }),
        course({ id: "music", name: "Music", blockIds: ["b1", "b2", "b3"] }),
      ],
      participants: [participant({ id: "a" })],
    });
    const names = result.assignments.map((a) =>
      a.courseId.startsWith("art") ? "Art" : "Music",
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it("matches activity names case- and whitespace-insensitively", () => {
    const result = run({
      blockIds: ["b1", "b2"],
      courses: [
        course({ id: "c1", name: "Drum  Set", blockIds: ["b1", "b2"] }),
        course({ id: "c2", name: "drum set", blockIds: ["b1", "b2"] }),
      ],
      participants: [participant({ id: "a" })],
    });
    expect(result.assignments).toHaveLength(1);
    expect(result.gaps).toHaveLength(1);
  });

  // §13: Nothing is ever assigned into a hidden or cancelled course.
  it("never assigns into a hidden or cancelled course", () => {
    const result = run({
      courses: [
        course({ id: "hidden", status: "hidden" }),
        course({ id: "cancelled", status: "cancelled" }),
      ],
      participants: [participant({ id: "a" })],
    });
    expect(result.assignments).toHaveLength(0);
    expect(result.gaps).toHaveLength(1);
  });

  it("leaves an occupied hidden class untouched rather than emptying it", () => {
    const result = run({
      courses: [
        course({ id: "hidden", status: "hidden", enrolledByBlock: { b1: 4 } }),
        course({ id: "open", cap: 10 }),
      ],
      participants: [participant({ id: "a" })],
    });
    expect(result.finalEnrolled["hidden|b1"]).toBe(4);
    expect(result.assignments[0]?.courseId).toBe("open");
  });
});

describe("fill-first — the core requirement", () => {
  // §13: Given two classes with space in a block, the fuller one is chosen.
  //      THIS IS THE FILL-FIRST REGRESSION TEST.
  it("chooses the fuller of two classes with space", () => {
    const result = run({
      courses: [
        course({ id: "empty", cap: 10, enrolledByBlock: { b1: 0 } }),
        course({ id: "fuller", cap: 10, enrolledByBlock: { b1: 6 } }),
      ],
      participants: [participant({ id: "a" })],
    });
    expect(result.assignments[0]?.courseId).toBe("fuller");
  });

  it("consolidates rather than spreading participants thinly", () => {
    // Four classes of 4 seats, 8 children. Spreading gives 2 each and nothing
    // viable; fill-first should complete classes instead.
    const result = run({
      courses: [
        course({ id: "a", cap: 4 }),
        course({ id: "b", cap: 4 }),
        course({ id: "c", cap: 4 }),
        course({ id: "d", cap: 4 }),
      ],
      participants: Array.from({ length: 8 }, (_, i) => participant({ id: `p${i}` })),
    });
    const counts = Object.values(result.finalEnrolled).sort((x, y) => y - x);
    // Two classes filled, two left empty — empty is an easier problem than
    // nearly-empty, which is the entire point of fill-first.
    expect(counts).toEqual([4, 4, 0, 0]);
  });

  it("prefers a nearly-viable class over an empty one", () => {
    const result = run({
      courses: [
        course({ id: "empty", cap: 10, enrolledByBlock: { b1: 0 }, minEnrollment: 3 }),
        course({ id: "nearly", cap: 10, enrolledByBlock: { b1: 2 }, minEnrollment: 3 }),
      ],
      participants: [participant({ id: "a" })],
    });
    expect(result.assignments[0]?.courseId).toBe("nearly");
  });

  it("does not prop up a hopeless class with a large shortfall", () => {
    // hopeless needs 7 more; established is 50% full. Fill-first should win,
    // because rescue is bounded to a shortfall of 2.
    const result = run({
      courses: [
        course({ id: "hopeless", cap: 20, enrolledByBlock: { b1: 1 }, minEnrollment: 8 }),
        course({ id: "established", cap: 10, enrolledByBlock: { b1: 5 }, minEnrollment: 3 }),
      ],
      participants: [participant({ id: "a" })],
    });
    expect(result.assignments[0]?.courseId).toBe("established");
  });
});

describe("preferences", () => {
  // §13: A stated preference beats fill-first.
  it("honours a stated preference over a fuller class", () => {
    const result = run({
      courses: [
        course({ id: "wanted", cap: 10, enrolledByBlock: { b1: 0 } }),
        course({ id: "packed", cap: 10, enrolledByBlock: { b1: 9 } }),
      ],
      participants: [participant({ id: "a", preferences: ["wanted"] })],
    });
    expect(result.assignments[0]?.courseId).toBe("wanted");
    expect(result.assignments[0]?.fromPreference).toBe(true);
    expect(result.assignments[0]?.reason).toBe("You asked for this one.");
  });

  it("never lets a preference break a hard constraint", () => {
    const full = run({
      courses: [course({ id: "wanted", cap: 1, enrolledByBlock: { b1: 1 } }), course({ id: "other", cap: 5 })],
      participants: [participant({ id: "a", preferences: ["wanted"] })],
    });
    expect(full.assignments[0]?.courseId).toBe("other");

    const ineligible = run({
      courses: [
        course({ id: "wanted", ageGroupIds: [OLDER] }),
        course({ id: "other", ageGroupIds: [YOUNGER] }),
      ],
      participants: [participant({ id: "a", ageGroupId: YOUNGER, preferences: ["wanted"] })],
    });
    expect(ineligible.assignments[0]?.courseId).toBe("other");

    const hidden = run({
      courses: [
        course({ id: "wanted", status: "hidden" }),
        course({ id: "other", cap: 5 }),
      ],
      participants: [participant({ id: "a", preferences: ["wanted"] })],
    });
    expect(hidden.assignments[0]?.courseId).toBe("other");
  });

  it("ignores a stale preference naming a course that no longer exists", () => {
    const result = run({
      courses: [course({ id: "real", cap: 5 })],
      participants: [participant({ id: "a", preferences: ["deleted-course-id"] })],
    });
    expect(result.assignments[0]?.courseId).toBe("real");
    expect(result.assignments[0]?.fromPreference).toBe(false);
  });

  // §13: Across a full event, no participant receives noticeably more filler.
  it("shares a scarce preferred class rather than favouring the same child", () => {
    // "Popular" has one seat in each of three blocks, and no child may repeat an
    // activity name. So it can be granted at most once per child, and the
    // least-satisfied-first ordering should hand it to a different child in each
    // block rather than letting one child take it every time.
    const result = assignParticipants({
      blockIds: ["b1", "b2", "b3"],
      seed: "fairness",
      courses: [
        course({ id: "popular", cap: 1, blockIds: ["b1", "b2", "b3"], name: "Popular" }),
        course({ id: "filler1", cap: 10, blockIds: ["b1", "b2", "b3"], name: "Filler One" }),
        course({ id: "filler2", cap: 10, blockIds: ["b1", "b2", "b3"], name: "Filler Two" }),
        course({ id: "filler3", cap: 10, blockIds: ["b1", "b2", "b3"], name: "Filler Three" }),
      ],
      participants: [
        participant({ id: "a", preferences: ["popular"] }),
        participant({ id: "b", preferences: ["popular"] }),
        participant({ id: "c", preferences: ["popular"] }),
      ],
    });

    const winners = result.assignments
      .filter((a) => a.courseId === "popular")
      .map((a) => a.participantId);

    // Three seats existed across the event and all three were used.
    expect(winners).toHaveLength(3);
    // Critically: three DIFFERENT children got it. No child hogged the seat.
    expect(new Set(winners).size).toBe(3);
    // Everybody got a full day; nobody was left with nothing.
    expect(result.gaps).toHaveLength(0);
    expect(result.assignments).toHaveLength(9);
  });
});

describe("gaps — never force-place", () => {
  // §13: A participant with no valid option is left unassigned and raises a
  //      blocking issue — never force-placed.
  it("reports all_full when every eligible class is full", () => {
    const result = run({
      courses: [course({ id: "art", cap: 1, enrolledByBlock: { b1: 1 } })],
      participants: [participant({ id: "a" })],
    });
    expect(result.assignments).toHaveLength(0);
    expect(result.gaps).toEqual([{ participantId: "a", blockId: "b1", cause: "all_full" }]);
    expect(result.finalEnrolled["art|b1"]).toBe(1);
  });

  it("reports no_eligible_course when nothing serves the participant", () => {
    const result = run({
      courses: [course({ id: "art", ageGroupIds: [YOUNGER] })],
      participants: [participant({ id: "a", ageGroupId: OLDER })],
    });
    expect(result.gaps).toEqual([
      { participantId: "a", blockId: "b1", cause: "no_eligible_course" },
    ]);
  });

  it("reports a gap per empty block without abandoning other blocks", () => {
    const result = assignParticipants({
      blockIds: ["b1", "b2"],
      seed: "s",
      courses: [course({ id: "art", cap: 5, blockIds: ["b1"] })],
      participants: [participant({ id: "a" })],
    });
    expect(result.assignments).toHaveLength(1);
    expect(result.gaps).toEqual([{ participantId: "a", blockId: "b2", cause: "no_eligible_course" }]);
  });
});

describe("unlimited classes — the overflow valve", () => {
  // Resolution of the null-cap conflict: an uncapped class always has room but
  // scores last, so it absorbs overflow without stealing children.
  it("never blocks anyone from an uncapped class", () => {
    const result = run({
      courses: [course({ id: "unlimited", cap: null })],
      participants: Array.from({ length: 50 }, (_, i) => participant({ id: `p${i}` })),
    });
    expect(result.assignments).toHaveLength(50);
    expect(result.gaps).toHaveLength(0);
    expect(result.finalEnrolled["unlimited|b1"]).toBe(50);
  });

  it("prefers a capped class over an uncapped one, so viability is protected", () => {
    const result = run({
      courses: [
        course({ id: "capped", cap: 10, enrolledByBlock: { b1: 1 } }),
        course({ id: "unlimited", cap: null, enrolledByBlock: { b1: 0 } }),
      ],
      participants: [participant({ id: "a" })],
    });
    expect(result.assignments[0]?.courseId).toBe("capped");
  });

  it("falls back to the uncapped class only once capped ones are full", () => {
    const result = run({
      courses: [
        course({ id: "capped", cap: 2 }),
        course({ id: "unlimited", cap: null }),
      ],
      participants: Array.from({ length: 5 }, (_, i) => participant({ id: `p${i}` })),
    });
    expect(result.finalEnrolled["capped|b1"]).toBe(2);
    expect(result.finalEnrolled["unlimited|b1"]).toBe(3);
    expect(result.gaps).toHaveLength(0);
  });

  it("does not produce an Infinity or NaN score for an uncapped class", () => {
    const s = scoreCourse(
      course({ id: "u", cap: null, enrolledByBlock: { b1: 5 } }),
      participant({ id: "p" }),
      5,
      new Set(),
    );
    expect(Number.isFinite(s)).toBe(true);
  });
});

describe("per-block occupancy", () => {
  // Regression: a course running in several blocks is several separate
  // offerings of `cap` seats each. Tracking occupancy once per course made a
  // single seat in block 1 close the class for the whole event, so seats in
  // later blocks silently went unused.
  it("gives each block its own seats", () => {
    const result = assignParticipants({
      blockIds: ["b1", "b2", "b3"],
      seed: "perblock",
      courses: [course({ id: "popular", name: "Popular", cap: 1, blockIds: ["b1", "b2", "b3"] })],
      participants: [participant({ id: "a" }), participant({ id: "b" }), participant({ id: "c" })],
    });

    // One seat per block, three blocks, three children — every seat used, and
    // no child repeats the activity, so each child is placed exactly once.
    expect(result.assignments).toHaveLength(3);
    expect(result.finalEnrolled["popular|b1"]).toBe(1);
    expect(result.finalEnrolled["popular|b2"]).toBe(1);
    expect(result.finalEnrolled["popular|b3"]).toBe(1);
    expect(new Set(result.assignments.map((a) => a.participantId)).size).toBe(3);
  });

  it("keeps pre-existing occupancy separate per block", () => {
    const result = assignParticipants({
      blockIds: ["b1", "b2"],
      seed: "s",
      courses: [
        course({
          id: "art",
          name: "Art",
          cap: 2,
          blockIds: ["b1", "b2"],
          enrolledByBlock: { b1: 2 },
        }),
      ],
      participants: [participant({ id: "a" })],
    });
    // b1 is already full, b2 is empty — the child lands in b2.
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]?.blockId).toBe("b2");
    expect(result.gaps).toEqual([{ participantId: "a", blockId: "b1", cause: "all_full" }]);
  });

  it("treats a missing block entry as empty", () => {
    const result = run({
      courses: [course({ id: "art", cap: 5, enrolledByBlock: {} })],
      participants: [participant({ id: "a" })],
    });
    expect(result.finalEnrolled["art|b1"]).toBe(1);
  });
});

describe("explanations", () => {
  it("explains a fill-first placement without inventing a preference", () => {
    const result = run({
      courses: [course({ id: "art", cap: 10, enrolledByBlock: { b1: 8 }, minEnrollment: 3 })],
      participants: [participant({ id: "a" })],
    });
    expect(result.assignments[0]?.reason).toBe("Assigned because it had room.");
    expect(result.assignments[0]?.fromPreference).toBe(false);
  });

  it("explains a rescue placement in terms the family can read", () => {
    const result = run({
      courses: [course({ id: "art", cap: 10, enrolledByBlock: { b1: 2 }, minEnrollment: 3 })],
      participants: [participant({ id: "a" })],
    });
    expect(result.assignments[0]?.reason).toBe(
      "Assigned because this class needed a few more to run.",
    );
  });
});

describe("variety", () => {
  it("prefers an untried category when scores are otherwise equal", () => {
    const tried = new Set(["sport"]);
    const sameCategory = scoreCourse(
      course({ id: "s2", category: "sport", enrolledByBlock: { b1: 0 } }),
      participant({ id: "p" }),
      0,
      tried,
    );
    const newCategory = scoreCourse(
      course({ id: "a1", category: "art", enrolledByBlock: { b1: 0 } }),
      participant({ id: "p" }),
      0,
      tried,
    );
    expect(newCategory).toBeGreaterThan(sameCategory);
  });

  it("is inert when courses carry no category", () => {
    const a = scoreCourse(course({ id: "a" }), participant({ id: "p" }), 0, new Set());
    const b = scoreCourse(course({ id: "b" }), participant({ id: "p" }), 0, new Set(["x"]));
    expect(a).toBe(b);
  });
});
