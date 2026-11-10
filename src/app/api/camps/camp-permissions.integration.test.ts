import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), member: vi.fn(), linkFind: vi.fn(), linkUpdate: vi.fn(), linkDelete: vi.fn(), linkCreate: vi.fn(),
  enrollmentFind: vi.fn(), enrollmentUpdate: vi.fn(), release: vi.fn(), courseFind: vi.fn(), courseCreate: vi.fn(), courseDelete: vi.fn(),
  sessionCreate: vi.fn(), sessionFind: vi.fn(), sessionUpdate: vi.fn(), sessionDelete: vi.fn(), claimSeat: vi.fn(), conflicts: vi.fn(), ageGroupFind: vi.fn(), personFind: vi.fn(), templateFind: vi.fn(), roomFind: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/db", () => ({ prisma: {
  campMember: { findFirst: mocks.member },
  registrationLink: { findFirst: mocks.linkFind, update: mocks.linkUpdate, delete: mocks.linkDelete, create: mocks.linkCreate },
  enrollment: { findFirst: mocks.enrollmentFind, update: mocks.enrollmentUpdate },
  course: { findFirst: mocks.courseFind, create: mocks.courseCreate, delete: mocks.courseDelete },
  session: { create: mocks.sessionCreate, findFirst: mocks.sessionFind, update: mocks.sessionUpdate, delete: mocks.sessionDelete },
  sessionTemplate: { findFirst: mocks.templateFind, findMany: mocks.templateFind },
  mandatorySession: { findFirst: vi.fn() }, room: { findFirst: mocks.roomFind },
  ageGroup: { findMany: mocks.ageGroupFind }, person: { findMany: mocks.personFind },
} }));
vi.mock("@/lib/capacity", () => ({
  releaseEnrollment: mocks.release, claimSeat: mocks.claimSeat, storedCapacity: vi.fn(), CapacityError: class CapacityError extends Error {}, capacityForCourse: vi.fn().mockResolvedValue(null),
  effectiveCapacity: vi.fn().mockReturnValue(10), syncCourseSessionCapacities: vi.fn(),
}));
vi.mock("@/lib/scheduling-conflicts", () => ({ checkSchedulingConflicts: mocks.conflicts }));
import { PATCH as patchLink, DELETE as deleteLink } from "@/app/api/camps/[campId]/registration-links/[id]/route";
import { POST as createLink } from "@/app/api/camps/[campId]/registration-links/route";
import { PATCH as patchEnrollment, DELETE as deleteEnrollment } from "@/app/api/camps/[campId]/enrollments/[id]/route";
import { POST as createSession } from "@/app/api/camps/[campId]/sessions/route";
import { PATCH as patchSession, DELETE as deleteSession } from "@/app/api/camps/[campId]/sessions/[id]/route";
import { POST as createEnrollment } from "@/app/api/camps/[campId]/enrollments/route";
import { POST as createCourse } from "@/app/api/camps/[campId]/courses/route";
import { PATCH as patchCourse, DELETE as deleteCourse } from "@/app/api/camps/[campId]/courses/[id]/route";

const params = { params: Promise.resolve({ campId: "event-a", id: "item-b" }) };
const collection = { params: Promise.resolve({ campId: "event-a" }) };
const request = (method: string, body?: object) => new NextRequest("http://localhost/api/camps/event-a/test", {
  method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
});
const writes = () => [mocks.linkUpdate, mocks.linkDelete, mocks.linkCreate, mocks.enrollmentUpdate, mocks.release, mocks.claimSeat, mocks.sessionCreate, mocks.sessionUpdate, mocks.sessionDelete, mocks.courseCreate, mocks.courseDelete];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ userId: "user-a" });
  mocks.member.mockResolvedValue({ role: "owner" });
  mocks.linkFind.mockResolvedValue({ id: "item-b" });
  mocks.enrollmentFind.mockResolvedValue({ id: "item-b", status: "enrolled" });
  mocks.courseFind.mockResolvedValue({ id: "item-b" });
  mocks.sessionFind.mockResolvedValue({ id: "item-b", course: null });
  mocks.conflicts.mockResolvedValue([]);
});

const operations = [
  ["registration link PATCH", () => patchLink(request("PATCH", { maxStudents: 2 }), params)],
  ["registration link DELETE", () => deleteLink(request("DELETE"), params)],
  ["registration link POST", () => createLink(request("POST", {}), collection)],
  ["enrollment PATCH", () => patchEnrollment(request("PATCH", { status: "enrolled" }), params)],
  ["enrollment DELETE", () => deleteEnrollment(request("DELETE"), params)],
  ["session POST", () => createSession(request("POST", { courseId: "course-a", sessionTemplateId: "slot-a" }), collection)],
  ["session PATCH", () => patchSession(request("PATCH", { status: "open" }), params)],
  ["session DELETE", () => deleteSession(request("DELETE"), params)],
  ["enrollment POST", () => createEnrollment(request("POST", { participantId: "participant-a", sessionId: "slot-a" }), collection)],
  ["course POST", () => createCourse(request("POST", { name: "Class A" }), collection)],
  ["course PATCH", () => patchCourse(request("PATCH", { name: "Class B" }), params)],
  ["course DELETE", () => deleteCourse(request("DELETE"), params)],
] as const;

