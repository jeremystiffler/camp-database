import { describe, expect, it } from "vitest";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SetupNav, sectionsFromStats } from "@/components/SetupNav";

/** Sidebar setup navigation — dashboard spec §5.3, Slice 5. */

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

const partial = sectionsFromStats(
  { ageGroups: 3, rooms: 5, scheduleBlocks: 40, teachers: 0, classes: 0 },
  { detailsDone: true, scheduleDone: false, registrationOpen: false },
);
const complete = sectionsFromStats(
  { ageGroups: 3, rooms: 5, scheduleBlocks: 40, teachers: 9, classes: 31 },
  { detailsDone: true, scheduleDone: true, registrationOpen: true },
);

describe("the collapsed row (§5.3)", () => {
  it("shows a count while work remains", () => {
    const html = render(<SetupNav href="/setup?campId=x" active={false} state={{ sections: partial }} />);
    expect(html).toContain("5 left");
  });

  it("shows no count when everything is green", () => {
    const html = render(<SetupNav href="/setup?campId=x" active={false} state={{ sections: complete }} />);
    expect(html).not.toContain("left</span>");
  });

  it("auto-expands when something needs attention", () => {
    const html = render(<SetupNav href="/setup?campId=x" active={false} state={{ sections: partial }} />);
    expect(html).toContain('aria-expanded="true"');
  });

  it("auto-collapses when nothing remains", () => {
    const html = render(<SetupNav href="/setup?campId=x" active={false} state={{ sections: complete }} />);
    expect(html).toContain('aria-expanded="false"');
  });
});

describe("three phases, not nine steps (§5.1)", () => {
  it("lists exactly Start, Build and Open", () => {
    const html = render(<SetupNav href="/setup?campId=x" active state={{ sections: partial }} />);
    expect(html).toContain(">Start<");
    expect(html).toContain(">Build<");
    expect(html).toContain(">Open<");
    // The nine section names belong on the page, not in the sidebar.
    expect(html).not.toContain("Time Blocks");
    expect(html).not.toContain("Schedule Grid");
  });

  it("links each phase to its first unfinished section", () => {
    const html = render(<SetupNav href="/setup?campId=x" active state={{ sections: partial }} />);
    // Start is finished, so it opens at its first section.
    expect(html).toContain("step=details");
    // Build's first gap is teachers.
    expect(html).toContain("step=teachers");
  });

  it("keeps the campId when appending the step", () => {
    const html = render(<SetupNav href="/setup?campId=abc" active state={{ sections: partial }} />);
    expect(html).toContain("campId=abc&amp;step=");
  });
});

describe("status dots (§5.3)", () => {
  it("marks a finished phase done", () => {
    const html = render(<SetupNav href="/setup" active state={{ sections: partial }} />);
    expect(html).toContain("setupnav__dot is-done");
  });

  it("marks an unfinished phase todo, never locked", () => {
    const html = render(<SetupNav href="/setup" active state={{ sections: partial }} />);
    expect(html).toContain("setupnav__dot is-todo");
    expect(html).not.toContain("is-locked");
    expect(html).not.toContain("disabled");
  });

  it("hover copy comes from the issue engine, not a second string table", () => {
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

  it("an issue on a finished phase still expands the nav and flags the dot", () => {
    const html = render(
      <SetupNav href="/setup" active state={{ sections: complete, reasons: { rooms: "Sanctuary double-booked" } }} />,
    );
    expect(html).toContain("is-attention");
  });
});

describe("no hard locks (§5.3)", () => {
  it("renders every phase as a live link regardless of order", () => {
    // A volunteer may legitimately enter activities before rooms.
    const nothingDone = sectionsFromStats(null, { detailsDone: false });
    const html = render(<SetupNav href="/setup" active state={{ sections: nothingDone }} />);
    const links = html.match(/class="setupnav__item"/g) ?? [];
    expect(links).toHaveLength(3);
    expect(html).not.toContain("aria-disabled");
  });
});

describe("the sticky banner is gone (§5.2)", () => {
  const layout = fs.readFileSync("src/app/(protected)/layout.tsx", "utf8");

  it("has no NEXT STEP banner", () => {
    expect(layout).not.toContain("Next step</span>");
    expect(layout).not.toMatch(/showBuildGuidance\s*&&/);
  });

  it("nothing in setup navigates out to /activities", () => {
    expect(layout).not.toMatch(/"\/setup":\s*\{\s*label:[^}]*\/activities/);
  });
});
