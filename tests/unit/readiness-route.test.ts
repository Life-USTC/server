import { afterEach, describe, expect, it, vi } from "vitest";

const queryRawMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

describe("/api/readiness", () => {
  afterEach(() => {
    queryRawMock.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns readiness checks for local requests", async () => {
    vi.stubEnv("S3_BUCKET", "life-ustc-test");
    queryRawMock.mockResolvedValue([{ "?column?": 1 }]);
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { GET } = await import("@/app/api/readiness/route");

    const response = await GET(
      new Request("http://127.0.0.1:3000/api/readiness", {
        headers: { "x-request-id": "request-1" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      checks: {
        database: { status: "ok" },
        storage: { status: "ok" },
      },
    });
  });

  it("hides readiness from remote requests without a token", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { GET } = await import("@/app/api/readiness/route");

    const response = await GET(
      new Request("https://example.test/api/readiness", {
        headers: { host: "example.test" },
      }),
    );

    expect(response.status).toBe(404);
    expect(queryRawMock).not.toHaveBeenCalled();
  });
});
