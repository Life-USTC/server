import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runWithCloudflareRuntimeEnv,
  setCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import { recordAndLogMcpResponse } from "@/lib/api/routes/mcp-response-bookkeeping";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { withBetterAuthOAuthDebug } from "@/lib/log/oauth-debug";
import {
  resetAnalyticsEngineDiagnosticsForTest,
  writeApiRequestAnalytics,
  writeAuditWriteAnalytics,
  writeCacheEventAnalytics,
  writeCalendarExportRebuildAnalytics,
  writeCalendarFeedCacheAnalytics,
  writeCommentsStageAnalytics,
  writeDashboardStageAnalytics,
  writeMcpTransportAnalytics,
  writeOAuthEventAnalytics,
  writePageRequestAnalytics,
  writeQueueBatchAnalytics,
  writeWorkerRequestAnalytics,
  writeWorkspaceOverviewStageAnalytics,
  writeWorkspaceRouteStageAnalytics,
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

const { emitLogMock } = vi.hoisted(() => ({
  emitLogMock: vi.fn(),
}));

vi.mock("@/lib/log/app-log-emitter", () => ({
  emitLog: emitLogMock,
}));

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
    resetAnalyticsEngineDiagnosticsForTest();
    emitLogMock.mockReset();
    clearPublicRuntimeCache();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reports a missing Analytics Engine binding through the existing logger", () => {
    runWithCloudflareRuntimeEnv({ NODE_ENV: "production" }, () => {
      writeOAuthEventAnalytics({
        event: "binding-check",
        ioObservedDurationMs: 0,
      });
    });

    expect(emitLogMock).toHaveBeenCalledWith("[analytics]", "error", {
      event: "analytics-engine.binding-missing",
      message: "analytics-engine.binding-missing",
      source: "analytics-engine",
    });
  });

  it("reports Analytics Engine write failures without raw error details", () => {
    const writeDataPoint = vi.fn(() => {
      throw new Error("private analytics detail");
    });
    setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint } });

    writeOAuthEventAnalytics({
      event: "write-check",
      ioObservedDurationMs: 0,
    });

    expect(emitLogMock).toHaveBeenCalledWith("[analytics]", "error", {
      errorName: "Error",
      event: "analytics-engine.write-failed",
      message: "analytics-engine.write-failed",
      source: "analytics-engine",
    });
    expect(JSON.stringify(emitLogMock.mock.calls)).not.toContain(
      "private analytics detail",
    );
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

  it("writes fixed low-cardinality workspace route stage datapoints", () => {
    const writeDataPoint = installAnalyticsBinding();
    const stages = [
      { route: "homeworks", stage: "auth" },
      { route: "homeworks", stage: "section_ids" },
      { route: "homeworks", stage: "db_context" },
      { route: "subscriptions_current", stage: "read" },
    ] as const;

    stages.forEach((entry, index) => {
      if (entry.route === "homeworks") {
        writeWorkspaceRouteStageAnalytics({
          ioObservedDurationMs: index + 10,
          route: "homeworks",
          stage: entry.stage,
          status: "success",
        });
        return;
      }

      writeWorkspaceRouteStageAnalytics({
        ioObservedDurationMs: index + 10,
        route: "subscriptions_current",
        stage: entry.stage,
        status: "success",
      });
    });

    expect(writeDataPoint).toHaveBeenCalledTimes(stages.length);
    stages.forEach((entry, index) => {
      expect(writeDataPoint).toHaveBeenNthCalledWith(index + 1, {
        indexes: [`workspace:${entry.route}:${entry.stage}`],
        blobs: [
          "workspace_route_stage_v1",
          entry.route,
          entry.stage,
          "success",
        ],
        doubles: [index + 10],
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
        "mcp_transport_v3",
        "handled",
        "tools",
        "/api/mcp",
        "2xx",
        "jsonrpc-single",
        "workspace",
        "none",
        "success",
      ],
      doubles: [expect.any(Number), 1, 14, 0, 0, 0],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "private title",
    );
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "tools/call",
    );
  });

  it("retains MCP application errors and unknown inspection outcomes", () => {
    const writeDataPoint = installAnalyticsBinding();
    const summary = {
      argumentKeys: [],
      bodyKind: "jsonrpc-single" as const,
      methods: ["tools/call"],
      rpcCount: 1,
      toolCalls: [],
      toolNames: ["workspace_todo_list"],
    };

    writeMcpTransportAnalytics({
      hasError: true,
      ioObservedDurationMs: 2,
      method: "POST",
      path: "/api/mcp",
      phase: "handled",
      rpcSummary: summary,
      status: 200,
    });
    writeMcpTransportAnalytics({
      hasError: false,
      inspectionTruncated: true,
      ioObservedDurationMs: 2,
      method: "POST",
      path: "/api/mcp",
      phase: "handled",
      rpcSummary: summary,
      status: 200,
    });

    expect(writeDataPoint).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        blobs: expect.arrayContaining(["error"]),
      }),
    );
    expect(writeDataPoint).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        blobs: expect.arrayContaining(["unknown"]),
      }),
    );
  });

  it("normalizes API, OAuth, and audit dimensions to finite values", () => {
    const writeDataPoint = installAnalyticsBinding();
    const secret = "secret-route-or-action-123";

    writeApiRequestAnalytics({
      authMode: secret,
      event: "finish",
      ioObservedDurationMs: 1,
      method: secret,
      route: `/api/auth/${secret}/${secret}`,
      status: 200,
    });
    writeOAuthEventAnalytics({
      errorName: secret,
      event: secret,
      grantType: secret,
      ioObservedDurationMs: 1,
      method: secret,
      path: `/api/auth/${secret}/${secret}`,
      phase: secret,
      status: 500,
      statusReason: secret,
    });
    writeAuditWriteAnalytics({
      action: secret,
      event: "success",
      ioObservedDurationMs: 1,
      targetType: secret,
    });

    expect(writeDataPoint).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        indexes: ["api:auth"],
        blobs: [
          "api_request_v3",
          "finish",
          "unknown",
          "auth",
          "2xx",
          "unknown",
        ],
      }),
    );
    expect(writeDataPoint).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        indexes: ["oauth:auth"],
        blobs: expect.arrayContaining([
          "oauth_event_v3",
          "unknown",
          "unknown",
          "auth",
          "unknown",
        ]),
      }),
    );
    expect(writeDataPoint).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        indexes: ["audit:unknown"],
        blobs: ["audit_write_v2", "success", "unknown", "unknown"],
      }),
    );
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(secret);
  });

  it("uses only current schemas and finite boundary dimensions", () => {
    const writeDataPoint = installAnalyticsBinding();
    const secret = "secret-route-or-locale-123";

    writeApiRequestAnalytics({
      authMode: "anonymous",
      event: "finish",
      ioObservedDurationMs: 1,
      method: "GET",
      route: "/api/catalog",
      status: 200,
    });
    writeOAuthEventAnalytics({
      event: "better-auth.response",
      ioObservedDurationMs: 1,
      path: "/api/auth/oauth2/token",
      status: 200,
    });
    writePageRequestAnalytics({
      appIoObservedDurationMs: 1,
      authIoObservedDurationMs: 1,
      authMode: "anonymous",
      authSignalPresence: "absent",
      catalogDetailTab: "not_applicable",
      event: "finish",
      ioObservedDurationMs: 1,
      locale: secret,
      method: secret,
      route: secret,
      ssrClass: "dynamic-ssr",
      status: 200,
    });
    writeCacheEventAnalytics({
      event: secret as never,
      ioObservedDurationMs: 1,
      namespace: secret as never,
      reason: secret as never,
      storeSize: 1,
      ttlMs: 1_000,
    });
    writeWorkspaceRouteStageAnalytics({
      ioObservedDurationMs: 1,
      route: "homeworks",
      stage: "read",
      status: "success",
    });
    writeWorkspaceRouteStageAnalytics({
      ioObservedDurationMs: 1,
      route: secret as never,
      stage: secret as never,
      status: secret as never,
    });
    writeCalendarFeedCacheAnalytics({
      feed: "user",
      status: "fresh",
      storeSize: 1,
      ttlMs: 1_000,
    });
    writeCalendarFeedCacheAnalytics({
      feed: secret as never,
      status: secret as never,
      storeSize: 1,
      ttlMs: 1_000,
    });
    writeCalendarExportRebuildAnalytics({ status: "ok" });

    const dataPoints = writeDataPoint.mock.calls.map(
      ([dataPoint]) => dataPoint,
    );
    expect(dataPoints.map((dataPoint) => dataPoint.blobs?.[0])).toEqual([
      "api_request_v3",
      "oauth_event_v3",
      "page_request_v2",
      "public_runtime_cache_v3",
      "workspace_route_stage_v1",
      "workspace_route_stage_v1",
      "calendar_feed_cache",
      "calendar_feed_cache",
      "calendar_export_rebuild",
    ]);
    expect(JSON.stringify(dataPoints)).not.toContain("api_request_v2");
    expect(JSON.stringify(dataPoints)).not.toContain("oauth_event_v2");
    expect(JSON.stringify(dataPoints)).not.toContain(secret);
    expect(dataPoints[5]).toMatchObject({
      indexes: ["workspace:unknown:unknown"],
      blobs: ["workspace_route_stage_v1", "unknown", "unknown", "unknown"],
    });
    expect(dataPoints[7]).toMatchObject({
      indexes: ["cache:calendar:unknown"],
      blobs: ["calendar_feed_cache", "unknown", "unknown"],
    });
    for (const dataPoint of dataPoints) {
      expect(dataPoint.indexes).toHaveLength(1);
      expect(dataPoint.blobs.length).toBeLessThanOrEqual(20);
      expect(dataPoint.doubles.length).toBeLessThanOrEqual(20);
    }
  });

  it("writes bounded worker and queue schemas", () => {
    const writeDataPoint = installAnalyticsBinding();

    writeWorkerRequestAnalytics({
      cacheOutcome: "hit",
      durationMs: 12,
      method: "GET",
      requestClass: "dynamic",
      route: "/account/sign-in?token=private",
      status: 200,
    });
    writeQueueBatchAnalytics({
      acked: 20,
      batchSize: 20,
      durationMs: 30,
      invalid: 0,
      maxAgeMs: 100,
      maxAttempts: 1,
      messageType: "audit-log.write.v1",
      outcome: "success",
      processed: 20,
      queue: "audit",
      retried: 0,
    });
    writeCommentsStageAnalytics({
      dbContext: "rls",
      dbLabel: "app",
      dbQueryCount: 5,
      dbTransactionCount: 1,
      durationMs: 80,
      loadedCount: 10,
      outcome: "success",
      rootCount: 2,
      stage: "comments.descendants",
    });
    writeDashboardStageAnalytics({
      dbContext: "rls",
      dbLabel: "app",
      dbQueryCount: 3,
      dbTransactionCount: 1,
      durationMs: 50,
      loadedCount: 4,
      outcome: "success",
      rootCount: 0,
      stage: "nav_stats",
      subscribedSectionCount: 4,
    });

    expect(writeDataPoint).toHaveBeenNthCalledWith(1, {
      indexes: ["worker:account-sign-in"],
      blobs: [
        "worker_request_v1",
        "finish",
        "account-sign-in",
        "dynamic",
        "GET",
        "2xx",
        "hit",
      ],
      doubles: [12, 200],
    });
    expect(writeDataPoint).toHaveBeenNthCalledWith(2, {
      indexes: ["queue:audit"],
      blobs: [
        "queue_batch_v1",
        "finish",
        "audit",
        "success",
        "audit-log.write.v1",
      ],
      doubles: [30, 20, 20, 20, 0, 0, 100, 1],
    });
    expect(writeDataPoint).toHaveBeenNthCalledWith(3, {
      indexes: ["comments:comments.descendants"],
      blobs: [
        "comments_stage_v1",
        "comments.descendants",
        "rls",
        "app",
        "success",
      ],
      doubles: [80, 5, 1, 10, 2],
    });
    expect(writeDataPoint).toHaveBeenNthCalledWith(4, {
      indexes: ["dashboard:nav_stats"],
      blobs: ["dashboard_stage_v1", "nav_stats", "rls", "app", "success"],
      doubles: [50, 3, 1, 4, 0, 4],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain("private");
  });

  it("normalizes stage dimensions and status classes at the analytics boundary", () => {
    const writeDataPoint = installAnalyticsBinding();
    const secret = "untrusted-stage-or-status";

    writeApiRequestAnalytics({
      authMode: "anonymous",
      event: "finish",
      ioObservedDurationMs: 1,
      method: "GET",
      route: "/api/catalog",
      status: 9999,
    });
    writeOAuthEventAnalytics({
      event: "oauth.callback.error",
      ioObservedDurationMs: 1,
      path: "/api/auth/oauth2/callback/provider",
      phase: "prepare-provider-request",
      status: 500,
    });
    writeCommentsStageAnalytics({
      dbContext: secret as never,
      dbLabel: secret as never,
      dbQueryCount: 1,
      dbTransactionCount: 1,
      durationMs: 1,
      outcome: secret as never,
      stage: secret as never,
    });
    writeDashboardStageAnalytics({
      dbContext: secret as never,
      dbLabel: secret as never,
      dbQueryCount: 1,
      dbTransactionCount: 1,
      durationMs: 1,
      outcome: secret as never,
      stage: secret as never,
    });

    expect(writeDataPoint).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        blobs: [
          "api_request_v3",
          "finish",
          "GET",
          "catalog",
          "unknown",
          "anonymous",
        ],
      }),
    );
    expect(writeDataPoint).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        blobs: expect.arrayContaining([
          "oauth_event_v3",
          "oauth.callback.error",
          "prepare-provider-request",
        ]),
      }),
    );
    expect(writeDataPoint).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        indexes: ["comments:unknown"],
        blobs: [
          "comments_stage_v1",
          "unknown",
          "unknown",
          "unknown",
          "unknown",
        ],
      }),
    );
    expect(writeDataPoint).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        indexes: ["dashboard:unknown"],
        blobs: [
          "dashboard_stage_v1",
          "unknown",
          "unknown",
          "unknown",
          "unknown",
        ],
      }),
    );
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(secret);
    expect(writeDataPoint.mock.calls[0]?.[0]?.blobs).not.toContain("9999");
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
      indexes: ["oauth:token"],
      blobs: [
        "oauth_event_v3",
        "better-auth.response",
        "POST",
        "token",
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
      indexes: ["oauth:token"],
      blobs: [
        "oauth_event_v3",
        "grant-validation-failed",
        "unknown",
        "token",
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
    const createMany = vi.fn(async () => ({}));

    await writeAuditLog(
      {
        action: "comment_create",
        metadata: { source: "unit-test" },
        targetId: "comment-secret",
        targetType: "comment",
        userId: "user-secret",
      },
      { auditLog: { createMany } },
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
  ])(
    "writes explicit $surface cache namespaces without raw query cache keys",
    async ({ key, namespace }) => {
      const writeDataPoint = installAnalyticsBinding();
      const load = vi.fn(async () => ({ ok: true }));

      await cachedPublicRuntimeData(namespace, key, 60_000, load);
      await cachedPublicRuntimeData(namespace, key, 60_000, load);

      expect(load).toHaveBeenCalledTimes(1);
      expect(writeDataPoint).toHaveBeenCalledWith({
        indexes: [`cache:${namespace}`],
        blobs: ["public_runtime_cache_v3", "miss", namespace, "none"],
        doubles: [expect.any(Number), 60_000, 0],
      });
      expect(writeDataPoint).toHaveBeenCalledWith({
        indexes: [`cache:${namespace}`],
        blobs: ["public_runtime_cache_v3", "hit", namespace, "none"],
        doubles: [expect.any(Number), 60_000, 1],
      });
      expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
        "sensitive-marker-679",
      );
    },
  );

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
            schema: "catalog-detail-core-v2",
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
          "public_runtime_cache_v3",
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
