import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  baseBusPreferenceAccessMock,
  busUserPreferenceMock,
  prismaMock,
  requireAuthMock,
  resolveApiUserIdMock,
} = vi.hoisted(() => {
  const baseBusPreferenceAccessMock = vi.fn(() => {
    throw new Error(
      "base bus preference delegate must not be used inside RLS context",
    );
  });
  return {
    baseBusPreferenceAccessMock,
    busUserPreferenceMock: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    prismaMock: {
      busCampus: {
        findMany: vi.fn(),
      },
      busUserPreference: {
        findUnique: baseBusPreferenceAccessMock,
        upsert: baseBusPreferenceAccessMock,
      },
    },
    requireAuthMock: vi.fn(),
    resolveApiUserIdMock: vi.fn(),
  };
});

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
  resolveApiUserId: resolveApiUserIdMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
  withUserDbContext: vi.fn(
    async (_userId: string, action: (tx: unknown) => Promise<unknown>) =>
      action({ busUserPreference: busUserPreferenceMock }),
  ),
}));

function preferenceRequest(body: unknown) {
  return new Request("https://example.test/api/workspace/bus-preferences", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("POST /api/workspace/bus-preferences 班车偏好接口", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuthMock.mockReset();
    resolveApiUserIdMock.mockReset();
    prismaMock.busCampus.findMany.mockReset();
    busUserPreferenceMock.findUnique.mockReset();
    busUserPreferenceMock.upsert.mockReset();
    baseBusPreferenceAccessMock.mockClear();
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
  });

  it("未知的首选出发校区返回 400", async () => {
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
    expect(busUserPreferenceMock.upsert).not.toHaveBeenCalled();
  });

  it("未知的首选目的校区返回 400", async () => {
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
    expect(busUserPreferenceMock.upsert).not.toHaveBeenCalled();
  });

  it("保留 null 校区重置行为", async () => {
    busUserPreferenceMock.upsert.mockResolvedValue({});
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
    expect(busUserPreferenceMock.upsert).toHaveBeenCalledOnce();
    expect(baseBusPreferenceAccessMock).not.toHaveBeenCalled();
  });
});
