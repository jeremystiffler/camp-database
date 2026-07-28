import { coversGroup, schedulableGroups, type IssueAgeGroup } from "@/lib/issues";

/**
 * Coverage — dashboard spec §4, Slice 4.
 *
 * Answers "which period needs another class, for which group."
 *
 * THE CENTRAL RULE (§4.2): headroom is measured per block PER AGE GROUP, never
 * aggregated. Eligibility is not fungible — a Younger child cannot sit in an
 * Older seat. At the 9:20 block the supplied sheet has Older ~8 spare, Younger
 * ~22, PreK ~15. Summed, that reads as a comfortable 45. But Older has 8, and
 * one family with three older children takes over a third of it. Any check that
 * sums across groups calls this healthy right up until it isn't.
 *
 * Pure logic, no React and no DOM: this is arithmetic the product's advice
 * depends on, so it is testable in isolation.
 */

export type CoverageCourse = {
  id: string;
  name: string;
  /** The class participant limit (§3.7 — never room capacity). */
  cap?: number | null;
  status?: string | null;
  /** Age tags. Empty, or covering every schedulable group, means all-ages. */
  courseAgeGroups?: { ageGroupId: string }[];
  courseSessionTemplates?: { sessionTemplateId: string }[];
  sessions?: {
    id: string;
    sessionTemplateId?: string | null;
    enrolledCount?: number | null;
    status?: string | null;
  }[];
};

export type CoverageBlock = {
  id: string;
  label: string;
  /** Whole-event blocks have no activity choice by design. */
  mandatory?: boolean;
};

export type CoverageColumn = {
  key: string;
  label: string;
  /** A folded column can represent the same period across several days. */
  blockIds: string[];
};

export type CellState = "comfortable" | "tight" | "short" | "none";

export type CoverageCell = {
  columnKey: string;
  groupId: string;
  groupName: string;
  /** Eligible seats offered in this period for this group. */
  seats: number;
  taken: number;
  spare: number;
  /** Active classes serving this group here. Drives "none" and "fragile". */
  activeClasses: number;
  state: CellState;
  /**
   * Enough room, no choice (§4.1). ORTHOGONAL to the seat states: a period can
   * have nine spare places and still be fragile because all nine sit in one
   * class. One teacher calls in sick and the block collapses.
   */
  fragile: boolean;
  /** True when a cap is unset somewhere, so `seats` is a floor not a total. */
  unlimited: boolean;
};

export type CoverageMatrix = {
  columns: CoverageColumn[];
  groups: IssueAgeGroup[];
  cells: CoverageCell[];
  /** Cells needing action, worst first (§4.3 callout ordering). */
  flagged: CoverageCell[];
};

const isLive = (course: CoverageCourse): boolean => {
  const status = (course.status ?? "active").toLowerCase();
  return status !== "cancelled" && status !== "dismissed" && status !== "hidden";
};

const isHidden = (course: CoverageCourse): boolean =>
  (course.status ?? "").toLowerCase() === "hidden";

const liveSessions = (course: CoverageCourse) =>
  (course.sessions ?? []).filter((session) => {
    const status = (session.status ?? "active").toLowerCase();
    return status !== "cancelled" && status !== "dismissed";
  });

/** Does this course run in any block behind this column? */
function runsInColumn(course: CoverageCourse, column: CoverageColumn): boolean {
  const inSessions = liveSessions(course).some(
    (session) => session.sessionTemplateId && column.blockIds.includes(session.sessionTemplateId),
  );
  if (inSessions) return true;
  return (course.courseSessionTemplates ?? []).some((entry) =>
    column.blockIds.includes(entry.sessionTemplateId),
  );
}

function enrolledInColumn(course: CoverageCourse, column: CoverageColumn): number {
  return liveSessions(course)
    .filter((session) => session.sessionTemplateId && column.blockIds.includes(session.sessionTemplateId))
    .reduce((total, session) => total + (session.enrolledCount ?? 0), 0);
}

