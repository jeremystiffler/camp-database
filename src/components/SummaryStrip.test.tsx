import { describe, expect, it } from "vitest";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SummaryStrip, summarise } from "@/components/SummaryStrip";
import { detectIssues, type Issue } from "@/lib/issues";

/**
 * Summary strip — dashboard spec §2.2/§2.3, build order phase 18e.
 *
 * §2.4 acceptance:
 *   - Every issue string originates in one module; grep finds no duplicated text.
 *   - Clicking an issue scrolls to and highlights the exact cell.
 *   - "Health details" no longer exists as a collapsed accordion.
 *   - The class-larger-than-room note never appears in the blocking count.
 */

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

function issue(over: Partial<Issue> & Pick<Issue, "code" | "severity" | "message">): Issue {
  return { key: `${over.code}|${over.message}`, ...over } as Issue;
}

describe("summarise", () => {
  it("says everything checks out when there is nothing wrong", () => {
    expect(summarise([])).toBe("Everything checks out");
  });

  it("produces the spec's dot-separated shape", () => {
    const text = summarise([
      issue({ code: "over-capacity", severity: "blocking", message: "a" }),
      issue({ code: "over-capacity", severity: "blocking", message: "b" }),
      issue({ code: "over-capacity", severity: "blocking", message: "c" }),
      issue({ code: "empty", severity: "warning", message: "d" }),
    ]);
    expect(text).toBe("3 over capacity · 1 class empty");
  });

  it("leads with blocking counts before warnings and advisories", () => {
    const text = summarise([
      issue({ code: "roomless", severity: "advisory", message: "a" }),
      issue({ code: "no-teacher", severity: "warning", message: "b" }),
      issue({ code: "over-capacity", severity: "blocking", message: "c" }),
    ]);
    expect(text.indexOf("over capacity")).toBeLessThan(text.indexOf("without a teacher"));
    expect(text.indexOf("without a teacher")).toBeLessThan(text.indexOf("without a room"));
  });

  it("pluralises honestly", () => {
    expect(summarise([issue({ code: "room-clash", severity: "blocking", message: "x" })])).toBe("1 room clash");
    expect(
      summarise([
        issue({ code: "room-clash", severity: "blocking", message: "x" }),
        issue({ code: "room-clash", severity: "blocking", message: "y" }),
      ]),
    ).toBe("2 room clashes");
  });
});

