"use client";

import { useEffect, useRef } from "react";

/**
 * Grid popover and drawer — dashboard spec §3, build order phase 18f.
 *
 * THE RULE: nothing here navigates. No Link, no router, no href. Every action is
 * a callback the grid handles in place. §3's acceptance test is literally "no
 * click inside the grid causes a route change", so the components that receive
 * those clicks must have no way to route at all.
 *
 * Both surfaces close on Escape and on a click outside, and both return focus to
 * the element that opened them — otherwise keyboard users are dropped at the top
 * of the document every time they inspect a cell.
 */

function useDismiss(open: boolean, onClose: () => void, returnFocusTo?: HTMLElement | null) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey, true);
    // Deferred so the click that opened it does not immediately close it.
    const timer = window.setTimeout(() => document.addEventListener("mousedown", onPointer), 0);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onPointer);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  // Send focus back to the control that opened this, not to the top of the
  // document. This must run on UNMOUNT: the component only ever mounts in the
  // open state, so an effect keyed on `open` would never fire, and the keyboard
  // user would be silently dropped wherever focus happened to be last.
  const returnRef = useRef<HTMLElement | null>(null);
  returnRef.current = returnFocusTo ?? null;
  useEffect(() => {
    return () => {
      const target = returnRef.current;
      // Only if it is still in the document — the row may have been removed.
      if (target && document.contains(target)) target.focus();
    };
  }, []);

  return ref;
}

export type CellPopoverData = {
  courseId: string;
  courseName: string;
  blockLabel: string;
  /** Null when the activity does not run in this block — the "empty cell" case. */
  sessionId: string | null;
  enrolled: number;
  capacity: number | null;
  roomName: string | null;
  teacherNames: string[];
};

export function CellPopover({
  data,
  onClose,
  onRemove,
  onAdd,
  returnFocusTo,
  busy,
}: {
  data: CellPopoverData;
  onClose: () => void;
  onRemove?: (data: CellPopoverData) => void;
  onAdd?: (data: CellPopoverData) => void;
  returnFocusTo?: HTMLElement | null;
  busy?: boolean;
}) {
  const ref = useDismiss(true, onClose, returnFocusTo);
  const scheduled = data.sessionId !== null;

  return (
    <div className="pop" role="dialog" aria-label={`${data.courseName} at ${data.blockLabel}`} ref={ref}>
      <div className="pop__head">
        <p className="pop__title">{data.courseName}</p>
        <p className="pop__sub">{data.blockLabel}</p>
      </div>

      {scheduled ? (
        <dl className="pop__facts">
          <div>
            <dt>Enrolled</dt>
            <dd>
              {data.enrolled}
              {data.capacity === null ? " · no limit" : ` of ${data.capacity}`}
            </dd>
          </div>
          <div>
            <dt>Room</dt>
            <dd className={data.roomName ? "" : "pop__muted"}>{data.roomName ?? "No room"}</dd>
          </div>
          <div>
            <dt>{data.teacherNames.length === 1 ? "Teacher" : "Teachers"}</dt>
            <dd className={data.teacherNames.length ? "" : "pop__muted"}>
              {data.teacherNames.length ? data.teacherNames.join(", ") : "No teacher"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="pop__empty">This activity does not run at {data.blockLabel}.</p>
      )}

      <div className="pop__actions">
        {scheduled ? (
          <button
            type="button"
            className="pop__btn pop__btn--danger"
            disabled={busy}
            onClick={() => onRemove?.(data)}
          >
            {busy ? "Removing…" : "Remove from this block"}
          </button>
        ) : (
          <button type="button" className="pop__btn" disabled={busy} onClick={() => onAdd?.(data)}>
            {busy ? "Adding…" : `Add ${data.courseName} at ${data.blockLabel}`}
          </button>
        )}
        <button type="button" className="pop__btn pop__btn--quiet" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export type RowDrawerData = {
  courseId: string;
  name: string;
  ageGroupName: string | null;
  color: string | null;
  icon: string | null;
  roomName: string | null;
  teacherNames: string[];
  capacity: number | null;
  sessionCount: number;
};

export function RowDrawer({
  data,
  onClose,
  returnFocusTo,
}: {
  data: RowDrawerData;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const ref = useDismiss(true, onClose, returnFocusTo);

  return (
    <div className="drawer" role="dialog" aria-label={`${data.name} details`} ref={ref}>
      <div className="drawer__head">
        <p className="drawer__title">
          {data.icon && <span aria-hidden="true">{data.icon} </span>}
          {data.name}
        </p>
        <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <dl className="drawer__facts">
        <div>
          <dt>Age group</dt>
          <dd className={data.ageGroupName ? "" : "pop__muted"}>{data.ageGroupName ?? "Open to all"}</dd>
        </div>
        <div>
          <dt>Colour</dt>
          <dd>
            {data.color ? (
              <>
                <span className="drawer__swatch" style={{ background: data.color }} aria-hidden="true" />
                {data.color}
              </>
            ) : (
              <span className="pop__muted">Default</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Default room</dt>
          <dd className={data.roomName ? "" : "pop__muted"}>{data.roomName ?? "No room"}</dd>
        </div>
        <div>
          <dt>{data.teacherNames.length === 1 ? "Teacher" : "Teachers"}</dt>
          <dd className={data.teacherNames.length ? "" : "pop__muted"}>
            {data.teacherNames.length ? data.teacherNames.join(", ") : "No teacher"}
          </dd>
        </div>
        <div>
          <dt>Participant limit</dt>
          <dd className={data.capacity === null ? "pop__muted" : ""}>
            {data.capacity === null ? "No limit set" : data.capacity}
          </dd>
        </div>
        <div>
          <dt>Scheduled</dt>
          <dd className={data.sessionCount ? "" : "pop__muted"}>
            {data.sessionCount
              ? `${data.sessionCount} time ${data.sessionCount === 1 ? "block" : "blocks"}`
              : "Not scheduled"}
          </dd>
        </div>
      </dl>

      {/* No "edit activity" link. §3 acceptance: no click inside the grid causes
          a route change, and an escape hatch to /activities is exactly that. */}
    </div>
  );
}
