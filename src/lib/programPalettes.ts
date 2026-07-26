export type ProgramPalette = {
  id: string;
  name: string;
  primaryColor: string;
  accentColor: string;
  preview: readonly [string, string];
};

// Dark, saturated primaries keep white text readable across the workspace,
// public registration, and print headers.
export const PROGRAM_PALETTES: readonly ProgramPalette[] = [
  { id: "ocean", name: "Ocean", primaryColor: "#075985", accentColor: "#0284C7", preview: ["#075985", "#38BDF8"] },
  { id: "forest", name: "Forest", primaryColor: "#166534", accentColor: "#16A34A", preview: ["#166534", "#4ADE80"] },
  { id: "sunset", name: "Sunset", primaryColor: "#C2410C", accentColor: "#EA580C", preview: ["#C2410C", "#FB923C"] },
  { id: "violet", name: "Violet", primaryColor: "#5B21B6", accentColor: "#7C3AED", preview: ["#5B21B6", "#A78BFA"] },
  { id: "rose", name: "Rose", primaryColor: "#BE123C", accentColor: "#E11D48", preview: ["#BE123C", "#FB7185"] },
  { id: "amber", name: "Amber", primaryColor: "#A16207", accentColor: "#D97706", preview: ["#A16207", "#FBBF24"] },
  { id: "teal", name: "Teal", primaryColor: "#0F766E", accentColor: "#0D9488", preview: ["#0F766E", "#2DD4BF"] },
  { id: "berry", name: "Berry", primaryColor: "#9D174D", accentColor: "#DB2777", preview: ["#9D174D", "#F472B6"] },
  { id: "slate", name: "Slate", primaryColor: "#334155", accentColor: "#475569", preview: ["#334155", "#94A3B8"] },
  { id: "midnight", name: "Midnight", primaryColor: "#1E3A8A", accentColor: "#2563EB", preview: ["#1E3A8A", "#60A5FA"] },
  { id: "ruby", name: "Ruby", primaryColor: "#991B1B", accentColor: "#DC2626", preview: ["#991B1B", "#F87171"] },
  { id: "plum", name: "Plum", primaryColor: "#701A75", accentColor: "#A21CAF", preview: ["#701A75", "#E879F9"] },
  { id: "cobalt", name: "Cobalt", primaryColor: "#1E40AF", accentColor: "#3B82F6", preview: ["#1E40AF", "#60A5FA"] },
  { id: "copper", name: "Copper", primaryColor: "#9A3412", accentColor: "#C2410C", preview: ["#9A3412", "#FB923C"] },
  { id: "lagoon", name: "Lagoon", primaryColor: "#155E75", accentColor: "#0891B2", preview: ["#155E75", "#22D3EE"] },
  { id: "charcoal", name: "Charcoal", primaryColor: "#1F2937", accentColor: "#4B5563", preview: ["#1F2937", "#9CA3AF"] },
] as const;

export const DEFAULT_PROGRAM_PALETTE = PROGRAM_PALETTES[0];

export function paletteForColors(primaryColor?: string, accentColor?: string): ProgramPalette {
  return PROGRAM_PALETTES.find((palette) => palette.primaryColor === primaryColor && palette.accentColor === accentColor) || DEFAULT_PROGRAM_PALETTE;
}
