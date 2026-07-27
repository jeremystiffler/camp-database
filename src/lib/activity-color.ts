export const ACTIVITY_HUES = [
  "indigo", "blue", "cyan", "teal", "emerald", "lime",
  "amber", "orange", "pink", "fuchsia", "violet", "slate",
] as const;

export type ActivityHue = (typeof ACTIVITY_HUES)[number];

const LEGACY_HEX_MAP: Record<string, ActivityHue> = {
  "#22c55e": "emerald",
  "#0ea5e9": "cyan",
  "#14b8a6": "teal",
  "#a855f7": "violet",
  "#6366f1": "indigo",
  "#ec4899": "pink",
  "#eab308": "amber",
  "#f97316": "orange",
};

export function normalizeActivityName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** FNV-1a: stable across sessions, deploys, and API ordering. */
function hash(value: string) {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return result >>> 0;
}

/**
 * Resolves every repeated activity name to the same visual identity. An explicit
 * color remains a manual override, but callers should pass the first stored
 * color for a name within an event, rather than a session-row color.
 */
export function resolveActivityHue(name: string, storedColor?: string | null): ActivityHue {
  const mapped = storedColor ? LEGACY_HEX_MAP[storedColor.toLowerCase()] : undefined;
  return mapped || ACTIVITY_HUES[hash(normalizeActivityName(name)) % ACTIVITY_HUES.length];
}

export function hueVars(hue: ActivityHue) {
  return {
    rail: `var(--act-${hue}-rail)`,
    wash: `var(--act-${hue}-wash)`,
    ink: `var(--act-${hue}-ink)`,
  };
}
