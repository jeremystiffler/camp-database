import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  estimateWidthPt,
  fitName,
  nameFieldWidthPt,
  splitName,
} from "@/lib/badgeFit";

/**
 * Badge name auto-fit — phase 14.
 *
 * The rule that matters: a printed badge never loses a character. It cannot be
 * scrolled, hovered or re-rendered once it is in a lanyard.
 */

// Q1/Q2 answered 2026-07-29: 5x3 means 3in wide by 5in tall, portrait, for every
// role including staff clip-ons.
const WIDTH_5x3 = nameFieldWidthPt(3);
const WIDTH_6x4 = nameFieldWidthPt(4);

describe("the field width follows the answered geometry", () => {
  it("5x3 is 3in wide, so the name field is 2.8in of usable space", () => {
    expect(WIDTH_5x3).toBeCloseTo(2.8 * 72, 5);
  });

  it("6x4 is 4in wide", () => {
    expect(WIDTH_6x4).toBeCloseTo(3.8 * 72, 5);
  });
});

describe("no name is ever truncated", () => {
  const brutal = [
    "Jo Ng",
    "Mary Smith",
    "Christopher Anderson",
    "Bartholomew Fitzgerald-Ashworth",
    "Maximilian Alexander Throckmorton-Fauntleroy",
    "Anastasiya Vasylkivska-Chernihivska",
  ];

  it("preserves every character even at the hard floor", () => {
    // The gap this closes: my brutal list never actually reached the
    // absolute-minimum branch, so truncation there went undetected. Force it
    // with an absurdly narrow field.
    const name = "Maximilian Alexander Throckmorton-Fauntleroy";
    const fit = fitName(name, 20);
    expect(fit.lines.join(" ")).toBe(name);
    expect(fit.lines.join(" ")).not.toContain("\u2026");
  });

  it("preserves characters at the floor for a single long token too", () => {
    const name = "Wolfeschlegelsteinhausenbergerdorff";
    const fit = fitName(name, 20);
    expect(fit.lines.join(" ")).toBe(name);
    expect(fit.lines.join(" ")).not.toContain("\u2026");
  });

  it.each(brutal)("%s renders every character on a 5x3", (name) => {
    const fit = fitName(name, WIDTH_5x3);
    const rendered = fit.lines.join(" ");
    expect(rendered).toBe(name);
    // Nothing dropped, nothing elided.
    expect(rendered).not.toContain("…");
    expect(rendered).not.toContain("...");
  });

  it.each(brutal)("%s also fits within the estimated width", (name) => {
    const fit = fitName(name, WIDTH_5x3);
    const longest = fit.lines.reduce((a, b) => (a.length >= b.length ? a : b));
    // Allow the hard-floor case, which is permitted to overflow slightly rather
    // than lose characters.
    if (fit.fontSizePt > 7) {
      expect(estimateWidthPt(longest, fit.fontSizePt)).toBeLessThanOrEqual(WIDTH_5x3);
    }
  });
});

describe("it shrinks before it wraps, and wraps before it gets tiny", () => {
  it("a short name renders at the full design size on one line", () => {
    const fit = fitName("Jo Ng", WIDTH_5x3);
    expect(fit.fontSizePt).toBe(13);
    expect(fit.wrapped).toBe(false);
  });

  it("a long name wraps rather than dropping below the comfortable floor", () => {
    const fit = fitName("Maximilian Alexander Throckmorton-Fauntleroy", WIDTH_5x3);
    expect(fit.wrapped).toBe(true);
    // Two lines at a readable size beats one line at 7pt.
    expect(fit.fontSizePt).toBeGreaterThanOrEqual(7);
  });

  it("keeps the surname whole when wrapping", () => {
    // A volunteer reading "Fitzgerald-" off a badge has learned nothing.
    expect(splitName("Bartholomew Fitzgerald-Ashworth")).toEqual([
      "Bartholomew",
      "Fitzgerald-Ashworth",
    ]);
  });

  it("keeps a middle name with the surname rather than orphaning it", () => {
    expect(splitName("Mary Jane Watson")).toEqual(["Mary", "Jane Watson"]);
  });

  it("handles a single unbreakable token without crashing", () => {
    const fit = fitName("Wolfeschlegelsteinhausenbergerdorff", WIDTH_5x3);
    expect(fit.lines).toHaveLength(1);
    expect(fit.lines[0]).toBe("Wolfeschlegelsteinhausenbergerdorff");
  });

  it("handles an empty name without producing NaN", () => {
    const fit = fitName("   ", WIDTH_5x3);
    expect(Number.isFinite(fit.fontSizePt)).toBe(true);
    expect(fit.lines).toEqual([""]);
  });
});

describe("the wider badge fits more before shrinking", () => {
  it("a name that must shrink on 5x3 stays larger on 6x4", () => {
    const name = "Christopher Anderson";
    const small = fitName(name, WIDTH_5x3);
    const large = fitName(name, WIDTH_6x4);
    expect(large.fontSizePt).toBeGreaterThanOrEqual(small.fontSizePt);
  });
});

describe("role bands clear 4.5:1 behind white text (doc C §3.2)", () => {
  const source = fs.readFileSync("src/app/(protected)/print/page.tsx", "utf8");

  function luminance(hex: string): number {
    const int = parseInt(hex.replace("#", ""), 16);
    const channels = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((value) => {
      const srgb = value / 255;
      return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrast(a: string, b: string): number {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  }

  const bands = [...source.matchAll(/band: "(#[0-9A-Fa-f]{6})"/g)].map((match) => match[1]);

  it("finds every role band in the source", () => {
    // Seven roles carry a band; Participant uses the event colour.
    expect(bands.length).toBe(7);
  });

  it.each(bands.map((band) => [band]))("%s clears 4.5:1 with white text", (band) => {
    expect(contrast("#FFFFFF", band)).toBeGreaterThanOrEqual(4.5);
  });

  it("no longer contains the three bands that failed", () => {
    // Measured 3.77, 3.68 and 3.56 — all below AA behind white text.
    for (const failing of ["#059669", "#0891B2", "#EA580C"]) {
      expect(bands).not.toContain(failing);
    }
  });
});
