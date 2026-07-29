/**
 * Setup's three phases — dashboard spec §5.1, Slice 5.
 *
 * Nine steps became three because the operations grid absorbed five of them.
 * Rooms, time blocks, teachers, activities and scheduling are all visible and
 * editable on the grid now, so they stop being separate destinations and become
 * one phase: Build.
 *
 *   Start   name, dates, age groups        short form; dates generate columns
 *   Build   rooms, blocks, teachers,       all five live in the grid
 *           activities, scheduling
 *   Open    registration form, review      the gate before families see it
 *
 * Pure functions, no React: the phase model and the first-incomplete rule are
 * the part most likely to break quietly, so they are testable without a DOM.
 */

export type SetupSectionKey =
  | "details"
  | "ages"
  | "rooms"
  | "times"
  | "teachers"
  | "activities"
  | "schedule"
  | "registration"
  | "review";

export type PhaseKey = "start" | "build" | "open";

export type SetupSection = {
  key: SetupSectionKey;
  label: string;
  /** Where this section lives now. */
  phase: PhaseKey;
  done: boolean;
};

export type SetupPhase = {
  key: PhaseKey;
  label: string;
  sections: SetupSection[];
  done: boolean;
  /** Sections in this phase that are not finished. */
  remaining: number;
};

/** Which phase each of the nine original sections belongs to (§5.1). */
export const PHASE_OF: Record<SetupSectionKey, PhaseKey> = {
  details: "start",
  ages: "start",
  rooms: "build",
  times: "build",
  teachers: "build",
  activities: "build",
  schedule: "build",
  registration: "open",
  review: "open",
};

export const PHASE_ORDER: PhaseKey[] = ["start", "build", "open"];

export const PHASE_LABEL: Record<PhaseKey, string> = {
  start: "Start",
  build: "Build",
  open: "Open",
};

/** Group sections into the three phases, preserving section order. */
export function buildPhases(sections: SetupSection[]): SetupPhase[] {
  return PHASE_ORDER.map((key) => {
    const own = sections.filter((section) => section.phase === key);
    const remaining = own.filter((section) => !section.done).length;
    return {
      key,
      label: PHASE_LABEL[key],
      sections: own,
      // A phase with no sections is not "done" in any meaningful sense, but it
      // must not report outstanding work either.
      done: own.length > 0 && remaining === 0,
      remaining,
    };
  });
}

/**
 * The defect §5.2 names: `/setup` with no step parameter always opened step 1,
 * which is usually already finished, so a returning organiser lands on work
 * they completed weeks ago.
 *
 * Returns the first section that is not done. Everything finished → the last
 * section, because "review" is where you go when there is nothing left to do.
 */
export function firstIncompleteSection(sections: SetupSection[]): SetupSectionKey {
  const pending = sections.find((section) => !section.done);
  if (pending) return pending.key;
  return sections[sections.length - 1]?.key ?? "details";
}

/** How many sections remain across the whole of setup. */
export function totalRemaining(sections: SetupSection[]): number {
  return sections.filter((section) => !section.done).length;
}

/**
 * A roster is not the same thing as teacher coverage. The old setup page marked
 * Teachers done as soon as one Person existed, even when a scheduled activity
 * had nobody assigned. Unscheduled activities do not create a live coverage
 * gap yet; every scheduled activity does.
 */
export function teacherCoverageDone(
  personCount: number,
  courses: Array<{ scheduled: boolean; teacherCount: number }>,
): boolean {
  return personCount > 0 && courses.every((course) => !course.scheduled || course.teacherCount > 0);
}

/**
 * The status line (§5.2a).
 *
 * THE TRIPWIRE, recorded because it is easy to violate by accident: this is a
 * STATUS, not a next action. It says how much is left, never what to do now. If
 * it ever names a specific section — "3 things left, start with Rooms" — it has
 * become a second "what next" signal, and §5.2a allows exactly one. The test
 * suite asserts no section label ever appears in this string.
 */
export function remainingLine(remaining: number): string {
  if (remaining === 0) return "Nothing left before you can open";
  if (remaining === 1) return "1 thing left before you can open";
  return `${remaining} things left before you can open`;
}

/**
 * The one surviving next-action signal (§5.2a): a button at the bottom of the
 * body that always sits in the same place and always names its destination.
 *
 * Never the word "refresh". Four buttons on the old page asked the user to
 * refresh, which tells them the product does not trust its own state.
 */
export function continueLabel(nextLabel: string | null): string | null {
  if (!nextLabel) return null;
  return `Save and continue to ${nextLabel} →`;
}

/** The section a phase should open at: its first unfinished one, else its first. */
export function phaseEntrySection(phase: SetupPhase): SetupSectionKey | null {
  const pending = phase.sections.find((section) => !section.done);
  return pending?.key ?? phase.sections[0]?.key ?? null;
}

/**
 * Sidebar dot state (§5.3). Three states only: done, needs attention, or in
 * progress. There is deliberately no "locked" state — §5.3 forbids hard locks,
 * because a volunteer may legitimately enter activities before rooms.
 */
export type DotState = "done" | "attention" | "todo";

export function phaseDot(phase: SetupPhase, hasIssue: boolean): DotState {
  if (hasIssue) return "attention";
  return phase.done ? "done" : "todo";
}

/** Collapsed sidebar count. Zero remaining shows no count at all (§5.3). */
export function sidebarCount(remaining: number): string | null {
  return remaining > 0 ? `${remaining} left` : null;
}
