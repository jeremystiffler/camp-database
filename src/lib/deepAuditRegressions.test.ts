import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { parseProgramDate, programDateInputValue } from "@/lib/programDates";
import { countTimeBlockGroups } from "@/lib/timeBlocks";
import { eventRoleLabel } from "@/lib/eventRoles";

const read = (path: string) => fs.readFileSync(path, "utf8");

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("deep audit functional regressions", () => {
  it("round-trips new-program dates without locale or timezone drift", () => {
    const start = parseProgramDate("2027-06-07");
    const end = parseProgramDate("2027-06-25");
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
    expect(programDateInputValue(start)).toBe("2027-06-07");
    expect(programDateInputValue(end)).toBe("2027-06-25");
    expect(parseProgramDate("06/07/2027")).toBeUndefined();
    expect(parseProgramDate("2027-13-07")).toBeUndefined();
  });

  it("sends, persists, and reloads both dates", () => {
    const wizard = read("src/components/NewCampWizard.tsx");
    const createRoute = read("src/app/api/camps/route.ts");
    const setup = read("src/app/(protected)/setup/page.tsx");
    expect(wizard).toContain("startDate: startDate || undefined");
    expect(wizard).toContain("endDate: endDate || undefined");
    expect(createRoute).toContain("startDate: parsedStartDate");
    expect(createRoute).toContain("endDate: parsedEndDate");
    expect(createRoute).toContain("End date must be on or after start date");
    expect(setup).toContain("setStartDate(programDateInputValue(c.startDate))");
    expect(setup).toContain("setEndDate(programDateInputValue(c.endDate))");
  });

  it("keeps Setup view state and the step query parameter synchronized", () => {
    const setup = read("src/app/(protected)/setup/page.tsx");
    expect(setup).toContain('params.set("step", tab)');
    expect(setup).toContain("router.replace(`/setup?${params.toString()}`, { scroll: false })");
    expect(setup).not.toContain("Next: —");
    expect(setup).toContain("continueLabel(stepLabel(followingStep))");
  });

  it("keeps registration copy complete and activity deletion wired and tenant-scoped", () => {
    const registration = read("src/app/(protected)/registration/page.tsx");
    const activities = read("src/app/(protected)/activities/page.tsx");
    const courseRoute = read("src/app/api/camps/[campId]/courses/[id]/route.ts");
    expect(registration).toContain("Families pick an <strong>Age Group</strong>");
    expect(activities).toContain('method: "DELETE"');
    expect(activities).toContain("<RowDeleteButton onDelete={() => deleteCourse(course)}");
    expect(courseRoute).toContain("accessibleCourse(session.userId, campId, id)");
    expect(courseRoute).toContain('where: { id: courseId, campId }');
  });
});

describe("deep audit shared system regressions", () => {
  it("uses a stable vocabulary for event roles", () => {
    expect(eventRoleLabel("owner")).toBe("Owner");
    expect(eventRoleLabel("admin")).toBe("Administrator");
    expect(eventRoleLabel("editor")).toBe("Editor");
    expect(eventRoleLabel("viewer")).toBe("Viewer");
  });

  it("counts repeated daily records as one user-authored time block", () => {
    expect(countTimeBlockGroups([
      { label: "Morning", startTime: "09:00", endTime: "09:45" },
      { label: "Morning", startTime: "09:00", endTime: "09:45" },
      { label: "Afternoon", startTime: "13:00", endTime: "13:45" },
    ])).toBe(2);
  });

  it("defines one action palette and prevents event themes from overriding it", () => {
    const css = read("src/app/globals.css");
    const palettes = read("src/lib/programPalettes.ts");
    expect(css).toContain("--brand-primary: #0F172A");
    expect(css).toContain("--brand-primary-hover: #1E293B");
    expect(css).toContain("--accent: #0369A1");
    expect(css).toContain("--success: #036B4E");
    expect(css).toContain("--success-action: #16A34A");
    expect(css).toContain("--radius-sm: 8px");
    expect(css).toContain("--radius-md: 12px");
    expect(css).toContain("--control-h: 40px");
    expect(palettes).not.toContain('"--brand-primary"');
    expect(palettes).not.toContain('"--brand-primary-hover"');
    expect(css).not.toMatch(/(?:ok)?lab\(/);
  });

  it("keeps approved small-text token pairs above WCAG AA", () => {
    expect(contrast("#036B4E", "#DCFCE7")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#64748B", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#0F172A", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("uses effective registration status instead of contradictory public and closed badges", () => {
    const registration = read("src/app/(protected)/registration/page.tsx");
    const badgeArea = registration.slice(registration.indexOf("flex flex-wrap gap-2 text-xs font-bold"), registration.indexOf("flex flex-wrap gap-2 text-xs font-bold") + 1200);
    expect(badgeArea).toContain("registrationStateLabel");
    expect(badgeArea).not.toContain('>Public</span>');
    expect(registration).toContain("formIsAcceptingRegistrations = formIsShareable && regOpen");
  });

  it("keeps names and modal headings as the primary identity copy", () => {
    const teachers = read("src/app/(protected)/teachers/page.tsx");
    const participants = read("src/app/(protected)/participants/page.tsx");
    const row = teachers.slice(teachers.indexOf("function PersonRow"), teachers.indexOf("function PersonRow") + 5000);
    expect(row.indexOf("{p.firstName} {p.lastName}")).toBeLessThan(row.indexOf("{p.role}"));
    expect(participants).toContain('{isNew ? "Add Participant" : currentName}');
  });

  it("keeps marketing hierarchy and terminology aligned with the app", () => {
    const landing = read("src/app/page.tsx");
    expect(landing).not.toContain('label: "Period');
    expect(landing).toContain('label: "Time Block 1"');
    expect(landing.indexOf("14-day free trial")).toBeGreaterThan(landing.indexOf('id="pricing"'));
    expect(landing).toContain('bg-[var(--brand-primary)] px-7 py-4');
    expect(landing).toContain('border border-slate-300 bg-transparent px-4');
    expect(landing).not.toContain("bg-gradient-to-br from-indigo-500 to-sky-500");
  });

  it("adds a contrast scrim to user-selectable gradient surfaces", () => {
    expect(read("src/app/register/[campId]/page.tsx")).toContain("linear-gradient(rgba(15,23,42,.48)");
    expect(read("src/app/(protected)/dashboard/page.tsx")).toContain("linear-gradient(rgba(15,23,42,.45)");
  });
});
