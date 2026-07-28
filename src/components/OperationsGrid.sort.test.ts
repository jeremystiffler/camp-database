import { describe, expect, it } from "vitest";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EMPTY_FILTER,
  OperationsGrid,
  arrangeRows,
  attentionScore,
  foldBlocks,
  hiddenBlockers,
  peakFill,
  type GridBlock,
  type GridCourse,
} from "@/components/OperationsGrid";

const blocks: GridBlock[] = [1, 2, 3, 4, 5].flatMap((day) =>
  (
    [
      ["09:20", "09:45"],
      ["09:45", "10:10"],
    ] as [string, string][]
  ).map(([start, end]) => ({
    id: `d${day}-${start}`,
    label: "",
    dayOfWeek: day,
    startTime: start,
    endTime: end,
  })),
);

const { columns } = foldBlocks(blocks);

function make(
  id: string,
  name: string,
  options: {
    cap?: number | null;
    at?: Record<string, number>;
    teacher?: string | null;
    room?: string | null;
    groups?: string[];
  } = {},
): GridCourse {
  const { cap = 10, at = {}, teacher = "Brad Farley", room = "Sanctuary", groups = [] } = options;
  const [first, last] = (teacher ?? " ").split(" ");
  return {
    id,
    name,
    cap,
    room: room ? { id: `r-${room}`, name: room, capacity: 60 } : null,
    courseTeachers: teacher ? [{ person: { id: `p-${teacher}`, firstName: first, lastName: last } }] : [],
    courseAgeGroups: groups.map((ageGroupId) => ({ ageGroupId })),
    sessions: Object.entries(at).flatMap(([start, count]) =>
      [1, 2, 3, 4, 5].map((day) => ({
        id: `${id}-${day}-${start}`,
        sessionTemplateId: `d${day}-${start}`,
        enrolledCount: count,
      })),
    ),
  } as unknown as GridCourse;
}

const ageGroups = [
  { id: "g-young", name: "younger", color: "#0891b2" },
  { id: "g-old", name: "older", color: "#7c3aed" },
];

const catalogue = [
  make("over", "Snacktivities", { cap: 20, at: { "09:20": 25 }, groups: ["g-young"] }),
  make("full", "Choir", { cap: 10, at: { "09:20": 10 }, groups: ["g-old"] }),
  make("half", "Drum Set", { cap: 10, at: { "09:20": 5 }, groups: ["g-old"] }),
  make("empty", "Artsy Sports", { cap: 15, at: { "09:45": 0 }, groups: ["g-young"] }),
  make("noteacher", "PreK Class", { cap: 15, at: { "09:45": 3 }, teacher: null, room: null }),
  make("unscheduled", "Zebra Painting", { cap: 12, at: {} , groups: ["g-young"] }),
];

describe("sorting the activity rows", () => {
  it("defaults to scheduled activities first, alphabetically", () => {
    const rows = arrangeRows(catalogue, columns, "default", EMPTY_FILTER);
    // Zebra Painting has no sessions, so it sinks to the bottom despite the Z.
    expect(rows[rows.length - 1].name).toBe("Zebra Painting");
    const scheduledNames = rows.slice(0, -1).map((course) => course.name);
    expect(scheduledNames).toEqual([...scheduledNames].sort((a, b) => a.localeCompare(b)));
  });

  it("sorts by name including unscheduled activities", () => {
    const rows = arrangeRows(catalogue, columns, "name", EMPTY_FILTER);
    expect(rows.map((course) => course.name)).toEqual([
      "Artsy Sports",
      "Choir",
      "Drum Set",
      "PreK Class",
      "Snacktivities",
      "Zebra Painting",
    ]);
  });

  it("puts the fullest first, and over-capacity above merely full", () => {
    const rows = arrangeRows(catalogue, columns, "fullest", EMPTY_FILTER);
    // 25/20 = 1.25 beats 10/10 = 1.0.
    expect(rows[0].name).toBe("Snacktivities");
    expect(rows[1].name).toBe("Choir");
  });

  it("puts the emptiest first", () => {
    const rows = arrangeRows(catalogue, columns, "emptiest", EMPTY_FILTER);
    // Zero-fill activities lead; the over-capacity one is last.
    expect(rows[rows.length - 1].name).toBe("Snacktivities");
    expect(peakFill(rows[0], columns)).toBe(0);
  });

  it("puts over capacity at the very top of the attention sort", () => {
    const rows = arrangeRows(catalogue, columns, "attention", EMPTY_FILTER);
    expect(rows[0].name).toBe("Snacktivities");
    // A healthy class scores nothing.
    expect(attentionScore(catalogue[2], columns)).toBe(0);
  });

  it("ranks a missing teacher above an empty class", () => {
    const noTeacher = catalogue.find((course) => course.name === "PreK Class")!;
    const emptyClass = catalogue.find((course) => course.name === "Artsy Sports")!;
    expect(attentionScore(noTeacher, columns)).toBeGreaterThan(attentionScore(emptyClass, columns));
  });

  it("is stable — equal rows keep a deterministic order", () => {
    const a = arrangeRows(catalogue, columns, "fullest", EMPTY_FILTER).map((c) => c.id);
    const b = arrangeRows([...catalogue].reverse(), columns, "fullest", EMPTY_FILTER).map((c) => c.id);
    expect(a).toEqual(b);
  });

  it("never mutates the input array", () => {
    const before = catalogue.map((course) => course.id);
    arrangeRows(catalogue, columns, "fullest", EMPTY_FILTER);
    expect(catalogue.map((course) => course.id)).toEqual(before);
  });
});

