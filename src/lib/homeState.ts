import type { Issue } from "@/lib/issues";

/**
 * Home's four states — dashboard spec §5 (Slice 5), build order phase 18g.
 *
 * "Four states on one page. The order changes; nothing is ever hidden. No mode
 * toggle." The state is DERIVED, never stored and never chosen by the user:
 * a stored mode is a mode toggle wearing a different hat, and it can fall out
 * of step with the event it claims to describe.
 *
 * Pure logic, no React, so the transitions can be tested exhaustively.
 */

export type HomeState = "empty" | "building" | "ready" | "running";

export type HomeInput = {
  activityCount: number;
  blockCount: number;
  /** From the one issue engine (phase 18b). Severity decides the state. */
  issues: Issue[];
  registrationOpen: boolean;
};

/**
 * THE TRIGGER IS ZERO BLOCKING ISSUES, NOT A PERCENTAGE (§5).
 *
 * A percentage would let an event read "90% ready" while a teacher is
 * double-booked, and it would let this page disagree with the summary strip
 * directly above it. Watching the grid fill in during Building is the progress
 * indicator, and it is the actual artifact rather than a proxy for one.
 */
export function homeState(input: HomeInput): HomeState {
  const { activityCount, blockCount, issues, registrationOpen } = input;

  // Empty: nothing to schedule yet. Both must be absent — an event with time
  // blocks but no activities is already being built.
  if (activityCount === 0 && blockCount === 0) return "empty";

  const blocking = issues.filter((issue) => issue.severity === "blocking").length;

  // A half-built event is Building even with a clean issue list. An event with
  // time blocks but no activities raises no blocking issue — there is nothing
  // yet to be wrong — but calling it "ready to open" would collapse setup and
  // claim readiness on an event nobody can register for.
  if (activityCount === 0 || blockCount === 0) return "building";

  // Running outranks Ready, but never outranks Building: registration being open
  // does not make a double-booked room acceptable. If readiness breaks while
  // registration is open, the organiser is told (§5: "unless readiness breaks,
  // then it reopens with the item flagged").
  if (blocking > 0) return "building";
  return registrationOpen ? "running" : "ready";
}

/** Does the setup section sit above the grid, or below it? */
export function setupComesFirst(state: HomeState): boolean {
  // Building is the only state where setup leads. Empty has no grid at all.
  return state === "building";
}

/** Is the setup section collapsed by default? Still expandable either way (§5). */
export function setupStartsCollapsed(state: HomeState): boolean {
  return state === "ready" || state === "running";
}

/** Is the grid shown at all? */
export function showsGrid(state: HomeState): boolean {
  return state !== "empty";
}

/**
 * The one line describing setup's condition.
 *
 * §5.4 forbids any string reading "100%" or describing setup as "complete" as a
 * MEASURE. "Setup complete · ready to open" is the spec's own wording for the
 * Ready state — it is a state name, not a percentage — so it is kept verbatim.
 * What is forbidden is a percentage figure, or counting completed steps against
 * a total.
 */
export function setupSummaryLine(state: HomeState, blockingCount: number): string {
  switch (state) {
    case "empty":
      return "Name your event to begin.";
    case "building":
      return blockingCount === 1
        ? "1 thing left before you can open"
        : `${blockingCount} things left before you can open`;
    case "ready":
      return "Setup complete · ready to open";
    case "running":
      return "Registration is open";
  }
}

/**
 * Readiness broke while registration was open. The spec asks for the setup
 * section to reopen with the item flagged rather than staying quietly collapsed.
 */
export function readinessBroke(state: HomeState, registrationOpen: boolean): boolean {
  return registrationOpen && state === "building";
}
