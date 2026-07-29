import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * "Switching the active event changes the banner on EVERY route" — §7, phases
 * 11 and 20.
 *
 * The banner draws from --brand-wash / --brand-rail / --brand-ink, which the
 * protected layout emits from the event's theme preset. A route with its own
 * hand-rolled header does not follow the event, so this test enumerates the
 * routes rather than trusting a spot check — the original audit found 2 of 13 and
 * I reported it as "2 of 18" by counting public routes too.
 */

const PROTECTED = "src/app/(protected)";

function routes(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx") found.push(full);
    }
  };
  walk(PROTECTED);
  return found.sort();
}

const ALL_ROUTES = routes();

/** A route is branded if it uses the component, the wrapper, or the CSS directly. */
function isBranded(file: string): boolean {
  const source = fs.readFileSync(file, "utf8");
  return (
    source.includes("<PageBanner") ||
    source.includes("<PageHeader") ||
    source.includes("page-banner")
  );
}

describe("every protected route carries the branded banner", () => {
  it("finds the expected number of routes", () => {
    // Guard against the test silently passing because the walk broke.
    expect(ALL_ROUTES.length).toBeGreaterThanOrEqual(13);
  });

  it.each(ALL_ROUTES.map((file) => [file.replace(`${PROTECTED}/`, ""), file]))(
    "%s",
    (_label, file) => {
      expect(isBranded(file)).toBe(true);
    },
  );

  it("no route still uses the bare .page-title as its page heading", () => {
    // .page-title is fine inside a printed document; it is not fine as the
    // top-level heading of a route, because it does not follow the event.
    const offenders = ALL_ROUTES.filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      // A page-title h1 that is NOT inside a print document context.
      return /<h1 className="page-title"/.test(source);
    });
    expect(offenders).toEqual([]);
  });
});

describe("the banner follows the event, not a hardcoded colour", () => {
  const css = fs.readFileSync("src/app/globals.css", "utf8");

  it("draws its surface, rail and text from brand tokens", () => {
    const block = css.match(/\.page-banner \{[^}]*\}/)?.[0] ?? "";
    expect(block).toContain("var(--brand-wash)");
    expect(block).toContain("var(--brand-rail)");
  });

  it("uses brand ink for the title, so contrast tracks the preset", () => {
    const title = css.match(/\.page-banner__title \{[^}]*\}/)?.[0] ?? "";
    expect(title).toContain("var(--brand-ink)");
  });

  it("hardcodes no hex inside any banner rule", () => {
    const rules = css.match(/\.page-banner[^{]*\{[^}]*\}/g) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule).not.toMatch(/#[0-9A-Fa-f]{6}/);
    }
  });
});

describe("PageHeader forwards to the banner rather than duplicating it", () => {
  const source = fs.readFileSync("src/components/OperationalUI.tsx", "utf8");

  it("renders PageBanner instead of its own header element", () => {
    // Converting the wrapper rather than each call site means future consumers
    // get the banner for free.
    expect(source).toContain("<PageBanner");
    expect(source).not.toMatch(/<header className="mb-6 flex flex-col gap-4 border-b/);
  });
});

describe("no text sits on a gradient in the converted routes", () => {
  it.each(ALL_ROUTES.map((file) => [file.replace(`${PROTECTED}/`, ""), file]))(
    "%s has no gradient carrying text-white",
    (_label, file) => {
      const source = fs.readFileSync(file, "utf8");
      // The pattern found and fixed on /teachers and /registration: a gradient
      // fill with white text, where the contrast ratio varies across the element
      // and can only be verified at a single point.
      const matches = source.match(/bg-gradient-to-\w+[^"'`]*text-white/g) ?? [];
      expect(matches).toEqual([]);
    },
  );
});
