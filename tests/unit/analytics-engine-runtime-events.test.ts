import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runWithCloudflareRuntimeEnv,
  setCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import { recordAndLogMcpResponse } from "@/lib/api/routes/mcp-response-bookkeeping";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { withBetterAuthOAuthDebug } from "@/lib/log/oauth-debug";
import {
  writeOAuthEventAnalytics,
  writeWorkspaceOverviewStageAnalytics,
} from "@/lib/metrics/analytics-engine";
import {
  cachedPublicRuntimeData,
  publicDetailColoCacheKey,
} from "@/lib/public-runtime-cache";
import {
  getStorageObjectResponse,
  headStorageObject,
  putStorageObject,
} from "@/lib/storage/r2-object";

function installAnalyticsBinding() {
  const writeDataPoint = vi.fn();
  setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });
  return writeDataPoint;
}

function clearPublicRuntimeCache() {
  delete (
    globalThis as typeof globalThis & {
      __lifeUstcPublicRuntimeCache?: unknown;
    }
  ).__lifeUstcPublicRuntimeCache;
}

function validatesSource(value: unknown) {
  return (
    value !== null &&
    typeof value === "object" &&
    "source" in value &&
    typeof value.source === "string"
  );
}

describe("Cloudflare Analytics Engine runtime events", () => {
  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
    clearPublicRuntimeCache();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("writes fixed low-cardinality workspace overview stage datapoints", () => {
    const writeDataPoint = installAnalyticsBinding();
    const stages = [
      "user_sections",
      "todo_summary",
      "due_todo_count",
      "due_todo_sample",
      "counts",
      "lists",
      "item_state",
    ] as const;

    stages.forEach((stage, index) => {
      writeWorkspaceOverviewStageAnalytics({
        ioObservedDurationMs: index + 1,
        stage,
        status: index === stages.length - 1 ? "error" : "success",
      });
    });

    expect(writeDataPoint).toHaveBeenCalledTimes(stages.length);
    stages.forEach((stage, index) => {
      expect(writeDataPoint).toHaveBeenNthCalledWith(index + 1, {
        indexes: [`workspace:overview:${stage}`],
        blobs: [
          "workspace_overview_stage_v1",
          stage,
          index === stages.length - 1 ? "error" : "success",
        ],
        doubles: [index + 1],
      });
    });
  });

  it("keeps workspace overview stages available when Analytics Engine fails", () => {
    setCloudflareRuntimeEnv({
      ANALYTICS: {
        writeDataPoint: vi.fn(() => {
          throw new Error("analytics unavailable");
        }),
      },
    });

    expect(() =>
      writeWorkspaceOverviewStageAnalytics({
        ioObservedDurationMs: 5,
        stage: "todo_summary",
        status: "success",
      }),
    ).not.toThrow();
  });

  it("writes MCP transport datapoints without tool argument values", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:01.000Z"));
    const writeDataPoint = installAnalyticsBinding();
    const request = new Request("https://example.test/api/mcp", {
      method: "POST",
    });

    recordAndLogMcpResponse({
      context: {
        correlationId: "request-1",
        request,
        requestUrl: new URL(request.url),
      },
      phase: "handled",
      request,
      rpcSummary: {
        argumentKeys: ["title"],
        bodyKind: "jsonrpc-single",
        methods: ["tools/call"],
        rpcCount: 1,
        toolCalls: [
          { argumentKeys: ["title"], toolName: "workspace_todo_create" },
        ],
        toolNames: ["workspace_todo_create"],
      },
      start: Date.now() - 125,
      status: 200,
      toolCount: 14,
    });

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["mcp:handled"],
      blobs: [
        "mcp_transport_v2",
        "handled",
        "POST",
        "/api/mcp",
        "200",
        "2xx",
        "jsonrpc-single",
        "tools/call",
        "workspace_todo_create",
        "title",
        "none",
      ],
      doubles: [125, 200, 1, 14],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "private title",
    );
  });

  it("writes OAuth wrapper datapoints when debug logging is off", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:01.000Z"));
    const writeDataPoint = installAnalyticsBinding();

    const response = await withBetterAuthOAuthDebug(
      "POST",
      new Request("https://example.test/api/auth/oauth2/token", {
        method: "POST",
      }),
      async () => new Response(null, { status: 201 }),
    );

    expect(response.status).toBe(201);
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["oauth:/api/auth/oauth2/token"],
      blobs: [
        "oauth_event_v2",
        "better-auth.response",
        "POST",
        "/api/auth/oauth2/token",
        "201",
        "2xx",
        "none",
        "resource_unknown",
        "none",
        "none",
        "none",
      ],
      doubles: [0, 201, 0, 0],
    });
  });

  it("preserves safe OAuth failure diagnostics outside sampled logs", () => {
    const writeDataPoint = installAnalyticsBinding();

    writeOAuthEventAnalytics({
      errorName: "TypeError",
      event: "grant-validation-failed",
      ioObservedDurationMs: 0,
      path: "/api/auth/oauth2/token",
      phase: "resolve-active-refresh-grant",
      status: 503,
    });

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["oauth:/api/auth/oauth2/token"],
      blobs: [
        "oauth_event_v2",
        "grant-validation-failed",
        "unknown",
        "/api/auth/oauth2/token",
        "503",
        "5xx",
        "none",
        "resource_unknown",
        "none",
        "resolve-active-refresh-grant",
        "TypeError",
      ],
      doubles: [0, 503, 0, 0],
    });
  });

  it("writes audit datapoints without audit subject identifiers", async () => {
    const writeDataPoint = installAnalyticsBinding();
    const create = vi.fn(async () => ({}));

    await writeAuditLog(
      {
        action: "comment_create",
        metadata: { source: "unit-test" },
        targetId: "comment-secret",
        targetType: "comment",
        userId: "user-secret",
      },
      { auditLog: { create } },
    );

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["audit:comment_create"],
      blobs: ["audit_write_v2", "success", "comment_create", "comment"],
      doubles: [expect.any(Number)],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "user-secret",
    );
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "comment-secret",
    );
  });

  it("writes storage datapoints without object keys", async () => {
    const writeDataPoint = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    setCloudflareRuntimeEnv({
      ANALYTICS: { writeDataPoint },
      R2_UPLOADS: {
        delete: vi.fn(),
        get: vi.fn(async () => ({
          body: stream,
          httpMetadata: { contentType: "text/plain" },
          size: 42,
        })),
        head: vi.fn(async () => ({
          httpMetadata: { contentType: "text/plain" },
          size: 42,
        })),
        put: vi.fn(),
      },
    });

    await headStorageObject("uploads/user-secret/file.txt");
    await getStorageObjectResponse({
      contentDisposition: "attachment",
      contentType: "text/plain",
      key: "uploads/user-secret/file.txt",
    });
    await putStorageObject({
      body: null,
      contentType: "text/plain",
      key: "uploads/user-secret/file.txt",
    });

    expect(writeDataPoint).toHaveBeenNthCalledWith(1, {
      indexes: ["storage:head"],
      blobs: ["storage_operation_v2", "success", "head"],
      doubles: [expect.any(Number), 42],
    });
    expect(writeDataPoint).toHaveBeenNthCalledWith(2, {
      indexes: ["storage:get"],
      blobs: ["storage_operation_v2", "success", "get"],
      doubles: [expect.any(Number), 42],
    });
    expect(writeDataPoint).toHaveBeenNthCalledWith(3, {
      indexes: ["storage:put"],
      blobs: ["storage_operation_v2", "success", "put"],
      doubles: [expect.any(Number), 0],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "uploads/user-secret",
    );
  });

  it.each([
    {
      key: "course-list:zh-cn:page=1&search=sensitive-marker-679",
      namespace: "page:course-list:zh-cn" as const,
      surface: "catalog page list",
    },
    {
      key: `api:sections:${JSON.stringify({
        locale: "en-us",
        pagination: { page: 1, pageSize: 20 },
        parsedQuery: { search: "sensitive-marker-679" },
      })}`,
      namespace: "api:sections:en-us" as const,
      surface: "section API",
    },
    {
      key: "catalog-detail:course:en-us:679123",
      namespace: "page:course-detail:en-us" as const,
      surface: "catalog detail core",
    },
  ])("writes explicit $surface cache namespaces without raw query cache keys", async ({
    key,
    namespace,
  }) => {
    const writeDataPoint = installAnalyticsBinding();
    const load = vi.fn(async () => ({ ok: true }));

    await cachedPublicRuntimeData(namespace, key, 60_000, load);
    await cachedPublicRuntimeData(namespace, key, 60_000, load);

    expect(load).toHaveBeenCalledTimes(1);
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: [`cache:${namespace}`],
      blobs: ["public_runtime_cache_v2", "miss", namespace, "none"],
      doubles: [expect.any(Number), 60_000, 0],
    });
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: [`cache:${namespace}`],
      blobs: ["public_runtime_cache_v2", "hit", namespace, "none"],
      doubles: [expect.any(Number), 60_000, 1],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "sensitive-marker-679",
    );
  });

  it("writes fixed colo-cache outcomes without entity IDs or synthetic keys", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const writeDataPoint = vi.fn();
    const cachedValue = { source: "colo" };
    const match = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            expiresAt: 60_000,
            schema: "catalog-detail-core-v1",
            value: cachedValue,
          }),
        ),
      )
      .mockResolvedValueOnce(undefined);
    const put = vi.fn(async () => undefined);
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ match, put })),
    });
    const scheduled: Promise<unknown>[] = [];
    const executionContext = {
      waitUntil(promise: Promise<unknown>) {
        scheduled.push(promise);
      },
    };
    const sensitiveId = 683999;
    const coloCacheKey = publicDetailColoCacheKey(
      "https://example.test",
      "course",
      "en-us",
      sensitiveId,
    );

    await runWithCloudflareRuntimeEnv(
      { ANALYTICS: { writeDataPoint } },
      async () => {
        await cachedPublicRuntimeData(
          "page:course-detail:en-us",
          "l2-hit",
          60_000,
          vi.fn(async () => ({ source: "unexpected" })),
          { coloCacheKey, validateColoCacheResult: validatesSource },
        );
        await cachedPublicRuntimeData(
          "page:course-detail:en-us",
          "l2-miss",
          60_000,
          async () => ({ source: "database" }),
          { coloCacheKey, validateColoCacheResult: validatesSource },
        );
        await Promise.all(scheduled);
      },
      executionContext,
    );

    for (const event of ["colo_hit", "colo_miss", "colo_write_complete"]) {
      expect(writeDataPoint).toHaveBeenCalledWith({
        indexes: ["cache:page:course-detail:en-us"],
        blobs: [
          "public_runtime_cache_v2",
          event,
          "page:course-detail:en-us",
          "none",
        ],
        doubles: [expect.any(Number), 60_000, expect.any(Number)],
      });
    }
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      String(sensitiveId),
    );
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "_life-ustc-internal-cache",
    );
  });
});
