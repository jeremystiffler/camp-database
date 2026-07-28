import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { detectIssues, type IssueInput } from "@/lib/issues";
import { arrangeRows, attentionScore, foldBlocks, EMPTY_FILTER } from "@/components/OperationsGrid";

/**
 * Phase 18b's whole point: every issue string in the product originates in ONE
 * module, and the surfaces can never disagree.
 *
 * The bug this replaces was real and shipped — the same "no limit set" condition
 * was worded two different ways in two different route files:
 *   dashboard/route.ts        "has no limit set and will accept..."
 *   registration-form/route.ts "has no class limit set and will accept..."
 */

const SURFACES = [
  "src/app/api/camps/[campId]/dashboard/route.ts",
  "src/app/api/camps/[campId]/registration-form/route.ts",
  "src/components/OperationsGrid.tsx",
];

describe("no surface authors its own issue strings", () => {
  it("every surface imports the engine", () => {
    for (const path of SURFACES) {
      const source = fs.readFileSync(path, "utf8");
      expect(source, `${path} must import @/lib/issues`).toContain("@/lib/issues");
    }
  });

  it("no surface hardcodes an issue sentence", () => {
    // These fragments belong to the engine alone. If one reappears in a route or
    // component, that surface has started authoring its own copy again.
    const fragments = [
      "has no limit set",
      "has no class limit set",
      "has no room assigned",
      "has no teacher assigned",
      "is not scheduled in any time block",
      "will accept unlimited registration",
    ];
    for (const path of SURFACES) {
      const source = fs.readFileSync(path, "utf8");
      for (const fragment of fragments) {
        expect(source, `${path} hardcodes "${fragment}" — it must come from @/lib/issues`).not.toContain(
          fragment,
        );
      }
    }
  });

  it("the divergent wording is gone from the codebase entirely", () => {
    const registration = fs.readFileSync(SURFACES[1], "utf8");
    expect(registration).not.toContain("has no class limit set");
  });

  it("the grid delegates its attention ordering instead of restating conditions", () => {
    const grid = fs.readFileSync(SURFACES[2], "utf8");
    expect(grid).toContain("detectIssues");
    // The old inline scoring used bare numeric bonuses. Those are gone.
    expect(grid).not.toContain("score += 100");
    expect(grid).not.toContain("score += 10");
  });
});

describe("the grid's ordering agrees with the engine", () => {
  const blocks = [
    { id: "b1", label: null, dayOfWeek: 1, startTime: "09:20", endTime: "09:45" },
    { id: "b2", label: null, dayOfWeek: 1, startTime: "09:45", endTime: "10:10" },
  ];
  const { columns } = foldBlocks(blocks as never);

  const overCapacity = {
    id: "over",
    name: "Snacktivities",
    cap: 20,
    room: { id: "r1", name: "Lobby", capacity: 60 },
    courseTeachers: [{ personId: "p1", person: { id: "p1", firstName: "Judi", lastName: "Reynolds" } }],
    courseAgeGroups: [{ ageGroupId: "g1" }],
    courseSessionTemplates: [{ sessionTemplateId: "b1" }],
    sessions: [{ id: "s1", sessionTemplateId: "b1", enrolledCount: 25 }],
  };
  const healthy = {
    id: "ok",
    name: "Drum Set",
    cap: 10,
    room: { id: "r1", name: "Lobby", capacity: 60 },
    courseTeachers: [{ personId: "p2", person: { id: "p2", firstName: "Brad", lastName: "Farley" } }],
    courseAgeGroups: [{ ageGroupId: "g1" }],
    courseSessionTemplates: [{ sessionTemplateId: "b1" }],
    sessions: [{ id: "s2", sessionTemplateId: "b1", enrolledCount: 5 }],
  };

  it("scores an activity the engine calls blocking above a healthy one", () => {
    expect(attentionScore(overCapacity as never, columns)).toBeGreaterThan(
      attentionScore(healthy as never, columns),
    );
  });

  it("scores a healthy activity at zero, matching an empty issue list", () => {
    const input: IssueInput = { courses: [healthy as never], blocks: blocks as never };
    expect(detectIssues(input)).toEqual([]);
    expect(attentionScore(healthy as never, columns)).toBe(0);
  });

  it("puts the engine's blocking activity first under the attention sort", () => {
    const rows = arrangeRows(
      [healthy as never, overCapacity as never],
      columns,
      "attention",
      EMPTY_FILTER,
    );
    expect(rows[0].name).toBe("Snacktivities");
  });

  it("agrees with the engine on which activities have any problem at all", () => {
    for (const course of [overCapacity, healthy]) {
      const engineSays = detectIssues({ courses: [course as never], blocks: blocks as never }).length > 0;
      const gridSays = attentionScore(course as never, columns) > 0;
      expect(gridSays, `disagreement on ${course.name}`).toBe(engineSays);
    }
  });
});
