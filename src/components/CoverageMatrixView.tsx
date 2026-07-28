"use client";

import { useState } from "react";
import {
  coverageLine,
  coverageSummary,
  remediesFor,
  type CoverageCell,
  type CoverageCourse,
  type CoverageMatrix,
} from "@/lib/coverage";
import type { IssueAgeGroup } from "@/lib/issues";

/**
 * The coverage matrix — dashboard spec §4.3, Slice 4.
 *
 * TWO PLACEMENTS, ONE COMPONENT:
 *   - `band`  a footer beneath the operations grid, SHARING its time columns.
 *             Column alignment is the whole point: read down a column for the
 *             classes above and the spare places below.
 *   - `panel` a first-class view above the /activities catalogue, because that
 *             is where classes actually get created.
 *
 * Every flagged cell is a button (§4.4). The documented failure across this
 * product is stating a problem and leaving the person to find the remedy —
 * "1 need a teacher" with no link to the class. A flag that is not a fix is
 * just a complaint.
 */

export type CoverageProps = {
  matrix: CoverageMatrix;
  courses: CoverageCourse[];
  variant: "band" | "panel";
  /** Opens the new-activity form pre-filled with this block and group (§4.4). */
  onAddClass?: (columnKey: string, groupId: string) => void;
  onRaiseCap?: (courseId: string) => void;
  onUnhide?: (courseId: string) => void;
};

export function CoverageMatrixView({
  matrix,
  courses,
  variant,
  onAddClass,
  onRaiseCap,
  onUnhide,
}: CoverageProps) {
  const [openCell, setOpenCell] = useState<string | null>(null);
  const summary = coverageSummary(matrix);

  if (matrix.columns.length === 0 || matrix.groups.length === 0) return null;

  const cellFor = (columnKey: string, groupId: string) =>
    matrix.cells.find((cell) => cell.columnKey === columnKey && cell.groupId === groupId);

  return (
    <section className={`cov cov--${variant}`} aria-label="Coverage by period and age group">
      {variant === "panel" && (
        <header className="cov__head">
          <h2 className="cov__title">{summary.headline}</h2>
          {summary.periods > 0 && (
            <p className="cov__sub">Spare places per period, per age group. A period with room but only one class is fragile.</p>
          )}
        </header>
      )}

      <div className="cov__scroll">
        <table className="cov__table">
          <thead>
            <tr>
              <th scope="col" className="cov__corner">
                {variant === "band" ? "Spare places" : "Age group"}
              </th>
              {matrix.columns.map((column) => (
                <th key={column.key} scope="col" className="cov__colhead">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.groups.map((group) => (
              <tr key={group.id}>
                <th scope="row" className="cov__rowhead">
                  {shortGroupName(group)}
                </th>
                {matrix.columns.map((column) => {
                  const cell = cellFor(column.key, group.id);
                  if (!cell) return <td key={column.key} className="cov__cell" />;
                  const id = `${column.key}:${group.id}`;
                  const flagged = cell.state !== "comfortable" || cell.fragile;
                  return (
                    <td key={column.key} className="cov__cell">
                      <CoverageCellView
                        cell={cell}
                        columnLabel={column.label}
                        open={openCell === id}
                        flagged={flagged}
                        onToggle={() => setOpenCell(openCell === id ? null : id)}
                        remedies={
                          flagged
                            ? remediesFor(cell, courses, column, matrix.groups)
                            : []
                        }
                        onAddClass={() => onAddClass?.(column.key, group.id)}
                        onRaiseCap={onRaiseCap}
                        onUnhide={onUnhide}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Worst-first callout (§4.3). Only on the panel: the band sits under the
          grid where vertical space is scarce, and the cells carry the same
          information in place. */}
      {variant === "panel" && matrix.flagged.length > 0 && (
        <ul className="cov__list">
          {matrix.flagged.slice(0, 6).map((cell) => {
            const column = matrix.columns.find((c) => c.key === cell.columnKey);
            if (!column) return null;
            return (
              <li key={`${cell.columnKey}:${cell.groupId}`} className="cov__listitem">
                <span className={`cov__pip is-${cell.state}${cell.fragile ? " is-fragile" : ""}`} aria-hidden="true" />
                <span className="cov__listtext">{coverageLine(cell, column.label)}</span>
                <button
                  type="button"
                  className="cov__listbtn"
                  onClick={() => onAddClass?.(cell.columnKey, cell.groupId)}
                >
                  Add a class
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CoverageCellView({
  cell,
  columnLabel,
  open,
  flagged,
  onToggle,
  remedies,
  onAddClass,
  onRaiseCap,
  onUnhide,
}: {
  cell: CoverageCell;
  columnLabel: string;
  open: boolean;
  flagged: boolean;
  onToggle: () => void;
  remedies: ReturnType<typeof remediesFor>;
  onAddClass: () => void;
  onRaiseCap?: (courseId: string) => void;
  onUnhide?: (courseId: string) => void;
}) {
  const classes = [
    "cov__btn",
    `is-${cell.state}`,
    cell.fragile ? "is-fragile" : "",
    flagged ? "is-flagged" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // A true minus sign for a shortage (§4.3), not a hyphen.
  const spareText =
    cell.state === "none"
      ? "none"
      : cell.spare < 0
        ? `\u2212${Math.abs(cell.spare)}`
        : cell.unlimited
          ? `${cell.spare}+`
          : String(cell.spare);

  return (
    <>
      <button
        type="button"
        className={classes}
        aria-expanded={flagged ? open : undefined}
        title={`${coverageLine(cell, columnLabel)}${cell.unlimited ? " — a class here has no limit set" : ""}`}
        onClick={flagged ? onToggle : undefined}
        disabled={!flagged}
      >
        <span className="cov__spare">{spareText}</span>
        <span className="cov__count">
          {cell.activeClasses} {cell.activeClasses === 1 ? "class" : "classes"}
        </span>
      </button>

      {open && flagged && (
        <div className="cov__pop" role="group" aria-label={coverageLine(cell, columnLabel)}>
          <p className="cov__popline">{coverageLine(cell, columnLabel)}</p>
          <div className="cov__actions">
            {remedies.map((remedy) => {
              if (remedy.kind === "add") {
                return (
                  <button key="add" type="button" className="cov__action" onClick={onAddClass}>
                    Add a class
                  </button>
                );
              }
              if (remedy.kind === "raise") {
                return (
                  <button
                    key={`raise-${remedy.courseId}`}
                    type="button"
                    className="cov__action"
                    onClick={() => onRaiseCap?.(remedy.courseId)}
                  >
                    {remedy.label}
                  </button>
                );
              }
              return (
                <button
                  key={`unhide-${remedy.courseId}`}
                  type="button"
                  className="cov__action"
                  onClick={() => onUnhide?.(remedy.courseId)}
                >
                  {remedy.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/** "Older (10-12 years)" is too wide for a matrix row header. */
function shortGroupName(group: IssueAgeGroup): string {
  return group.name.replace(/\s*\([^)]*\)\s*$/, "").trim() || group.name;
}
