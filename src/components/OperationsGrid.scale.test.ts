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
  it("is 2x the original 12px", () => {
    const block = rule(".ops-num {");
    const fallback = block.match(/var\(--ops-num-size,\s*([0-9.]+)px\)/);
    expect(fallback).not.toBeNull();
    expect(Number(fallback![1])).toBe(24);
  });

  it("is exposed as a token so the scale can be retuned in one place", () => {
    expect(rule(".ops-num {")).toContain("--ops-num-size");
  });

  it("uses the site body face, not the mono face", () => {
    // DM Sans is the site's body font (--font-body, set in layout.tsx). DM Mono
    // is also only loaded at weights 400/500, so 700 on it was faux-bolded.
    const block = rule(".ops-num {");
    expect(block).toContain("var(--font-body)");
    expect(block).not.toContain("var(--font-mono)");
  });

  it("uses one typeface across the whole grid", () => {
    // A mono header above a sans number read as two unrelated faces stacked in
    // the same column, so the headers moved to the body face too.
    for (const selector of [".ops-grid thead th {", ".ops-num {", ".ops-name {"]) {
      expect(rule(selector)).not.toContain("var(--font-mono)");
    }
  });

  it("keeps tabular figures so columns still align", () => {
    const block = rule(".ops-num {");
    expect(block).toContain("tabular-nums");
    expect(block).toContain('font-feature-settings: "tnum" 1');
  });

  it("shrinks for print so a printed grid still fits a page", () => {
    const printBlock = css.slice(css.indexOf("@media print", css.indexOf(".ops-shadow-r.is-on")));
    expect(printBlock).toContain(".ops-num");
    expect(px(printBlock.slice(printBlock.indexOf(".ops-num")), "font-size")).toBeLessThan(24);
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

  it("gives a data cell room for three digits and the widest time header", () => {
    // Measured in a browser with DM Sans loaded: "125" at 24px/700 is 37px, and
    // the widest header ("10:35am" at 11px) is 43px — the header binds.
    const block = rule(".ops-cell {");
    const width = px(block, "width");
    const declaration = rule(".ops-grid td.ops-cell {").match(/padding:\s*([^;]+)/)![1];
    const parts = declaration.trim().split(/\s+/).map((value) => Number(value.replace("px", "")));
    // padding: A  -> horizontal is A;  padding: A B -> horizontal is B.
    const padding = parts.length === 1 ? parts[0] : parts[1];
    expect(width - padding * 2).toBeGreaterThanOrEqual(48);
  });
});

describe("the capacity bar stays proportional to the count", () => {
  it("is taller than the original 4px so it is not lost beside the larger number", () => {
    expect(px(rule(".cap-track {"), "height")).toBeGreaterThan(4);
  });

  it("stays proportional — not taller than a quarter of the count size", () => {
    const barHeight = px(rule(".cap-track {"), "height");
    const numSize = Number(rule(".ops-num {").match(/var\(--ops-num-size,\s*([0-9.]+)px\)/)![1]);
    expect(barHeight).toBeLessThanOrEqual(numSize / 4);
  });

  it("keeps the fill, nub and empty states", () => {
    expect(css).toContain(".cap-track--over .cap-fill");
    expect(css).toContain(".cap-nub");
    expect(css).toContain(".cap-track--empty");
  });
});
