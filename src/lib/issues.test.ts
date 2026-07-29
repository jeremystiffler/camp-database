import { describe, expect, it } from "vitest";
import {
  BLOCKING_CODES,
  blockingIssues,
  canOpenRegistration,
  countsByCode,
  coversGroup,
  detectIssues,
  isAllAges,
  schedulableGroups,
  issueCounts,
  issuesForCourse,
  type IssueCourse,
  type IssueInput,
} from "@/lib/issues";

const blocks = [
  { id: "b1", label: null, dayOfWeek: 1, startTime: "09:20", endTime: "09:45" },
  { id: "b2", label: null, dayOfWeek: 1, startTime: "09:45", endTime: "10:10" },
];

const ageGroups = [
  { id: "g-young", name: "younger" },
  { id: "g-old", name: "older" },
];

function course(overrides: Partial<IssueCourse> & { id: string; name: string }): IssueCourse {
  return {
    cap: 10,
    room: { id: "r1", name: "Sanctuary", capacity: 60 },
    courseTeachers: [{ personId: "p1", person: { id: "p1", firstName: "Brad", lastName: "Farley" } }],
    courseAgeGroups: [{ ageGroupId: "g-young" }, { ageGroupId: "g-old" }],
    courseSessionTemplates: [{ sessionTemplateId: "b1" }],
    sessions: [{ id: "s1", sessionTemplateId: "b1", enrolledCount: 5 }],
    attentionDismissals: [],
    ...overrides,
  };
}

/** A well-formed event with nothing wrong: both blocks covered for both groups. */
function healthy(): IssueInput {
  return {
    courses: [
      course({
        id: "c1",
        name: "Choir",
        sessions: [
          { id: "s1", sessionTemplateId: "b1", enrolledCount: 5 },
          { id: "s2", sessionTemplateId: "b2", enrolledCount: 5 },
        ],
        courseSessionTemplates: [{ sessionTemplateId: "b1" }, { sessionTemplateId: "b2" }],
      }),
    ],
    blocks,
    ageGroups,
  };
}

describe("a healthy event produces no issues", () => {
  it("reports nothing at all", () => {
    expect(detectIssues(healthy())).toEqual([]);
  });

  it("allows registration to open", () => {
    expect(canOpenRegistration(detectIssues(healthy()))).toBe(true);
  });
});

describe("over capacity is the only blocking condition", () => {
  it("blocks when enrolment exceeds the class limit", () => {
    const input = healthy();
    input.courses[0].sessions![0].enrolledCount = 25;
    input.courses[0].cap = 20;
    const issues = detectIssues(input);
    const over = issues.find((issue) => issue.code === "over-capacity");
    expect(over).toBeDefined();
    expect(over!.severity).toBe("blocking");
    // Spec wording: "Get crafty is 1 over at 9:20" — the overage, not the raw pair.
    expect(over!.message).toContain("is 5 over");
    expect(canOpenRegistration(issues)).toBe(false);
  });

  it("does NOT fire when a class is exactly full — full is a success", () => {
    const input = healthy();
    input.courses[0].sessions![0].enrolledCount = 10; // cap is 10
    const issues = detectIssues(input);
    expect(issues.some((issue) => issue.code === "over-capacity")).toBe(false);
  });

  it("measures per session, not summed across blocks", () => {
    // 5 + 5 = 10 across two blocks, limit 8. Each session is under its own limit,
    // so summing would report a false overflow.
    const input = healthy();
    input.courses[0].cap = 8;
    const issues = detectIssues(input);
    expect(issues.some((issue) => issue.code === "over-capacity")).toBe(false);
  });

  it("names the specific block that is over", () => {
    const input = healthy();
    input.courses[0].cap = 6;
    input.courses[0].sessions![1].enrolledCount = 9;
    const over = detectIssues(input).filter((issue) => issue.code === "over-capacity");
    expect(over).toHaveLength(1);
    expect(over[0].blockId).toBe("b2");
    expect(over[0].message).toContain("9:45");
  });

  it("never blocks on an unlimited class, however many enrol", () => {
    const input = healthy();
    input.courses[0].cap = null;
    input.courses[0].sessions![0].enrolledCount = 5000;
    const issues = detectIssues(input);
    expect(issues.some((issue) => issue.code === "over-capacity")).toBe(false);
    expect(canOpenRegistration(issues)).toBe(true);
  });

  it("blocks on exactly the four conditions the spec lists", () => {
    // Dashboard spec 2.1: over capacity, room clash, teacher clash, seat
    // shortfall. Room-capacity mismatches are NOT here (build order 3.7).
    expect([...BLOCKING_CODES].sort()).toEqual([
      "over-capacity",
      "room-clash",
      "seat-shortfall",
      "teacher-clash",
    ]);
    expect(BLOCKING_CODES).not.toContain("cap-above-room");
    expect(BLOCKING_CODES).not.toContain("roomless");
    expect(BLOCKING_CODES).not.toContain("no-limit-set");
  });
});

