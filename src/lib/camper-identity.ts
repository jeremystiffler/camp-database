import { randomUUID } from "crypto";

export function generateCamperScanCode() {
  return `campdb:camper:${randomUUID().replace(/-/g, "")}`;
}

export function normalizePickupNumber(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const cleaned = String(value).trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return cleaned || null;
}

export function familyPickupLabel(lastName?: string | null) {
  const name = (lastName || "Family").trim();
  return `${name.toUpperCase()} FAMILY`;
}
