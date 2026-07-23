import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runWithCloudflareRuntimeEnv,
  setCloudflareRequestContext,
} from "@/lib/adapters/cloudflare-runtime";
import { logAppEvent, logRouteFailure, shouldLog } from "@/lib/log/app-logger";

describe("应用日志记录器", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("遵循配置的日志级别", () => {
    vi.stubEnv("LOG_LEVEL", "warn");

    expect(shouldLog("debug")).toBe(false);
    expect(shouldLog("info")).toBe(false);
    expect(shouldLog("warn")).toBe(true);
    expect(shouldLog("error")).toBe(true);
  });

  it("规范化仅用于日志的环境变量值", () => {
    vi.stubEnv("LOG_LEVEL", " WARN ");

    expect(shouldLog("info")).toBe(false);
    expect(shouldLog("warn")).toBe(true);
  });

  it("对无效日志级别回退到 info", () => {
    vi.stubEnv("LOG_LEVEL", "verbose");

    expect(shouldLog("debug")).toBe(false);
    expect(shouldLog("info")).toBe(true);
  });

  it("在生产环境中抑制非服务端路由失败", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logRouteFailure("Bad request", 400, new Error("invalid"));

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("将服务端路由失败记录为结构化生产 JSON", () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logRouteFailure("Server failure", 500, new Error("boom"), {
      route: "/api/test",
    });

    expect(errorSpy).toHaveBeenCalledOnce();
    const [payload] = errorSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(payload))).toMatchObject({
      prefix: "[app]",
      environment: "production",
      message: "Server failure",
      status: 500,
      route: "/api/test",
      error: {
        name: "Error",
      },
    });
    expect(String(payload)).not.toContain("boom");
    expect(String(payload)).not.toContain("stack");
  });

  it("以结构化生产 JSON 发送应用事件", () => {
    vi.stubEnv("NODE_ENV", "production");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    logAppEvent("info", "test.event", { requestId: "req_123" });

    expect(infoSpy).toHaveBeenCalledOnce();
    const [payload] = infoSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(payload))).toMatchObject({
      prefix: "[app]",
      environment: "production",
      runtime: "server",
      message: "test.event",
      requestId: "req_123",
    });
  });

  it("自动关联请求范围内的底层错误日志", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runWithCloudflareRuntimeEnv({}, () => {
      setCloudflareRequestContext({
        method: "POST",
        requestId: "request-context-id",
        route: "/api/todos/:id",
      });
      logRouteFailure("Server failure", 500, new Error("boom"));
    });

    const [payload] = errorSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(payload))).toMatchObject({
      method: "POST",
      requestId: "request-context-id",
      route: "/api/todos/:id",
    });
  });

  it("请求上下文字段不被局部日志上下文覆盖或清空", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await runWithCloudflareRuntimeEnv({}, () => {
      setCloudflareRequestContext({
        method: "POST",
        requestId: "request-context-id",
        route: "/api/todos/:id",
      });
      logAppEvent("info", "test.event", {
        method: "DELETE",
        requestId: undefined,
        route: "/api/other/:id",
      });
    });

    const [payload] = infoSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(payload))).toMatchObject({
      method: "POST",
      requestId: "request-context-id",
      route: "/api/todos/:id",
    });
  });
});