describe("room and limit problems are advisory, never blocking (§3.7)", () => {
  it("treats a missing room as advisory and still allows registration", () => {
    const input = healthy();
    input.courses[0].room = null;
    const issues = detectIssues(input);
    const roomless = issues.find((issue) => issue.code === "roomless");
    expect(roomless!.severity).toBe("advisory");
    expect(canOpenRegistration(issues)).toBe(true);
  });

  it("treats a limit above room capacity as advisory", () => {
    const input = healthy();
    input.courses[0].cap = 80; // room holds 60
    const issues = detectIssues(input);
    const advisory = issues.find((issue) => issue.code === "cap-above-room");
    expect(advisory!.severity).toBe("advisory");
    expect(advisory!.message).toContain("Sanctuary");
    expect(advisory!.message).toContain("60");
    // Spec 2.1: room capacity is often an unverified estimate, so the wording is
    // deliberately soft — "is listed at", never "holds".
    expect(advisory!.message).toContain("is listed at");
    expect(advisory!.message).not.toContain("holds");
    expect(canOpenRegistration(issues)).toBe(true);
  });

  it("treats an unset limit as advisory, not an error", () => {
    const input = healthy();
    input.courses[0].cap = null;
    const issues = detectIssues(input);
    const unset = issues.find((issue) => issue.code === "no-limit-set");
    expect(unset!.severity).toBe("advisory");
    expect(canOpenRegistration(issues)).toBe(true);
  });

  it("keeps every advisory out of the blocking set", () => {
    const input = healthy();
    input.courses[0].room = null;
    input.courses[0].cap = null;
    expect(blockingIssues(detectIssues(input))).toEqual([]);
  });
});

describe("warnings", () => {
  it("flags an activity with no teacher", () => {
    const input = healthy();
    input.courses[0].courseTeachers = [];
    const issue = detectIssues(input).find((item) => item.code === "no-teacher");
    expect(issue!.severity).toBe("warning");
    expect(issue!.message).toBe("Choir has no teacher assigned");
  });

  it("flags an activity that is never scheduled", () => {
    const input = healthy();
    input.courses[0].sessions = [];
    input.courses[0].courseSessionTemplates = [];
    const issue = detectIssues(input).find((item) => item.code === "unscheduled");
    expect(issue!.severity).toBe("warning");
  });

  it("flags a scheduled activity with nobody enrolled", () => {
    const input = healthy();
    input.courses[0].sessions!.forEach((session) => (session.enrolledCount = 0));
    const issue = detectIssues(input).find((item) => item.code === "empty");
    expect(issue!.severity).toBe("warning");
  });

  it("does not report empty for an unscheduled activity — one problem, not two", () => {
    const input = healthy();
    input.courses[0].sessions = [];
    input.courses[0].courseSessionTemplates = [];
    const codes = detectIssues(input).map((issue) => issue.code);
    expect(codes).toContain("unscheduled");
    expect(codes).not.toContain("empty");
  });
});

