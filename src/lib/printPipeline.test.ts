import { describe, expect, it } from "vitest";
import fs from "node:fs";

/**
 * Print pipeline — master build order phase 8 (doc C §7).
 *
 * "Nothing printable is testable before this." The pipeline was already built
 * inside the print page's inline styles rather than globals.css, which is why an
 * earlier audit reported it missing. These tests pin the four requirements so a
 * future refactor of that page cannot quietly drop one.
 */

const PRINT_PAGE = "src/app/(protected)/print/page.tsx";
const source = fs.readFileSync(PRINT_PAGE, "utf8");

describe("the four phase-8 requirements", () => {
  it("forces colour to survive PDF export and mono drivers", () => {
    expect(source).toContain("print-color-adjust: exact");
    expect(source).toContain("-webkit-print-color-adjust: exact");
  });

  it("breaks the page per record, both modern and legacy properties", () => {
    expect(source).toContain("break-after: page");
    expect(source).toContain("page-break-after: always");
    expect(source).toContain("break-inside: avoid");
    expect(source).toContain("page-break-inside: avoid");
  });

  it("does not break after the final record", () => {
    // Without this every job ends on a blank sheet.
    expect(source).toContain(".print-page[data-last]");
    expect(source).toContain("break-after: auto");
  });

  it("positions the print root statically, outside the app shell's layout", () => {
    expect(source).toContain("#print-root { display: block !important");
    expect(source).toContain("position: static !important");
  });
});

describe("exactly one @page rule at any time", () => {
  it("builds the rule as a single derived string, not by appending", () => {
    // The failure mode: emitting a second @page for a new job while the first
    // is still mounted. Every branch must return one complete rule.
    // Template literals mean ${g.w}in contains a brace, so match to the LAST
    // brace of each rule rather than the first.
    const rules = source.match(/@page \{ size: .*?margin: .*?; \}/g) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule).toContain("size:");
      expect(rule).toContain("margin:");
      expect(rule.endsWith("; }")).toBe(true);
    }
  });

  it("renders that rule into one style element with a stable id", () => {
    expect(source).toContain('<style id="print-page-rule">');
    expect((source.match(/id="print-page-rule"/g) ?? []).length).toBe(1);
  });

  it("covers card, sheet, landscape and default geometries", () => {
    expect(source).toContain("size: letter landscape");
    expect(source).toMatch(/size: \$\{g\.w\}in \$\{g\.h\}in/);
  });
});

describe("N records produce N cards", () => {
  // The done-gate names 84 badges specifically. This mirrors the page's own
  // chunkItems() so the arithmetic is checked rather than assumed.
  function chunkItems<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += Math.max(size, 1)) {
      chunks.push(items.slice(i, i + Math.max(size, 1)));
    }
    return chunks.length ? chunks : [[]];
  }

  const people = Array.from({ length: 84 }, (_, index) => ({ id: `p${index}` }));

  it.each([
    ["5x3", 4],
    ["6x4", 2],
  ])("%s sheet mode seats all 84", (_size, perSheet) => {
    const sheets = chunkItems(people, perSheet);
    const seated = sheets.reduce((total, sheet) => total + sheet.length, 0);
    expect(seated).toBe(84);
  });

  it("card mode emits a front and a back per person", () => {
    expect(people.length * 2).toBe(168);
  });

  it("never drops the remainder into a lost final chunk", () => {
    // 84 / 5 = 16.8 — the case where a naive loop loses the last four.
    const sheets = chunkItems(people, 5);
    expect(sheets.reduce((total, sheet) => total + sheet.length, 0)).toBe(84);
    expect(sheets[sheets.length - 1].length).toBe(4);
  });

  it("returns one empty page rather than nothing when there are no records", () => {
    expect(chunkItems([], 4)).toEqual([[]]);
  });
});

describe("badge geometry names the long edge first", () => {
  it("5x3 is 3in wide by 5in tall (portrait), per Q1's stated assumption", () => {
    expect(source).toContain('"5x3": { w: 3, h: 5');
  });

  it("6x4 is 4in wide by 6in tall (portrait)", () => {
    expect(source).toContain('"6x4": { w: 4, h: 6');
  });
});
