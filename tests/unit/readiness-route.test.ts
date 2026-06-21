import { afterEach, describe, expect, it, vi } from "vitest";

const { queryRawMock, storageReadinessMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  storageReadinessMock: vi.fn(() => ({
    status: "ok",
    binding: "R2_UPLOADS",
  })),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

vi.mock("@/lib/storage/r2-object", () => ({
  storageReadiness: storageReadinessMock,
}));

describe("/api/readiness", () => {
  afterEach(() => {
    queryRawMock.mockReset();
    storageReadinessMock.mockClear();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns readiness checks for local requests", async () => {
    queryRawMock.mockResolvedValue([{ "?column?": 1 }]);
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { GET } = await import("@/routes/api/readiness/+server");

    const response = await GET({
      request: new Request("http://127.0.0.1:3000/api/readiness", {
        headers: { "x-request-id": "request-1" },
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      checks: {
        database: { status: "ok" },
        storage: { status: "ok" },
      },
    });
    expect(typeof body.uptimeSeconds).toBe("number");
  });

  it("hides readiness from remote requests without a token", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { GET } = await import("@/routes/api/readiness/+server");

    const response = await GET({
      request: new Request("https://example.test/api/readiness", {
        headers: { host: "example.test" },
      }),
    });

    expect(response.status).toBe(404);
    expect(queryRawMock).not.toHaveBeenCalled();
  });
});
