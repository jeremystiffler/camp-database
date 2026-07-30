import { describe, expect, it } from "vitest";
import fs from "node:fs";

const PAGE = "src/app/(protected)/schedule/page.tsx";
const source = fs.readFileSync(PAGE, "utf8");

/**
 * Build order 18d: replace Course Matrix and Capacity Heatmap with the operations
 * grid, cutting /schedule from six views to five.
 *
 * §8 is explicit that this phase is "the phase most likely to be skipped" and that
 * unlinking a view while leaving its component in the bundle "means the reduction
 * accomplished nothing and the surface grows back. Delete the code." These tests
 * assert the code is gone, not merely unreachable.
 */

describe("the two replaced views are deleted, not just unlinked", () => {
  it("has no CoursePivot component", () => {
    expect(source).not.toContain("function CoursePivot");
    expect(source).not.toContain("<CoursePivot");
  });

  it("has no CapacityHeatmap component", () => {
    expect(source).not.toContain("function CapacityHeatmap");
    expect(source).not.toContain("<CapacityHeatmap");
  });

  it("has no route to either view", () => {
    expect(source).not.toContain("coursePivot");
    expect(source).not.toContain('"capacity"');
  });

  it("no longer offers either label in the view picker", () => {
    expect(source).not.toContain("Course Matrix");
    expect(source).not.toContain("Capacity Heatmap");
  });

  it("leaves no helper behind that only those views used", () => {
    // ageGroupNames was read by Course Matrix alone. A definition with no callers
    // is exactly the residue §8 warns about.
    expect(source).not.toContain("function ageGroupNames");
  });
});

describe("/schedule offers five views, down from six", () => {
  const options = source.match(/\{ id: "[a-zA-Z]+", label: "[^"]+"/g) ?? [];

  it("declares exactly five", () => {
    expect(options).toHaveLength(5);
  });

  it("keeps the four views 18d does not touch", () => {
    for (const label of ["Day × Time", "Room × Time", "Teacher × Time", "List"]) {
      expect(source).toContain(label);
    }
  });

  it("adds the grid as the fifth", () => {
    expect(source).toContain('id: "grid"');
    expect(source).toContain("Activities by time block");
  });

  it("opens on Activities by time block by default", () => {
    expect(source).toContain('useState<ScheduleView>("grid")');
  });

  it("keeps Day × Time one selection away", () => {
    expect(source).toContain('{ id: "dayGrid", label: "Day × Time"');
  });

  it("makes the View control a prominent branded control", () => {
    expect(source).toContain("bg-[var(--brand-strong)]");
    expect(source).toContain("min-w-64");
    expect(source).toContain("text-base font-extrabold");
  });

  it("declares the view union with exactly those five ids", () => {
    const union = source.match(/type ScheduleView = ([^;]+);/)![1];
    const ids = union.split("|").map((part) => part.trim().replace(/"/g, ""));
    expect(ids.sort()).toEqual(["dayGrid", "grid", "list", "roomPivot", "teacherPivot"]);
  });
});

describe("the grid is wired to real data", () => {
  it("imports the shared component rather than reimplementing a grid", () => {
    expect(source).toContain('from "@/components/OperationsGrid"');
    expect(source).toContain("<OperationsGrid");
  });

  it("loads age groups from the canonical event payload", () => {
    expect(source).toContain("camp?.ageGroups");
    expect(source).not.toContain("/age-groups");
  });

  it("feeds the grid RAW sessions, not the deduped display list", () => {
    // The grid folds repeating days itself. Passing displaySessions or
    // filteredSessions would hide days twice and under-report enrolment.
    const block = source.slice(source.indexOf("const gridCourses"));
    const mapping = block.slice(0, block.indexOf("}));"));
    expect(mapping).toContain("sessions");
    expect(mapping).not.toContain("displaySessions");
    expect(mapping).not.toContain("filteredSessions");
    expect(mapping).not.toContain("dayDisplaySessions");
  });

  it("maps nested age-group objects down to the ids the grid filters on", () => {
    expect(source).toContain("ageGroupId: entry.ageGroup?.id");
  });

  it("is interactive in its new Schedule home", () => {
    expect(source).toContain("interactive");
    expect(source).toContain("onRemoveSession={removeSession}");
    expect(source).toContain("onAddSession={addSession}");
  });
});

describe("schedule health balances high load with low attendance", () => {
  it("keeps Highest load", () => {
    expect(source).toContain("Highest load");
  });

  it("shows the three lowest-attended class sessions", () => {
    expect(source).toContain("Lowest attendance");
    expect(source).toContain("a.enrolledCount - b.enrolledCount");
    expect(source).toContain(".slice(0, 3)");
  });
});

describe("the summed-capacity bug does not survive the swap", () => {
  it("no longer sums enrolment or caps across sessions for a load figure", () => {
    // Course Matrix computed:
    //   enrolled = sum(session.enrolledCount)
    //   cap      = sum(course.cap)  <- once per session
    // On real production data that showed Drawing Lessons at 25% when its busiest
    // session was actually at 40%. The grid measures per session instead.
    expect(source).not.toContain("sum + (s.course?.cap || 0)");
  });
});
