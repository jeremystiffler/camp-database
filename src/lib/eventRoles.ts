export type EventRole = "owner" | "admin" | "editor" | "viewer";

const EVENT_ROLE_LABELS: Record<EventRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  editor: "Editor",
  viewer: "Viewer",
};

/** One vocabulary for every user-facing event access label. */
export function eventRoleLabel(role?: string | null): string {
  const normalized = (role || "viewer").toLowerCase() as EventRole;
  return EVENT_ROLE_LABELS[normalized] || EVENT_ROLE_LABELS.viewer;
}
