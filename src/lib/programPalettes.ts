export type ProgramPalette = {
  id: string;
  name: string;
  /** Filled buttons / chips with white text (≥4.5:1 vs white). Stored as camp.primaryColor. */
  primaryColor: string;
  /** Complementary secondary highlight, never behind text. Stored as camp.accentColor. */
  accentColor: string;
  /** Banner and panel backgrounds — very pale; ink reaches ≥7:1. */
  wash: string;
  /** Banner headings and body text — ≥7:1 on wash. */
  ink: string;
  /** 3–4px rails, underlines, dividers, active nav. Decorative only. */
  rail: string;
  /** Text on primaryColor surfaces. */
  onStrong: string;
  preview: readonly [string, string];
};

// Six softened presets (simpleschedulepro-banner-theming-fix.md §4).
// Every preset clears AAA (7:1) for ink-on-wash and AA (4.5:1) for white-on-strong.
// No free hex input anywhere: arbitrary colors cannot guarantee these ratios.
export const PROGRAM_PALETTES: readonly ProgramPalette[] = [
  { id: "harbor", name: "Harbor", primaryColor: "#2F6FB8", accentColor: "#7FB6D4", wash: "#EEF4FA", ink: "#1B4470", rail: "#4F8CC9", onStrong: "#FFFFFF", preview: ["#2F6FB8", "#7FB6D4"] },
  { id: "evergreen", name: "Evergreen", primaryColor: "#2E7D63", accentColor: "#8CC0AB", wash: "#EDF5F1", ink: "#1B4A3A", rail: "#4E9B7E", onStrong: "#FFFFFF", preview: ["#2E7D63", "#8CC0AB"] },
  { id: "plum", name: "Plum", primaryColor: "#6B4E9E", accentColor: "#B3A0D8", wash: "#F2EFF8", ink: "#402E63", rail: "#8A6DBF", onStrong: "#FFFFFF", preview: ["#6B4E9E", "#B3A0D8"] },
  { id: "ember", name: "Ember", primaryColor: "#A85832", accentColor: "#E0A87C", wash: "#FBF1EA", ink: "#7A3D1F", rail: "#C2683C", onStrong: "#FFFFFF", preview: ["#A85832", "#E0A87C"] },
  { id: "rose", name: "Rose", primaryColor: "#A34862", accentColor: "#D99BAF", wash: "#FAEFF2", ink: "#6E2A42", rail: "#B05070", onStrong: "#FFFFFF", preview: ["#A34862", "#D99BAF"] },
  { id: "slate", name: "Slate", primaryColor: "#4A6580", accentColor: "#A3B8CB", wash: "#EFF3F7", ink: "#2E4257", rail: "#6D8AA6", onStrong: "#FFFFFF", preview: ["#4A6580", "#A3B8CB"] },
] as const;

export const DEFAULT_PROGRAM_PALETTE = PROGRAM_PALETTES[0];

// Legacy saved colors (pre-preset) map to the nearest softened preset by hue family
// (§4.7 migration table plus the retired 16-palette set).
const LEGACY_PRESET_MAP: Record<string, string> = {
  "#075985": "harbor", "#1E3A8A": "harbor", "#1E40AF": "harbor", "#2563EB": "harbor", "#155E75": "harbor",
  "#166534": "evergreen", "#0F766E": "evergreen",
  "#5B21B6": "plum", "#701A75": "plum", "#9D174D": "plum",
  "#C2410C": "ember", "#A16207": "ember", "#9A3412": "ember", "#F0894A": "ember",
  "#BE123C": "rose", "#991B1B": "rose",
  "#334155": "slate", "#1F2937": "slate",
};

export function paletteForColors(primaryColor?: string, accentColor?: string): ProgramPalette {
  const direct = PROGRAM_PALETTES.find((palette) => palette.primaryColor.toLowerCase() === (primaryColor || "").toLowerCase());
  if (direct) return direct;
  const legacy = LEGACY_PRESET_MAP[(primaryColor || "").toUpperCase()];
  if (legacy) return PROGRAM_PALETTES.find((palette) => palette.id === legacy) || DEFAULT_PROGRAM_PALETTE;
  void accentColor;
  return DEFAULT_PROGRAM_PALETTE;
}

/** Literal-hex CSS custom properties for the theme wrapper. No var() indirection —
 *  literals are what make the override work at every depth (§3.1). */
export function themeTokens(primaryColor?: string, accentColor?: string): Record<string, string> {
  const palette = paletteForColors(primaryColor, accentColor);
  return {
    "--brand-wash": palette.wash,
    "--brand-ink": palette.ink,
    "--brand-rail": palette.rail,
    "--brand-strong": palette.primaryColor,
    "--brand-accent": palette.accentColor,
    "--brand-onstrong": palette.onStrong,
    // Back-compat aliases, emitted as literals on the same wrapper.
    "--brand-primary": palette.primaryColor,
    "--brand-primary-hover": palette.ink,
    "--accent": palette.accentColor,
  };
}
