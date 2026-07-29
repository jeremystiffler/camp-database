import { describe, expect, it } from "vitest";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CoverageMatrixView } from "@/components/CoverageMatrixView";
import { buildCoverage, type CoverageCourse } from "@/lib/coverage";

/** Coverage matrix rendering — dashboard spec §4.3–4.5, Slice 4. */

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

const groups = [
  { id: "older", name: "Older (10-12 years)" },
  { id: "younger", name: "Younger (6-9 years)" },
  { id: "prek", name: "Pre K (4-5 years)", noSchedule: true },
];
const blocks = [
  { id: "b920", label: "9:20am" },
  { id: "b1035", label: "10:35am" },
];
const columns = [
  { key: "c920", label: "9:20am", blockIds: ["b920"] },
  { key: "c1035", label: "10:35am", blockIds: ["b1035"] },
];

const course = (over: Partial<CoverageCourse> & { id: string }): CoverageCourse => ({
  name: over.id,
  cap: 10,
  courseAgeGroups: [],
  sessions: [],
  ...over,
});

// Older is short at 9:20 while Younger has plenty — the §4.2 case.
const courses: CoverageCourse[] = [
  course({
    id: "art",
    name: "Art",
    cap: 5,
    courseAgeGroups: [{ ageGroupId: "older" }],
    sessions: [{ id: "s1", sessionTemplateId: "b920", enrolledCount: 5 }],
  }),
  course({
    id: "games",
    name: "Games",
    cap: 40,
    courseAgeGroups: [{ ageGroupId: "younger" }],
    sessions: [{ id: "s2", sessionTemplateId: "b920", enrolledCount: 4 }],
  }),
  course({
    id: "solo",
    name: "Choir",
    cap: 30,
    courseAgeGroups: [{ ageGroupId: "older" }],
    sessions: [{ id: "s3", sessionTemplateId: "b1035", enrolledCount: 2 }],
  }),
];

const matrix = buildCoverage({
  courses,
  blocks,
  columns,
  ageGroups: groups,
  campersByAgeGroup: { older: 20, younger: 40 },
});

describe("one component, two placements (§4.3)", () => {
  it("renders as a band", () => {
    const html = render(<CoverageMatrixView matrix={matrix} courses={courses} variant="band" />);
    expect(html).toContain("cov--band");
  });

  it("renders as a panel with a headline", () => {
    const html = render(<CoverageMatrixView matrix={matrix} courses={courses} variant="panel" />);
    expect(html).toContain("cov--panel");
    expect(html).toMatch(/period(s)? need/);
  });

  it("uses the same table markup in both", () => {
    const band = render(<CoverageMatrixView matrix={matrix} courses={courses} variant="band" />);
    const panel = render(<CoverageMatrixView matrix={matrix} courses={courses} variant="panel" />);
    for (const marker of ["cov__table", "cov__rowhead", "cov__btn"]) {
      expect(band).toContain(marker);
      expect(panel).toContain(marker);
    }
  });
});

describe("cells report per group, not aggregated (§4.5)", () => {
  const html = render(<CoverageMatrixView matrix={matrix} courses={courses} variant="panel" />);

  it("marks the short group short even though the block has spare overall", () => {
    expect(html).toContain("is-short");
  });

  it("does not mark the healthy group short", () => {
    // 36 spare for Younger in the same block.
    expect(html).toContain(">36<");
  });

  it("gives the unscheduled group no row", () => {
    expect(html).not.toContain("Pre K");
  });

  it("trims the parenthetical from row headers", () => {
    expect(html).toContain(">Older<");
    expect(html).not.toContain("Older (10-12 years)<");
  });
});

describe("fragile renders regardless of seat colour (§4.3)", () => {
  it("marks a roomy single-class period fragile", () => {
    const html = render(<CoverageMatrixView matrix={matrix} courses={courses} variant="panel" />);
    expect(html).toContain("is-fragile");
  });

  it("stacks fragile with comfortable rather than replacing it", () => {
    // Choir at 10:35: 28 spare, one class. Comfortable AND fragile.
    const cell = matrix.cells.find((c) => c.columnKey === "c1035" && c.groupId === "older")!;
    expect(cell.state).toBe("comfortable");
    expect(cell.fragile).toBe(true);
  });
});

