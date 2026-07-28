import { describe, expect, it } from "vitest";
import {
  NO_SELECTION,
  blockTotals,
  cellDomId,
  dimmedRowIds,
  moveFocus,
  selectionLabel,
  toggleSelection,
  type DimmableRow,
  type GridSelection,
} from "@/components/gridInteraction";

/** Grid interaction — dashboard spec §3, build order phase 18f. */

describe("keyboard focus", () => {
  const at = (row: number, col: number) => ({ row, col });

  it("moves in all four directions", () => {
    expect(moveFocus(at(1, 1), "ArrowUp", 5, 4)).toEqual(at(0, 1));
    expect(moveFocus(at(1, 1), "ArrowDown", 5, 4)).toEqual(at(2, 1));
    expect(moveFocus(at(1, 1), "ArrowLeft", 5, 4)).toEqual(at(1, 0));
    expect(moveFocus(at(1, 1), "ArrowRight", 5, 4)).toEqual(at(1, 2));
  });

  it("clamps rather than wrapping", () => {
    // Wrapping in a 2D grid loses the organiser's place and there is no undo for
    // "where was I".
    expect(moveFocus(at(0, 2), "ArrowUp", 5, 4)).toEqual(at(0, 2));
    expect(moveFocus(at(4, 2), "ArrowDown", 5, 4)).toEqual(at(4, 2));
    expect(moveFocus(at(2, 3), "ArrowRight", 5, 4)).toEqual(at(2, 3));
  });

  it("treats column -1 as the row header and stops there", () => {
    expect(moveFocus(at(2, 0), "ArrowLeft", 5, 4)).toEqual(at(2, -1));
    expect(moveFocus(at(2, -1), "ArrowLeft", 5, 4)).toEqual(at(2, -1));
  });

  it("Home reaches the row header and End the last column", () => {
    expect(moveFocus(at(3, 2), "Home", 5, 4)).toEqual(at(3, -1));
    expect(moveFocus(at(3, 0), "End", 5, 4)).toEqual(at(3, 3));
  });

  it("does nothing in an empty grid", () => {
    expect(moveFocus(at(0, 0), "ArrowDown", 0, 0)).toEqual(at(0, 0));
  });

  it("gives every cell a stable id so focus survives a re-render", () => {
    expect(cellDomId(2, 3)).toBe("ops-r2-c3");
    expect(cellDomId(2, -1)).toBe("ops-r2-head");
    expect(cellDomId(0, 0)).not.toBe(cellDomId(0, 1));
  });
});

describe("selection toggling", () => {
  const judi: GridSelection = { kind: "teacher", id: "p1", label: "Judi Reynolds" };
  const brad: GridSelection = { kind: "teacher", id: "p2", label: "Brad Farley" };
  const sanctuary: GridSelection = { kind: "room", id: "r1", label: "Sanctuary" };

  it("selects when nothing is selected", () => {
    expect(toggleSelection(NO_SELECTION, judi)).toEqual(judi);
  });

  it("clicking the same target again clears it (§3)", () => {
    expect(toggleSelection(judi, { ...judi })).toEqual(NO_SELECTION);
  });

  it("clicking a different target of the same kind switches", () => {
    expect(toggleSelection(judi, brad)).toEqual(brad);
  });

  it("clicking a different kind switches rather than stacking", () => {
    // Two simultaneous filters would make "why is this row dim?" unanswerable.
    expect(toggleSelection(judi, sanctuary)).toEqual(sanctuary);
  });

  it("distinguishes a teacher from a room with the same id", () => {
    const room: GridSelection = { kind: "room", id: "p1", label: "Room P1" };
    expect(toggleSelection(judi, room)).toEqual(room);
  });

  it("toggles a block by key", () => {
    const block: GridSelection = { kind: "block", key: "09:20|09:45", label: "9:20am" };
    expect(toggleSelection(block, { ...block })).toEqual(NO_SELECTION);
    expect(toggleSelection(block, { kind: "block", key: "x", label: "y" })).toEqual({
      kind: "block",
      key: "x",
      label: "y",
    });
  });
});

describe("filtered views dim rather than remove (§3)", () => {
  const rows: DimmableRow[] = [
    { courseId: "c1", teacherIds: ["p1"], roomId: "r1" },
    { courseId: "c2", teacherIds: ["p1", "p2"], roomId: "r2" },
    { courseId: "c3", teacherIds: [], roomId: "r1" },
  ];

  it("dims every row the selected teacher does not teach", () => {
    const dimmed = dimmedRowIds(rows, { kind: "teacher", id: "p1", label: "Judi" });
    expect([...dimmed]).toEqual(["c3"]);
  });

  it("keeps a row where the teacher is one of several", () => {
    const dimmed = dimmedRowIds(rows, { kind: "teacher", id: "p2", label: "Brad" });
    expect(dimmed.has("c2")).toBe(false);
  });

  it("dims every row not in the selected room", () => {
    const dimmed = dimmedRowIds(rows, { kind: "room", id: "r1", label: "Sanctuary" });
    expect([...dimmed]).toEqual(["c2"]);
  });

  it("dims nothing when nothing is selected", () => {
    expect(dimmedRowIds(rows, NO_SELECTION).size).toBe(0);
  });

  it("dims nothing for a block selection", () => {
    // Every row participates in a time block; dimming all 31 would say nothing.
    const dimmed = dimmedRowIds(rows, { kind: "block", key: "b1", label: "9:20am" });
    expect(dimmed.size).toBe(0);
  });

  it("never removes a row from the list", () => {
    // The contract is opacity, not deletion, so context is kept and the filter
    // is obviously reversible.
    const dimmed = dimmedRowIds(rows, { kind: "teacher", id: "p1", label: "Judi" });
    expect(rows).toHaveLength(3);
    expect(dimmed.size).toBeLessThan(rows.length);
  });
});

describe("selection label", () => {
  it("says whose day is showing", () => {
    expect(selectionLabel({ kind: "teacher", id: "p1", label: "Judi Reynolds" }, 4)).toBe(
      "Showing Judi Reynolds's day — 4 activities",
    );
  });

  it("is empty when nothing is selected", () => {
    expect(selectionLabel(NO_SELECTION, 0)).toBe("");
  });

  it("counts one activity in the singular", () => {
    expect(selectionLabel({ kind: "room", id: "r1", label: "Sanctuary" }, 1)).toContain("1 activity");
    expect(selectionLabel({ kind: "room", id: "r1", label: "Sanctuary" }, 1)).not.toContain("activities");
  });
});

describe("block seat totals", () => {
  it("sums enrolment and capacity", () => {
    expect(blockTotals([
      { enrolled: 4, capacity: 10 },
      { enrolled: 2, capacity: 9 },
    ])).toEqual({ enrolled: 6, capacity: 19, activities: 2 });
  });

  it("reports unlimited when any class has no limit", () => {
    // Reporting a number here would understate what the block can absorb.
    expect(blockTotals([
      { enrolled: 4, capacity: 10 },
      { enrolled: 2, capacity: null },
    ])).toEqual({ enrolled: 6, capacity: null, activities: 2 });
  });

  it("handles an empty block", () => {
    expect(blockTotals([])).toEqual({ enrolled: 0, capacity: 0, activities: 0 });
  });
});
