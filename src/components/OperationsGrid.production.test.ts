import { describe, expect, it } from "vitest";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OperationsGrid, foldBlocks, type GridBlock } from "@/components/OperationsGrid";

/**
 * Folding against the REAL production shape of 2027 Creator's Camp: five
 * weekdays, eight periods each, forty SessionTemplates. Verified against the
 * live database on 2026-07-28 — every (activity, time) pair carries identical
 * enrollment across all five days.
 */

const TIMES: [string, string][] = [
  ["09:00", "09:20"],
  ["09:20", "09:45"],
  ["09:45", "10:10"],
  ["10:10", "10:35"],
  ["10:35", "11:00"],
  ["11:00", "11:25"],
  ["11:25", "11:50"],
  ["11:50", "12:00"],
];

const blocks: GridBlock[] = [];
for (const day of [1, 2, 3, 4, 5]) {
  for (const [start, end] of TIMES) {
    blocks.push({ id: `d${day}-${start}`, label: "", dayOfWeek: day, startTime: start, endTime: end });
  }
}

// Real activities and their real per-session counts from production.
const realCourses = [
  { name: "Drawing Lessons", cap: 10, at: { "09:20": 4, "09:45": 1, "11:00": 1 } },
  { name: "Drum Set", cap: 9, at: { "09:45": 2, "10:10": 1, "10:35": 2 } },
  { name: "Artsy Sports", cap: 15, at: { "09:20": 1, "09:45": 1, "10:10": 1 } },
  { name: "Arts and Crafts", cap: 8, at: { "10:10": 0, "11:00": 1, "11:25": 1 } },
  { name: "Choir", cap: 50, at: { "11:25": 1 } },
  { name: "Get Crafty", cap: 9, at: { "09:20": 1 } },
];

const courses = realCourses.map((entry, index) => ({
  id: `c${index}`,
  name: entry.name,
  cap: entry.cap,
  room: { id: "r1", name: "Sanctuary", capacity: 60 },
  courseTeachers: [{ person: { id: "p1", firstName: "Brad", lastName: "Farley" } }],
  courseAgeGroups: [],
  // Every day carries the same count, exactly as production does.
  sessions: Object.entries(entry.at).flatMap(([start, count]) =>
    [1, 2, 3, 4, 5].map((day) => ({
      id: `${index}-${day}-${start}`,
      sessionTemplateId: `d${day}-${start}`,
      enrolledCount: count,
    })),
  ),
}));

describe("production shape: 2027 Creator's Camp", () => {
  it("reduces 40 columns to 8", () => {
    expect(blocks).toHaveLength(40);
    const { columns, folded, hiddenDayCount } = foldBlocks(blocks);
    expect(folded).toBe(true);
    expect(columns).toHaveLength(8);
    expect(hiddenDayCount).toBe(4);
  });

  it("renders one header cell per period, not per day-period pair", () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationsGrid, { courses, blocks, ageGroups: [] } as never),
    );
    const thead = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
    const headerCells = (thead.match(/<th /g) ?? []).length;
    // 8 time columns + 1 activity column.
    expect(headerCells).toBe(9);
    // No day prefix survives in a folded header.
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri"]) {
      expect(thead).not.toContain(day);
    }
  });

  it("shows each activity's real count once per period, not five times", () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationsGrid, { courses, blocks, ageGroups: [] } as never),
    );
    const table = html.slice(html.indexOf("<table"));
    const rowStart = table.indexOf("Drawing Lessons");
    const row = table.slice(rowStart, table.indexOf("</tr>", rowStart));
    // Drawing Lessons runs at 9:20 (4), 9:45 (1) and 11:00 (1) — three filled
    // cells out of eight, each showing a single number.
    expect((row.match(/ops-num/g) ?? []).length).toBe(3);
    expect(row).toContain(">4<");
    // No variation marker, because every day agrees.
    expect(row).not.toContain("*");
  });

  it("explains the fold instead of silently hiding four days", () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationsGrid, { courses, blocks, ageGroups: [] } as never),
    );
    expect(html).toContain("Mon–Fri");
    expect(html).toContain("same time blocks");
    expect(html).toContain("5 days are shown once");
    // Nothing varies in this fixture, so the variation note stays out of the way.
    expect(html).not.toContain("differs between days");
  });

  it("writes the folded harness for visual inspection", () => {
    const html = renderToStaticMarkup(
      React.createElement(OperationsGrid, { courses, blocks, ageGroups: [] } as never),
    );
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    fs.writeFileSync(
      "/tmp/grid-folded.html",
      `<!doctype html><html><head><meta charset="utf-8">
<style>${css}</style>
<style>
 body{font-family:system-ui,sans-serif;padding:24px;background:#f8fafc}
 .hidden{display:none!important}
 .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
 h1{font-size:15px;margin:0 0 6px}
 .relative{position:relative}
</style></head><body>
<h1>Folded: 40 templates (Mon–Fri x 8 periods) rendered as 8 columns</h1>
${html.replace(/class="md:hidden"/g, 'class="hidden"').replace(/hidden md:block/g, "relative")}
</body></html>`,
    );
    expect(fs.existsSync("/tmp/grid-folded.html")).toBe(true);
  });
});
