"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
            const dot = reason ? "attention" : section.done ? "done" : "todo";
            return (
              <li key={section.key}>
                <Link
                  href={`${href}${sep}step=${section.key}`}
                  className="setupnav__item"
                  title={reason ?? (section.done ? `${section.label} is done` : `${section.label} needs attention`)}
                  onClick={onNavigate}
                >
                  <span className={`setupnav__dot is-${dot}`} aria-hidden="true">
                    {dot === "done" ? "✓" : dot === "attention" ? "!" : ""}
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
