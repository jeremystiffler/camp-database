"use client";

import { useEffect, useState } from "react";
import type { HomeState } from "@/lib/homeState";
import { readinessBroke, setupSummaryLine } from "@/lib/homeState";

/**
 * The setup panel — dashboard spec §5, build order phase 18g.
 *
 * "The order changes; nothing is ever hidden." Collapsed is not hidden: the
 * header still states the condition and the panel is always expandable. There is
 * no mode toggle — the collapsed default follows the derived state.
 */

export type SetupLink = { label: string; href: string; done: boolean };

export function SetupPanel({
  state,
  blockingCount,
  links,
  firstIncompleteHref,
  registrationOpen = false,
}: {
  state: HomeState;
  blockingCount: number;
  links: SetupLink[];
  /** Needed to tell "still building" from "was running and readiness broke". */
  registrationOpen?: boolean;
  /**
   * Where "Continue setup" goes. §5.2: setup must open the FIRST INCOMPLETE
   * section, never step 1, or a returning organiser lands on finished work.
   */
  firstIncompleteHref: string;
}) {
  const startsCollapsed = state === "ready" || state === "running";
  const [open, setOpen] = useState(!startsCollapsed);
  const broke = readinessBroke(state, registrationOpen);

  // Auto-expand when readiness breaks (§5): the setup section "reopens with the
  // item flagged" rather than staying quietly collapsed while registration is
  // open and something is wrong.
  useEffect(() => {
    if (state === "building") setOpen(true);
  }, [state]);

  const remaining = links.filter((link) => !link.done).length;

  /**
   * The header and the checklist must never contradict each other. The state
   * machine reasons about blocking ISSUES; the checklist reasons about DATA
   * ("do you have any rooms yet?"). Those are different questions, and an event
   * can be free of blocking issues while a checklist row is still empty.
   *
   * When that happens, say the honest thing rather than "complete" over a list
   * showing "Not yet" — that contradiction is the exact defect deleted from the
   * dashboard in phase 18f, and it would be silly to reintroduce it here.
   */
  const claimsComplete = state === "ready" || state === "running";
  const line =
    claimsComplete && remaining > 0
      ? remaining === 1
        ? "Nothing blocking · 1 section still open"
        : `Nothing blocking · ${remaining} sections still open`
      : setupSummaryLine(state, blockingCount || remaining);

  return (
    <section
      className={`setup ${broke ? "setup--broke" : ""}`}
      aria-labelledby="setup-heading"
      data-state={state}
    >
      <button
        type="button"
        className="setup__head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span id="setup-heading" className="setup__title">
            Event setup
          </span>
          <span className={`setup__line ${claimsComplete && remaining === 0 ? "setup__line--ok" : ""}`}>
            {line}
          </span>
        </span>
        <span className="setup__chev" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="setup__body">
          <ul className="setup__list">
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="setup__link">
                  <span className={`setup__dot ${link.done ? "is-done" : ""}`} aria-hidden="true" />
                  <span>{link.label}</span>
                  {/* No hard locks (§5.3): every section stays reachable. A
                      volunteer may legitimately enter activities before rooms. */}
                  <span className="setup__state">{link.done ? "Done" : "Not yet"}</span>
                </a>
              </li>
            ))}
          </ul>
          <a href={firstIncompleteHref} className="setup__cta">
            Continue setup →
          </a>
        </div>
      )}
    </section>
  );
}

/**
 * The Empty state (§5): "Start form only. One action: Name your event. No grid."
 */
export function EmptyHome({ onStart, campName }: { onStart: () => void; campName?: string }) {
  return (
    <section className="emptyhome" aria-labelledby="emptyhome-heading">
      <h2 id="emptyhome-heading" className="emptyhome__title">
        {campName ? `${campName} has nothing scheduled yet` : "Name your event to begin"}
      </h2>
      <p className="emptyhome__sub">
        Add your first activity and time block, and the grid appears here — filling in as you go.
      </p>
      {/* Exactly one action. Anything else competes with it. */}
      <button type="button" className="emptyhome__cta" onClick={onStart}>
        {campName ? "Start setup" : "Name your event"}
      </button>
    </section>
  );
}
