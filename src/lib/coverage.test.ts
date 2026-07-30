import { describe, expect, it } from "vitest";
import {
  buildCoverage,
  cellState,
  coverageLine,
  coverageSummary,
  headroom,
  remediesFor,
  worstFirst,
  type CoverageCourse,
} from "@/lib/coverage";

/** Coverage — dashboard spec §4, Slice 4. */

const groups = [
  { id: "older", name: "Older" },
  { id: "younger", name: "Younger" },
  { id: "prek", name: "Pre K", noSchedule: true },
];
const schedulable = [groups[0], groups[1]];

const blocks = [
  { id: "b920", label: "9:20am" },
  { id: "b1035", label: "10:35am" },
  { id: "assembly", label: "Opening Assembly", mandatory: true },
];
const columns = [
  { key: "c920", label: "9:20am", blockIds: ["b920"] },
  { key: "c1035", label: "10:35am", blockIds: ["b1035"] },
  { key: "cassembly", label: "Opening Assembly", blockIds: ["assembly"] },
];

const course = (over: Partial<CoverageCourse> & { id: string }): CoverageCourse => ({
  name: over.id,
  cap: 10,
  courseAgeGroups: [],
  sessions: [],
  ...over,
});

describe("headroom is per block per age group, never aggregated (§4.2)", () => {
  // THE CENTRAL CASE. Total spare across groups looks comfortable; one group is
  // short. Any check that sums calls this healthy right up until it isn't.
  const courses = [
    course({
      id: "older-only",
      cap: 10,
      courseAgeGroups: [{ ageGroupId: "older" }],
      sessions: [{ id: "s1", sessionTemplateId: "b920", enrolledCount: 10 }],
    }),
    course({
      id: "younger-roomy",
      cap: 40,
      courseAgeGroups: [{ ageGroupId: "younger" }],
      sessions: [{ id: "s2", sessionTemplateId: "b920", enrolledCount: 5 }],
    }),
  ];

  it("reports the shortage for the group that has it", () => {
    const older = headroom(courses, columns[0], groups[0], schedulable);
    expect(older.seats).toBe(10);
    expect(older.taken).toBe(10);
    expect(older.spare).toBe(0);
  });

  it("does not let another group's spare seats mask it", () => {
    const younger = headroom(courses, columns[0], groups[1], schedulable);
    expect(younger.spare).toBe(35);
    // Aggregated, this block has 35 spare of 50 — comfortable by any total.
    const matrix = buildCoverage({
      courses,
      blocks,
      columns,
      ageGroups: groups,
      participantsByAgeGroup: { older: 20, younger: 40 },
    });
    const olderCell = matrix.cells.find((c) => c.groupId === "older" && c.columnKey === "c920")!;
    expect(olderCell.state).toBe("short");
    const youngerCell = matrix.cells.find((c) => c.groupId === "younger" && c.columnKey === "c920")!;
    expect(youngerCell.state).toBe("comfortable");
  });

  it("counts an all-ages class toward every schedulable group", () => {
    // Tagged with every schedulable group = open to all (owner ruling).
    const allAges = [
      course({
        id: "choir",
        cap: 50,
        courseAgeGroups: [{ ageGroupId: "older" }, { ageGroupId: "younger" }],
        sessions: [{ id: "s1", sessionTemplateId: "b920", enrolledCount: 3 }],
      }),
    ];
    expect(headroom(allAges, columns[0], groups[0], schedulable).seats).toBe(50);
    expect(headroom(allAges, columns[0], groups[1], schedulable).seats).toBe(50);
  });
});

