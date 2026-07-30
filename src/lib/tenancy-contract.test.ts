import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = "src/app/api/camps/[campId]";

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(child);
    return entry.name === "route.ts" ? [child] : [];
  });
}

const routes = routeFiles(ROOT);

describe("camp-scoped tenancy boundary", () => {
  it("covers the complete camp-scoped API surface", () => {
    expect(routes.length).toBeGreaterThanOrEqual(38);
  });

  it.each(routes.map((file) => [file.replace(`${ROOT}/`, ""), file]))(
    "%s does not turn missing membership into 403",
    (_label, file) => {
      const source = fs.readFileSync(file, "utf8");

      // 403 is still correct for a real member who lacks editor/admin rights.
      // These patterns specifically catch checks that conflate a missing
      // membership with a role failure and leak that the event exists.
      expect(source).not.toMatch(/!member\s*\|\|\s*!hasPermission/);
      expect(source).not.toMatch(/!role\s*\|\|\s*!hasPermission/);
      expect(source).not.toMatch(/!myRole\s*\|\|\s*!hasPermission/);
      expect(source).not.toMatch(/!await checkAccess\([^)]*\)\)[^\n]*status:\s*403/);
      expect(source).not.toMatch(/!await prisma\.campMember\.findFirst\([^\n]*status:\s*403/);
      expect(source).not.toMatch(/if \(!member\)[^\n]*status:\s*403/);
    },
  );
});