describe("event write authorization", () => {
  it.each(operations)("%s denies outsiders without mutating", async (_, operation) => {
    mocks.member.mockResolvedValue(null);
    expect((await operation()).status).toBe(404);
    for (const write of writes()) expect(write).not.toHaveBeenCalled();
  });
  it.each(operations)("%s denies viewers without mutating", async (_, operation) => {
    mocks.member.mockResolvedValue({ role: "viewer" });
    expect((await operation()).status).toBe(403);
    for (const write of writes()) expect(write).not.toHaveBeenCalled();
  });
  it.each(operations)("%s denies anonymous users", async (_, operation) => {
    mocks.getSession.mockResolvedValue(null);
    expect((await operation()).status).toBe(401);
  });
  it("does not update or delete a foreign registration link", async () => {
    mocks.linkFind.mockResolvedValue(null);
    expect((await patchLink(request("PATCH", { maxStudents: 2 }), params)).status).toBe(404);
    expect((await deleteLink(request("DELETE"), params)).status).toBe(404);
    expect(mocks.linkFind).toHaveBeenCalledWith({ where: { id: "item-b", campId: "event-a" }, select: { id: true } });
    expect(mocks.linkUpdate).not.toHaveBeenCalled();
    expect(mocks.linkDelete).not.toHaveBeenCalled();
  });
  it("does not update or release a foreign enrollment", async () => {
    mocks.enrollmentFind.mockResolvedValue(null);
    mocks.release.mockResolvedValue(false);
    expect((await patchEnrollment(request("PATCH", { status: "enrolled" }), params)).status).toBe(404);
    expect((await deleteEnrollment(request("DELETE"), params)).status).toBe(404);
    expect(mocks.enrollmentFind).toHaveBeenCalledWith({ where: { id: "item-b", campId: "event-a" } });
    expect(mocks.enrollmentUpdate).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledWith("item-b", "event-a");
  });
  it("rejects foreign course/session IDs before creation", async () => {
    mocks.courseFind.mockResolvedValue(null);
    expect((await createSession(request("POST", { courseId: "foreign", sessionTemplateId: "slot-a" }), collection)).status).toBe(400);
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
    mocks.ageGroupFind.mockResolvedValue([]);
    expect((await createCourse(request("POST", { name: "Class A", ageGroupIds: ["foreign"] }), collection)).status).toBe(400);
    expect(mocks.courseCreate).not.toHaveBeenCalled();
  });
  it("rejects server-owned registration link fields and course ownership edits", async () => {
    expect((await createLink(request("POST", { usedCount: 100 }), collection)).status).toBe(400);
    expect((await patchLink(request("PATCH", { campId: "event-b" }), params)).status).toBe(400);
    expect((await patchCourse(request("PATCH", { campId: "event-b" }), params)).status).toBe(400);
    for (const write of writes()) expect(write).not.toHaveBeenCalled();
  });
  it("never edits or deletes a foreign session", async () => {
    mocks.sessionFind.mockResolvedValue(null);
    expect((await patchSession(request("PATCH", { status: "open" }), params)).status).toBe(404);
    expect((await deleteSession(request("DELETE"), params)).status).toBe(404);
    expect(mocks.sessionUpdate).not.toHaveBeenCalled();
    expect(mocks.sessionDelete).not.toHaveBeenCalled();
  });
  it("scopes permitted registration-link mutations in the write predicate", async () => {
    mocks.linkUpdate.mockResolvedValue({ id: "item-b" });
    mocks.linkCreate.mockResolvedValue({ id: "new-link" });
    expect((await patchLink(request("PATCH", { maxStudents: 3 }), params)).status).toBe(200);
    expect(mocks.linkUpdate).toHaveBeenCalledWith({ where: { id: "item-b", campId: "event-a" }, data: { maxStudents: 3 } });
    expect((await createLink(request("POST", { maxStudents: 2 }), collection)).status).toBe(201);
    expect(mocks.linkCreate.mock.calls[0][0].data).toMatchObject({ campId: "event-a", maxStudents: 2 });
    expect(mocks.linkCreate.mock.calls[0][0].data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mocks.linkCreate.mock.calls[0][0].data).not.toHaveProperty("usedCount");
  });
});
