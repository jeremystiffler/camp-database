import { describe, expect, it } from "vitest";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SetupNav, sectionsFromStats } from "@/components/SetupNav";

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

const partial = sectionsFromStats(
  { ageGroups: 3, rooms: 5, scheduleBlocks: 40, teachers: 0, classes: 0 },
  { detailsDone: true, scheduleDone: false, registrationOpen: false },
);
const complete = sectionsFromStats(
  { ageGroups: 3, rooms: 5, scheduleBlocks: 40, teachers: 9, classes: 31 },
  { detailsDone: true, scheduleDone: true, registrationOpen: true },
);

const sectionLabels = [
  "Event Info",
  "Age Groups",
  "Rooms",
  "Time Blocks",
  "Teachers",
  "Activities",
  "Schedule Grid",
  "Registration Form",
  "Review &amp; Open",
];

describe("the Event setup dropdown", () => {
  it("shows a count while work remains", () => {
    const html = render(<SetupNav href="/setup?campId=x" active={false} state={{ sections: partial }} />);
    expect(html).toContain("5 left");
  });

  it("shows no count and collapses when everything is ready", () => {
    const html = render(<SetupNav href="/setup?campId=x" active={false} state={{ sections: complete }} />);
    expect(html).not.toContain("left</span>");
    expect(html).toContain('aria-expanded="false"');
  });

  it("auto-expands when something needs attention", () => {
    const html = render(<SetupNav href="/setup?campId=x" active={false} state={{ sections: partial }} />);
    expect(html).toContain('aria-expanded="true"');
  });

  it("lists all nine setup sections directly, with no Start / Build / Open buckets", () => {
    const html = render(<SetupNav href="/setup?campId=x" active state={{ sections: partial }} />);
    for (const label of sectionLabels) expect(html).toContain(`>${label}<`);
    expect(html.match(/class="setupnav__item"/g)).toHaveLength(9);
    expect(html).not.toMatch(/>Start<|>Build<|>Open</);
  });

  it("links every section directly and preserves campId", () => {
    const html = render(<SetupNav href="/setup?campId=abc" active state={{ sections: partial }} />);
    for (const section of partial) {
      expect(html).toContain(`campId=abc&amp;step=${section.key}`);
    }
  });
});

describe("section status dots", () => {
  it("marks finished and unfinished sections independently", () => {
    const html = render(<SetupNav href="/setup" active state={{ sections: partial }} />);
    expect(html).toContain("setupnav__dot is-done");
    expect(html).toContain("setupnav__dot is-todo");
    expect(html).not.toContain("is-locked");
    expect(html).not.toContain("aria-disabled");
  });

  it("puts an issue on its owning section rather than a phase bucket", () => {
    const html = render(
      <SetupNav
        href="/setup"
        active
        state={{ sections: partial, reasons: { activities: "Snacktivities is 5 over at 9:20am" } }}
      />,
    );
    expect(html).toContain('title="Snacktivities is 5 over at 9:20am"');
    expect(html).toContain("setupnav__dot is-attention");
  });

  it("an issue still expands an otherwise complete dropdown", () => {
    const html = render(
      <SetupNav href="/setup" active state={{ sections: complete, reasons: { rooms: "Sanctuary double-booked" } }} />,
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("is-attention");
  });
});

describe("the sticky guidance banner remains deleted", () => {
  const layout = fs.readFileSync("src/app/(protected)/layout.tsx", "utf8");

  it("has no NEXT STEP banner", () => {
    expect(layout).not.toContain("Next step</span>");
    expect(layout).not.toMatch(/showBuildGuidance\s*&&/);
  });

  it("nothing in setup navigation redirects to /activities", () => {
    expect(layout).not.toMatch(/"\/setup":\s*\{\s*label:[^}]*\/activities/);
  });
});
