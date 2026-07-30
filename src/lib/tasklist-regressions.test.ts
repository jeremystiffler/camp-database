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

  it("uses next/image and modern formats for five licensed audience photos", () => {
    const config = fs.readFileSync("next.config.ts", "utf8");
    const audienceSection = landing.slice(landing.indexOf("const audiences"), landing.indexOf("const sampleBlocks"));
    expect(landing).not.toContain("<img ");
    expect(landing).toContain("audiences.map");
    expect(audienceSection.match(/title: /g)).toHaveLength(5);
    expect(audienceSection).toContain("CC BY 2.0");
    expect(audienceSection).toContain("Public domain");
    for (const file of ["vbs-crafts.jpg", "camps-game.jpg", "homeschool-coops.jpg", "conferences.jpg", "small-groups.jpg"]) {
      expect(fs.existsSync(`public/images/audiences/${file}`), file).toBe(true);
    }
    expect(config).toContain('formats: ["image/avif", "image/webp"]');
  });

  it("keeps collection reads on the aggregate event endpoints", () => {
    for (const route of ["courses", "rooms", "persons", "age-groups", "mandatory-sessions", "session-templates"]) {
      const source = fs.readFileSync(`src/app/api/camps/[campId]/${route}/route.ts`, "utf8");
      expect(source, route).not.toContain("export async function GET");
      expect(source, route).toContain("export async function POST");
    }
  });

  it("removes manual check-in refresh and applies the landing type scale", () => {
    const checkIn = fs.readFileSync("src/app/(protected)/check-in/page.tsx", "utf8");
    expect(checkIn).not.toContain(">Refresh</button>");
    expect(checkIn).toContain("window.setInterval(load, 15_000)");
    expect(landing).toContain("text-[clamp(2.75rem,5vw,3.5rem)] font-bold leading-[1.02] tracking-[-0.032em]");
  });

  it("adds the spreadsheet comparison and a local-only sample experience", () => {
    const sample = fs.readFileSync("src/app/sample/page.tsx", "utf8");
    expect(landing).toContain("Your spreadsheet was never built for this.");
    expect(landing).toContain('href="/sample"');
    expect(sample).toContain("Eight activities, three age groups, and five time blocks");
    expect(sample.match(/id: "(?:art|games|music|science|drama|robots|story|service)"/g)).toHaveLength(8);
    expect(sample).toContain("interactive onAddSession={addSession} onRemoveSession={removeSession}");
    expect(sample).not.toContain("fetch(");
  });

  it("uses one consistent SVG icon family instead of feature emoji", () => {
    expect(landing).toContain("function FeatureIcon");
    expect(landing.match(/<FeatureIcon /g)).toHaveLength(1);
    expect(landing).not.toMatch(/[👨👩👧👦🗓️🎨✅🖨️💳]/u);
  });
});
