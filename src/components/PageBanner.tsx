"use client";

import type { ReactNode } from "react";

/**
 * The one page header — doc E §5, phases 11 and 20.
 *
 * Every route had its own hand-rolled heading block, so switching the active
 * event changed the colour on two routes out of thirteen. The banner draws from
 * --brand-wash / --brand-rail / --brand-ink, which the protected layout emits
 * from the event's theme preset, so adopting it is what makes the §7 gate
 * "switching the active event changes the banner on every route" true.
 *
 * Deliberately not configurable beyond these props: a header that accepts
 * arbitrary styling is how thirteen different headers happened.
 */
export function PageBanner({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = "",
}: {
  /** Small uppercase label above the title. Names the workspace, not the action. */
  eyebrow?: string;
  title: string;
  /** One line of context — counts, dates, state. Never instructions. */
  description?: ReactNode;
  /** Buttons or links, laid out at the trailing edge. */
  actions?: ReactNode;
  /** Anything that must sit inside the banner below the header row. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`page-banner mb-6 ${className}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="page-banner__eyebrow">{eyebrow}</p>}
          <h1 className="page-banner__title">{title}</h1>
          {description && <p className="page-banner__desc">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
