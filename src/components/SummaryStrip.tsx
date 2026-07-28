"use client";

import { useEffect, useRef, useState } from "react";
import type { Issue, IssueSeverity } from "@/lib/issues";

/**
 * The summary strip — dashboard spec §2.2, build order phase 18e.
 *
 * Sits above the grid and is ALWAYS VISIBLE. It replaces the "Health details"
 * collapsed accordion, which §2.3 orders deleted outright: "A health summary
 * hidden behind a click is not a callout."
 *
 * Every string here comes from the issue engine (phase 18b). This component
 * counts and renders; it never authors copy and never decides severity. That is
 * what makes the §7 gate — "the sidebar and the summary strip never disagree" —
 * structurally true rather than merely observed.
 */

export type SummaryStripProps = {
  issues: Issue[];
  /** Zero activities AND zero blocks: the strip becomes wayfinding (§2.2). */
  /**
   * Scroll the offending cell into view and highlight it. Returns false when the
   * target is not on screen, which lets the strip say so instead of silently
   * doing nothing.
   */
  onJump?: (issue: Issue) => boolean;
  /** Start expanded. Used by tests and by static rendering. */
  defaultOpen?: boolean;
};

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  blocking: "blocking",
  warning: "needs attention",
  advisory: "advisory",
};

/**
 * Plain-language summary. Counts by code, not by severity, because "3 over
 * capacity · 1 class empty · 0 room clashes" is what the spec asks for and it is
 * what an organiser can act on.
 */
export function summarise(issues: Issue[]): string {
  if (issues.length === 0) return "Everything checks out";
  const counts = new Map<string, number>();
  for (const issue of issues) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);

  const phrase: Record<string, (n: number) => string> = {
    "over-capacity": (n) => `${n} over capacity`,
    "room-clash": (n) => `${n} room ${n === 1 ? "clash" : "clashes"}`,
    "teacher-clash": (n) => `${n} teacher ${n === 1 ? "clash" : "clashes"}`,
    "seat-shortfall": (n) => `${n} short on seats`,
    "no-teacher": (n) => `${n} without a teacher`,
    unscheduled: (n) => `${n} not scheduled`,
    empty: (n) => `${n} ${n === 1 ? "class" : "classes"} empty`,
    "age-group-gap": (n) => `${n} coverage ${n === 1 ? "gap" : "gaps"}`,
    "cap-above-room": (n) => `${n} above room size`,
    roomless: (n) => `${n} without a room`,
    "no-limit-set": (n) => `${n} with no limit`,
  };

  // Blocking first, then warnings, then advisories — same order as the engine.
  const order: string[] = [
    "over-capacity",
    "room-clash",
    "teacher-clash",
    "seat-shortfall",
    "no-teacher",
    "unscheduled",
    "empty",
    "age-group-gap",
    "cap-above-room",
    "roomless",
    "no-limit-set",
  ];
  return order
    .filter((code) => (counts.get(code) ?? 0) > 0)
    .map((code) => phrase[code](counts.get(code)!))
    .join(" · ");
}

export function SummaryStrip({ issues, onJump, defaultOpen }: SummaryStripProps) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [missed, setMissed] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // A resolved issue must not leave a stale "couldn't find it" note behind.
  useEffect(() => setMissed(null), [issues]);

  // The empty-event branch that stood here is deleted (phase 18g). EmptyHome
  // owns that state; this strip only ever renders alongside a grid.

  const blocking = issues.filter((issue) => issue.severity === "blocking").length;
  const clear = issues.length === 0;
  const tone = clear ? "ok" : blocking > 0 ? "blocking" : "warn";

  return (
    <div className={`strip strip--${tone}`}>
      <div className="strip__row">
        <p className="strip__text" role="status">
          {summarise(issues)}
        </p>
        {!clear && (
          <button
            type="button"
            className="strip__toggle"
            aria-expanded={open}
            aria-controls="strip-issues"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Hide issues" : `Show issues (${issues.length})`}
          </button>
        )}
      </div>

      {open && !clear && (
        <div className="strip__list" id="strip-issues" ref={listRef}>
          <ul>
            {issues.map((issue) => (
              <li key={issue.key}>
                <button
                  type="button"
                  className={`strip__issue strip__issue--${issue.severity}`}
                  onClick={() => {
                    const found = onJump ? onJump(issue) : false;
                    // Say so rather than appearing broken. An unscheduled activity
                    // has no cell to scroll to, which is not a failure.
                    setMissed(found ? null : issue.key);
                  }}
                >
                  <span className={`strip__dot strip__dot--${issue.severity}`} aria-hidden="true" />
                  <span className="strip__msg">{issue.message}</span>
                  <span className="strip__sev">{SEVERITY_LABEL[issue.severity]}</span>
                </button>
                {missed === issue.key && (
                  <p className="strip__missed" role="status">
                    That one has no cell in the grid yet.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
