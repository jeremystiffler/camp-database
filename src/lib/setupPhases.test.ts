import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  continueLabel,
  firstIncompleteSection,
  remainingLine,
  sidebarCount,
  teacherCoverageDone,
  totalRemaining,
  type SetupSection,
  type SetupSectionKey,
} from "@/lib/setupPhases";

/** Setup section routing and readiness. */

const SECTION_LABELS: Record<SetupSectionKey, string> = {
  details: "Event Info",
  ages: "Age Groups",
  rooms: "Rooms",
  times: "Time Blocks",
  teachers: "Teachers",
  activities: "Activities",
  schedule: "Schedule Grid",
  registration: "Registration Form",
  review: "Review & Open",
};

const make = (done: Partial<Record<SetupSectionKey, boolean>>): SetupSection[] =>
  (Object.keys(SECTION_LABELS) as SetupSectionKey[]).map((key) => ({
    key,
    label: SECTION_LABELS[key],
    done: done[key] ?? false,
  }));

describe("first-incomplete routing — the defect underneath (§5.2)", () => {
  it("opens the first unfinished section, not step 1", () => {
    // A returning organiser used to land on Event Info every time, which is
    // usually the first thing they finished.
    const sections = make({ details: true, ages: true, rooms: true, times: true });
    expect(firstIncompleteSection(sections)).toBe("teachers");
  });

  it("opens step 1 only when step 1 is genuinely unfinished", () => {
    expect(firstIncompleteSection(make({}))).toBe("details");
  });

  it("falls back to the last section when everything is done", () => {
    const all = make(
      Object.fromEntries((Object.keys(SECTION_LABELS) as SetupSectionKey[]).map((k) => [k, true])),
    );
    expect(firstIncompleteSection(all)).toBe("review");
  });

  it("skips a finished section in the middle", () => {
    const sections = make({ details: true, ages: true, rooms: true, times: true, teachers: true });
    expect(firstIncompleteSection(sections)).toBe("activities");
  });
});

describe("teacher coverage controls the Teachers checkmark", () => {
  it("does not confuse one person on the roster with coverage", () => {
    expect(teacherCoverageDone(1, [
      { scheduled: true, teacherCount: 1 },
      { scheduled: true, teacherCount: 0 },
    ])).toBe(false);
  });

  it("passes when every scheduled activity has a teacher", () => {
    expect(teacherCoverageDone(2, [
      { scheduled: true, teacherCount: 1 },
      { scheduled: true, teacherCount: 2 },
      { scheduled: false, teacherCount: 0 },
    ])).toBe(true);
  });

  it("still requires someone on the roster", () => {
    expect(teacherCoverageDone(0, [])).toBe(false);
  });
});

describe("the status line is a status, never an instruction (§5.2a tripwire)", () => {
  it("says how much is left", () => {
    expect(remainingLine(3)).toBe("3 things left before you can open");
    expect(remainingLine(1)).toBe("1 thing left before you can open");
    expect(remainingLine(0)).toBe("Nothing left before you can open");
  });

  it("never names a section", () => {
    // THE TRIPWIRE. The moment this string names a step it has become a second
    // "what next" signal, and §5.2a permits exactly one.
    for (let n = 0; n <= 9; n += 1) {
      const line = remainingLine(n);
      for (const label of Object.values(SECTION_LABELS)) {
        expect(line, `remainingLine(${n}) must not name ${label}`).not.toContain(label);
      }
    }
  });

  it("carries no percentage and no step fraction", () => {
    for (let n = 0; n <= 9; n += 1) {
      expect(remainingLine(n)).not.toMatch(/\d+\s*%/);
      expect(remainingLine(n)).not.toMatch(/\d+\s+of\s+\d+/);
    }
  });
});

describe("the one surviving next-action signal (§5.2a)", () => {
  it("names its destination", () => {
    expect(continueLabel("Age Groups")).toBe("Save and continue to Age Groups →");
  });

  it("disappears at the end rather than pointing nowhere", () => {
    expect(continueLabel(null)).toBeNull();
  });

  it("never says refresh", () => {
    // Four buttons on the old page asked the user to refresh. Telling someone
    // to refresh says the product does not trust its own state.
    for (const label of Object.values(SECTION_LABELS)) {
      expect(continueLabel(label)).not.toMatch(/refresh/i);
    }
  });
});

describe("sidebar navigation (§5.3)", () => {
  it("shows a count only while work remains", () => {
    expect(sidebarCount(3)).toBe("3 left");
    expect(sidebarCount(0)).toBeNull();
  });

  it("keeps every section independently reachable", () => {
    expect(make({})).toHaveLength(9);
    expect(make({}).map((section) => section.key)).toEqual(Object.keys(SECTION_LABELS));
  });
});

describe("§5.4 acceptance, against the live setup page", () => {
  const page = fs.readFileSync("src/app/(protected)/setup/page.tsx", "utf8");

  it("no button asks the user to refresh", () => {
    expect(page).not.toMatch(/refresh\s*&\s*go/i);
    expect(page).not.toMatch(/refresh everything/i);
  });

  it("no percentage readiness measure survives", () => {
    expect(page).not.toContain("setupPercent");
    expect(page).not.toMatch(/>Readiness</);
  });

  it("no step-count fraction survives", () => {
    expect(page).not.toMatch(/steps complete/);
    expect(page).not.toMatch(/Step \{[^}]+\} of \{/);
  });

  it("the repeated instructional lines are gone", () => {
    expect(page).not.toContain("order your brain");
    expect(page).not.toContain("setup path above");
  });

  it("the nine-step chevron bar is gone", () => {
    // The clip-path polygon was the chevron shape.
    expect(page).not.toContain("calc(100% - 18px) 0");
  });

  it("nothing in setup navigates out of setup", () => {
    expect(page).not.toMatch(/Continue\s*→\s*<\/Link>/);
  });

  it("no section is hard-locked", () => {
    // Scoped to the SetupStep model: the page also has an unrelated
    // "All Schedule Lock" feature for time blocks, which is not a setup lock.
    expect(page).not.toContain("lockMessage");
    expect(page).not.toContain("aria-disabled={step.locked}");
    expect(page).not.toContain("step.locked ?");
  });

  it("routes to the first incomplete section", () => {
    expect(page).toContain("firstIncompleteSection");
  });

  it("renders every setup section without phase filtering", () => {
    expect(page).toContain("visibleSetupSteps.map");
    expect(page).not.toContain("activePhase");
    expect(page).not.toContain("setupphase");
  });
});