/**
 * §4.2's headroom(), with the eligibility predicate shared with the issue
 * engine so coverage and the gap rules cannot disagree about who may attend.
 */
export function headroom(
  courses: CoverageCourse[],
  column: CoverageColumn,
  group: IssueAgeGroup,
  schedulable: IssueAgeGroup[],
): { seats: number; taken: number; spare: number; activeClasses: number; unlimited: boolean } {
  let seats = 0;
  let taken = 0;
  let activeClasses = 0;
  let unlimited = false;

  for (const course of courses) {
    if (!isLive(course)) continue;
    if (!coversGroup(course, group.id, schedulable)) continue;
    if (!runsInColumn(course, column)) continue;

    activeClasses += 1;
    if (course.cap === null || course.cap === undefined) {
      // No ceiling set. Counting it as zero would invent a shortage; counting
      // it as infinite would hide one. Flag it and let the cell say so.
      unlimited = true;
    } else {
      seats += course.cap;
    }
    taken += enrolledInColumn(course, column);
  }

  return { seats, taken, spare: seats - taken, activeClasses, unlimited };
}

/**
 * Cell state (§4.3). "Comfortable" is `spare >= 10% of expected group size`.
 *
 * NOTE ON EXPECTED GROUP SIZE: there is no such field in the schema, and
 * inventing a target would put a number in front of an organiser that the
 * product cannot justify. Current registration count is the honest stand-in —
 * it is what the seat-shortfall rule already uses. With nobody registered yet
 * the threshold collapses to "any spare seat is comfortable", which is correct:
 * a shortage cannot be asserted before anyone has signed up.
 */
export function cellState(
  spare: number,
  activeClasses: number,
  expectedGroupSize: number,
): CellState {
  if (activeClasses === 0) return "none";
  if (spare <= 0) return "short";
  const tightBelow = expectedGroupSize * 0.1;
  if (spare < tightBelow) return "tight";
  return "comfortable";
}

export function buildCoverage(input: {
  courses: CoverageCourse[];
  blocks: CoverageBlock[];
  columns: CoverageColumn[];
  ageGroups: IssueAgeGroup[];
  campersByAgeGroup?: Record<string, number>;
}): CoverageMatrix {
  const { courses, blocks, columns, ageGroups, campersByAgeGroup = {} } = input;

  // Groups that never take classes are not missing anything (owner ruling
  // 2026-07-28: Pre K is a daycare). They get no headroom row at all.
  const groups = schedulableGroups(ageGroups);

  // Whole-event blocks have no activity choice, so they are not coverage
  // columns — "Older has nothing at Closing Assembly" is a false alarm.
  const mandatoryIds = new Set(blocks.filter((block) => block.mandatory).map((block) => block.id));
  const electiveColumns = columns.filter((column) =>
    column.blockIds.some((id) => !mandatoryIds.has(id)),
  );

  const cells: CoverageCell[] = [];
  for (const group of groups) {
    const expected = campersByAgeGroup[group.id] ?? 0;
    for (const column of electiveColumns) {
      const { seats, taken, spare, activeClasses, unlimited } = headroom(
        courses,
        column,
        group,
        groups,
      );
      cells.push({
        columnKey: column.key,
        groupId: group.id,
        groupName: group.name,
        seats,
        taken,
        spare,
        activeClasses,
        state: cellState(spare, activeClasses, expected),
        // Orthogonal to seat state (§4.1) — stacks with any colour.
        fragile: activeClasses === 1,
        unlimited,
      });
    }
  }

  return { columns: electiveColumns, groups, cells, flagged: worstFirst(cells) };
}

/** Severity for callout ordering: no options, then short, then fragile. */
function severityRank(cell: CoverageCell): number {
  if (cell.state === "none") return 0;
  if (cell.state === "short") return 1;
  if (cell.fragile) return 2;
  if (cell.state === "tight") return 3;
  return 99;
}

