export type CampRole = "owner" | "admin" | "editor" | "viewer";

export const ROLE_HIERARCHY: Record<CampRole, number> = {
  owner:  4,
  admin:  3,
  editor: 2,
  viewer: 1,
};

/** Returns true if userRole meets or exceeds requiredRole */
export function hasPermission(userRole: string, requiredRole: CampRole): boolean {
  const level = ROLE_HIERARCHY[userRole as CampRole] ?? 0;
  return level >= ROLE_HIERARCHY[requiredRole];
}

export const ROLE_LABELS: Record<CampRole, string> = {
  owner:  "Owner",
  admin:  "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<CampRole, string> = {
  owner:  "Created this program — full control",
  admin:  "Manage team, create & delete camps",
  editor: "Edit all content, cannot delete program",
  viewer: "View-only access",
};

export const ROLE_COLORS: Record<CampRole, string> = {
  owner:  "bg-sunset-100 text-sunset-700 border-sunset-200",
  admin:  "bg-berry-100 text-berry-700 border-berry-200",
  editor: "bg-sky-100 text-sky-700 border-sky-200",
  viewer: "bg-slate-100 text-slate-600 border-slate-200",
};

/** Roles that can be assigned to invited members (owner can't be assigned) */
export const ASSIGNABLE_ROLES: CampRole[] = ["admin", "editor", "viewer"];
