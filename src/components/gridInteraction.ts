/**
 * Grid interaction logic — dashboard spec §3 (Slice 3), build order phase 18f.
 *
 * Pure functions, no React and no DOM, so the keyboard model and the filtered
 * views can be tested without rendering anything.
 *
 * THE HARD RULE (§3 acceptance): no click inside the grid causes a route change.
 * Everything here returns state; nothing here navigates. That is why the focus
 * and selection model lives in a module of its own rather than as ad-hoc
 * handlers scattered through the table markup.
 */

/** Where keyboard focus sits. Column -1 is the row header. */
export type FocusCell = { row: number; col: number };

/**
 * A filtered view dims non-matching rows rather than removing them (§3), so the
 * organiser keeps their bearings and the filter is obviously reversible.
 */
export type GridSelection =
  | { kind: "none" }
  | { kind: "teacher"; id: string; label: string }
  | { kind: "room"; id: string; label: string }
  | { kind: "block"; key: string; label: string };

export const NO_SELECTION: GridSelection = { kind: "none" };

/** What a click on a target should do to the current selection. */
export function toggleSelection(current: GridSelection, next: GridSelection): GridSelection {
  if (next.kind === "none") return NO_SELECTION;
  // "Clicking the same target again clears it" (§3).
  if (current.kind === next.kind) {
    const sameId =
      current.kind === "block" && next.kind === "block"
        ? current.key === next.key
        : "id" in current && "id" in next && current.id === next.id;
    if (sameId) return NO_SELECTION;
  }
  return next;
}

/**
 * Move the focused cell. Clamps at the edges rather than wrapping: wrapping in a
 * two-dimensional grid loses the organiser's place, and there is no undo for
 * "where was I".
 *
 * `colCount` counts data columns only; -1 addresses the row header.
 */
export function moveFocus(
  current: FocusCell,
  key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End",
  rowCount: number,
  colCount: number,
): FocusCell {
  if (rowCount === 0) return current;
  const clampRow = (row: number) => Math.max(0, Math.min(rowCount - 1, row));
  const clampCol = (col: number) => Math.max(-1, Math.min(colCount - 1, col));
  switch (key) {
    case "ArrowUp":
      return { row: clampRow(current.row - 1), col: current.col };
    case "ArrowDown":
      return { row: clampRow(current.row + 1), col: current.col };
    case "ArrowLeft":
      return { row: current.row, col: clampCol(current.col - 1) };
    case "ArrowRight":
      return { row: current.row, col: clampCol(current.col + 1) };
    case "Home":
      return { row: current.row, col: -1 };
    case "End":
      return { row: current.row, col: clampCol(colCount - 1) };
    default:
      return current;
  }
}

/** Stable DOM id for a cell, so focus can be restored after a re-render. */
export function cellDomId(row: number, col: number): string {
  return col < 0 ? `ops-r${row}-head` : `ops-r${row}-c${col}`;
}

export type DimmableRow = {
  courseId: string;
  teacherIds: string[];
  roomId: string | null;
};

/**
 * Which rows are dimmed under the current selection.
 *
 * A block selection dims no rows — it highlights a column instead, because every
 * row participates in a time block. Returning an empty set here rather than
 * dimming everything is deliberate: dimming all 31 rows would communicate
 * nothing.
 */
export function dimmedRowIds(rows: DimmableRow[], selection: GridSelection): Set<string> {
  const dimmed = new Set<string>();
  if (selection.kind === "none" || selection.kind === "block") return dimmed;
  for (const row of rows) {
    const matches =
      selection.kind === "teacher"
        ? row.teacherIds.includes(selection.id)
        : row.roomId === selection.id;
    if (!matches) dimmed.add(row.courseId);
  }
  return dimmed;
}

/**
 * Plain-language description of the active filter, for the reset control and for
 * screen readers. Never invents a count it has not been given.
 */
export function selectionLabel(selection: GridSelection, matchCount: number): string {
  switch (selection.kind) {
    case "none":
      return "";
    case "teacher":
      return `Showing ${selection.label}'s day — ${matchCount} ${matchCount === 1 ? "activity" : "activities"}`;
    case "room":
      return `Showing ${selection.label} — ${matchCount} ${matchCount === 1 ? "activity" : "activities"}`;
    case "block":
      return `Showing ${selection.label}`;
  }
}

/** Seat totals for a time block, shown when a column header is selected (§3). */
export function blockTotals(
  cells: { enrolled: number; capacity: number | null }[],
): { enrolled: number; capacity: number | null; activities: number } {
  let enrolled = 0;
  let capacity: number | null = 0;
  let activities = 0;
  for (const cell of cells) {
    enrolled += cell.enrolled;
    activities += 1;
    // One unlimited class makes the block total unlimited; reporting a number
    // would understate what the block can absorb.
    if (capacity !== null) {
      if (cell.capacity === null) capacity = null;
      else capacity += cell.capacity;
    }
  }
  return { enrolled, capacity, activities };
}
