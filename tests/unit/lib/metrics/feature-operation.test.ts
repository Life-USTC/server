import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  runWithCloudflareRuntimeEnv,
  setCloudflareRequestContext,
} from "@/lib/adapters/cloudflare-runtime";
import { logAppEvent } from "@/lib/log/app-logger";
import {
  httpFeatureContext,
  observeHttpFeature,
  resolveHttpFeatureOperation,
} from "@/lib/metrics/feature-http-operation";
import {
  classifyFeatureStatus,
  observeFeatureOperation,
} from "@/lib/metrics/feature-operation";

vi.mock("@/lib/log/app-logger", () => ({ logAppEvent: vi.fn() }));
const requestId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const context = {
  feature: "catalog.course",
  operation: "get",
  protocol: "rest",
  surface: "unknown",
  authMode: "anonymous",
} as const;
const writeDataPoint = vi.fn();
const run = <T>(callback: () => T) =>
  runWithCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } }, callback);
beforeEach(() => {
  writeDataPoint.mockReset();
});

describe("feature operation recording", () => {
  it("emits one bounded event with trusted context and no payload or identity", async () => {
    const value = { email: "private@example.com", query: "private search" };
    await run(async () => {
      setCloudflareRequestContext({
        method: "GET",
        route: "/private",
        requestId,
      });
      expect(await observeFeatureOperation(context, () => value)).toBe(value);
    });
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["feature:catalog.course"],
      blobs: [
        "feature_operation_v1",
        "catalog.course",
        "get",
        "rest",
        "unknown",
        "anonymous",
        "success",
        "none",
        requestId,
      ],
      doubles: [expect.any(Number)],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain("private");
  });
  it("preserves the identical response and stream without cloning or reading", async () => {
    const response = new Response("hello", {
      headers: { "cache-control": "public, max-age=60", etag: "test" },
    });
    const clone = vi.spyOn(response, "clone");
    const result = await run(() =>
      observeHttpFeature(
        new Request("https://example.com/catalog/courses"),
        requestId,
        () => response,
      ),
    );
    expect(result).toBe(response);
    expect(response.bodyUsed).toBe(false);
    expect(clone).not.toHaveBeenCalled();
    expect(result.headers.get("cache-control")).toBe("public, max-age=60");
    expect(await result.text()).toBe("hello");
  });
  it("never changes successful values or thrown errors when the sink fails", async () => {
    writeDataPoint.mockImplementation(() => {
      throw Error("sink down");
    });
    const error = Object.assign(new Error("private database detail"), {
      status: 503,
    });
    await run(async () => {
      expect(await observeFeatureOperation(context, () => 42)).toBe(42);
      await expect(
        observeFeatureOperation(context, () => {
          throw error;
        }),
      ).rejects.toBe(error);
    });
  });
  it("isolates a failed result classifier from the operation", async () => {
    await run(async () =>
      expect(
        await observeFeatureOperation(
          context,
          () => 42,
          () => {
            throw Error("classifier");
          },
        ),
      ).toBe(42),
    );
    expect(writeDataPoint.mock.calls[0][0].blobs.slice(6, 8)).toEqual([
      "unknown",
      "unknown",
    ]);
  });
  it.each([
    [200, "success", "none"],
    [207, "unknown", "unknown"],
    [302, "unknown", "unknown"],
    [400, "rejected", "invalid_input"],
    [401, "rejected", "unauthorized"],
    [403, "rejected", "forbidden"],
    [404, "rejected", "not_found"],
    [429, "rejected", "rate_limited"],
    [500, "error", "internal"],
    [503, "error", "dependency"],
  ])("classifies status %i independently", (status, outcome, errorClass) => {
    expect(classifyFeatureStatus(Number(status))).toEqual({
      outcome,
      errorClass,
    });
  });
  it("does not call a remote reader or require a configured sink", async () => {
    await runWithCloudflareRuntimeEnv({}, async () =>
      expect(await observeFeatureOperation(context, () => 42)).toBe(42),
    );
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
  it("does not infer a verified identity from credentials or user agent", () => {
    const request = new Request("https://example.com/api/catalog/courses", {
      headers: { authorization: "Bearer secret", "user-agent": "cli" },
    });
    expect(httpFeatureContext(request)).toMatchObject({
      authMode: "unknown",
      surface: "unknown",
    });
  });
  it("excludes prefetch, HEAD, telemetry/admin, and transport envelopes", async () => {
    await run(async () => {
      for (const path of [
        "/admin/experience",
        "/api/graphql",
        "/api/mcp",
        "/api/health",
        "/api/community/section-homeworks/audit",
        "/api/catalog/courses/not-an-id",
      ])
        await observeHttpFeature(
          new Request(`https://example.com${path}`),
          requestId,
          () => new Response(),
        );
      await observeHttpFeature(
        new Request("https://example.com/search", {
          headers: { purpose: "prefetch" },
        }),
        requestId,
        () => new Response(),
      );
      await observeHttpFeature(
        new Request("https://example.com/search", { method: "HEAD" }),
        requestId,
        () => new Response(),
      );
    });
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
  it.each([
    ["/api/catalog/sections/match-codes", "POST", "catalog.section", "match"],
    ["/workspace", "GET", "workspace.overview", "view"],
    [
      "/api/workspace/homeworks/12/completion",
      "PUT",
      "workspace.homework",
      "set_completion",
    ],
    [
      "/api/workspace/homeworks/completions",
      "PUT",
      "workspace.homework",
      "batch",
    ],
    [
      "/api/workspace/subscriptions",
      "PATCH",
      "workspace.subscription",
      "batch",
    ],
    [
      "/api/workspace/subscriptions/query",
      "POST",
      "workspace.subscription",
      "list",
    ],
    [
      "/api/community/section-homeworks/cmmj1abc",
      "DELETE",
      "community.section-homework",
      "delete",
    ],
    ["/api/catalog/courses?search=math", "GET", "catalog.course", "search"],
    ["/catalog/courses/__data.json", "GET", "catalog.course", "view"],
  ])("maps %s %s to its real operation", (path, method, feature, operation) => {
    expect(
      resolveHttpFeatureOperation(
        new URL(`https://example.com${path}`),
        method,
      ),
    ).toEqual({ feature, operation });
  });
  it("does not claim an uninspected batch succeeded", async () => {
    await run(() =>
      observeHttpFeature(
        new Request("https://example.com/api/workspace/homeworks/completions", {
          method: "PUT",
        }),
        requestId,
        () => new Response('{"errors":["failed"]}'),
      ),
    );
    expect(writeDataPoint.mock.calls[0][0].blobs[6]).toBe("unknown");
  });
});

it("reports lost telemetry coverage once per request and preserves all operations", async () => {
  vi.mocked(logAppEvent).mockClear();
  writeDataPoint.mockImplementation(() => {
    throw Error("quota exceeded");
  });
  await run(async () => {
    for (let index = 0; index < 300; index++)
      expect(await observeFeatureOperation(context, () => index)).toBe(index);
  });
  expect(
    vi
      .mocked(logAppEvent)
      .mock.calls.filter((call) => call[1] === "feature.telemetry.failure"),
  ).toHaveLength(1);
});
