/** Setup section routing and readiness helpers. Pure functions, no React. */

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

export type SetupSection = {
  key: SetupSectionKey;
  label: string;
  done: boolean;
};

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

/** Collapsed sidebar count. Zero remaining shows no count at all (§5.3). */
export function sidebarCount(remaining: number): string | null {
  return remaining > 0 ? `${remaining} left` : null;
}
