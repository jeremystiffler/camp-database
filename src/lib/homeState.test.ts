import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  homeState,
  readinessBroke,
  setupComesFirst,
  setupStartsCollapsed,
  setupSummaryLine,
  showsGrid,
  type HomeInput,
} from "@/lib/homeState";
import type { Issue } from "@/lib/issues";

/** Home four-state behaviour — dashboard spec §5, build order phase 18g. */

const issue = (severity: Issue["severity"], code = "over-capacity"): Issue =>
  ({ code, severity, message: `${severity} issue`, courseId: "c1" }) as Issue;

const base: HomeInput = {
  activityCount: 3,
  blockCount: 8,
  issues: [],
  registrationOpen: false,
};

describe("the four states (§5)", () => {
  it("Empty when there are no activities and no time blocks", () => {
    expect(homeState({ ...base, activityCount: 0, blockCount: 0 })).toBe("empty");
  });

  it("is already Building with time blocks but no activities", () => {
    // Dates generate the columns, so an event can have blocks before activities.
    // That organiser has started; showing them the start form again is wrong.
    expect(homeState({ ...base, activityCount: 0, blockCount: 8 })).toBe("building");
  });

  it("is Building with activities but no blocks", () => {
    expect(homeState({ ...base, activityCount: 3, blockCount: 0 })).toBe("building");
  });

  it("Building while any blocking issue stands", () => {
    expect(homeState({ ...base, issues: [issue("blocking")] })).toBe("building");
  });

  it("Ready at zero blocking issues", () => {
    expect(homeState({ ...base, issues: [] })).toBe("ready");
  });

  it("Running when registration is open and nothing blocks", () => {
    expect(homeState({ ...base, registrationOpen: true })).toBe("running");
  });
});

describe("the trigger is zero blocking issues, not a percentage (§5)", () => {
  it("stays Ready with warnings and advisories outstanding", () => {
    // A percentage would drag this back below 100 and contradict the strip.
    const state = homeState({
      ...base,
      issues: [issue("warning"), issue("warning"), issue("advisory")],
    });
    expect(state).toBe("ready");
  });

  it("drops to Building on a single blocking issue among many advisories", () => {
    const state = homeState({
      ...base,
      issues: [issue("advisory"), issue("advisory"), issue("blocking"), issue("advisory")],
    });
    expect(state).toBe("building");
  });

  it("one blocking issue is enough however many others there are", () => {
    // The discriminating case. Any proportional rule — "block only if blocking
    // issues exceed 20% of the list" — passes the test above by luck and fails
    // here. One double-booked room is one too many, whatever its share.
    const manyAdvisories = Array.from({ length: 40 }, () => issue("advisory"));
    const state = homeState({ ...base, issues: [issue("blocking"), ...manyAdvisories] });
    expect(state).toBe("building");
  });

  it("scales: a single blocking issue still blocks among 200", () => {
    const noise = Array.from({ length: 200 }, () => issue("warning"));
    expect(homeState({ ...base, issues: [...noise, issue("blocking")] })).toBe("building");
  });

  it("blocking outranks registration being open", () => {
    // Registration being open does not make a double-booked room acceptable.
    const state = homeState({
      ...base,
      registrationOpen: true,
      issues: [issue("blocking", "room-clash")],
    });
    expect(state).toBe("building");
  });

  it("flags that readiness broke rather than staying quietly collapsed", () => {
    const state = homeState({ ...base, registrationOpen: true, issues: [issue("blocking")] });
    expect(readinessBroke(state, true)).toBe(true);
    expect(readinessBroke("ready", true)).toBe(false);
  });
});

