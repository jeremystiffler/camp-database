import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The programme's global done-gate (master build order §7).
 *
 * These are the checks that are easy to satisfy once and then quietly undo. A
 * grep in a checklist gets run when someone remembers; a test gets run every
 * time.
 */

const SRC = "src";

function walk(dir: string, match: (file: string) => boolean): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, match));
    else if (match(entry.name)) found.push(full);
  }
  return found;
}

const sourceFiles = walk(SRC, (file) =>
  /\.(tsx?|css)$/.test(file) && !file.includes(".test."),
);

function filesContaining(needle: string, filter?: (file: string) => boolean): string[] {
  return sourceFiles
    .filter((file) => (filter ? filter(file) : true))
    .filter((file) => fs.readFileSync(file, "utf8").includes(needle));
}

describe("§7 colour gate", () => {
  it.each([
    "sage-100",
    "--ui-lavender",
    "--ui-berry",
    "--ui-sage",
    "--ui-aqua",
    "--ui-denim",
    "--age-slate",
    "stat-forest",
  ])("%s appears nowhere", (token) => {
    expect(filesContaining(token)).toEqual([]);
  });

  it("the whole --ui-* alias layer is gone, not just the listed few", () => {
    // The gate names six tokens; there were fifteen. Deleting only the named
    // ones would pass the checklist and leave the layer standing.
    // Matched as a custom-property reference so the font stack's
    // `ui-sans-serif` keyword is not mistaken for the alias layer.
    const offenders = sourceFiles.filter((file) =>
      /(var\(\s*--ui-|^\s*--ui-[a-z-]+\s*:)/m.test(fs.readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("no warm cream surface survives", () => {
    expect(filesContaining("#fffdf9")).toEqual([]);
  });

  it("#2563EB and #0EA5E9 appear only where they are definitions, not styling", () => {
    const allowed = [
      "programPalettes.ts", // legacy → preset migration table
      "globals.css", // authoritative semantic product-action token
      "activity-color.ts", // legacy hex → hue lookup
      "SSPLogo.tsx", // the product mark itself
      "route.ts", // age-group swatch seeds
      "page.tsx", // explanatory comment on the dashboard card
    ];
    for (const hex of ["#2563EB", "#0EA5E9"]) {
      const offenders = filesContaining(hex).filter(
        (file) => !allowed.some((name) => file.endsWith(name)),
      );
      expect(offenders).toEqual([]);
    }
  });
});

describe("§7 legibility gate", () => {
  it("no screen element is set to font-weight 900", () => {
    // Tailwind's font-black IS 900. Print CSS is exempt: a 420pt pickup number
    // on paper is a different medium with different rules.
    expect(filesContaining("font-black")).toEqual([]);

    const screenNine = sourceFiles
      .filter((file) => !file.includes("print"))
      .filter((file) => /font-weight:\s*900/.test(fs.readFileSync(file, "utf8")))
      // The globals.css comment documents the removal; it is not a rule.
      .filter((file) => !fs.readFileSync(file, "utf8").includes("the earlier block set"));
    expect(screenNine).toEqual([]);
  });

  it("declares .page-title exactly once", () => {
    // It was declared twice with conflicting weights; the loser was invisible
    // dead code that still looked authoritative when read.
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    const matches = css.match(/^\.page-title\s*\{/gm) ?? [];
    expect(matches).toHaveLength(1);
  });
});

describe("activity identity is derived, not stored at random", () => {
  const importRoute = fs.readFileSync("src/app/api/camps/[campId]/import/route.ts", "utf8");

  it("the CSV import assigns no random colour", () => {
    // Math.random() meant importing the same file twice produced different
    // colours for the same activities.
    expect(importRoute).not.toContain("Math.random()");
    expect(importRoute).toContain("stableColor");
  });

  it("the CSV import stamps no placeholder icon", () => {
    expect(importRoute).not.toContain("🎯");
  });
});