describe("fragile is orthogonal to seat state (§4.1)", () => {
  it("flags a period with plenty of spare but only one class", () => {
    // Nine spare places, all in one class. One teacher calls in sick and the
    // block collapses.
    const courses = [
      course({
        id: "solo",
        cap: 30,
        courseAgeGroups: [{ ageGroupId: "older" }],
        sessions: [{ id: "s1", sessionTemplateId: "b920", enrolledCount: 21 }],
      }),
    ];
    const matrix = buildCoverage({
      courses,
      blocks,
      columns,
      ageGroups: groups,
      participantsByAgeGroup: { older: 30 },
    });
    const cell = matrix.cells.find((c) => c.groupId === "older" && c.columnKey === "c920")!;
    expect(cell.spare).toBe(9);
    expect(cell.state).toBe("comfortable");
    expect(cell.fragile).toBe(true);
  });

  it("does not flag fragile when two classes serve the group", () => {
    const courses = [
      course({ id: "a", courseAgeGroups: [{ ageGroupId: "older" }], sessions: [{ id: "s1", sessionTemplateId: "b920", enrolledCount: 1 }] }),
      course({ id: "b", courseAgeGroups: [{ ageGroupId: "older" }], sessions: [{ id: "s2", sessionTemplateId: "b920", enrolledCount: 1 }] }),
    ];
    const matrix = buildCoverage({ courses, blocks, columns, ageGroups: groups, participantsByAgeGroup: { older: 10 } });
    const cell = matrix.cells.find((c) => c.groupId === "older" && c.columnKey === "c920")!;
    expect(cell.fragile).toBe(false);
  });

  it("stacks fragile with a shortage", () => {
    const courses = [
      course({ id: "solo", cap: 5, courseAgeGroups: [{ ageGroupId: "older" }], sessions: [{ id: "s1", sessionTemplateId: "b920", enrolledCount: 5 }] }),
    ];
    const matrix = buildCoverage({ courses, blocks, columns, ageGroups: groups, participantsByAgeGroup: { older: 10 } });
    const cell = matrix.cells.find((c) => c.groupId === "older" && c.columnKey === "c920")!;
    expect(cell.state).toBe("short");
    expect(cell.fragile).toBe(true);
  });
});

describe("cell states (§4.3)", () => {
  it("no options when nothing serves the group", () => {
    expect(cellState(0, 0, 20)).toBe("none");
  });

  it("short at or below zero spare", () => {
    expect(cellState(0, 2, 20)).toBe("short");
    expect(cellState(-3, 2, 20)).toBe("short");
  });

  it("tight below 10% of expected size", () => {
    expect(cellState(1, 2, 20)).toBe("tight");
    expect(cellState(3, 2, 100)).toBe("tight");
  });

  it("comfortable at or above 10%", () => {
    expect(cellState(2, 2, 20)).toBe("comfortable");
    expect(cellState(10, 2, 100)).toBe("comfortable");
  });

  it("treats any spare as comfortable before anyone registers", () => {
    // Nobody signed up yet: a shortage cannot honestly be asserted.
    expect(cellState(1, 1, 0)).toBe("comfortable");
  });
});

describe("unscheduled groups and mandatory blocks are excluded", () => {
  const courses = [
    course({ id: "a", courseAgeGroups: [{ ageGroupId: "older" }], sessions: [{ id: "s1", sessionTemplateId: "b920", enrolledCount: 1 }] }),
  ];
  const matrix = buildCoverage({ courses, blocks, columns, ageGroups: groups, participantsByAgeGroup: { older: 5, prek: 9 } });

  it("gives a daycare group no headroom row at all", () => {
    expect(matrix.groups.map((g) => g.id)).toEqual(["older", "younger"]);
    expect(matrix.cells.some((c) => c.groupId === "prek")).toBe(false);
  });

  it("does not treat a whole-event block as a coverage column", () => {
    expect(matrix.columns.map((c) => c.key)).toEqual(["c920", "c1035"]);
    expect(matrix.cells.some((c) => c.columnKey === "cassembly")).toBe(false);
  });
});

