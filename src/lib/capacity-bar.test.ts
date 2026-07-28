import { describe, expect, it } from "vitest";
import { effectiveCapacity } from "./capacity-rules";

/**
 * Slice 1 acceptance (dashboard spec §1.7). These assert the ARITHMETIC the
 * capacity bar renders, so the regression test survives refactors of the markup.
 */

type Cell = { enrolled: number; cap: number | null };

/** Mirror of CapacityBar's decision logic. */
export function barState(cell: Cell) {
  const capacity = effectiveCapacity({ cap: cell.cap });
  const unlimited = !Number.isFinite(capacity);
  if (cell.enrolled === 0) return { kind: "empty" as const, fill: 0, nub: 0 };
  if (unlimited || capacity <= 0) return { kind: "unlimited" as const, fill: 1, nub: 0 };
  if (cell.enrolled > capacity) {
    return {
      kind: "over" as const,
      fill: 1,
      nub: (cell.enrolled - capacity) / capacity,
    };
  }
  return { kind: "within" as const, fill: Math.min(1, cell.enrolled / capacity), nub: 0 };
}

describe("§1.7 — Snacktivities vs Choir, the capacity model regression test", () => {
  const snacktivities: Cell = { enrolled: 25, cap: 20 }; // five people over
  const choir: Cell = { enrolled: 37, cap: 50 }; // 13 seats spare

  it("renders Snacktivities as over capacity and Choir as merely busy", () => {
    expect(barState(snacktivities).kind).toBe("over");
    expect(barState(choir).kind).toBe("within");
  });

  it("gives Snacktivities a nub and Choir none", () => {
    expect(barState(snacktivities).nub).toBeGreaterThan(0);
    expect(barState(choir).nub).toBe(0);
  });

  it("does not let the raw count decide — the smaller number is the alarming one", () => {
    // The spreadsheet's defect: it tracks magnitude, so 37 looked worse than 25.
    expect(choir.enrolled).toBeGreaterThan(snacktivities.enrolled);
    expect(barState(snacktivities).kind).toBe("over");
    expect(barState(choir).kind).not.toBe("over");
  });
});

describe("§1.7 — a full class is not an error", () => {
  it("treats 5 of 5 as within capacity, fully filled", () => {
    const state = barState({ enrolled: 5, cap: 5 });
    expect(state.kind).toBe("within");
    expect(state.fill).toBe(1);
    expect(state.nub).toBe(0);
  });

  it("distinguishes full from over by one seat", () => {
    expect(barState({ enrolled: 5, cap: 5 }).kind).toBe("within");
    expect(barState({ enrolled: 6, cap: 5 }).kind).toBe("over");
  });
});

describe("§1.7 — bar length equals enrolled / cap, clamped at 1", () => {
  const cases: [Cell, number][] = [
    [{ enrolled: 0, cap: 10 }, 0],
    [{ enrolled: 1, cap: 10 }, 0.1],
    [{ enrolled: 5, cap: 10 }, 0.5],
    [{ enrolled: 13, cap: 15 }, 13 / 15],
    [{ enrolled: 37, cap: 50 }, 0.74],
    [{ enrolled: 10, cap: 10 }, 1],
    [{ enrolled: 25, cap: 20 }, 1],
    [{ enrolled: 100, cap: 20 }, 1],
  ];

  it.each(cases)("fill for %o is %f", (cell, expected) => {
    expect(barState(cell).fill).toBeCloseTo(expected, 5);
  });
});

describe("empty and unlimited states", () => {
  it("marks a scheduled class with nobody enrolled as empty, not as zero-width fill", () => {
    expect(barState({ enrolled: 0, cap: 20 }).kind).toBe("empty");
  });

  it("does not compute a ratio for an unlimited class", () => {
    const state = barState({ enrolled: 40, cap: null });
    expect(state.kind).toBe("unlimited");
    expect(Number.isFinite(state.fill)).toBe(true);
    expect(state.nub).toBe(0);
  });

  it("never produces NaN or Infinity for any input", () => {
    const inputs: Cell[] = [
      { enrolled: 0, cap: 0 },
      { enrolled: 5, cap: 0 },
      { enrolled: 0, cap: null },
      { enrolled: 9, cap: null },
      { enrolled: 3, cap: 1 },
    ];
    for (const cell of inputs) {
      const state = barState(cell);
      expect(Number.isFinite(state.fill)).toBe(true);
      expect(Number.isFinite(state.nub)).toBe(true);
    }
  });
});