describe("the strip renders the engine's strings verbatim", () => {
  const issues = detectIssues({
    courses: [
      {
        id: "c1",
        name: "Get Crafty",
        cap: 9,
        room: { id: "r1", name: "College Room", capacity: 20 },
        courseTeachers: [],
        courseAgeGroups: [],
        courseSessionTemplates: [{ sessionTemplateId: "b1" }],
        sessions: [{ id: "s1", sessionTemplateId: "b1", enrolledCount: 10 }],
      },
    ],
    blocks: [{ id: "b1", label: "Session 1", dayOfWeek: 1, startTime: "09:20", endTime: "09:45" }],
  });

  it("summarises without listing until asked", () => {
    // The list is collapsed by default: the strip is a one-line summary with a
    // "Show issues" affordance, per the spec's shape.
    const html = render(<SummaryStrip issues={issues} />);
    expect(html).toContain("Show issues (2)");
    expect(html).not.toContain("has no teacher assigned");
  });

  it("shows the exact message the engine produced, once expanded", () => {
    const html = render(<SummaryStrip issues={issues} defaultOpen />);
    // renderToStaticMarkup escapes apostrophes, so compare against escaped text.
    const escape = (value: string) => value.replace(/'/g, "&#x27;");
    expect(issues.length).toBeGreaterThan(0);
    for (const item of issues) {
      expect(html).toContain(escape(item.message));
    }
  });

  it("does not invent copy of its own for a condition", () => {
    // The component may add counts and severity labels, but never a sentence
    // describing an issue. Those live in @/lib/issues alone.
    const source = fs.readFileSync("src/components/SummaryStrip.tsx", "utf8");
    for (const fragment of [
      "has no teacher assigned",
      "isn't in any time block",
      "is listed at",
      "will accept unlimited registration",
      "over at",
    ]) {
      expect(source, `SummaryStrip hardcodes "${fragment}"`).not.toContain(fragment);
    }
  });

  it("marks a blocking issue distinctly from an advisory", () => {
    const html = render(
      <SummaryStrip
        issues={[
          issue({ code: "over-capacity", severity: "blocking", message: "over" }),
          issue({ code: "roomless", severity: "advisory", message: "roomless" }),
        ]}
      />,
    );
    expect(html).toContain("strip--blocking");
  });
});

describe("tone follows the worst issue present", () => {
  it("reads clear when there is nothing wrong", () => {
    const html = render(<SummaryStrip issues={[]} />);
    expect(html).toContain("strip--ok");
    expect(html).toContain("Everything checks out");
  });

  it("does not offer a Show issues button when there is nothing to show", () => {
    const html = render(<SummaryStrip issues={[]} />);
    expect(html).not.toContain("Show issues");
  });

  it("reads warning when only warnings and advisories exist", () => {
    const html = render(
      <SummaryStrip issues={[issue({ code: "no-teacher", severity: "warning", message: "x" })]} />,
    );
    expect(html).toContain("strip--warn");
    expect(html).not.toContain("strip--blocking");
  });

  it("an advisory alone never renders as blocking (§2.4)", () => {
    // "The class-larger-than-room note never appears in the blocking count."
    const html = render(
      <SummaryStrip issues={[issue({ code: "cap-above-room", severity: "advisory", message: "x" })]} />,
    );
    expect(html).not.toContain("strip--blocking");
  });
});

describe("the strip's empty branch moved to EmptyHome (phase 18g)", () => {
  it("no longer carries an empty-event mode", () => {
    // The branch was unreachable: the dashboard only rendered this strip inside
    // a section already gated on courses.length > 0. EmptyHome owns that state
    // now — two components answering "what now?" is how they disagree.
    const source = fs.readFileSync("src/components/SummaryStrip.tsx", "utf8");
    expect(source).not.toContain("isEmptyEvent");
    expect(source).not.toContain("emptyAction");
    expect(source).not.toContain("Add your first activity");
  });
});

describe("the accordion is gone (§2.3)", () => {
  const dashboard = fs.readFileSync("src/app/(protected)/dashboard/page.tsx", "utf8");

  it("has no Health details toggle", () => {
    // A comment recording the deletion is fine; a live control is not.
    expect(dashboard).not.toContain("<span>Health details</span>");
    expect(dashboard).not.toContain("aria-expanded={healthOpen}");
  });

  it("leaves no dead state behind", () => {
    // §8: unlinking while leaving the machinery is how a surface grows back.
    expect(dashboard).not.toContain("healthOpen");
    expect(dashboard).not.toContain("setHealthOpen");
  });

  it("renders the strip above the grid, not behind a click", () => {
    expect(dashboard).toContain("<SummaryStrip");
    expect(dashboard.indexOf("<SummaryStrip")).toBeLessThan(dashboard.indexOf("<OperationsGrid"));
  });
});

describe("jump links have something to aim at", () => {
  const grid = fs.readFileSync("src/components/OperationsGrid.tsx", "utf8");

  it("tags cells with their activity and blocks", () => {
    expect(grid).toContain("data-course-id={course.id}");
    expect(grid).toContain('data-block-ids={column.blockIds.join(" ")}');
  });

  it("tags row headers so an unscheduled activity still has a target", () => {
    expect(grid).toContain('className="ops-rowhead" data-course-id={course.id}');
  });

  it("the dashboard honours prefers-reduced-motion when scrolling", () => {
    const dashboard = fs.readFileSync("src/app/(protected)/dashboard/page.tsx", "utf8");
    expect(dashboard).toContain("prefers-reduced-motion");
  });

  it("the highlight survives reduced motion in CSS, dropping only the animation", () => {
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    // There are several reduced-motion blocks; select the one guarding the jump
    // highlight rather than assuming it is the first.
    const start = css.indexOf("is-jump-target", css.indexOf("@media (prefers-reduced-motion: reduce)\n  .ops-cell.is-jump-target") >= 0 ? 0 : 0);
    const guard = css.lastIndexOf("@media (prefers-reduced-motion: reduce)", css.indexOf(".ops-cell.is-jump-target, .ops-rowhead.is-jump-target {\n    animation: none"));
    const rule = css.slice(guard, css.indexOf("}\n}", guard) + 3);
    void start;
    expect(rule).toContain("is-jump-target");
    expect(rule).toContain("animation: none");
    // The cue itself must remain — only the motion is removed.
    expect(rule).toContain("background:");
  });
});