describe("worst-first ordering and copy (§4.3)", () => {
  const cells = [
    { columnKey: "a", groupId: "g", groupName: "Older", seats: 5, taken: 3, spare: 2, activeClasses: 3, state: "tight" as const, fragile: false, unlimited: false },
    { columnKey: "b", groupId: "g", groupName: "Older", seats: 0, taken: 0, spare: 0, activeClasses: 0, state: "none" as const, fragile: false, unlimited: false },
    { columnKey: "c", groupId: "g", groupName: "Older", seats: 5, taken: 7, spare: -2, activeClasses: 2, state: "short" as const, fragile: false, unlimited: false },
    { columnKey: "d", groupId: "g", groupName: "Older", seats: 20, taken: 1, spare: 19, activeClasses: 1, state: "comfortable" as const, fragile: true, unlimited: false },
    { columnKey: "e", groupId: "g", groupName: "Older", seats: 20, taken: 1, spare: 19, activeClasses: 4, state: "comfortable" as const, fragile: false, unlimited: false },
  ];

  it("orders no-options, then short, then fragile, then tight", () => {
    expect(worstFirst(cells).map((c) => c.columnKey)).toEqual(["b", "c", "d", "a"]);
  });

  it("omits healthy cells from the callout", () => {
    expect(worstFirst(cells).some((c) => c.columnKey === "e")).toBe(false);
  });

  it("never reports a tight cell as if it were good news", () => {
    // "47 spare" inside a list headed "6 time blocks need attention" undercuts the
    // warning it belongs to.
    const tight = cells[0];
    const line = coverageLine(tight, "11:25am");
    expect(line).toContain("only 2 spare for the group");
    expect(line).not.toBe("11:25am · Older · 2 spare");
  });

  it("writes a line that explains itself", () => {
    expect(coverageLine(cells[2], "10:35am")).toBe("10:35am · Older · 2 places short");
    expect(coverageLine(cells[1], "11:25am")).toBe("11:25am · Older · nothing on offer");
    expect(coverageLine(cells[3], "11:25am")).toBe("11:25am · Older · only one option");
  });

  it("uses a singular place for a shortage of one", () => {
    const one = { ...cells[2], spare: -1 };
    expect(coverageLine(one, "9:20am")).toBe("9:20am · Older · 1 place short");
  });

  it("summarises by period, not by cell", () => {
    // Two groups short in the same period is one period needing attention.
    const twoGroupsOneperiod = [
      { ...cells[2], columnKey: "same" },
      { ...cells[2], columnKey: "same", groupName: "Younger" },
    ];
    expect(coverageSummary({ columns: [], groups: [], cells: twoGroupsOneperiod, flagged: twoGroupsOneperiod }).periods).toBe(1);
  });

  it("says so plainly when nothing needs attention", () => {
    expect(coverageSummary({ columns: [], groups: [], cells: [], flagged: [] }).headline).toBe(
      "Every time block has room and a choice",
    );
  });
});

describe("the flag is the fix (§4.4)", () => {
  const hidden = course({
    id: "drums",
    name: "Drum Set",
    cap: 8,
    status: "hidden",
    courseAgeGroups: [{ ageGroupId: "older" }],
    sessions: [{ id: "s9", sessionTemplateId: "b920", enrolledCount: 1 }],
  });
  const live = course({
    id: "art",
    name: "Art",
    cap: 5,
    courseAgeGroups: [{ ageGroupId: "older" }],
    sessions: [{ id: "s1", sessionTemplateId: "b920", enrolledCount: 5 }],
  });
  const cell = {
    columnKey: "c920", groupId: "older", groupName: "Older",
    seats: 5, taken: 5, spare: 0, activeClasses: 1,
    state: "short" as const, fragile: true, unlimited: false,
  };

  it("always offers adding a class", () => {
    const remedies = remediesFor(cell, [live], columns[0], schedulable);
    expect(remedies.some((r) => r.kind === "add")).toBe(true);
  });

  it("offers raising a cap when a class already serves the group here", () => {
    const remedies = remediesFor(cell, [live], columns[0], schedulable);
    expect(remedies.find((r) => r.kind === "raise")).toMatchObject({ courseId: "art" });
  });

  it("offers un-hide only when a hidden class fits, with its spare count", () => {
    const remedies = remediesFor(cell, [live, hidden], columns[0], schedulable);
    const unhide = remedies.find((r) => r.kind === "unhide");
    expect(unhide?.label).toBe("Un-hide Drum Set (7 places)");
  });

  it("does not offer a full hidden class as a remedy", () => {
    const full = { ...hidden, sessions: [{ id: "s9", sessionTemplateId: "b920", enrolledCount: 8 }] };
    const remedies = remediesFor(cell, [live, full], columns[0], schedulable);
    expect(remedies.some((r) => r.kind === "unhide")).toBe(false);
  });

  it("does not offer a hidden class for the wrong group", () => {
    const youngerOnly = { ...hidden, courseAgeGroups: [{ ageGroupId: "younger" }] };
    const remedies = remediesFor(cell, [live, youngerOnly], columns[0], schedulable);
    expect(remedies.some((r) => r.kind === "unhide")).toBe(false);
  });

  it("offers no cap raise where nothing serves the group at all", () => {
    const noOptions = { ...cell, activeClasses: 0, state: "none" as const, fragile: false };
    const remedies = remediesFor(noOptions, [], columns[0], schedulable);
    expect(remedies.map((r) => r.kind)).toEqual(["add"]);
  });
});

describe("classes with no cap set", () => {
  it("marks the cell unlimited rather than inventing a shortage", () => {
    const courses = [
      course({ id: "nocap", cap: null, courseAgeGroups: [{ ageGroupId: "older" }], sessions: [{ id: "s1", sessionTemplateId: "b920", enrolledCount: 4 }] }),
    ];
    const result = headroom(courses, columns[0], groups[0], schedulable);
    expect(result.unlimited).toBe(true);
    expect(result.activeClasses).toBe(1);
  });
});