describe("room clash", () => {
  it("reports two activities in one room in the same block", () => {
    const input: IssueInput = {
      courses: [
        course({ id: "c1", name: "Choir" }),
        course({ id: "c2", name: "Drum Set", sessions: [{ id: "s2", sessionTemplateId: "b1", enrolledCount: 3 }] }),
      ],
      blocks,
      ageGroups,
    };
    const clash = detectIssues(input).find((issue) => issue.code === "room-clash");
    expect(clash).toBeDefined();
    // A double-booked room means the event cannot physically run (spec 2.1).
    // 3.7 makes room CAPACITY advisory; it does not make double-booking benign.
    expect(clash!.severity).toBe("blocking");
    expect(clash!.message).toContain("Sanctuary");
    expect(clash!.message).toContain("two activities");
  });

  it("does not report a clash when the rooms differ", () => {
    const input: IssueInput = {
      courses: [
        course({ id: "c1", name: "Choir" }),
        course({
          id: "c2",
          name: "Drum Set",
          room: { id: "r2", name: "Green Room", capacity: 20 },
          sessions: [{ id: "s2", sessionTemplateId: "b1", enrolledCount: 3 }],
        }),
      ],
      blocks,
      ageGroups,
    };
    expect(detectIssues(input).some((issue) => issue.code === "room-clash")).toBe(false);
  });

  it("does not report a clash when the blocks differ", () => {
    const input: IssueInput = {
      courses: [
        course({ id: "c1", name: "Choir" }),
        course({ id: "c2", name: "Drum Set", sessions: [{ id: "s2", sessionTemplateId: "b2", enrolledCount: 3 }] }),
      ],
      blocks,
      ageGroups,
    };
    expect(detectIssues(input).some((issue) => issue.code === "room-clash")).toBe(false);
  });

  it("does not report an activity clashing with itself", () => {
    const input: IssueInput = {
      courses: [
        course({
          id: "c1",
          name: "Choir",
          sessions: [
            { id: "s1", sessionTemplateId: "b1", enrolledCount: 3 },
            { id: "s1b", sessionTemplateId: "b1", enrolledCount: 3 },
          ],
        }),
      ],
      blocks,
      ageGroups,
    };
    expect(detectIssues(input).some((issue) => issue.code === "room-clash")).toBe(false);
  });

  it("ignores roomless activities — nothing to clash over", () => {
    const input: IssueInput = {
      courses: [
        course({ id: "c1", name: "Choir", room: null }),
        course({ id: "c2", name: "Drum Set", room: null, sessions: [{ id: "s2", sessionTemplateId: "b1", enrolledCount: 3 }] }),
      ],
      blocks,
      ageGroups,
    };
    expect(detectIssues(input).some((issue) => issue.code === "room-clash")).toBe(false);
  });
});

describe("teacher clash", () => {
  const persons = [{ id: "p1", firstName: "Brad", lastName: "Farley" }];

  it("reports one teacher in two activities in the same block", () => {
    const input: IssueInput = {
      courses: [
        course({ id: "c1", name: "Choir" }),
        course({
          id: "c2",
          name: "Drum Set",
          room: { id: "r2", name: "Green Room", capacity: 20 },
          sessions: [{ id: "s2", sessionTemplateId: "b1", enrolledCount: 3 }],
        }),
      ],
      blocks,
      ageGroups,
      persons,
    };
    const clash = detectIssues(input).find((issue) => issue.code === "teacher-clash");
    expect(clash).toBeDefined();
    expect(clash!.severity).toBe("blocking");
    // Spec wording: "Judi Reynolds is in two rooms at 11:25".
    expect(clash!.message).toContain("Brad Farley");
    expect(clash!.message).toContain("in two rooms");
  });

  it("does not report a clash for different teachers", () => {
    const input: IssueInput = {
      courses: [
        course({ id: "c1", name: "Choir" }),
        course({
          id: "c2",
          name: "Drum Set",
          room: { id: "r2", name: "Green Room", capacity: 20 },
          courseTeachers: [{ personId: "p2", person: { id: "p2", firstName: "Sam", lastName: "Hall" } }],
          sessions: [{ id: "s2", sessionTemplateId: "b1", enrolledCount: 3 }],
        }),
      ],
      blocks,
      ageGroups,
      persons,
    };
    expect(detectIssues(input).some((issue) => issue.code === "teacher-clash")).toBe(false);
  });

  it("prefers session teachers over course teachers when set", () => {
    const input: IssueInput = {
      courses: [
        course({ id: "c1", name: "Choir", sessions: [{ id: "s1", sessionTemplateId: "b1", enrolledCount: 3, sessionTeachers: [{ personId: "p9" }] }] }),
        course({
          id: "c2",
          name: "Drum Set",
          room: { id: "r2", name: "Green Room", capacity: 20 },
          sessions: [{ id: "s2", sessionTemplateId: "b1", enrolledCount: 3, sessionTeachers: [{ personId: "p9" }] }],
        }),
      ],
      blocks,
      ageGroups,
      persons: [{ id: "p9", firstName: "Judi", lastName: "Reynolds" }],
    };
    const clash = detectIssues(input).find((issue) => issue.code === "teacher-clash");
    expect(clash!.message).toContain("Judi Reynolds");
  });
});