/** Cells needing action, worst first (§4.3). */
export function worstFirst(cells: CoverageCell[]): CoverageCell[] {
  return cells
    .filter((cell) => cell.state !== "comfortable" || cell.fragile)
    .sort((a, b) => {
      const rank = severityRank(a) - severityRank(b);
      if (rank !== 0) return rank;
      // Deeper shortage first within a rank.
      return a.spare - b.spare;
    });
}

/** One line of callout copy. Never a bare number with no explanation. */
export function coverageLine(cell: CoverageCell, columnLabel: string): string {
  const group = cell.groupName.replace(/\s*\([^)]*\)\s*$/, "").trim() || cell.groupName;
  if (cell.state === "none") return `${columnLabel} · ${group} · nothing on offer`;
  if (cell.state === "short") {
    const short = Math.abs(cell.spare);
    return `${columnLabel} · ${group} · ${short} ${short === 1 ? "place" : "places"} short`;
  }
  if (cell.state === "tight") {
    // "47 spare" in a list headed "6 periods need attention" reads as good news
    // and undercuts the warning. Say what is actually wrong: the group is large
    // enough that this many seats is a thin margin, not a comfortable one.
    const suffix = cell.fragile ? ", and only one option" : "";
    return `${columnLabel} · ${group} · only ${cell.spare} spare for the group${suffix}`;
  }
  if (cell.fragile) return `${columnLabel} · ${group} · only one option`;
  return `${columnLabel} · ${group} · ${cell.spare} spare`;
}

export type Remedy =
  | { kind: "add"; label: string }
  | { kind: "raise"; label: string; courseId: string }
  | { kind: "unhide"; label: string; courseId: string; spare: number };

/**
 * §4.4: the flag is the fix. Every flagged cell offers remedies, because the
 * documented failure across this product is stating a problem and leaving the
 * person to hunt for the cure — "1 need a teacher" with no link to the class.
 *
 * A new class is not always the answer, so the cheaper remedies come too.
 */
export function remediesFor(
  cell: CoverageCell,
  courses: CoverageCourse[],
  column: CoverageColumn,
  schedulable: IssueAgeGroup[],
): Remedy[] {
  const remedies: Remedy[] = [{ kind: "add", label: "Add a class" }];

  // Raising a cap only helps where a class already serves this group here.
  const eligibleHere = courses.filter(
    (course) =>
      isLive(course) &&
      coversGroup(course, cell.groupId, schedulable) &&
      runsInColumn(course, column),
  );
  if (eligibleHere.length > 0) {
    const fullest = [...eligibleHere].sort(
      (a, b) => (b.cap ?? 0) - (a.cap ?? 0),
    )[0];
    remedies.push({ kind: "raise", label: "Raise a cap", courseId: fullest.id });
  }

  // Un-hide appears only when a hidden class exists for this block and group,
  // WITH its spare count, so the organiser can tell whether it actually solves
  // the problem before clicking.
  for (const course of courses) {
    if (!isHidden(course)) continue;
    if (!coversGroup(course, cell.groupId, schedulable)) continue;
    if (!runsInColumn(course, column)) continue;
    const spare = (course.cap ?? 0) - enrolledInColumn(course, column);
    if (spare <= 0) continue;
    remedies.push({
      kind: "unhide",
      label: `Un-hide ${course.name} (${spare} ${spare === 1 ? "place" : "places"})`,
      courseId: course.id,
      spare,
    });
  }

  return remedies;
}

/** Summary for the callout heading. */
export function coverageSummary(matrix: CoverageMatrix): {
  periods: number;
  headline: string;
} {
  const periods = new Set(matrix.flagged.map((cell) => cell.columnKey)).size;
  if (periods === 0) return { periods: 0, headline: "Every period has room and a choice" };
  return {
    periods,
    headline: `${periods} ${periods === 1 ? "period needs" : "periods need"} attention`,
  };
}
