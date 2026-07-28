import { describe, expect, it } from "vitest";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OperationsGrid, type GridBlock } from "@/components/OperationsGrid";

/**
 * The variation case: days that are folded but whose enrollment disagrees. The
 * busiest day must win and be marked, because the fullest day is the one that
 * can breach the limit.
 */

const blocks: GridBlock[] = [];
for (const day of [1, 2, 3, 4, 5]) {
  for (const [start, end] of [
    ["09:20", "09:45"],
    ["09:45", "10:10"],
  ] as [string, string][]) {
    blocks.push({ id: `d${day}-${start}`, label: "", dayOfWeek: day, startTime: start, endTime: end });
  }
}

const courses = [
  {
    id: "c1",
    name: "Drum Set",
    cap: 9,
    room: { id: "r1", name: "Sanctuary", capacity: 60 },
    courseTeachers: [{ person: { id: "p1", firstName: "Judi", lastName: "Reynolds" } }],
    courseAgeGroups: [],
    sessions: [
      // 9:20 is steady at 2 across all five days.
      ...[1, 2, 3, 4, 5].map((day) => ({
        id: `a${day}`,
        sessionTemplateId: `d${day}-09:20`,
        enrolledCount: 2,
      })),
      // 9:45 spikes to 12 on Wednesday — over the limit of 9 on ONE day only.
      ...[1, 2, 3, 4, 5].map((day) => ({
        id: `b${day}`,
        sessionTemplateId: `d${day}-09:45`,
        enrolledCount: day === 3 ? 12 : 3,
      })),
    ],
  },
];

const html = renderToStaticMarkup(
  React.createElement(OperationsGrid, { courses, blocks, ageGroups: [] } as never),
);

describe("folding must not hide a single bad day", () => {
  it("still folds to two columns", () => {
    const thead = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
    expect((thead.match(/<th /g) ?? []).length).toBe(3); // activity + 2 periods
  });

  it("shows the over-capacity Wednesday rather than averaging it away", () => {
    const table = html.slice(html.indexOf("<table"));
    const rowStart = table.indexOf("Drum Set");
    const row = table.slice(rowStart, table.indexOf("</tr>", rowStart));
    // The mean would be 4.8 of 9 — comfortably "fine". The max is 12 of 9.
    expect(row).toContain(">12<");
    expect(row).not.toContain(">4.8<");
    // And it is flagged as over capacity, with the nub.
    expect(row).toContain("ops-num--over");
    expect(row).toContain("cap-nub");
  });

  it("marks the varying cell and names the per-day counts for a screen reader", () => {
    const table = html.slice(html.indexOf("<table"));
    const rowStart = table.indexOf("Drum Set");
    const row = table.slice(rowStart, table.indexOf("</tr>", rowStart));
    expect(row).toContain("busiest day");
    expect(row).toContain("varies by day");
    expect(row).toContain("Varies by day"); // hover title
  });

  it("does not mark the steady cell", () => {
    const table = html.slice(html.indexOf("<table"));
    const rowStart = table.indexOf("Drum Set");
    const row = table.slice(rowStart, table.indexOf("</tr>", rowStart));
    // Exactly one varying cell of the two.
    expect((row.match(/busiest day/g) ?? []).length).toBe(1);
  });

  it("explains the asterisk when something varies", () => {
    expect(html).toContain("differs between days");
    expect(html).toContain("the busiest is shown");
  });

  it("writes the variation harness", () => {
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    fs.writeFileSync(
      "/tmp/grid-varies.html",
      `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
<style>body{font-family:system-ui,sans-serif;padding:24px;background:#f8fafc}
.hidden{display:none!important}.relative{position:relative}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
h1{font-size:15px;margin:0 0 6px}</style></head><body>
<h1>Folded, but Wednesday at 9:45 is 12 of 9 — must not be averaged away</h1>
${html.replace(/class="md:hidden"/g, 'class="hidden"').replace(/hidden md:block/g, "relative")}
</body></html>`,
    );
    expect(fs.existsSync("/tmp/grid-varies.html")).toBe(true);
  });
});
