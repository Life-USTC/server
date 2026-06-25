import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, requireAuthMock, resolveApiUserIdMock } = vi.hoisted(
  () => ({
    prismaMock: {
      busCampus: {
        findMany: vi.fn(),
      },
      busUserPreference: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    },
    requireAuthMock: vi.fn(),
    resolveApiUserIdMock: vi.fn(),
  }),
);

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
  resolveApiUserId: resolveApiUserIdMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

function preferenceRequest(body: unknown) {
  return new Request("https://example.test/api/bus/preferences", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("POST /api/bus/preferences", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuthMock.mockReset();
    resolveApiUserIdMock.mockReset();
    prismaMock.busCampus.findMany.mockReset();
    prismaMock.busUserPreference.findUnique.mockReset();
    prismaMock.busUserPreference.upsert.mockReset();
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
  });

  it("returns 400 for an unknown preferred origin campus", async () => {
    prismaMock.busCampus.findMany.mockResolvedValue([]);
    const { postBusPreferencesRoute } = await import("@/lib/api/routes/bus");

    const response = await postBusPreferencesRoute(
      preferenceRequest({
        preferredOriginCampusId: 999,
        preferredDestinationCampusId: null,
        showDepartedTrips: false,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Unknown preferred origin campus",
    });
    expect(prismaMock.busUserPreference.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown preferred destination campus", async () => {
    prismaMock.busCampus.findMany.mockResolvedValue([{ id: 1 }]);
    const { postBusPreferencesRoute } = await import("@/lib/api/routes/bus");

    const response = await postBusPreferencesRoute(
      preferenceRequest({
        preferredOriginCampusId: 1,
        preferredDestinationCampusId: 999,
        showDepartedTrips: true,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Unknown preferred destination campus",
    });
    expect(prismaMock.busUserPreference.upsert).not.toHaveBeenCalled();
  });

  it("keeps null campus reset behavior", async () => {
    prismaMock.busUserPreference.upsert.mockResolvedValue({});
    const { postBusPreferencesRoute } = await import("@/lib/api/routes/bus");

    const response = await postBusPreferencesRoute(
      preferenceRequest({
        preferredOriginCampusId: null,
        preferredDestinationCampusId: null,
        showDepartedTrips: false,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      preference: {
        preferredOriginCampusId: null,
        preferredDestinationCampusId: null,
        showDepartedTrips: false,
      },
    });
    expect(prismaMock.busCampus.findMany).not.toHaveBeenCalled();
    expect(prismaMock.busUserPreference.upsert).toHaveBeenCalledOnce();
  });
});