describe("age group gap", () => {
  it("reports a group with no activity in a block", () => {
    const input: IssueInput = {
      courses: [
        course({
          id: "c1",
          name: "Choir",
          courseAgeGroups: [{ ageGroupId: "g-old" }],
          courseSessionTemplates: [{ sessionTemplateId: "b1" }, { sessionTemplateId: "b2" }],
          sessions: [
            { id: "s1", sessionTemplateId: "b1", enrolledCount: 3 },
            { id: "s2", sessionTemplateId: "b2", enrolledCount: 3 },
          ],
        }),
      ],
      blocks,
      ageGroups,
    };
    const gaps = detectIssues(input).filter((issue) => issue.code === "age-group-gap");
    // younger has nothing in either block.
    expect(gaps).toHaveLength(2);
    expect(gaps.every((gap) => gap.message.includes("younger"))).toBe(true);
  });

  it("treats an activity with no age group as covering everyone", () => {
    // This is the same all-ages rule the grid's age filter uses.
    const input: IssueInput = {
      courses: [
        course({
          id: "c1",
          name: "Snacktivities",
          courseAgeGroups: [],
          courseSessionTemplates: [{ sessionTemplateId: "b1" }, { sessionTemplateId: "b2" }],
          sessions: [
            { id: "s1", sessionTemplateId: "b1", enrolledCount: 3 },
            { id: "s2", sessionTemplateId: "b2", enrolledCount: 3 },
          ],
        }),
      ],
      blocks,
      ageGroups,
    };
    expect(detectIssues(input).some((issue) => issue.code === "age-group-gap")).toBe(false);
  });
});

describe("unscheduled age groups and all-ages activities (owner ruling 2026-07-28)", () => {
  const groups = [
    { id: "older", name: "Older" },
    { id: "younger", name: "Younger" },
    { id: "prek", name: "Pre K", noSchedule: true },
  ];
  const blocks = [
    { id: "b1", label: "Session 1", dayOfWeek: 1, startTime: "09:00", endTime: "09:30" },
    { id: "b2", label: "Session 2", dayOfWeek: 1, startTime: "09:30", endTime: "10:00" },
  ];
  const choir = {
    id: "c1",
    name: "Choir",
    cap: 50,
    room: { id: "r1", name: "Sanctuary", capacity: 200 },
    courseAgeGroups: [{ ageGroupId: "older" }, { ageGroupId: "younger" }],
    courseTeachers: [{ person: { id: "p1", firstName: "Judi", lastName: "Reynolds" } }],
    sessions: [
      { id: "s1", sessionTemplateId: "b1", enrolledCount: 3 },
      { id: "s2", sessionTemplateId: "b2", enrolledCount: 3 },
    ],
  };

  it("treats an activity tagged on every schedulable group as all-ages", () => {
    const sched = schedulableGroups(groups);
    expect(sched.map((g) => g.id)).toEqual(["older", "younger"]);
    expect(isAllAges(choir, sched)).toBe(true);
  });

  it("still treats an untagged activity as all-ages", () => {
    expect(isAllAges({ courseAgeGroups: [] }, schedulableGroups(groups))).toBe(true);
  });

  it("does not treat a single-group activity as all-ages", () => {
    const olderOnly = { courseAgeGroups: [{ ageGroupId: "older" }] };
    const sched = schedulableGroups(groups);
    expect(isAllAges(olderOnly, sched)).toBe(false);
    expect(coversGroup(olderOnly, "older", sched)).toBe(true);
    expect(coversGroup(olderOnly, "younger", sched)).toBe(false);
  });

  it("raises no coverage gap for a group that never takes classes", () => {
    const issues = detectIssues({
      courses: [choir],
      blocks,
      ageGroups: groups,
      participantsByAgeGroup: { older: 5, younger: 5, prek: 9 },
    } as never);
    expect(issues.filter((i) => i.code === "age-group-gap")).toHaveLength(0);
  });

  it("raises the gap again if that group is marked schedulable", () => {
    // Sabotage-check: the silence above must come from the flag, not from the
    // coverage rule having quietly stopped working.
    const issues = detectIssues({
      courses: [choir],
      blocks,
      ageGroups: groups.map((g) => ({ id: g.id, name: g.name })),
      participantsByAgeGroup: { older: 5, younger: 5, prek: 9 },
    } as never);
    const gaps = issues.filter((i) => i.code === "age-group-gap");
    expect(gaps).toHaveLength(2);
    expect(gaps[0].message).toContain("Pre K");
  });

  it("counts no seat shortfall against an unscheduled group", () => {
    const issues = detectIssues({
      courses: [choir],
      blocks,
      ageGroups: groups,
      participantsByAgeGroup: { prek: 500 },
    } as never);
    expect(issues.filter((i) => i.code === "seat-shortfall")).toHaveLength(0);
  });

  it("an all-ages activity covers every schedulable group at once", () => {
    const issues = detectIssues({
      courses: [choir],
      blocks,
      ageGroups: groups,
      participantsByAgeGroup: { older: 5, younger: 5 },
    } as never);
    expect(issues.filter((i) => i.code === "age-group-gap")).toHaveLength(0);
  });
});

