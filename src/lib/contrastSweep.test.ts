import { describe, expect, it } from "vitest";
import {
  PROGRAM_PALETTES,
  themeTokens,
  type ProgramPalette,
} from "@/lib/programPalettes";
import { ACTIVITY_HUES } from "@/lib/activity-color";
import fs from "node:fs";

/**
 * Contrast sweep — doc E §8, phase 25.
 *
 * The done-gate says "every text node on a coloured surface clears 4.5:1, on all
 * six presets." Walking every route by hand in six themes is 78 screens and
 * nobody will do it twice. Instead this sweeps the token pairs the surfaces are
 * actually built from, so a palette edit that breaks contrast fails here rather
 * than in front of a family.
 */

function luminance(hex: string): number {
  const clean = hex.replace("#", "").trim();
  const int = parseInt(clean, 16);
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

const AA = 4.5;
const AAA = 7;

/** Every text-on-surface pair the banner and its descendants produce. */
function bannerPairs(palette: ProgramPalette): [string, string, string][] {
  return [
    ["banner title (ink on wash)", palette.ink, palette.wash],
    ["banner eyebrow (ink on wash)", palette.ink, palette.wash],
    ["banner description (ink on wash)", palette.ink, palette.wash],
    ["primary action (onStrong on strong)", palette.onStrong, palette.primaryColor],
  ];
}

describe.each(PROGRAM_PALETTES.map((p) => [p.name, p] as const))(
  "%s preset",
  (_name, palette) => {
    it.each(bannerPairs(palette))("%s clears AA", (_label, fg, bg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA);
    });

    it("banner body text clears AAA, not merely AA", () => {
      // The banner carries the event name on every route. It is the single most
      // read surface in the product.
      expect(contrast(palette.ink, palette.wash)).toBeGreaterThanOrEqual(AAA);
    });

    it("the eyebrow survives its own opacity", () => {
      // .page-banner__eyebrow renders at opacity .75 over the wash. Opacity is
      // not a colour, so the effective ratio must be computed from the blend —
      // the CSS comment claims this stays above 4.5:1; verify it.
      const blend = (fg: string, bg: string, alpha: number) => {
        const mix = (a: number, b: number) => Math.round(a * alpha + b * (1 - alpha));
        const f = parseInt(fg.slice(1), 16);
        const b = parseInt(bg.slice(1), 16);
        const channel = (shift: number) => mix((f >> shift) & 255, (b >> shift) & 255);
        return `#${[channel(16), channel(8), channel(0)]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("")}`;
      };
      const css = fs.readFileSync("src/app/globals.css", "utf8");
      const declared = css.match(/\.page-banner__eyebrow\s*\{[^}]*opacity:\s*\.?(\d+)/);
      expect(declared).not.toBeNull();
      const alpha = Number(`0.${declared![1]}`);
      const effective = blend(palette.ink, palette.wash, alpha);
      expect(contrast(effective, palette.wash)).toBeGreaterThanOrEqual(AA);
    });

    it("the rail is visible against the wash it sits on", () => {
      // Not a text rule — a 4px decorative edge, not a control. Measured 3.00 to
      // 4.42 across the six; Evergreen sits exactly on 3.00, so a floor of 3
      // would let float rounding decide. 2.9 catches a real regression without
      // being decided by the last bit.
      expect(contrast(palette.rail, palette.wash)).toBeGreaterThanOrEqual(2.9);
    });

    it("emits every brand literal as a resolved hex", () => {
      const tokens = themeTokens(undefined, undefined, palette.id);
      for (const value of Object.values(tokens)) {
        expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  },
);

describe("activity hues carry text safely on every route", () => {
  const css = fs.readFileSync("src/app/globals.css", "utf8");

  /** Pull the three literals for a hue straight out of the stylesheet. */
  function hueTriple(hue: string): { rail: string; wash: string; ink: string } | null {
    const grab = (suffix: string) => {
      const match = css.match(new RegExp(`--act-${hue}-${suffix}\\s*:\\s*(#[0-9A-Fa-f]{6})`));
      return match?.[1] ?? null;
    };
    const rail = grab("rail");
    const wash = grab("wash");
    const ink = grab("ink");
    if (!rail || !wash || !ink) return null;
    return { rail, wash, ink };
  }

  it("defines all twelve hues", () => {
    const missing = ACTIVITY_HUES.filter((hue) => hueTriple(hue) === null);
    expect(missing).toEqual([]);
  });

  it.each(ACTIVITY_HUES.map((hue) => [hue]))(
    "%s ink on wash clears AA with headroom",
    (hue) => {
      const triple = hueTriple(hue);
      expect(triple).not.toBeNull();
      // Activity blocks carry the activity name — the thing a volunteer reads
      // off a schedule at arm's length. Measured range is 6.55 to 8.78, so 6 is
      // a floor that catches a real regression without pinning the exact value.
      expect(contrast(triple!.ink, triple!.wash)).toBeGreaterThanOrEqual(6);
    },
  );

  it.each(ACTIVITY_HUES.map((hue) => [hue]))(
    "%s rail is distinguishable from its wash",
    (hue) => {
      // A rail is a decorative edge beside the text, not a control and not a
      // meaningful graphic, so WCAG's 3:1 non-text threshold does not apply —
      // the activity name carries the information. It must still be clearly
      // visible: measured 1.84 to 3.95 against the wash.
      const triple = hueTriple(hue);
      expect(contrast(triple!.rail, triple!.wash)).toBeGreaterThanOrEqual(1.7);
    },
  );
});

describe("status colours clear AA on their washes", () => {
  const css = fs.readFileSync("src/app/globals.css", "utf8");

  function token(name: string): string | null {
    // Take the LAST definition: later :root blocks win on source order.
    const matches = [...css.matchAll(new RegExp(`--${name}\\s*:\\s*(#[0-9A-Fa-f]{6})`, "g"))];
    return matches.length ? matches[matches.length - 1][1] : null;
  }

  it.each([
    ["success", "success-wash"],
    ["warning", "warning-wash"],
    ["danger", "danger-wash"],
    ["info", "info-wash"],
  ])("%s on %s", (fg, bg) => {
    const foreground = token(fg);
    const background = token(bg);
    expect(foreground).not.toBeNull();
    expect(background).not.toBeNull();
    expect(contrast(foreground!, background!)).toBeGreaterThanOrEqual(AA);
  });
});

describe("the neutral text ramp clears AA on both canvases", () => {
  const css = fs.readFileSync("src/app/globals.css", "utf8");

  function token(name: string): string | null {
    const matches = [...css.matchAll(new RegExp(`--${name}\\s*:\\s*(#[0-9A-Fa-f]{6})`, "gi"))];
    return matches.length ? matches[matches.length - 1][1] : null;
  }

  const canvases = ["canvas", "canvas-sunk"];

  it.each(
    ["text-strong", "text", "text-muted"].flatMap((fg) =>
      canvases.map((bg) => [fg, bg] as [string, string]),
    ),
  )("%s on %s", (fg, bg) => {
    const foreground = token(fg);
    const background = token(bg);
    expect(foreground).not.toBeNull();
    expect(background).not.toBeNull();
    expect(contrast(foreground!, background!)).toBeGreaterThanOrEqual(AA);
  });

  it("text-faint stays above the 2.5 floor it is documented for", () => {
    // --text-faint measures 2.52:1 on canvas. That is BELOW AA and below the 3:1
    // non-text threshold, so it must never carry essential copy — it is for
    // decorative labels beside content that already states the same thing.
    // Pinned here so the value cannot drift further down unnoticed.
    const faint = token("text-faint");
    const ratio = contrast(faint!, token("canvas")!);
    expect(ratio).toBeGreaterThanOrEqual(2.5);
    expect(ratio).toBeLessThan(4.5);
  });
});
