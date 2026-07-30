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

  it("renders the real shared operations grid in the hero with four sample colours", () => {
    expect(landing).toContain("<OperationsGrid courses={sampleCourses}");
    expect(landing).toContain("Activity × time grid");
    const sampleSection = landing.slice(landing.indexOf("const sampleCourses"), landing.indexOf("function FeatureCard"));
    expect(new Set(sampleSection.match(/color: \"#[0-9A-F]{6}\"/g))).toHaveLength(4);
  });

  it("shows exactly one toggle-controlled price per tier", () => {
    expect(landing).toContain('useState<"annual" | "monthly">("annual")');
    expect(landing).toContain("Save 2 months");
    expect(landing).toContain("14-day free trial · no credit card required");
    expect(landing).not.toContain("founding:");
    expect(landing).not.toContain("paid registrations/year");
    expect(landing.match(/"Unlimited participants"/g)).toHaveLength(3);
  });

  it("uses next/image and configured modern formats for licensed photos", () => {
    const config = fs.readFileSync("next.config.ts", "utf8");
    expect(landing).not.toContain("<img ");
    expect(landing.match(/<Image /g)).toHaveLength(3);
    expect(config).toContain('formats: ["image/avif", "image/webp"]');
    expect(config).toContain('hostname: "images.unsplash.com"');
  });
});