describe("the flag is the fix (§4.5)", () => {
  it("renders a flagged cell as a real button", () => {
    const html = render(<CoverageMatrixView matrix={matrix} courses={courses} variant="panel" />);
    expect(html).toMatch(/<button[^>]*class="cov__btn[^"]*is-short/);
  });

  it("leaves a healthy cell inert rather than a dead-looking button", () => {
    // Needs a genuinely comfortable, non-fragile cell: two roomy classes.
    const healthy = [
      course({ id: "a", cap: 50, courseAgeGroups: [{ ageGroupId: "older" }], sessions: [{ id: "s1", sessionTemplateId: "b920", enrolledCount: 1 }] }),
      course({ id: "b", cap: 50, courseAgeGroups: [{ ageGroupId: "older" }], sessions: [{ id: "s2", sessionTemplateId: "b920", enrolledCount: 1 }] }),
      course({ id: "c", cap: 50, courseAgeGroups: [{ ageGroupId: "younger" }], sessions: [{ id: "s3", sessionTemplateId: "b920", enrolledCount: 1 }] }),
      course({ id: "d", cap: 50, courseAgeGroups: [{ ageGroupId: "younger" }], sessions: [{ id: "s4", sessionTemplateId: "b920", enrolledCount: 1 }] }),
    ];
    const m = buildCoverage({
      courses: healthy,
      blocks: [blocks[0]],
      columns: [columns[0]],
      ageGroups: groups,
      campersByAgeGroup: { older: 5, younger: 5 },
    });
    const html = render(<CoverageMatrixView matrix={m} courses={healthy} variant="panel" />);
    expect(html).toContain("disabled");
    expect(html).not.toContain("is-flagged");
  });

  it("lists gaps worst-first with an action on each", () => {
    const html = render(<CoverageMatrixView matrix={matrix} courses={courses} variant="panel" />);
    expect(html).toContain("cov__listbtn");
    expect(html).toContain("Add a class");
  });

  it("uses a true minus sign for a shortage, not a hyphen", () => {
    const shortCourses = [
      course({
        id: "over",
        cap: 5,
        courseAgeGroups: [{ ageGroupId: "older" }],
        sessions: [{ id: "s1", sessionTemplateId: "b920", enrolledCount: 8 }],
      }),
    ];
    const m = buildCoverage({
      courses: shortCourses,
      blocks,
      columns,
      ageGroups: groups,
      campersByAgeGroup: { older: 20 },
    });
    const html = render(<CoverageMatrixView matrix={m} courses={shortCourses} variant="panel" />);
    expect(html).toContain("\u22123");
    expect(html).not.toContain(">-3<");
  });

  it("says none where nothing serves the group", () => {
    const m = buildCoverage({
      courses: [],
      blocks,
      columns,
      ageGroups: groups,
      campersByAgeGroup: { older: 20 },
    });
    const html = render(<CoverageMatrixView matrix={m} courses={[]} variant="panel" />);
    expect(html).toContain("none");
    expect(html).toContain("is-none");
  });
});

describe("nothing to report", () => {
  it("says so plainly instead of showing an empty table", () => {
    const healthy = [
      course({ id: "a", cap: 50, courseAgeGroups: [{ ageGroupId: "older" }], sessions: [{ id: "s1", sessionTemplateId: "b920", enrolledCount: 1 }] }),
      course({ id: "b", cap: 50, courseAgeGroups: [{ ageGroupId: "older" }], sessions: [{ id: "s2", sessionTemplateId: "b920", enrolledCount: 1 }] }),
      course({ id: "c", cap: 50, courseAgeGroups: [{ ageGroupId: "younger" }], sessions: [{ id: "s3", sessionTemplateId: "b920", enrolledCount: 1 }] }),
      course({ id: "d", cap: 50, courseAgeGroups: [{ ageGroupId: "younger" }], sessions: [{ id: "s4", sessionTemplateId: "b920", enrolledCount: 1 }] }),
    ];
    const m = buildCoverage({
      courses: healthy,
      blocks: [blocks[0]],
      columns: [columns[0]],
      ageGroups: groups,
      campersByAgeGroup: { older: 5, younger: 5 },
    });
    const html = render(<CoverageMatrixView matrix={m} courses={healthy} variant="panel" />);
    expect(html).toContain("Every period has room and a choice");
    expect(html).not.toContain("cov__listbtn");
  });
});

describe("§4.5 acceptance, against the live wiring", () => {
  const schedule = fs.readFileSync("src/app/(protected)/schedule/page.tsx", "utf8");
  const activities = fs.readFileSync("src/app/(protected)/activities/page.tsx", "utf8");
  const grid = fs.readFileSync("src/components/OperationsGrid.tsx", "utf8");

  it("the band shares the grid's own columns", () => {
    // Passed as the grid's footer, INSIDE its scroll wrapper, built from the
    // same foldBlocks() columns the table uses.
    expect(schedule).toContain("variant=\"band\"");
    expect(schedule).toContain("foldBlocks(gridBlocks).columns");
    expect(grid).toContain("{footer}");
  });

  it("the band is sticky to the bottom of the grid viewport", () => {
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.cov--band\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/\.cov--band\s*\{[^}]*bottom:\s*0/);
  });

  it("an open popover is not clipped by the scroll container", () => {
    // Found in a screenshot, not in the DOM: overflow-x:auto makes the wrapper a
    // scroll container on BOTH axes, so the popover's remedy buttons were cut
    // off by 39px and could not be clicked at all — which defeats §4.4.
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain(".cov__scroll:has(.cov__pop) { overflow: visible; }");
  });

  it("both placements use the one component", () => {
    expect(schedule).toContain("CoverageMatrixView");
    expect(activities).toContain("CoverageMatrixView");
  });

  it("a flagged cell pre-fills the new-class form with block and group", () => {
    expect(schedule).toContain("new=1&blockId=");
    expect(schedule).toContain("ageGroupId=");
    expect(activities).toContain("prefill?.ageGroupId ? [prefill.ageGroupId] : []");
    expect(activities).toContain("prefill?.blockId");
  });
});
