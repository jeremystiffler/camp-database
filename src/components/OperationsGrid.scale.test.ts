import { describe, expect, it } from "vitest";
import fs from "node:fs";

/**
 * The type scale is a product decision, not an incidental style. These lock the
 * relationships so a later refactor cannot quietly undo them.
 */

const css = fs.readFileSync("src/app/globals.css", "utf8");

function rule(selector: string): string {
  const index = css.indexOf(selector);
  if (index === -1) throw new Error(`selector not found: ${selector}`);
  return css.slice(index, css.indexOf("}", index));
}

function px(block: string, property: string): number {
  const match = block.match(new RegExp(`${property}:\\s*([0-9.]+)px`));
  if (!match) throw new Error(`${property} not found in: ${block.slice(0, 90)}`);
  return Number(match[1]);
}

describe("enrollment count size", () => {
  it("is 4x the original 12px", () => {
    const block = rule(".ops-num {");
    const fallback = block.match(/var\(--ops-num-size,\s*([0-9.]+)px\)/);
    expect(fallback).not.toBeNull();
    expect(Number(fallback![1])).toBe(48);
  });

  it("is exposed as a token so the scale can be retuned in one place", () => {
    expect(rule(".ops-num {")).toContain("--ops-num-size");
  });

  it("keeps tabular figures so columns still align at the larger size", () => {
    const block = rule(".ops-num {");
    expect(block).toContain("tabular-nums");
    expect(block).toContain("var(--font-mono)");
  });

  it("shrinks for print so a printed grid still fits a page", () => {
    const printBlock = css.slice(css.indexOf("@media print", css.indexOf(".ops-shadow-r.is-on")));
    expect(printBlock).toContain(".ops-num");
    expect(px(printBlock.slice(printBlock.indexOf(".ops-num")), "font-size")).toBeLessThan(48);
  });
});

describe("activity title", () => {
  it("is bolder and larger than the metadata line beneath it", () => {
    const name = rule(".ops-name {");
    const meta = rule(".ops-meta {");
    expect(px(name, "font-size")).toBeGreaterThan(px(meta, "font-size"));
    expect(px(name, "font-size")).toBe(15);
    expect(name).toContain("font-weight: 700");
  });

  it("is larger than it was before this change", () => {
    expect(px(rule(".ops-name {"), "font-size")).toBeGreaterThan(12);
  });
});

describe("column widths follow from the type scale", () => {
  it("gives the activity column room for a 35-character name", () => {
    // Longest real activity: "Violin (Advanced Only = 1+ yrs exp)".
    const block = rule(".ops-grid .ops-rowhead {");
    expect(px(block, "width")).toBeGreaterThanOrEqual(260);
  });

  it("gives a data cell room for three digits at the enlarged size", () => {
    // A 48px DM Mono digit is ~29px, so three digits need ~88px of content box.
    // Measured in a real browser: 3 digits render at 177px in a 178px content box.
    const block = rule(".ops-cell {");
    const width = px(block, "width");
    // padding: 5px 4px — the horizontal value is the second.
    const padding = Number(
      rule(".ops-grid td.ops-cell {").match(/padding:\s*[0-9.]+px\s+([0-9.]+)px/)![1],
    );
    expect(padding).toBe(4);
    expect(width - padding * 2).toBeGreaterThanOrEqual(84);
  });
});

describe("the capacity bar stays proportional to the count", () => {
  it("is taller than the original 4px so it is not lost beside a 48px number", () => {
    expect(px(rule(".cap-track {"), "height")).toBeGreaterThan(4);
  });

  it("keeps the fill, nub and empty states", () => {
    expect(css).toContain(".cap-track--over .cap-fill");
    expect(css).toContain(".cap-nub");
    expect(css).toContain(".cap-track--empty");
  });
});
