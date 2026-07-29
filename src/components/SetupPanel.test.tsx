import { describe, expect, it } from "vitest";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmptyHome, SetupPanel, type SetupLink } from "@/components/SetupPanel";

/** Setup panel and empty state — dashboard spec §5, build order phase 18g. */

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

const links: SetupLink[] = [
  { label: "Age groups", href: "/setup?step=age-groups", done: true },
  { label: "Rooms", href: "/setup?step=rooms", done: true },
  { label: "Time blocks", href: "/setup?step=schedule", done: false },
  { label: "Activities", href: "/activities", done: false },
];

describe("the header never contradicts the checklist", () => {
  it("does not say complete while a row still reads Not yet", () => {
    // The state machine reasons about blocking ISSUES; the checklist reasons
    // about DATA. An event can be free of blocking issues while a section is
    // still empty. Claiming "complete" over a list of "Not yet" is the exact
    // contradiction deleted from the dashboard in 18f.
    const html = render(
      <SetupPanel state="ready" blockingCount={0} links={links} firstIncompleteHref="/setup" />,
    );
    // Collapsed, so only the header line is in the DOM — and that is precisely
    // the string that must not overclaim.
    expect(html).not.toContain("Setup complete");
    expect(html).toContain("Nothing blocking · 2 sections still open");
  });

  it("says complete only when every section is genuinely done", () => {
    const allDone = links.map((link) => ({ ...link, done: true }));
    const html = render(
      <SetupPanel state="ready" blockingCount={0} links={allDone} firstIncompleteHref="/setup" />,
    );
    expect(html).toContain("Setup complete · ready to open");
  });

  it("uses the singular for one open section", () => {
    const oneLeft = links.map((link, index) => ({ ...link, done: index !== 2 }));
    const html = render(
      <SetupPanel state="running" blockingCount={0} links={oneLeft} firstIncompleteHref="/setup" />,
    );
    expect(html).toContain("Nothing blocking · 1 section still open");
  });
});

describe("setup collapses but is never hidden (§5)", () => {
  it("starts expanded while Building", () => {
    const html = render(
      <SetupPanel state="building" blockingCount={2} links={links} firstIncompleteHref="/setup?step=schedule" />,
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Time blocks");
  });

  it("starts collapsed once Ready, with the condition still stated", () => {
    // Every section done, so the header may legitimately say "complete".
    const allDone = links.map((link) => ({ ...link, done: true }));
    const html = render(
      <SetupPanel state="ready" blockingCount={0} links={allDone} firstIncompleteHref="/setup" />,
    );
    expect(html).toContain('aria-expanded="false"');
    // Collapsed is not hidden: the header still says where things stand.
    expect(html).toContain("Setup complete · ready to open");
  });

  it("stays collapsed while Running", () => {
    const allDone = links.map((link) => ({ ...link, done: true }));
    const html = render(
      <SetupPanel state="running" blockingCount={0} links={allDone} firstIncompleteHref="/setup" />,
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Registration is open");
  });

  it("is always expandable — the header is a real button", () => {
    const html = render(
      <SetupPanel state="ready" blockingCount={0} links={links} firstIncompleteHref="/setup" />,
    );
    expect(html).toContain('<button type="button" class="setup__head"');
  });
});

describe("counts what is left, never what is done (§5.2)", () => {
  it("says how many things remain", () => {
    const html = render(
      <SetupPanel state="building" blockingCount={3} links={links} firstIncompleteHref="/setup" />,
    );
    expect(html).toContain("3 things left before you can open");
  });

  it("renders no percentage and no step fraction in any state", () => {
    for (const state of ["building", "ready", "running"] as const) {
      const html = render(
        <SetupPanel state={state} blockingCount={3} links={links} firstIncompleteHref="/setup" />,
      );
      expect(html, state).not.toMatch(/\d+\s*%/);
      expect(html, state).not.toMatch(/\d+\s+of\s+\d+\s+steps/);
      expect(html, state).not.toMatch(/READINESS/i);
    }
  });
});

describe("no hard locks (§5.3)", () => {
  it("renders every section as a reachable link, done or not", () => {
    const html = render(
      <SetupPanel state="building" blockingCount={2} links={links} firstIncompleteHref="/setup" />,
    );
    // A volunteer may legitimately enter activities before rooms.
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("aria-disabled");
    for (const link of links) expect(html).toContain(link.href);
  });

  it("marks progress with a dot rather than removing the link", () => {
    const html = render(
      <SetupPanel state="building" blockingCount={2} links={links} firstIncompleteHref="/setup" />,
    );
    expect(html).toContain("setup__dot is-done");
    expect(html).toContain("Not yet");
  });
});

describe("continue goes to the first incomplete section (§5.2)", () => {
  it("uses the href it is given, not step 1", () => {
    // The defect underneath /setup: it always opened step 1, so a returning
    // organiser landed on finished work.
    const html = render(
      <SetupPanel state="building" blockingCount={2} links={links} firstIncompleteHref="/setup?step=schedule" />,
    );
    expect(html).toContain('href="/setup?step=schedule"');
  });
});

describe("readiness breaking is flagged, not swallowed (§5)", () => {
  it("marks the panel when registration is open and something blocks", () => {
    const html = render(
      <SetupPanel
        state="building"
        blockingCount={1}
        links={links}
        registrationOpen
        firstIncompleteHref="/setup"
      />,
    );
    expect(html).toContain("setup--broke");
  });

  it("does not mark it while merely building before launch", () => {
    const html = render(
      <SetupPanel state="building" blockingCount={1} links={links} firstIncompleteHref="/setup" />,
    );
    expect(html).not.toContain("setup--broke");
  });
});

describe("the empty state offers exactly one action (§5)", () => {
  it("shows a single button and no grid", () => {
    const html = render(<EmptyHome onStart={() => {}} />);
    const buttons = html.match(/<button/g) ?? [];
    expect(buttons).toHaveLength(1);
    expect(html).toContain("Name your event");
    expect(html).not.toContain("ops-grid");
  });

  it("names the event when there is one to name", () => {
    const html = render(<EmptyHome onStart={() => {}} campName="Creator's Camp" />);
    expect(html).toContain("Creator&#x27;s Camp has nothing scheduled yet");
    expect(html).toContain("Start setup");
  });
});

describe("§5.4 acceptance, against the dashboard", () => {
  const dashboard = fs.readFileSync("src/app/(protected)/dashboard/page.tsx", "utf8");
  const schedule = fs.readFileSync("src/app/(protected)/schedule/page.tsx", "utf8");

  it("derives the state rather than storing a mode", () => {
    expect(dashboard).toContain("homeState({");
    // A stored mode is a mode toggle wearing a different hat.
    expect(dashboard).not.toMatch(/useState<HomeState>/);
  });

  it("renders the setup panel in both positions, not two different panels", () => {
    // One panel, two placements — the ORDER changes, the component does not.
    // Counting `&& setupPanel` catches the real property: the same variable is
    // used for both building and ready/running states.
    const occurrences = dashboard.match(/&&\s*setupPanel\}/g) ?? [];
    expect(occurrences).toHaveLength(2);
    // And it is defined once.
    expect(dashboard.match(/const setupPanel =/g) ?? []).toHaveLength(1);
  });

  it("moves the grid to Schedule and makes it the default view", () => {
    expect(dashboard).not.toContain("<OperationsGrid");
    expect(schedule).toContain("<OperationsGrid");
    expect(schedule).toContain('useState<ScheduleView>("grid")');
  });
});