describe("filtering the activity rows", () => {
  it("matches on activity name, case-insensitively", () => {
    const rows = arrangeRows(catalogue, columns, "name", { ...EMPTY_FILTER, query: "choir" });
    expect(rows.map((course) => course.name)).toEqual(["Choir"]);
  });

  it("matches on room and teacher too", () => {
    expect(
      arrangeRows(catalogue, columns, "name", { ...EMPTY_FILTER, query: "sanctuary" }).length,
    ).toBeGreaterThan(1);
    expect(
      arrangeRows(catalogue, columns, "name", { ...EMPTY_FILTER, query: "farley" }).length,
    ).toBeGreaterThan(1);
  });

  it("ignores surrounding whitespace", () => {
    const rows = arrangeRows(catalogue, columns, "name", { ...EMPTY_FILTER, query: "  choir  " });
    expect(rows).toHaveLength(1);
  });

  it("filters by age group", () => {
    const rows = arrangeRows(catalogue, columns, "name", { ...EMPTY_FILTER, ageGroupId: "g-old" });
    const names = rows.map((course) => course.name);
    expect(names).toContain("Choir");
    expect(names).toContain("Drum Set");
    expect(names).not.toContain("Snacktivities");
  });

  it("keeps an activity with no age group visible under every group filter", () => {
    // PreK Class carries no age group, so it is open to all and must not vanish.
    for (const group of ["g-young", "g-old"]) {
      const names = arrangeRows(catalogue, columns, "name", {
        ...EMPTY_FILTER,
        ageGroupId: group,
      }).map((course) => course.name);
      expect(names).toContain("PreK Class");
    }
  });

  it("shows only activities with a problem when attention-only is on", () => {
    const rows = arrangeRows(catalogue, columns, "name", { ...EMPTY_FILTER, attentionOnly: true });
    const names = rows.map((course) => course.name);
    expect(names).toContain("Snacktivities"); // over capacity
    expect(names).toContain("PreK Class"); // no teacher, no room
    expect(names).not.toContain("Drum Set"); // healthy
    expect(names).not.toContain("Choir"); // full is not a problem
  });

  it("combines query and age group", () => {
    const rows = arrangeRows(catalogue, columns, "name", {
      query: "drum",
      ageGroupId: "g-old",
      attentionOnly: false,
    });
    expect(rows.map((course) => course.name)).toEqual(["Drum Set"]);
  });

  it("returns nothing when no activity matches", () => {
    expect(
      arrangeRows(catalogue, columns, "name", { ...EMPTY_FILTER, query: "xyzzy" }),
    ).toHaveLength(0);
  });
});

describe("a filter must not hide a blocking problem", () => {
  it("names an over-capacity activity the filter is hiding", () => {
    const visible = arrangeRows(catalogue, columns, "name", { ...EMPTY_FILTER, query: "drum" });
    expect(hiddenBlockers(catalogue, visible, columns)).toEqual(["Snacktivities"]);
  });

  it("reports nothing when the over-capacity activity is visible", () => {
    const visible = arrangeRows(catalogue, columns, "name", { ...EMPTY_FILTER, query: "snack" });
    expect(hiddenBlockers(catalogue, visible, columns)).toEqual([]);
  });

  it("reports nothing when unfiltered", () => {
    const visible = arrangeRows(catalogue, columns, "default", EMPTY_FILTER);
    expect(hiddenBlockers(catalogue, visible, columns)).toEqual([]);
  });

  it("does not count an unlimited class as a hidden blocker", () => {
    const unlimited = make("unl", "Devotional", { cap: null, at: { "09:20": 500 } });
    const all = [...catalogue, unlimited];
    const visible = arrangeRows(all, columns, "name", { ...EMPTY_FILTER, query: "snack" });
    expect(hiddenBlockers(all, visible, columns)).not.toContain("Devotional");
  });
});

describe("rendered toolbar", () => {
  const html = renderToStaticMarkup(
    React.createElement(OperationsGrid, { courses: catalogue, blocks, ageGroups } as never),
  );

  it("renders labelled sort and filter controls", () => {
    expect(html).toContain('id="ops-sort"');
    expect(html).toContain('id="ops-filter-query"');
    expect(html).toContain('id="ops-age-filter"');
    expect(html).toContain("Needs attention");
    // Every control is labelled for a screen reader.
    expect(html).toContain('for="ops-sort"');
    expect(html).toContain('for="ops-filter-query"');
    expect(html).toContain('for="ops-age-filter"');
  });

  it("offers every age group in the filter", () => {
    expect(html).toContain("All age groups");
    expect(html).toContain("younger");
    expect(html).toContain("older");
  });

  it("reports the visible count", () => {
    expect(html).toContain("6 activities");
  });

  it("hides the toolbar when printing", () => {
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    // There are several @media print blocks. Assert the rule exists in one of
    // them rather than assuming which is last — appending a new print block
    // elsewhere must not break this.
    const printBlocks = css.split("@media print").slice(1);
    expect(printBlocks.some((block) => block.includes("ops-toolbar"))).toBe(true);
  });

  it("writes the toolbar harness", () => {
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    fs.writeFileSync(
      "/tmp/grid-toolbar.html",
      `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
<style>body{font-family:system-ui,sans-serif;padding:24px;background:#f8fafc}
.hidden{display:none!important}.relative{position:relative}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
h1{font-size:15px;margin:0 0 10px}</style></head><body>
<h1>Activity column: sort and filter</h1>
${html.replace(/class="md:hidden"/g, 'class="hidden"').replace(/hidden md:block/g, "relative")}
</body></html>`,
    );
    expect(fs.existsSync("/tmp/grid-toolbar.html")).toBe(true);
  });
});
