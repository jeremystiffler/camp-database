"use client";

import Link from "next/link";
import { useState } from "react";
import {
  sidebarCount,
  type SetupSection,
  type SetupSectionKey,
} from "@/lib/setupPhases";

/**
 * Sidebar setup navigation — dashboard spec §5.3, Slice 5.
 *
 * `Event setup` expands directly into every setup section, each with a status
 * dot. The sidebar is reachable from anywhere, which matters because the moment
 * you want to jump to Rooms is usually while you are staring at the schedule.
 *
 * No hard locks. A volunteer may legitimately enter activities before rooms, so
 * every section is a live link regardless of what came before it.
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
  const remaining = state ? state.sections.filter((section) => !section.done).length : 0;
  const count = sidebarCount(remaining);

  // Setup is open when the signed-in shell first mounts. After that, the user
  // owns this choice: changing completion data must not reopen a section they
  // deliberately collapsed or collapse one they are actively reviewing.
  const [open, setOpen] = useState(true);

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
        {state?.sections.length ? (
          <button
            type="button"
            className="setupnav__toggle"
            aria-expanded={open}
            aria-label={open ? "Collapse setup sections" : "Expand setup sections"}
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden="true">{open ? "▾" : "▸"}</span>
          </button>
        ) : null}
      </div>

      {open && state?.sections.length ? (
        <ul className="setupnav__list">
          {state.sections.map((section) => {
            // Hover copy comes from the issue engine, never a second string
            // table — one source for what is wrong, everywhere it is shown.
            const reason = state.reasons?.[section.key];
            const dot = section.done && !reason ? "done" : "attention";
            return (
              <li key={section.key}>
                <Link
                  href={`${href}${sep}step=${section.key}`}
                  className="setupnav__item"
                  title={reason ?? (section.done ? `${section.label} is done` : `${section.label} needs attention`)}
                  onClick={onNavigate}
                >
                  <span className={`setupnav__dot is-${dot}`} aria-hidden="true">
                    {dot === "done" ? "✓" : "!"}
                  </span>
                  <span className="setupnav__label">{section.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
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
    detailsReady?: boolean;
    teachersReady?: boolean;
    activitiesReady?: boolean;
    scheduleReady?: boolean;
    registrationReady?: boolean;
    reviewReady?: boolean;
  } | null,
): SetupSection[] {
  const done: Record<SetupSectionKey, boolean> = {
    details: stats?.detailsReady ?? false,
    ages: (stats?.ageGroups ?? 0) > 0,
    rooms: (stats?.rooms ?? 0) > 0,
    times: (stats?.scheduleBlocks ?? 0) > 0,
    teachers: stats?.teachersReady ?? false,
    activities: stats?.activitiesReady ?? false,
    schedule: stats?.scheduleReady ?? false,
    registration: stats?.registrationReady ?? false,
    review: stats?.reviewReady ?? false,
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