describe("whole-event blocks are not coverage gaps", () => {
  it("does not report a gap in a mandatory block", () => {
    // Opening and Closing Assembly have zero activities BY DESIGN — everyone
    // attends together. Before this rule, real production data produced 30
    // false "Older has nothing at Closing Assembly" warnings.
    const input: IssueInput = {
      courses: [],
      blocks: [{ id: "assembly", label: "Closing Assembly", dayOfWeek: 1, startTime: "11:50", endTime: "12:00", mandatory: true }],
      ageGroups,
    };
    expect(detectIssues(input).some((issue) => issue.code === "age-group-gap")).toBe(false);
  });

  it("still reports a gap in an ordinary block", () => {
    const input: IssueInput = {
      courses: [],
      blocks: [{ id: "b1", label: "Session 1", dayOfWeek: 1, startTime: "09:20", endTime: "09:45", mandatory: false }],
      ageGroups,
    };
    expect(detectIssues(input).filter((issue) => issue.code === "age-group-gap")).toHaveLength(2);
  });

  it("does not report a seat shortfall in a mandatory block", () => {
    const input: IssueInput = {
      courses: [course({ id: "c1", name: "Choir", cap: 1, sessions: [{ id: "s1", sessionTemplateId: "assembly", enrolledCount: 1 }] })],
      blocks: [{ id: "assembly", label: "Opening Assembly", dayOfWeek: 1, startTime: "09:00", endTime: "09:20", mandatory: true }],
      ageGroups: [ageGroups[0]],
      participantsByAgeGroup: { "g-young": 500 },
    };
    expect(detectIssues(input).some((issue) => issue.code === "seat-shortfall")).toBe(false);
  });
});

describe("seat shortfall", () => {
  it("reports more participants than seats in a block", () => {
    const input: IssueInput = {
      courses: [course({ id: "c1", name: "Choir", cap: 5 })],
      blocks: [blocks[0]],
      ageGroups: [ageGroups[0]],
      participantsByAgeGroup: { "g-young": 12 },
    };
    const shortfall = detectIssues(input).find((issue) => issue.code === "seat-shortfall");
    expect(shortfall).toBeDefined();
    expect(shortfall!.severity).toBe("blocking");
    // Spec wording: "10:10 offers 70 seats for 84 participants".
    expect(shortfall!.message).toContain("offers 5 seats");
    expect(shortfall!.message).toContain("12");
  });

  it("does not report a shortfall when seats are sufficient", () => {
    const input: IssueInput = {
      courses: [course({ id: "c1", name: "Choir", cap: 30 })],
      blocks: [blocks[0]],
      ageGroups: [ageGroups[0]],
      participantsByAgeGroup: { "g-young": 12 },
    };
    expect(detectIssues(input).some((issue) => issue.code === "seat-shortfall")).toBe(false);
  });

  it("never reports a shortfall when an unlimited activity runs in the block", () => {
    const input: IssueInput = {
      courses: [
        course({ id: "c1", name: "Choir", cap: 2 }),
        course({ id: "c2", name: "Devotional", cap: null, room: { id: "r2", name: "Chapel", capacity: 200 } }),
      ],
      blocks: [blocks[0]],
      ageGroups: [ageGroups[0]],
      participantsByAgeGroup: { "g-young": 500 },
    };
    expect(detectIssues(input).some((issue) => issue.code === "seat-shortfall")).toBe(false);
  });
});

