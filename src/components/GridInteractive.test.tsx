import { describe, expect, it } from "vitest";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OperationsGrid, type GridBlock, type GridCourse } from "@/components/OperationsGrid";
import { CellPopover, RowDrawer } from "@/components/GridPopover";

/**
 * Grid click targets — dashboard spec §3 (Slice 3), build order phase 18f.
 *
 * §3 acceptance is a single sentence: "no click inside the grid causes a route
 * change." These tests treat that as a structural property of the code, not a
 * behaviour to be observed once — a Link or a router.push added later must fail.
 */

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

const blocks: GridBlock[] = [
  { id: "b1", label: "Session 1", dayOfWeek: 1, startTime: "09:20", endTime: "09:45" },
  { id: "b2", label: "Session 2", dayOfWeek: 1, startTime: "09:45", endTime: "10:10" },
];

const courses: GridCourse[] = [
  {
    id: "c1",
    name: "Choir",
    cap: 50,
    room: { id: "r1", name: "Sanctuary", capacity: 200 },
    courseTeachers: [{ person: { id: "p1", firstName: "Judi", lastName: "Reynolds" } }],
    courseAgeGroups: [{ ageGroupId: "g1" }],
    sessions: [{ id: "s1", sessionTemplateId: "b1", enrolledCount: 12 }],
  },
  {
    id: "c2",
    name: "Drum Set",
    cap: 9,
    room: { id: "r2", name: "Kids Red Room", capacity: 12 },
    courseTeachers: [{ person: { id: "p2", firstName: "Brad", lastName: "Farley" } }],
    courseAgeGroups: [{ ageGroupId: "g1" }],
    sessions: [{ id: "s2", sessionTemplateId: "b2", enrolledCount: 4 }],
  },
];

const ageGroups = [{ id: "g1", name: "Older (10-12 years)" }];

describe("no click inside the grid causes a route change (§3 acceptance)", () => {
  const gridSource = fs.readFileSync("src/components/OperationsGrid.tsx", "utf8");
  const popoverSource = fs.readFileSync("src/components/GridPopover.tsx", "utf8");
  const interactionSource = fs.readFileSync("src/components/gridInteraction.ts", "utf8");

  it("the grid imports no router and no Link", () => {
    for (const source of [gridSource, popoverSource, interactionSource]) {
      expect(source).not.toContain("next/link");
      expect(source).not.toContain("next/navigation");
      expect(source).not.toContain("useRouter");
      expect(source).not.toContain("router.push");
    }
  });

  it("renders no anchor tag when interactive", () => {
    const html = render(
      <OperationsGrid courses={courses} blocks={blocks} ageGroups={ageGroups} interactive />,
    );
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href=");
  });

  it("renders no anchor tag in the popover or the drawer", () => {
    const data = {
      courseId: "c1",
      courseName: "Choir",
      blockLabel: "Session 1",
      sessionId: "s1",
      enrolled: 12,
      capacity: 50,
      roomName: "Sanctuary",
      teacherNames: ["Judi Reynolds"],
    };
    const pop = render(<CellPopover data={data} onClose={() => {}} />);
    expect(pop).not.toContain("<a ");
    expect(pop).not.toContain("href=");

    const drawer = render(
      <RowDrawer
        data={{
          courseId: "c1",
          name: "Choir",
          ageGroupName: "Older",
          color: "#0891b2",
          icon: null,
          roomName: "Sanctuary",
          teacherNames: ["Judi Reynolds"],
          capacity: 50,
          sessionCount: 1,
        }}
        onClose={() => {}}
      />,
    );
    expect(drawer).not.toContain("<a ");
    expect(drawer).not.toContain("href=");
  });

  it("offers no escape hatch to the activities page", () => {
    // An "Edit activity" link inside a popover is exactly the route change §3
    // forbids, however convenient it looks.
    for (const source of [gridSource, popoverSource]) {
      expect(source).not.toContain("/activities?");
      expect(source).not.toContain("activityId=");
    }
  });

  it("every interactive control is a real button", () => {
    const html = render(
      <OperationsGrid courses={courses} blocks={blocks} ageGroups={ageGroups} interactive />,
    );
    // Cells, row headers, column headers, room and teacher tags.
    for (const cls of ["ops-cellbtn", "ops-headbtn", "ops-colbtn", "ops-tag"]) {
      expect(html, `missing ${cls}`).toContain(cls);
    }
    // A div with onClick is not keyboard reachable; the spec requires real
    // focusable controls.
    const buttons = html.match(/<button/g) ?? [];
    expect(buttons.length).toBeGreaterThan(courses.length * blocks.length);
  });
});

describe("read-only placements stay read-only", () => {
  it("renders no buttons in the table body when interactive is off", () => {
    const html = render(<OperationsGrid courses={courses} blocks={blocks} ageGroups={ageGroups} />);
    expect(html).not.toContain("ops-cellbtn");
    expect(html).not.toContain("ops-headbtn");
    expect(html).not.toContain("ops-colbtn");
  });

  it("defaults to non-interactive so a placement must opt in", () => {
    const source = fs.readFileSync("src/components/OperationsGrid.tsx", "utf8");
    expect(source).toContain("interactive = false");
  });
});

