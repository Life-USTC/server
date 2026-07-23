import { afterEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { recordAndLogMcpResponse } from "@/lib/api/routes/mcp-response-bookkeeping";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { withBetterAuthOAuthDebug } from "@/lib/log/oauth-debug";
import { writeOAuthEventAnalytics } from "@/lib/metrics/analytics-engine";
import { cachedPublicRuntimeData } from "@/lib/public-runtime-cache";
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

describe("Cloudflare Analytics Engine runtime events", () => {
  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
    clearPublicRuntimeCache();
    vi.useRealTimers();
    vi.restoreAllMocks();
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
        toolCalls: [{ argumentKeys: ["title"], toolName: "create_my_todo" }],
        toolNames: ["create_my_todo"],
      },
      start: Date.now() - 125,
      status: 200,
      toolCount: 14,
    });

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["mcp:handled"],
      blobs: [
        "mcp_transport",
        "handled",
        "POST",
        "/api/mcp",
        "200",
        "2xx",
        "jsonrpc-single",
        "tools/call",
        "create_my_todo",
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
        "oauth_event",
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
      durationMs: 0,
      errorName: "TypeError",
      event: "grant-validation-failed",
      path: "/api/auth/oauth2/token",
      phase: "resolve-active-refresh-grant",
      status: 503,
    });

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["oauth:/api/auth/oauth2/token"],
      blobs: [
        "oauth_event",
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
      blobs: ["audit_write", "success", "comment_create", "comment"],
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
      blobs: ["storage_operation", "success", "head"],
      doubles: [expect.any(Number), 42],
    });
    expect(writeDataPoint).toHaveBeenNthCalledWith(2, {
      indexes: ["storage:get"],
      blobs: ["storage_operation", "success", "get"],
      doubles: [expect.any(Number), 42],
    });
    expect(writeDataPoint).toHaveBeenNthCalledWith(3, {
      indexes: ["storage:put"],
      blobs: ["storage_operation", "success", "put"],
      doubles: [expect.any(Number), 0],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "uploads/user-secret",
    );
  });

  it("writes cache datapoints without raw query cache keys", async () => {
    const writeDataPoint = installAnalyticsBinding();
    const load = vi.fn(async () => ({ ok: true }));
    const key = "api:courses:en-us:search=private-query&page=1";

    await cachedPublicRuntimeData(key, 60_000, load);
    await cachedPublicRuntimeData(key, 60_000, load);

    expect(load).toHaveBeenCalledTimes(1);
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["cache:api:courses:en-us"],
      blobs: ["public_runtime_cache", "miss", "api:courses:en-us"],
      doubles: [expect.any(Number), 60_000, 0],
    });
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ["cache:api:courses:en-us"],
      blobs: ["public_runtime_cache", "hit", "api:courses:en-us"],
      doubles: [expect.any(Number), 60_000, 1],
    });
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain(
      "private-query",
    );
  });
});