describe("cancelled and dismissed", () => {
  it("ignores a cancelled activity entirely", () => {
    const input = healthy();
    input.courses[0].status = "cancelled";
    input.courses[0].courseTeachers = [];
    input.courses[0].room = null;
    const issues = detectIssues(input);
    expect(issues.some((issue) => issue.courseId === "c1")).toBe(false);
  });

  it("honours a dismissed teacher warning", () => {
    const input = healthy();
    input.courses[0].courseTeachers = [];
    input.courses[0].attentionDismissals = ["teacher"];
    expect(detectIssues(input).some((issue) => issue.code === "no-teacher")).toBe(false);
  });

  it("honours a dismissed limit advisory", () => {
    const input = healthy();
    input.courses[0].cap = null;
    input.courses[0].attentionDismissals = ["limit"];
    expect(detectIssues(input).some((issue) => issue.code === "no-limit-set")).toBe(false);
  });
});

describe("one string per condition", () => {
  it("produces exactly one message for the unset-limit condition", () => {
    // The bug this module exists to kill: the same condition worded two ways in
    // two files ("has no limit set" vs "has no class limit set").
    const input = healthy();
    input.courses[0].cap = null;
    const messages = detectIssues(input)
      .filter((issue) => issue.code === "no-limit-set")
      .map((issue) => issue.message);
    expect(messages).toEqual(["Choir has no limit set and will accept unlimited registration"]);
  });

  it("gives every issue a stable unique key", () => {
    const input = healthy();
    input.courses[0].cap = null;
    input.courses[0].room = null;
    const issues = detectIssues(input);
    const keys = issues.map((issue) => issue.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("is deterministic — identical input yields identical output", () => {
    const a = JSON.stringify(detectIssues(healthy()));
    const b = JSON.stringify(detectIssues(healthy()));
    expect(a).toBe(b);
  });

  it("orders blocking first, then warnings, then advisories", () => {
    const input = healthy();
    input.courses[0].cap = 2; // over capacity
    input.courses[0].room = null; // advisory
    input.courses[0].courseTeachers = []; // warning
    const severities = detectIssues(input).map((issue) => issue.severity);
    const ranked = severities.map((severity) => ({ blocking: 0, warning: 1, advisory: 2 })[severity]);
    expect(ranked).toEqual([...ranked].sort((a, b) => a - b));
  });

  it("never mutates its input", () => {
    const input = healthy();
    const before = JSON.stringify(input);
    detectIssues(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("helpers the surfaces use", () => {
  it("counts by severity", () => {
    const input = healthy();
    input.courses[0].cap = 2;
    input.courses[0].room = null;
    const counts = issueCounts(detectIssues(input));
    expect(counts.blocking).toBeGreaterThan(0);
    expect(counts.advisory).toBeGreaterThan(0);
  });

  it("counts by code", () => {
    const input = healthy();
    input.courses[0].room = null;
    expect(countsByCode(detectIssues(input))["roomless"]).toBe(1);
  });

  it("filters to one activity", () => {
    const input: IssueInput = {
      courses: [
        course({ id: "c1", name: "Choir", room: null }),
        course({ id: "c2", name: "Drum Set", room: null, sessions: [{ id: "s2", sessionTemplateId: "b2", enrolledCount: 3 }] }),
      ],
      blocks,
      ageGroups,
    };
    const issues = detectIssues(input);
    expect(issuesForCourse(issues, "c1").every((issue) => issue.courseId === "c1")).toBe(true);
    expect(issuesForCourse(issues, "c1").length).toBeGreaterThan(0);
  });

  it("handles an empty event without throwing", () => {
    expect(detectIssues({ courses: [] })).toEqual([]);
    expect(canOpenRegistration([])).toBe(true);
  });
});