describe("the order changes; nothing is hidden (§5)", () => {
  it("puts setup first only while Building", () => {
    expect(setupComesFirst("building")).toBe(true);
    expect(setupComesFirst("ready")).toBe(false);
    expect(setupComesFirst("running")).toBe(false);
  });

  it("collapses setup once there is nothing blocking", () => {
    expect(setupStartsCollapsed("building")).toBe(false);
    expect(setupStartsCollapsed("ready")).toBe(true);
    expect(setupStartsCollapsed("running")).toBe(true);
  });

  it("shows the grid in every state but Empty", () => {
    expect(showsGrid("empty")).toBe(false);
    expect(showsGrid("building")).toBe(true);
    expect(showsGrid("ready")).toBe(true);
    expect(showsGrid("running")).toBe(true);
  });
});

describe("setup summary line", () => {
  it("counts what is left rather than what is done", () => {
    // "3 things left before you can open", never "6 of 9 steps complete".
    expect(setupSummaryLine("building", 3)).toBe("3 things left before you can open");
  });

  it("says one thing in the singular", () => {
    expect(setupSummaryLine("building", 1)).toBe("1 thing left before you can open");
  });

  it("uses the spec's own wording when ready", () => {
    expect(setupSummaryLine("ready", 0)).toBe("Setup complete · ready to open");
  });

  it("names the running state plainly", () => {
    expect(setupSummaryLine("running", 0)).toBe("Registration is open");
  });

  it("never expresses setup as a percentage or a fraction of steps", () => {
    for (const state of ["empty", "building", "ready", "running"] as const) {
      const line = setupSummaryLine(state, 3);
      expect(line).not.toMatch(/\d+\s*%/);
      expect(line).not.toMatch(/\d+\s+of\s+\d+/);
      expect(line).not.toMatch(/readiness/i);
    }
  });
});

describe("§5.4 acceptance, enforced against the source", () => {
  const homeSource = fs.readFileSync("src/lib/homeState.ts", "utf8");

  it("never renders a percentage or a step fraction in any state", () => {
    // §5.4 governs what the PRODUCT SAYS, not what the source discusses. Grepping
    // the file catches my own comments quoting the forbidden strings, which is a
    // false positive — so assert against every string the module can actually
    // return, across a wide range of counts.
    for (const state of ["empty", "building", "ready", "running"] as const) {
      for (const count of [0, 1, 3, 9, 67, 100]) {
        const line = setupSummaryLine(state, count);
        expect(line, `${state}/${count}`).not.toMatch(/\d+\s*%/);
        expect(line, `${state}/${count}`).not.toMatch(/\d+\s+of\s+\d+/);
        expect(line, `${state}/${count}`).not.toMatch(/READINESS/i);
      }
    }
  });

  it("the state is derived, never stored, so there is no mode toggle", () => {
    // A stored mode is a mode toggle wearing a different hat and can fall out of
    // step with the event it claims to describe.
    expect(homeSource).not.toContain("useState");
    expect(homeSource).not.toContain("localStorage");
    expect(homeSource).not.toContain("setState");
  });

  it("derives state from issue severity, not from a step count", () => {
    expect(homeSource).toContain('severity === "blocking"');
    expect(homeSource).not.toMatch(/stepsComplete|completedSteps|totalSteps/);
  });
});

describe("state transitions in sequence", () => {
  it("walks empty → building → ready → running as an organiser works", () => {
    const walk: HomeInput[] = [
      { activityCount: 0, blockCount: 0, issues: [], registrationOpen: false },
      { activityCount: 2, blockCount: 8, issues: [issue("blocking")], registrationOpen: false },
      { activityCount: 2, blockCount: 8, issues: [], registrationOpen: false },
      { activityCount: 2, blockCount: 8, issues: [], registrationOpen: true },
    ];
    expect(walk.map(homeState)).toEqual(["empty", "building", "ready", "running"]);
  });

  it("walks back to building when readiness breaks mid-registration", () => {
    const open = { activityCount: 2, blockCount: 8, registrationOpen: true };
    expect(homeState({ ...open, issues: [] })).toBe("running");
    expect(homeState({ ...open, issues: [issue("blocking", "teacher-clash")] })).toBe("building");
  });
});
