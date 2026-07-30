import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findMember: vi.fn(),
  findCamp: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    campMember: { findFirst: mocks.findMember },
    camp: { findFirst: mocks.findCamp },
  },
}));
vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));

import { GET } from "@/app/api/camps/[campId]/route";

describe("GET /api/camps/[campId] consolidated read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ userId: "user-1" });
    mocks.findMember.mockResolvedValue({ role: "owner" });
  });

  it("requests and returns every consolidated planning collection", async () => {
    const camp = {
      id: "camp-1",
      ageGroups: [{ id: "age-1" }],
      rooms: [{ id: "room-1" }],
      persons: [{ id: "person-1", personAgeGroups: [] }],
      courses: [{ id: "course-1", sessions: [], courseAgeGroups: [], courseTeachers: [], courseSessionTemplates: [] }],
      sessionTemplates: [{ id: "block-1" }],
      mandatorySessions: [{ id: "required-1" }],
    };
    mocks.findCamp.mockResolvedValue(camp);

    const response = await GET(
      new NextRequest("http://localhost/api/camps/camp-1"),
      { params: Promise.resolve({ campId: "camp-1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ...camp,
      myRole: "owner",
    });

    const query = mocks.findCamp.mock.calls[0][0];
    expect(query.include).toMatchObject({
      ageGroups: expect.any(Object),
      rooms: true,
      persons: expect.any(Object),
      courses: expect.any(Object),
      sessionTemplates: expect.any(Object),
      mandatorySessions: expect.any(Object),
    });
    expect(query.include.courses.include).toMatchObject({
      sessions: expect.any(Object),
      courseAgeGroups: expect.any(Object),
      courseTeachers: expect.any(Object),
      courseSessionTemplates: expect.any(Object),
    });
  });

  it("returns 404 without querying event data when the user is not a member", async () => {
    mocks.findMember.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost/api/camps/someone-elses-event"),
      { params: Promise.resolve({ campId: "someone-elses-event" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(mocks.findCamp).not.toHaveBeenCalled();
  });
});
