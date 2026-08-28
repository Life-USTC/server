import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const { findSuspension, findUser } = vi.hoisted(() => ({
  findSuspension: vi.fn(),
  findUser: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: findUser },
    userSuspension: { findFirst: findSuspension },
  },
}));

describe("viewer context request cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUser.mockResolvedValue({
      id: "user-1",
      image: null,
      isAdmin: true,
      name: "Test User",
    });
    findSuspension.mockResolvedValue(null);
  });

  it("deduplicates identical viewer queries within one request", async () => {
    const { getViewerContext } = await import("@/lib/auth/viewer-context");

    const [first, second] = await runWithCloudflareRuntimeEnv({}, () =>
      Promise.all([
        getViewerContext({ userId: "user-1" }),
        getViewerContext({ userId: "user-1" }),
      ]),
    );

    expect(first).toBe(second);
    expect(findUser).toHaveBeenCalledOnce();
    expect(findSuspension).toHaveBeenCalledOnce();
  });

  it("counts uncached reads but leaves request-cache hits and anonymous reads at zero", async () => {
    const { getViewerContext } = await import("@/lib/auth/viewer-context");
    let uncachedQueryCount = 0;
    let cachedQueryCount = 0;
    let anonymousQueryCount = 0;

    await runWithCloudflareRuntimeEnv({}, async () => {
      await getViewerContext({
        userId: "user-1",
        instrumentation: { onQuery: () => (uncachedQueryCount += 1) },
      });
      await getViewerContext({
        userId: "user-1",
        instrumentation: { onQuery: () => (cachedQueryCount += 1) },
      });
    });
    await runWithCloudflareRuntimeEnv({}, () =>
      getViewerContext({
        userId: null,
        instrumentation: { onQuery: () => (anonymousQueryCount += 1) },
      }),
    );

    expect(uncachedQueryCount).toBe(2);
    expect(cachedQueryCount).toBe(0);
    expect(anonymousQueryCount).toBe(0);
  });

  it("does not share viewer data across requests or admin modes", async () => {
    const { getViewerContext } = await import("@/lib/auth/viewer-context");

    await runWithCloudflareRuntimeEnv({}, () =>
      Promise.all([
        getViewerContext({ userId: "user-1" }),
        getViewerContext({ includeAdmin: true, userId: "user-1" }),
      ]),
    );
    await runWithCloudflareRuntimeEnv({}, () =>
      getViewerContext({ userId: "user-1" }),
    );

    expect(findUser).toHaveBeenCalledTimes(3);
    expect(findSuspension).toHaveBeenCalledTimes(3);
  });
});
