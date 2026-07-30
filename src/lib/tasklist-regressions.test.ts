import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { resolveAccessibleCamp } from "@/lib/camp-selection";

const camps = [{ id: "first", name: "First event" }, { id: "second", name: "Second event" }];

describe("accessible event selection", () => {
  it("falls back from a stale saved id without selecting an inaccessible event", () => {
    expect(resolveAccessibleCamp(camps, "", "dead-id")).toEqual({
      selected: camps[0],
      deniedRequestedId: null,
    });
  });

  it("flags a requested event outside the accessible list and offers the first accessible event", () => {
    expect(resolveAccessibleCamp(camps, "someone-elses-event", "second")).toEqual({
      selected: camps[1],
      deniedRequestedId: "someone-elses-event",
    });
  });

  it("honors an accessible URL event ahead of saved state", () => {
    expect(resolveAccessibleCamp(camps, "first", "second")).toEqual({
      selected: camps[0],
      deniedRequestedId: null,
    });
  });
});

describe("task-list contrast and access regressions", () => {
  const layout = fs.readFileSync("src/app/(protected)/layout.tsx", "utf8");
  const schedule = fs.readFileSync("src/app/(protected)/schedule/page.tsx", "utf8");
  const landing = fs.readFileSync("src/app/page.tsx", "utf8");

  it("renders an explicit event access error rather than a zero-state", () => {
    expect(layout).toContain("You don&apos;t have access to this event");
    expect(layout).toContain('localStorage.removeItem("activeCampId")');
    expect(layout).toContain("accessDenied ?");
  });

  it("keeps readable schedule text off the faint decorative token", () => {
    expect(schedule).not.toContain("text-[var(--text-faint)]");
  });

  it("uses the required high-contrast hero mock treatments", () => {
    expect(landing.match(/bg-\[var\(--brand-wash\)\]/g)).toHaveLength(2);
    expect(landing.match(/text-\[var\(--brand-ink\)\]/g)).toHaveLength(2);
    expect(landing).toContain('text-[13px] font-bold text-slate-600">printable packets');
    expect(landing).toContain('text-[13px] font-bold text-slate-600">schedule conflicts');
  });
});
