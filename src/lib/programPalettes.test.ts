import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  DEFAULT_PROGRAM_PALETTE,
  PROGRAM_PALETTES,
  paletteForColors,
  paletteForPreset,
  themeTokens,
} from "@/lib/programPalettes";

/**
 * Theme presets — Phases 4 and 23.
 *
 * The preset is stored by NAME. Colours are its rendered output. The point of
 * six fixed schemes rather than a colour picker is that contrast can be
 * measured once and guaranteed, instead of hoped for per event.
 */

/** WCAG relative luminance. */
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

describe("the contrast guarantee (why presets exist at all)", () => {
  it.each(PROGRAM_PALETTES.map((palette) => [palette.name, palette] as const))(
    "%s clears AAA for ink on wash",
    (_name, palette) => {
      expect(contrast(palette.ink, palette.wash)).toBeGreaterThanOrEqual(7);
    },
  );

  it.each(PROGRAM_PALETTES.map((palette) => [palette.name, palette] as const))(
    "%s clears AA for text on the strong fill",
    (_name, palette) => {
      expect(contrast(palette.onStrong, palette.primaryColor)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("would fail this suite if a preset were swapped for a raw bright colour", () => {
    // The exact failure free hex entry allowed: white on yellow, 1.07:1.
    expect(contrast("#FFFFFF", "#FFFF00")).toBeLessThan(4.5);
  });
});

describe("preset resolution (Phase 4)", () => {
  it("resolves by stored name", () => {
    expect(paletteForPreset("evergreen").id).toBe("evergreen");
    expect(paletteForPreset("EVERGREEN").id).toBe("evergreen");
  });

  it("falls back to the hex for rows written before the column existed", () => {
    expect(paletteForPreset(null, "#2E7D63").id).toBe("evergreen");
    expect(paletteForPreset(undefined, "#075985").id).toBe("harbor");
  });

  it("prefers the stored name over the hex when they disagree", () => {
    // The name is the source of truth; hex is its rendered output.
    expect(paletteForPreset("plum", "#2E7D63").id).toBe("plum");
  });

  it("ignores an unknown name rather than throwing", () => {
    expect(paletteForPreset("neon-yellow", "#2E7D63").id).toBe("evergreen");
  });
});

describe("unmapped colours go to the nearest preset, not silently to blue", () => {
  // Both of these are live in the database and appear in no legacy table.
  it("maps indigo to its nearest relative", () => {
    expect(paletteForColors("#4F46E5").id).toBe("harbor");
  });

  it("maps brown to Ember rather than defaulting to Harbor blue", () => {
    // The bug this replaced: DEFAULT_PROGRAM_PALETTE is Harbor, so every
    // unmapped colour became blue. A brown event turning blue without saying so
    // is worse than choosing the closest of the six.
    expect(paletteForColors("#A1624A").id).toBe("ember");
    expect(paletteForColors("#A1624A").id).not.toBe(DEFAULT_PROGRAM_PALETTE.id);
  });

  it("still defaults when there is no colour at all", () => {
    expect(paletteForColors(undefined).id).toBe(DEFAULT_PROGRAM_PALETTE.id);
    expect(paletteForColors("not-a-colour").id).toBe(DEFAULT_PROGRAM_PALETTE.id);
  });
});

describe("theme tokens are literals (Phase 5)", () => {
  it("emits all six brand literals", () => {
    const tokens = themeTokens(undefined, undefined, "evergreen");
    for (const key of ["--brand-wash", "--brand-ink", "--brand-rail", "--brand-strong", "--brand-accent", "--brand-onstrong"]) {
      expect(tokens[key]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("never emits a var() on the right-hand side", () => {
    // Literals are what make the override work at every depth.
    const tokens = themeTokens(undefined, undefined, "plum");
    for (const value of Object.values(tokens)) {
      expect(value).not.toContain("var(");
    }
  });

  it("follows the preset name, not the hex", () => {
    expect(themeTokens("#2E7D63", "#8CC0AB", "rose")["--brand-strong"]).toBe("#A34862");
  });
});

describe("no free hex entry survives (Phase 23)", () => {
  const api = fs.readFileSync("src/app/api/camps/[campId]/route.ts", "utf8");

  it("the API rejects colours outside the presets", () => {
    // Grepping for the error string is not enough: it survives even when the
    // guard around it is bypassed. Assert the PREDICATE the route applies.
    const known = (value: string) =>
      PROGRAM_PALETTES.some(
        (palette) =>
          palette.primaryColor.toUpperCase() === value.toUpperCase() ||
          palette.accentColor.toUpperCase() === value.toUpperCase(),
      );
    expect(known("#FFFF00")).toBe(false);
    expect(known("#4F46E5")).toBe(false);
    expect(known("#2E7D63")).toBe(true);
    expect(known("#8cc0ab")).toBe(true);

    // And the route must still branch on it, not just mention the message.
    expect(api).toMatch(/if\s*\(!known\)\s*\{/);
    expect(api).toContain("must come from a theme preset");
    expect(api).not.toContain("/^#[0-9a-fA-F]{6}$/");
  });

  it("a preset write derives its own hex server-side", () => {
    expect(api).toContain("allowed.primaryColor = preset.primaryColor");
    expect(api).toContain("allowed.accentColor = preset.accentColor");
  });

  it("no event-colour picker uses a raw colour input", () => {
    for (const file of [
      "src/app/(protected)/dashboard/page.tsx",
      "src/components/NewCampWizard.tsx",
      "src/app/(protected)/settings/page.tsx",
    ]) {
      expect(fs.readFileSync(file, "utf8")).not.toContain('type="color"');
    }
  });

  it("the picker sends a preset name, not a hex pair", () => {
    const dashboard = fs.readFileSync("src/app/(protected)/dashboard/page.tsx", "utf8");
    expect(dashboard).toContain("JSON.stringify({ themePreset })");
  });
});

describe("the migration covers every colour in the live database", () => {
  const migration = fs.readFileSync(
    "prisma/migrations/20260729_add_theme_preset/migration.sql",
    "utf8",
  );

  it.each(["#F0894A", "#2E7D63", "#075985", "#4F46E5", "#A1624A"])(
    "%s has an explicit mapping rather than falling to ELSE",
    (hex) => {
      expect(migration).toContain(hex);
    },
  );

  it("constrains the column to the six known presets", () => {
    expect(migration).toContain("camp_theme_preset_known");
    for (const palette of PROGRAM_PALETTES) {
      expect(migration).toContain(`'${palette.id}'`);
    }
  });
});
