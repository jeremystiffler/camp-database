import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import type { CampRole } from "@/lib/permissions";
import { NextResponse } from "next/server";

/** Do not reveal whether an event exists to users outside its membership. */
export async function requireCampRole(userId: string, campId: string, role: CampRole = "editor") {
  const member = await prisma.campMember.findFirst({ where: { campId, userId }, select: { role: true } });
  if (!member) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (!hasPermission(member.role, role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  return null;
}

export function allowedBody(body: unknown, keys: readonly string[]): body is Record<string, unknown> {
  return !!body && typeof body === "object" && !Array.isArray(body) &&
    Object.keys(body).every(key => keys.includes(key));
}

export function validIds(ids: unknown): ids is string[] {
  return Array.isArray(ids) && ids.length <= 100 &&
    ids.every(id => typeof id === "string" && id.length > 0 && id.length <= 128) &&
    new Set(ids).size === ids.length;
}

/** Verify every referenced ID exists inside the event before inserting join rows. */
export async function sameCampIds(campId: string, model: "ageGroup" | "person" | "sessionTemplate", ids: string[]) {
  if (!ids.length) return true;
  const where = { campId, id: { in: ids } };
  const found = model === "ageGroup"
    ? await prisma.ageGroup.findMany({ where, select: { id: true } })
    : model === "person"
      ? await prisma.person.findMany({ where, select: { id: true } })
      : await prisma.sessionTemplate.findMany({ where, select: { id: true } });
  return found.length === ids.length;
}

export const COURSE_FIELDS = ["name", "description", "ageGroupId", "roomId", "cap", "heldSeats", "minEnrollment", "status", "color", "icon", "ageGroupIds", "teacherIds", "sessionTemplateIds", "attentionDismissals"] as const;

export function courseFields(body: Record<string, unknown>) {
  const data: {
    name?: string; description?: string | null; ageGroupId?: string | null; roomId?: string | null;
    cap?: number | null; heldSeats?: number; minEnrollment?: number; status?: string;
    color?: string; icon?: string | null;
  } = {};
  for (const key of ["name", "color", "status"] as const) {
    if (key in body) {
      if (typeof body[key] !== "string" || !body[key] || body[key].length > 255) return null;
      data[key] = body[key];
    }
  }
  for (const key of ["description", "icon", "ageGroupId", "roomId"] as const) {
    if (key in body) {
      if (body[key] !== null && typeof body[key] !== "string") return null;
      if (typeof body[key] === "string" && body[key].length > 5000) return null;
      data[key] = body[key] as string | null;
    }
  }
  if ("status" in data && !["active", "hidden", "cancelled"].includes(data.status!)) return null;
  for (const key of ["cap", "heldSeats", "minEnrollment"] as const) {
    if (key in body) {
      const number = body[key] === "" || body[key] === null ? null : Number(body[key]);
      if (number === null && key !== "cap") return null;
      if (number !== null && (!Number.isInteger(number) || number < (key === "cap" ? 1 : 0))) return null;
      if (key === "cap") data.cap = number;
      else if (key === "heldSeats") data.heldSeats = number!;
      else data.minEnrollment = number!;
    }
  }
  return data;
}

export async function validCourseReferences(campId: string, body: Record<string, unknown>) {
  for (const [field, model] of [
    ["ageGroupIds", "ageGroup"], ["teacherIds", "person"], ["sessionTemplateIds", "sessionTemplate"],
  ] as const) {
    if (field in body && (!validIds(body[field]) || !await sameCampIds(campId, model, body[field]))) return false;
  }
  if (body.ageGroupId && !await sameCampIds(campId, "ageGroup", [body.ageGroupId as string])) return false;
  if (body.roomId && !await prisma.room.findFirst({ where: { campId, id: body.roomId as string }, select: { id: true } })) return false;
  return true;
}
