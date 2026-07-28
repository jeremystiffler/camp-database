import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import { OperationsGrid } from "@/components/OperationsGrid";

/**
 * Renders the real component with the §1.7 acceptance data and asserts the
 * markup. Also writes /tmp/grid-harness.html for visual inspection.
 */

const blocks = [
  { id: "b1", label: "", dayOfWeek: 1, startTime: "09:20", endTime: "09:45" },
  { id: "b2", label: "", dayOfWeek: 1, startTime: "09:45", endTime: "10:10" },
  { id: "b3", label: "", dayOfWeek: 1, startTime: "10:10", endTime: "10:35" },
  { id: "b4", label: "", dayOfWeek: 1, startTime: "10:35", endTime: "11:00" },
];

const ageGroups = [
  { id: "g1", name: "younger", color: "#0891b2" },
  { id: "g2", name: "older", color: "#7c3aed" },
];

const courses = [
  {
    id: "snack",
    name: "Snacktivities",
    cap: 20,
    room: { id: "r1", name: "Lobby Entrance", capacity: 30 },
    courseTeachers: [{ person: { id: "p1", firstName: "Judi", lastName: "Reynolds" } }],
    courseAgeGroups: [{ ageGroupId: "g1" }],
    sessions: [{ id: "s1", sessionTemplateId: "b1", enrolledCount: 25 }], // 25/20 OVER
  },
  {
    id: "choir",
    name: "Choir",
    cap: 50,
    room: { id: "r2", name: "Sanctuary", capacity: 80 },
    courseTeachers: [{ person: { id: "p2", firstName: "Brad", lastName: "Farley" } }],
    courseAgeGroups: [{ ageGroupId: "g2" }],
    sessions: [{ id: "s2", sessionTemplateId: "b1", enrolledCount: 37 }], // 37/50 fine
  },
  {
    id: "artsy",
    name: "Artsy sports",
    cap: 15,
    room: { id: "r3", name: "Outside", capacity: 40 },
    courseTeachers: [{ person: { id: "p3", firstName: "Brad", lastName: "Farley" } }],
    courseAgeGroups: [{ ageGroupId: "g1" }],
    sessions: [
      { id: "s3", sessionTemplateId: "b1", enrolledCount: 13 },
      { id: "s4", sessionTemplateId: "b2", enrolledCount: 3 },
      { id: "s5", sessionTemplateId: "b3", enrolledCount: 14 },
      { id: "s6", sessionTemplateId: "b4", enrolledCount: 15 }, // exactly full
    ],
  },
  {
    id: "prek",
    name: "PreK class",
    cap: 15,
    room: null,
    courseTeachers: [],
    courseAgeGroups: [],
    sessions: [{ id: "s7", sessionTemplateId: "b2", enrolledCount: 0 }], // empty
  },
  {
    id: "unl",
    name: "Morning devotional",
    cap: null,
    room: { id: "r4", name: "New Sanctuary", capacity: 200 },
    courseTeachers: [{ person: { id: "p4", firstName: "Sam", lastName: "Hall" } }],
    courseAgeGroups: [],
    sessions: [{ id: "s8", sessionTemplateId: "b3", enrolledCount: 42 }],
  },
];

const html = renderToStaticMarkup(
  React.createElement(OperationsGrid, { courses, blocks, ageGroups } as never),
);

describe("Slice 1 §1.7 acceptance — rendered markup", () => {
  it("renders a real table (the audited baseline was zero)", () => {
    expect(html).toContain("<table");
    expect((html.match(/<table/g) ?? []).length).toBeGreaterThan(0);
  });

  it("renders Snacktivities as over capacity with a nub, Choir as neither", () => {
    // Over-capacity track and the nub that spills past it.
    expect(html).toContain("cap-track cap-track--over");
    expect(html).toContain("cap-nub");
    // One over-capacity cell (Snacktivities), rendered twice: once in the
    // desktop table and once in the mobile block list. Both views are in the
    // markup; CSS decides which is visible.
    expect((html.match(/cap-track--over/g) ?? []).length).toBe(2);
    expect((html.match(/ops-num--over/g) ?? []).length).toBe(2);
    // Choir is 37/50 and must NOT be flagged. Its cell carries a plain track.
    const choirCell = html.slice(html.indexOf("Choir"));
    expect(choirCell.slice(0, 600)).not.toContain("cap-track--over");
  });

  it("does not render a full class as an error", () => {
    // Artsy sports at 15/15 in the last block is exactly full: a complete bar,
    // no danger class, no nub. Scope to the desktop table row.
    const table = html.slice(html.indexOf("<table"));
    const rowStart = table.indexOf("Artsy sports");
    const artsyRow = table.slice(rowStart, table.indexOf("</tr>", rowStart));
    expect(artsyRow).not.toContain("cap-track--over");
    expect(artsyRow).not.toContain("cap-nub");
    // 15/15 fills the track completely without any danger treatment.
    expect(artsyRow).toContain('style="width:100%"');
    // And the four blocks render 13, 3, 14, 15 — bar length tracks ratio.
    expect(artsyRow).toContain(">13<");
    expect(artsyRow).toContain(">15<");
  });

  it("marks a scheduled class with nobody enrolled", () => {
    expect(html).toContain("cap-track--empty");
    expect(html).toContain("ops-num--empty");
  });

  it("shows a missing teacher in the row header without opening anything", () => {
    expect(html).toContain("no teacher");
    expect(html).toContain("ops-meta__warn");
  });

  it("freezes both axes and provides a scroll affordance", () => {
    expect(html).toContain("ops-rowhead");
    expect(html).toContain("ops-shadow-r");
    expect(html).toContain("ops-shadow-b");
  });

  it("renders the mobile time-block list as a separate view", () => {
    expect(html).toContain("md:hidden");
    expect(html).toContain("ops-block-picker");
  });

  it("labels cells for screen readers with the real limit", () => {
    expect(html).toContain("of 20");
    expect(html).toContain("over capacity");
    expect(html).toContain("nobody enrolled");
    // An unlimited class must not read as "42 of No limit".
    expect(html).toContain("enrolled, no limit set");
    expect(html).not.toContain("of No limit");
  });

  it("labels the class limit in the row header so a bare number cannot be misread", () => {
    expect(html).toContain("Judi Reynolds · limit 20");
    expect(html).toContain("Sam Hall · no limit");
    // The ambiguous bare-number form is gone.
    expect(html).not.toContain("Brad Farley · 15");
  });

  it("writes the harness for visual inspection", () => {
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    fs.writeFileSync(
      "/tmp/grid-harness.html",
      `<!doctype html><html><head><meta charset="utf-8">
<style>${css}</style>
<style>
 body{font-family:system-ui,sans-serif;padding:24px;background:#f8fafc}
 .hidden{display:none!important}
 .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
 h1{font-size:15px;margin:0 0 14px}
 .relative{position:relative}
</style></head><body>
<h1>Slice 1 — Snacktivities 25/20 (over) vs Choir 37/50 (fine)</h1>
${html.replace(/class="md:hidden"/g, 'class="hidden"').replace(/hidden md:block/g, "relative")}
</body></html>`,
    );
    expect(fs.existsSync("/tmp/grid-harness.html")).toBe(true);
  });
});
