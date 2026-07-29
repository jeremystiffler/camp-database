/**
 * Badge name auto-fit — doc C §4, phase 14.
 *
 * A printed badge cannot scroll and cannot be hovered. If a name does not fit,
 * the previous behaviour truncated it with an ellipsis — which on a check-in
 * desk turns "Bartholomew Fitzgerald-Ashworth" into "Bartholomew Fitzger…",
 * exactly when a volunteer needs to read it aloud. Shrinking the type is always
 * better than losing characters.
 *
 * Print has no layout engine we can query at build time, so this estimates width
 * from character count against a measured average advance for the badge face.
 * The estimate is deliberately conservative: overshooting the shrink costs a
 * little visual weight, while undershooting clips a legal name.
 */

/** Sizes are points, matching the print stylesheet. */
export interface NameFit {
  /** Font size to render at. */
  fontSizePt: number;
  /** Whether the name had to be split across two lines. */
  wrapped: boolean;
  /** The lines to render, already split. */
  lines: string[];
}

/**
 * Average character advance as a fraction of font size for the badge face
 * (Arial/Helvetica bold). Measured across mixed-case names rather than assumed:
 * capitals and lowercase average out close to 0.55em at bold weight.
 */
const AVG_ADVANCE = 0.55;

/** Points per inch. */
const PT_PER_IN = 72;

/**
 * Widest the name may be, in points, given the badge width and the horizontal
 * padding the band applies on each side.
 */
export function nameFieldWidthPt(badgeWidthIn: number, sidePaddingIn = 0.1): number {
  return (badgeWidthIn - sidePaddingIn * 2) * PT_PER_IN;
}

/** Estimated rendered width of a string at a given size. */
export function estimateWidthPt(text: string, fontSizePt: number): number {
  return text.length * fontSizePt * AVG_ADVANCE;
}

/**
 * Splits a name into two balanced lines at a word boundary, preferring to keep
 * the surname whole. Returns a single line when there is nothing to split on.
 */
export function splitName(name: string): string[] {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return [name.trim()];
  // Prefer first name on line one, everything else on line two: a hyphenated or
  // double surname stays together, which is how people read a badge.
  return [parts[0], parts.slice(1).join(" ")];
}

/**
 * Chooses the largest size at which the name fits, wrapping to two lines before
 * shrinking below the comfortable floor.
 *
 * @param name       the full name as printed
 * @param widthPt    available width, from nameFieldWidthPt()
 * @param maxPt      the design size (13pt on a 5x3 band)
 * @param minPt      never render smaller than this; below it, wrap instead
 * @param absoluteMinPt hard floor once wrapped — still legible at arm's length
 */
export function fitName(
  name: string,
  widthPt: number,
  maxPt = 13,
  minPt = 9,
  absoluteMinPt = 7,
): NameFit {
  const trimmed = name.trim();
  if (!trimmed) return { fontSizePt: maxPt, wrapped: false, lines: [""] };

  // 1. Try one line, shrinking to the comfortable floor.
  for (let size = maxPt; size >= minPt; size -= 0.5) {
    if (estimateWidthPt(trimmed, size) <= widthPt) {
      return { fontSizePt: size, wrapped: false, lines: [trimmed] };
    }
  }

  // 2. Wrap to two lines and try again from the top. Two lines at 12pt reads far
  //    better than one line at 7pt.
  const lines = splitName(trimmed);
  if (lines.length > 1) {
    const longest = lines.reduce((a, b) => (a.length >= b.length ? a : b));
    for (let size = maxPt; size >= absoluteMinPt; size -= 0.5) {
      if (estimateWidthPt(longest, size) <= widthPt) {
        return { fontSizePt: size, wrapped: true, lines };
      }
    }
    // 3. Even wrapped it will not fit: render at the hard floor. Still every
    //    character — never an ellipsis.
    return { fontSizePt: absoluteMinPt, wrapped: true, lines };
  }

  // A single unbreakable token longer than the badge (rare, but real).
  return { fontSizePt: absoluteMinPt, wrapped: false, lines: [trimmed] };
}
