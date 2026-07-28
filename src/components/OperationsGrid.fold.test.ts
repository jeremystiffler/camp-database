import { describe, expect, it } from "vitest";
import { foldBlocks, foldCell, type GridBlock, type GridCourse } from "@/components/OperationsGrid";

/**
 * Day folding. A five-day camp running the same eight periods every weekday
 * produces forty SessionTemplates; forty columns is not a readable grid.
 */

const TIMES: [string, string][] = [
  ["09:00", "09:20"],
  ["09:20", "09:45"],
  ["09:45", "10:10"],
  ["10:10", "10:35"],
  ["10:35", "11:00"],
  ["11:00", "11:25"],
  ["11:25", "11:50"],
  ["11:50", "12:00"],
];

/** The real production shape: 5 weekdays x 8 identical periods. */
function weekBlocks(days = [1, 2, 3, 4, 5]): GridBlock[] {
  const blocks: GridBlock[] = [];
  for (const day of days) {
    for (const [start, end] of TIMES) {
      blocks.push({ id: `d${day}-${start}`, label: "", dayOfWeek: day, startTime: start, endTime: end });
    }
  }
  return blocks;
}

describe("folding identical days", () => {
  it("folds 5 identical weekdays of 8 periods into 8 columns", () => {
    const blocks = weekBlocks();
    expect(blocks).toHaveLength(40);

    const { columns, folded, hiddenDayCount, dayLabel } = foldBlocks(blocks);
    expect(folded).toBe(true);
    expect(columns).toHaveLength(8);
    expect(hiddenDayCount).toBe(4);
    expect(dayLabel).toBe("Mon–Fri");
  });

  it("labels folded columns by time alone, with no day prefix", () => {
    const { columns } = foldBlocks(weekBlocks());
    expect(columns.map((column) => column.label)).toEqual([
      "9:00am",
      "9:20am",
      "9:45am",
      "10:10am",
      "10:35am",
      "11:00am",
      "11:25am",
      "11:50am",
    ]);
  });

  it("keeps every underlying block id so no session is orphaned", () => {
    const { columns } = foldBlocks(weekBlocks());
    const all = columns.flatMap((column) => column.blockIds);
    expect(all).toHaveLength(40);
    expect(new Set(all).size).toBe(40);
  });

  it("orders columns chronologically", () => {
    const { columns } = foldBlocks(weekBlocks());
    const starts = columns.map((column) => column.startTime);
    expect([...starts].sort()).toEqual(starts);
  });

  it("names non-consecutive days explicitly", () => {
    const { folded, dayLabel } = foldBlocks(weekBlocks([1, 3, 5]));
    expect(folded).toBe(true);
    expect(dayLabel).toBe("Mon, Wed, Fri");
  });
});

describe("refusing to fold when days genuinely differ", () => {
  it("does not fold when one day is missing a period", () => {
    // Friday skips the last period — a real difference the organiser must see.
    const blocks = weekBlocks([1, 2, 3, 4]).concat(
      TIMES.slice(0, 7).map(([start, end]) => ({
        id: `d5-${start}`,
        label: "",
        dayOfWeek: 5,
        startTime: start,
        endTime: end,
      })),
    );
    const { folded, columns } = foldBlocks(blocks);
    expect(folded).toBe(false);
    // Day-prefixed labels return so the difference is visible.
    expect(columns[0].label).toContain("Mon");
    expect(columns).toHaveLength(39);
  });

  it("does not fold when one day has an extra period", () => {
    const blocks = weekBlocks([1, 2]).concat([
      { id: "d2-extra", label: "", dayOfWeek: 2, startTime: "13:00", endTime: "13:30" },
    ]);
    expect(foldBlocks(blocks).folded).toBe(false);
  });

  it("does not fold a single day", () => {
    const { folded, columns } = foldBlocks(weekBlocks([1]));
    expect(folded).toBe(false);
    expect(columns).toHaveLength(8);
    // One day only, so no day prefix is needed.
    expect(columns[0].label).toBe("9:00am");
  });

  it("does not fold blocks with no day information", () => {
    const blocks: GridBlock[] = TIMES.map(([start, end]) => ({
      id: `x-${start}`,
      label: "",
      dayOfWeek: null,
      startTime: start,
      endTime: end,
    }));
    const { folded, columns } = foldBlocks(blocks);
    expect(folded).toBe(false);
    expect(columns).toHaveLength(8);
  });

  it("handles an empty block list", () => {
    const { columns, folded } = foldBlocks([]);
    expect(columns).toEqual([]);
    expect(folded).toBe(false);
  });
});

describe("folded cell occupancy", () => {
  const { columns } = foldBlocks(weekBlocks());
  const nineTwenty = columns[1];

  function course(counts: Record<number, number>): GridCourse {
    return {
      id: "c1",
      name: "Drawing Lessons",
      cap: 10,
      sessions: Object.entries(counts).map(([day, enrolled]) => ({
        id: `s${day}`,
        sessionTemplateId: `d${day}-09:20`,
        enrolledCount: enrolled,
      })),
      ageGroupIds: [],
    } as unknown as GridCourse;
  }

  it("shows the shared count when every day agrees", () => {
    // Production reality: all five days carry the same enrollment.
    const cell = foldCell(course({ 1: 4, 2: 4, 3: 4, 4: 4, 5: 4 }), nineTwenty);
    expect(cell).toMatchObject({ enrolled: 4, varies: false, perDay: "4" });
  });

  it("shows the busiest day and flags variation when days disagree", () => {
    // The fullest day is the one that can breach the limit, so an average would
    // hide precisely the day that matters.
    const cell = foldCell(course({ 1: 2, 2: 9, 3: 3, 4: 2, 5: 2 }), nineTwenty);
    expect(cell).toMatchObject({ enrolled: 9, varies: true });
    expect(cell?.perDay).toContain("9");
  });

  it("returns null when the activity does not run in that column", () => {
    expect(foldCell(course({}), nineTwenty)).toBeNull();
  });

  it("treats a partially scheduled activity as scheduled", () => {
    // Runs Monday and Tuesday only, within a folded column.
    const cell = foldCell(course({ 1: 3, 2: 5 }), nineTwenty);
    expect(cell).toMatchObject({ enrolled: 5, varies: true });
  });

  it("keeps an over-capacity day visible after folding", () => {
    // 12 of 10 on Wednesday only. Folding must not average this away.
    const cell = foldCell(course({ 1: 1, 2: 1, 3: 12, 4: 1, 5: 1 }), nineTwenty);
    expect(cell?.enrolled).toBe(12);
    expect(cell?.varies).toBe(true);
  });
});
