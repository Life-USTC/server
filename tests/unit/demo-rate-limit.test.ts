import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkDemoRateLimit } from "@/features/demo/server/demo-rate-limit";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const request = () =>
  new Request("https://life.example/demo", {
    headers: { "cf-connecting-ip": "192.0.2.7" },
  });

describe("demo rate limits", () => {
  beforeEach(() => setCloudflareRuntimeEnv(undefined));
  afterEach(() => setCloudflareRuntimeEnv(undefined));

  it("uses the strict shared binding and separates bootstrap from token budgets", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    setCloudflareRuntimeEnv({ USER_BATCH_WRITE_RATE_LIMITER: { limit } });

    await expect(checkDemoRateLimit(request(), "bootstrap")).resolves.toEqual({
      allowed: true,
    });
    await expect(
      checkDemoRateLimit(request(), "token", "opaque-session-hash"),
    ).resolves.toEqual({ allowed: true });

    expect(JSON.parse(limit.mock.calls[0][0].key)).toEqual([
      "user-mutation:v1",
      "life.example",
      "demo:bootstrap",
      "192.0.2.7",
    ]);
    expect(JSON.parse(limit.mock.calls[1][0].key)).toEqual([
      "user-mutation:v1",
      "life.example",
      "demo:token",
      "opaque-session-hash",
    ]);
  });

  it("rejects excess requests and fails closed when the binding is missing", async () => {
    setCloudflareRuntimeEnv({
      USER_BATCH_WRITE_RATE_LIMITER: {
        limit: vi.fn().mockResolvedValue({ success: false }),
      },
    });
    await expect(checkDemoRateLimit(request(), "bootstrap")).resolves.toEqual({
      allowed: false,
      reason: "limited",
    });

    setCloudflareRuntimeEnv({});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(checkDemoRateLimit(request(), "bootstrap")).resolves.toEqual({
      allowed: false,
      reason: "unavailable",
    });
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});
