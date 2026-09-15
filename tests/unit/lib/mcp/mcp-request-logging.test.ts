import { beforeEach, describe, expect, it, vi } from "vitest";

const { logAppEventMock, logOAuthDebugMock } = vi.hoisted(() => ({
  logAppEventMock: vi.fn(),
  logOAuthDebugMock: vi.fn(),
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

vi.mock("@/lib/log/oauth-debug", () => ({
  logOAuthDebug: logOAuthDebugMock,
}));

describe("MCP request logging", () => {
  beforeEach(() => {
    logAppEventMock.mockReset();
    logOAuthDebugMock.mockReset();
  });

  it("logs auth rejection diagnostics as top-level fields", async () => {
    const { logMcpTransportResponse } = await import(
      "@/lib/api/routes/mcp-request-logging"
    );
    const request = new Request("https://life.example/api/mcp", {
      headers: { "user-agent": "openai-mcp/1.0.0 (ChatGPT)" },
      method: "POST",
    });

    logMcpTransportResponse({
      authFailureDiagnostics: {
        acceptedAudienceCount: 3,
        acceptedIssuerCount: 1,
        authFailureKind: "jwt_verify_failed",
        authHeaderKind: "bearer",
        authTokenFormat: "jwt",
        jwtErrorName: "JWTClaimValidationFailed",
      },
      context: {
        correlationId: "req-1",
        request,
        requestUrl: new URL(request.url),
      },
      ioObservedDurationMs: 12,
      phase: "auth-rejected",
      rpcSummary: null,
      status: 401,
      wwwAuthenticatePrefix: 'Bearer error="invalid_token"',
    });

    expect(logAppEventMock).toHaveBeenCalledWith(
      "info",
      "mcp.transport.response",
      expect.objectContaining({
        acceptedAudienceCount: 3,
        acceptedIssuerCount: 1,
        authFailureKind: "jwt_verify_failed",
        authHeaderKind: "bearer",
        authTokenFormat: "jwt",
        jwtErrorName: "JWTClaimValidationFailed",
        phase: "auth-rejected",
        status: 401,
      }),
    );
    expect(JSON.stringify(logAppEventMock.mock.calls)).not.toContain(
      "unexpected aud claim value",
    );
  });

  it("logs transport failures at error level without exception messages", async () => {
    const { logMcpTransportResponse } = await import(
      "@/lib/api/routes/mcp-request-logging"
    );
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
    });

    logMcpTransportResponse({
      context: {
        correlationId: "req-2",
        request,
        requestUrl: new URL(request.url),
      },
      ioObservedDurationMs: 7,
      errorName: "TypeError",
      phase: "error",
      rpcSummary: null,
      status: 500,
    });

    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "mcp.transport.response",
      expect.objectContaining({
        errorName: "TypeError",
        phase: "error",
        status: 500,
      }),
    );
    expect(JSON.stringify(logAppEventMock.mock.calls)).not.toContain(
      "database unavailable",
    );
  });

  it("retains HTTP 200 JSON-RPC application errors regardless of sampling", async () => {
    const { logMcpTransportResponse } = await import(
      "@/lib/api/routes/mcp-request-logging"
    );
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
    });

    logMcpTransportResponse({
      context: {
        correlationId: "sampled-out-request",
        request,
        requestUrl: new URL(request.url),
      },
      hasError: true,
      ioObservedDurationMs: 1,
      phase: "handled",
      rpcSummary: null,
      status: 200,
    });

    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "mcp.transport.response",
      expect.objectContaining({
        hasError: true,
        inspectionTruncated: false,
        phase: "handled",
        status: 200,
      }),
    );
  });

  it("retains truncated inspections without classifying them as successful", async () => {
    const { logMcpTransportResponse } = await import(
      "@/lib/api/routes/mcp-request-logging"
    );
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
    });

    logMcpTransportResponse({
      context: {
        correlationId: "sampled-out-request",
        request,
        requestUrl: new URL(request.url),
      },
      hasError: false,
      inspectionTruncated: true,
      ioObservedDurationMs: 1,
      phase: "handled",
      rpcSummary: null,
      status: 200,
    });

    expect(logAppEventMock).toHaveBeenCalledWith(
      "info",
      "mcp.transport.response",
      expect.objectContaining({
        hasError: false,
        inspectionTruncated: true,
        phase: "handled",
        status: 200,
      }),
    );
  });
});
