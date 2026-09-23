import { afterEach, describe, expect, it, vi } from "vitest";
import {
  shouldLogSampledSuccess,
  shouldLogSuccessfulRequest,
} from "@/lib/log/request-log-sampling";

describe("request log sampling", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is deterministic for a request ID and logs every non-success/slow event", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(shouldLogSampledSuccess("request-1", 1)).toBe(
      shouldLogSampledSuccess("request-1", 1),
    );
    expect(
      shouldLogSuccessfulRequest({
        durationMs: 10,
        requestId: "request-1",
        samplePercent: 0,
        status: 200,
      }),
    ).toBe(false);
    for (const status of [400, 401, 404, 500, 503]) {
      expect(
        shouldLogSuccessfulRequest({
          durationMs: 10,
          requestId: "request-1",
          samplePercent: 0,
          status,
        }),
      ).toBe(true);
    }
    expect(
      shouldLogSuccessfulRequest({
        durationMs: 1_000,
        requestId: "request-1",
        samplePercent: 0,
        status: 200,
      }),
    ).toBe(true);
  });

  it("does not sample non-production logs", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(shouldLogSampledSuccess("request-1", 0)).toBe(true);
  });
});
