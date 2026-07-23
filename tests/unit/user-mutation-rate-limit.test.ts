import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { checkUserMutationRateLimit } from "@/lib/security/user-mutation-rate-limit";

describe("user mutation rate limits", () => {
  beforeEach(() => setCloudflareRuntimeEnv(undefined));
  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
    vi.restoreAllMocks();
  });

  it("explicitly bypasses the gate outside a Cloudflare runtime", async () => {
    await expect(
      checkUserMutationRateLimit({
        action: "workspace.todo:write",
        host: "life.example",
        userId: "user-1",
      }),
    ).resolves.toEqual({ allowed: true });
  });

  it("uses one canonical per-host, per-user, per-feature-action key", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    setCloudflareRuntimeEnv({ USER_WRITE_RATE_LIMITER: { limit } });

    await expect(
      checkUserMutationRateLimit({
        action: "workspace.todo:write",
        host: "LIFE.EXAMPLE",
        userId: "user-1",
      }),
    ).resolves.toEqual({ allowed: true });

    expect(limit).toHaveBeenCalledOnce();
    expect(JSON.parse(limit.mock.calls[0][0].key)).toEqual([
      "user-mutation:v1",
      "life.example",
      "workspace.todo:write",
      "user-1",
    ]);
  });

  it("selects the stricter batch binding", async () => {
    const batchLimit = vi.fn().mockResolvedValue({ success: true });
    const writeLimit = vi.fn().mockResolvedValue({ success: true });
    setCloudflareRuntimeEnv({
      USER_BATCH_WRITE_RATE_LIMITER: { limit: batchLimit },
      USER_WRITE_RATE_LIMITER: { limit: writeLimit },
    });

    await checkUserMutationRateLimit({
      action: "subscription:batch-write",
      host: "life.example",
      tier: "batch",
      userId: "user-1",
    });

    expect(batchLimit).toHaveBeenCalledOnce();
    expect(writeLimit).not.toHaveBeenCalled();
  });

  it("reports a rejected budget without throwing", async () => {
    setCloudflareRuntimeEnv({
      USER_WRITE_RATE_LIMITER: {
        limit: vi.fn().mockResolvedValue({ success: false }),
      },
    });

    await expect(
      checkUserMutationRateLimit({
        action: "community.comment:write",
        host: "life.example",
        userId: "user-1",
      }),
    ).resolves.toEqual({ allowed: false, reason: "limited" });
  });

  it.each([
    {},
    {
      USER_WRITE_RATE_LIMITER: {
        limit: vi.fn().mockRejectedValue(new Error("binding unavailable")),
      },
    },
  ])("fails closed when the Cloudflare binding is missing or errors", async (env) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    setCloudflareRuntimeEnv(env);

    await expect(
      checkUserMutationRateLimit({
        action: "community.comment:write",
        host: "life.example",
        userId: "user-1",
      }),
    ).resolves.toEqual({ allowed: false, reason: "unavailable" });

    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        action: "community.comment:write",
        event: "user-mutation-rate-limit.unavailable",
        source: "rate-limit",
        tier: "write",
      }),
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("user-1");
  });
});
