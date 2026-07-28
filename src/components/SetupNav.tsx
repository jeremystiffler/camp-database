"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PHASE_OF,
  buildPhases,
  phaseEntrySection,
  sidebarCount,
  type SetupSection,
  type SetupSectionKey,
} from "@/lib/setupPhases";

/**
 * Sidebar setup navigation — dashboard spec §5.3, Slice 5.
 *
 * `Event setup` expands into its phases, each with a status dot. This REPLACES
 * the in-page chevron bar: one navigation system, not two. The sidebar is
 * reachable from anywhere, which matters because the moment you want to jump to
 * Rooms is usually while you are staring at the schedule.
 *
 * No hard locks. A volunteer may legitimately enter activities before rooms, so
 * every phase is a live link regardless of what came before it.
 */

export type SetupNavState = {
  sections: SetupSection[];
  /** Reasons per section, sourced from the Slice 2 issue engine (§5.3). */
  reasons?: Partial<Record<SetupSectionKey, string>>;
};

export function SetupNav({
  href,
  active,
  state,
  onNavigate,
}: {
  /** Base href, already carrying campId. */
  href: string;
  active: boolean;
  state: SetupNavState | null;
  onNavigate?: () => void;
}) {
  const phases = state ? buildPhases(state.sections) : [];
  const remaining = state ? state.sections.filter((section) => !section.done).length : 0;
  const count = sidebarCount(remaining);

  // Auto-collapses when everything is green; auto-expands when something needs
  // attention (§5.3). "Attention" is not only unfinished work — a blocking
  // issue on a FINISHED section counts too, otherwise a double-booked room
  // hides behind a collapsed row precisely because setup looks complete.
  const hasReason = Object.values(state?.reasons ?? {}).some(Boolean);
  const needsAttention = remaining > 0 || hasReason;
  const [open, setOpen] = useState(needsAttention);
  useEffect(() => {
    setOpen(needsAttention);
  }, [needsAttention]);

  const sep = href.includes("?") ? "&" : "?";

  return (
    <div className="setupnav">
      <div className={`setupnav__row ${active ? "is-active" : ""}`}>
        <Link href={href} className="setupnav__main" onClick={onNavigate}>
          <span className="setupnav__icon" aria-hidden="true">
            <SetupGlyph />
          </span>
          <span>Event setup</span>
        </Link>
        {/* Zero remaining shows no count at all — a "0 left" badge is noise. */}
        {count && <span className="setupnav__count">{count}</span>}
        {phases.length > 0 && (
          <button
            type="button"
            className="setupnav__toggle"
            aria-expanded={open}
            aria-label={open ? "Collapse setup sections" : "Expand setup sections"}
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden="true">{open ? "▾" : "▸"}</span>
          </button>
        )}
      </div>

      {open && phases.length > 0 && (
        <ul className="setupnav__list">
          {phases.map((phase) => {
            const entry = phaseEntrySection(phase);
            // Hover copy comes from the issue engine, never a second string
            // table — one source for what is wrong, everywhere it is shown.
            const reason = phase.sections
              .map((section) => state?.reasons?.[section.key])
              .find(Boolean);
            const dot = reason ? "attention" : phase.done ? "done" : "todo";
            return (
              <li key={phase.key}>
                <Link
                  href={entry ? `${href}${sep}step=${entry}` : href}
                  className="setupnav__item"
                  title={reason ?? (phase.done ? `${phase.label} is done` : `${phase.remaining} left in ${phase.label}`)}
                  onClick={onNavigate}
                >
                  <span className={`setupnav__dot is-${dot}`} aria-hidden="true">
                    {dot === "done" ? "✓" : dot === "attention" ? "!" : ""}
                  </span>
                  <span className="setupnav__label">{phase.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Derive the section-completion list the nav needs from a dashboard summary.
 * Kept here so the sidebar and `/setup` cannot drift into two opinions about
 * what "done" means.
 */
export function sectionsFromStats(
  stats: {
    ageGroups?: number;
    rooms?: number;
    scheduleBlocks?: number;
    teachers?: number;
    classes?: number;
  } | null,
  extras: { detailsDone?: boolean; scheduleDone?: boolean; registrationOpen?: boolean } = {},
): SetupSection[] {
  const done: Record<SetupSectionKey, boolean> = {
    details: extras.detailsDone ?? true,
    ages: (stats?.ageGroups ?? 0) > 0,
    rooms: (stats?.rooms ?? 0) > 0,
    times: (stats?.scheduleBlocks ?? 0) > 0,
    teachers: (stats?.teachers ?? 0) > 0,
    activities: (stats?.classes ?? 0) > 0,
    schedule: extras.scheduleDone ?? false,
    registration: extras.registrationOpen ?? false,
    review: extras.registrationOpen ?? false,
  };
  const labels: Record<SetupSectionKey, string> = {
    details: "Event Info",
    ages: "Age Groups",
    rooms: "Rooms",
    times: "Time Blocks",
    teachers: "Teachers",
    activities: "Activities",
    schedule: "Schedule Grid",
    registration: "Registration Form",
    review: "Review & Open",
  };
  return (Object.keys(labels) as SetupSectionKey[]).map((key) => ({
    key,
    label: labels[key],
    phase: PHASE_OF[key],
    done: done[key],
  }));
}

function SetupGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 3 20h18L12 3Z" strokeLinejoin="round" />
    </svg>
  );
}