describe("keyboard model (§3)", () => {
  const html = render(
    <OperationsGrid courses={courses} blocks={blocks} ageGroups={ageGroups} interactive />,
  );

  it("gives every cell a stable id so focus can be moved to it", () => {
    expect(html).toContain('id="ops-r0-head"');
    expect(html).toContain('id="ops-r0-c0"');
    expect(html).toContain('id="ops-r1-c1"');
  });

  it("tells a screen reader how to drive the grid", () => {
    expect(html).toContain("arrow keys");
  });

  it("gives every focusable control a visible ring", () => {
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    const rule = css.slice(css.indexOf(".ops-cellbtn:focus-visible"));
    expect(rule.slice(0, 200)).toContain("outline:");
  });
});

describe("filtered views dim rather than remove (§3)", () => {
  it("styles dimmed rows at the opacity the spec names", () => {
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain("tr.is-dimmed { opacity: 0.25; }");
  });

  it("marks room and teacher tags as toggle controls", () => {
    const html = render(
      <OperationsGrid courses={courses} blocks={blocks} ageGroups={ageGroups} interactive />,
    );
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Sanctuary");
    expect(html).toContain("Judi Reynolds");
  });
});

describe("the duplicate issue display is gone (phase 18f)", () => {
  const dashboard = fs.readFileSync("src/app/(protected)/dashboard/page.tsx", "utf8");
  const schedule = fs.readFileSync("src/app/(protected)/schedule/page.tsx", "utf8");

  it("no longer runs a second attention tally", () => {
    // It disagreed with the engine: on a room+teacher clash it reported 1 issue
    // (counting a full 9/9 class) while the engine reported 2 blocking.
    expect(dashboard).not.toContain("capacityBlockers");
    expect(dashboard).not.toContain("capacityAdvisories");
    expect(dashboard).not.toContain("attentionTotal");
  });

  it("derives its headline from the one engine", () => {
    expect(dashboard).toContain("summary?.issueSummary?.warning");
  });

  it("no longer pushes to the activities page from an issue chip", () => {
    expect(dashboard).not.toContain("activityId=${issue.courseId}");
  });

  it("keeps the moved Schedule grid interactive", () => {
    expect(dashboard).toContain("<OperationsGrid");
    expect(schedule).toContain("interactive");
    expect(schedule).toContain("onRemoveSession");
    expect(schedule).toContain("onAddSession");
  });
});

describe("popover content", () => {
  const base = {
    courseId: "c1",
    courseName: "Choir",
    blockLabel: "Session 1",
    enrolled: 12,
    capacity: 50,
    roomName: "Sanctuary",
    teacherNames: ["Judi Reynolds"],
  };

  it("shows teacher, room and capacity for a scheduled cell (§3)", () => {
    const html = render(<CellPopover data={{ ...base, sessionId: "s1" }} onClose={() => {}} />);
    expect(html).toContain("Judi Reynolds");
    expect(html).toContain("Sanctuary");
    expect(html).toContain("12");
    expect(html).toContain("Remove from this block");
  });

  it("offers to add the activity when the cell is empty (§3)", () => {
    const html = render(<CellPopover data={{ ...base, sessionId: null }} onClose={() => {}} />);
    expect(html).toContain("Add Choir at Session 1");
    expect(html).not.toContain("Remove from this block");
  });

  it("names a missing room and teacher rather than leaving a blank", () => {
    const html = render(
      <CellPopover
        data={{ ...base, sessionId: "s1", roomName: null, teacherNames: [] }}
        onClose={() => {}}
      />,
    );
    expect(html).toContain("No room");
    expect(html).toContain("No teacher");
  });

  it("says no limit rather than showing a fabricated number", () => {
    const html = render(
      <CellPopover data={{ ...base, sessionId: "s1", capacity: null }} onClose={() => {}} />,
    );
    expect(html).toContain("no limit");
  });
});

describe("row drawer content (§3)", () => {
  it("carries name, age group, colour, room, teacher and limit", () => {
    const html = render(
      <RowDrawer
        data={{
          courseId: "c1",
          name: "Choir",
          ageGroupName: "Older (10-12 years)",
          color: "#0891b2",
          icon: "🎵",
          roomName: "Sanctuary",
          teacherNames: ["Judi Reynolds"],
          capacity: 50,
          sessionCount: 3,
        }}
        onClose={() => {}}
      />,
    );
    expect(html).toContain("Choir");
    expect(html).toContain("Older (10-12 years)");
    expect(html).toContain("#0891b2");
    expect(html).toContain("Sanctuary");
    expect(html).toContain("Judi Reynolds");
    expect(html).toContain("50");
    expect(html).toContain("3 time blocks");
  });

  it("says open to all when an activity carries no age tag", () => {
    const html = render(
      <RowDrawer
        data={{
          courseId: "c1",
          name: "Snacktivities",
          ageGroupName: null,
          color: null,
          icon: null,
          roomName: null,
          teacherNames: [],
          capacity: null,
          sessionCount: 0,
        }}
        onClose={() => {}}
      />,
    );
    expect(html).toContain("Open to all");
    expect(html).toContain("Not scheduled");
    expect(html).toContain("No limit set");
  });
});
