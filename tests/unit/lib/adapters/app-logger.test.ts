import { createConnection, createServer } from "node:net";
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
        route: "/api/workspace/todos/:id",
      });
      logRouteFailure("Server failure", 500, new Error("boom"));
    });

    const [payload] = errorSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(payload))).toMatchObject({
      method: "POST",
      requestId: "request-context-id",
      route: "/api/workspace/todos/:id",
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

  it("keeps only validated transaction timeout metadata in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("private SQL and user input"), {
      name: "PrismaClientKnownRequestError",
      code: "P2028",
      meta: {
        operation: "query",
        timeout: 5000,
        timeTaken: 5368,
        secret: "private",
      },
    });
    logRouteFailure("Read failed", 500, error);
    const payload = JSON.parse(String(errorSpy.mock.calls[0]?.[0]));
    expect(payload.error).toEqual({
      name: "PrismaClientKnownRequestError",
      prismaCode: "P2028",
      transaction: {
        reason: "execution_timeout",
        operation: "query",
        timeoutMs: 5000,
        elapsedMs: 5368,
      },
    });
    expect(JSON.stringify(payload)).not.toContain("private");
  });

  // Prisma 7.10.1 TransactionManagerError messages, independent of the logger's
  // classifier. The query/commit/rollback operation vocabulary is closed.
  it.each([
    [
      "Unable to start a transaction in the given time.",
      { reason: "startup_timeout" },
    ],
    [
      "Transaction not found. Transaction ID is invalid, refers to an old closed transaction Prisma doesn't have information about anymore, or was obtained before disconnecting.",
      { reason: "not_found" },
    ],
    [
      "Transaction already closed: A query cannot be executed on a committed transaction.",
      { reason: "already_committed", operation: "query" },
    ],
    [
      "Transaction already closed: A commit cannot be executed on a committed transaction.",
      { reason: "already_committed", operation: "commit" },
    ],
    [
      "Transaction already closed: A rollback cannot be executed on a committed transaction.",
      { reason: "already_committed", operation: "rollback" },
    ],
    [
      "Transaction already closed: A query cannot be executed on a transaction that was rolled back.",
      { reason: "already_rolled_back", operation: "query" },
    ],
    [
      "Transaction already closed: A commit cannot be executed on a transaction that was rolled back.",
      { reason: "already_rolled_back", operation: "commit" },
    ],
    [
      "Transaction already closed: A rollback cannot be executed on a transaction that was rolled back.",
      { reason: "already_rolled_back", operation: "rollback" },
    ],
  ])(
    "keeps a fixed reason for the exact P2028 template %s",
    (message, transaction) => {
      vi.stubEnv("NODE_ENV", "production");
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      for (const location of ["message", "meta.error"] as const) {
        errorSpy.mockClear();
        const error = Object.assign(
          new Error(
            location === "message"
              ? `Transaction API error: ${message}`
              : "private SQL and actor input",
          ),
          {
            name: "PrismaClientKnownRequestError",
            code: "P2028",
            ...(location === "meta.error"
              ? { meta: { error: message, secret: "private metadata" } }
              : {}),
          },
        );
        logRouteFailure("Read failed", 500, error);
        expect(errorSpy).toHaveBeenCalledOnce();
        const payload = String(errorSpy.mock.calls[0]?.[0]);
        expect(JSON.parse(payload).error).toEqual({
          name: "PrismaClientKnownRequestError",
          prismaCode: "P2028",
          transaction,
        });
        expect(payload).not.toContain(message);
        expect(payload).not.toContain("private");
        expect(payload).not.toContain("stack");
      }
    },
  );

  it.each([
    "private SQL before Unable to start a transaction in the given time.",
    "Unable to start a transaction in the given time. private actor after",
    " Unable to start a transaction in the given time.",
    "Unable to start a transaction in the given time.\n",
    "Transaction API error: Transaction API error: Unable to start a transaction in the given time.",
    "Transaction already closed: A private query cannot be executed on a committed transaction.",
    "Transaction already closed: A query cannot be executed on a committed transaction.\n",
    "A query cannot be executed on an expired transaction.",
    "private startup timeout after 2000 ms",
    "x".repeat(513),
  ])("does not infer a transaction reason from other text: %s", (message) => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logRouteFailure(
      "Read failed",
      500,
      Object.assign(new Error(message), {
        code: "P2028",
        meta: { error: message },
      }),
    );
    expect(JSON.parse(String(errorSpy.mock.calls[0]?.[0])).error).toEqual({
      name: "Error",
      prismaCode: "P2028",
    });
    expect(String(errorSpy.mock.calls[0]?.[0])).not.toContain(message);
  });

  it.each([undefined, "P2010"])(
    "does not classify a known template with code %s",
    (code) => {
      vi.stubEnv("NODE_ENV", "production");
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      logRouteFailure(
        "Read failed",
        500,
        Object.assign(
          new Error(
            "Transaction API error: Unable to start a transaction in the given time.",
          ),
          { code },
        ),
      );
      const payload = JSON.parse(String(errorSpy.mock.calls[0]?.[0]));
      expect(payload.error).not.toHaveProperty("transaction");
      expect(String(errorSpy.mock.calls[0]?.[0])).not.toContain(
        "Unable to start",
      );
    },
  );

  it.each(["meta", "cause"])(
    "prefers structured execution timeout over an outer reason through %s",
    (key) => {
      vi.stubEnv("NODE_ENV", "production");
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const inner = Object.assign(new Error("private inner SQL"), {
        code: "P2028",
        meta: { operation: "commit", timeout: 5000, timeTaken: 5368 },
      });
      const outer = Object.assign(
        new Error(
          "Transaction API error: Unable to start a transaction in the given time.",
        ),
        { code: "P2028", [key]: inner },
      );
      Object.defineProperty(inner, "cause", { value: outer });
      logRouteFailure("Read failed", 500, outer);
      const payload = String(errorSpy.mock.calls[0]?.[0]);
      expect(JSON.parse(payload).error.transaction).toEqual({
        reason: "execution_timeout",
        operation: "commit",
        timeoutMs: 5000,
        elapsedMs: 5368,
      });
      expect(payload).not.toContain("private");
      expect(payload).not.toContain("Unable to start");
    },
  );

  it("does not evaluate message or meta.error getters for reason classification", () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const message = vi.fn(
      () =>
        "Transaction API error: Unable to start a transaction in the given time.",
    );
    const metaError = vi.fn(() => {
      throw new Error("private getter");
    });
    const error = Object.assign(new Error("private"), {
      code: "P2028",
      meta: {},
    });
    Object.defineProperty(error, "message", { get: message });
    Object.defineProperty(error.meta, "error", { get: metaError });
    expect(() => logRouteFailure("Read failed", 500, error)).not.toThrow();
    expect(message).not.toHaveBeenCalled();
    expect(metaError).not.toHaveBeenCalled();
    expect(JSON.parse(String(errorSpy.mock.calls[0]?.[0])).error).toEqual({
      name: "Error",
      prismaCode: "P2028",
    });
    expect(String(errorSpy.mock.calls[0]?.[0])).not.toContain("private");
  });

  it("ignores inherited messages and preserves bounded traversal with hostile causes", () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const inherited = Object.assign(
      Object.create({
        name: "PrismaClientKnownRequestError",
        message:
          "Transaction API error: Unable to start a transaction in the given time.",
      }),
      { code: "P2028" },
    );
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    inherited.cause = proxy;
    expect(() => logRouteFailure("Read failed", 500, inherited)).not.toThrow();
    expect(
      JSON.parse(String(errorSpy.mock.calls[0]?.[0])).error,
    ).not.toHaveProperty("transaction");
    let deep: object = Object.assign(
      new Error("Unable to start a transaction in the given time."),
      { code: "P2028" },
    );
    for (let depth = 0; depth < 9; depth++) deep = { cause: deep };
    errorSpy.mockClear();
    expect(() => logRouteFailure("Read failed", 500, deep)).not.toThrow();
    expect(
      JSON.parse(String(errorSpy.mock.calls[0]?.[0])).error,
    ).not.toHaveProperty("transaction");
  });

  it.each([
    { operation: "private query", timeout: 5000, timeTaken: 5368 },
    { operation: "query", timeout: "5000", timeTaken: 5368 },
    { operation: "query", timeout: -1, timeTaken: 5368 },
    { operation: "query", timeout: 5000, timeTaken: Number.POSITIVE_INFINITY },
    { operation: "query", timeout: 5000, timeTaken: 4999 },
    { error: "private transaction message" },
  ])(
    "does not infer timeout from unsafe or incomplete metadata: %j",
    (meta) => {
      vi.stubEnv("NODE_ENV", "production");
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      logRouteFailure(
        "Read failed",
        500,
        Object.assign(new Error("private"), { code: "P2028", meta }),
      );
      expect(JSON.parse(String(errorSpy.mock.calls[0]?.[0])).error).toEqual({
        name: "Error",
        prismaCode: "P2028",
      });
    },
  );

  it("生产环境保留嵌套 cause / meta 上的数据库错误码", () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const cause = Object.assign(new Error("permission denied"), {
      code: "42501",
      name: "error",
    });
    const prismaError = Object.assign(new Error("raw query failed"), {
      cause,
      code: "P2010",
      name: "PrismaClientKnownRequestError",
    });

    logRouteFailure("Failed to fetch comments", 500, prismaError, {
      route: "/api/community/comments",
    });

    const [payload] = errorSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(payload))).toMatchObject({
      error: {
        code: "42501",
        name: "PrismaClientKnownRequestError",
        prismaCode: "P2010",
      },
    });
    expect(String(payload)).not.toContain("permission denied");
  });

  it("生产环境从仅含 cause SQLSTATE 的包装错误提取 code", () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const cause = Object.assign(new Error("permission denied for function"), {
      code: "42501",
      name: "error",
    });
    const wrapper = Object.assign(new Error("wrapped"), {
      cause,
      name: "DriverAdapterError",
    });

    logRouteFailure("Failed to fetch comments", 500, wrapper);

    const [payload] = errorSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(payload))).toMatchObject({
      error: {
        code: "42501",
        name: "DriverAdapterError",
      },
    });
  });

  it("生产环境保留 P2039 wrapper 并优先记录嵌套 driver code", () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const driverError = Object.assign(new Error("private database detail"), {
      originalCode: "42P01",
      name: "error",
    });
    const prismaError = Object.assign(new Error("private wrapper detail"), {
      cause: driverError,
      code: "P2039",
      name: "PrismaClientKnownRequestError",
    });

    logRouteFailure("Failed to load section", 500, prismaError);

    const [payload] = errorSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(payload))).toMatchObject({
      error: {
        code: "42P01",
        name: "PrismaClientKnownRequestError",
        prismaCode: "P2039",
      },
    });
    expect(String(payload)).not.toContain("private database detail");
    expect(String(payload)).not.toContain("private wrapper detail");
  });

  it("records a native refused connection through a generic Error wrapper", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const listener = createServer();
    await new Promise<void>((resolve) =>
      listener.listen(0, "127.0.0.1", resolve),
    );
    const address = listener.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test listener");
    await new Promise<void>((resolve, reject) =>
      listener.close((error) => (error ? reject(error) : resolve())),
    );
    const cause = await new Promise<Error>((resolve, reject) => {
      const socket = createConnection({
        host: "127.0.0.1",
        port: address.port,
      });
      let connectionError: Error | undefined;
      socket.once("error", (error) => {
        connectionError = error;
      });
      socket.once("close", () => {
        if (connectionError) resolve(connectionError);
      });
      socket.once("connect", () => {
        socket.destroy();
        reject(new Error("Closed test port unexpectedly connected"));
      });
    });
    logRouteFailure("Read failed", 500, new Error("private query", { cause }));
    const serialized = String(errorSpy.mock.calls[0]?.[0]);
    expect(JSON.parse(serialized).error).toEqual({
      name: "Error",
      transportCode: "ECONNREFUSED",
    });
    expect(serialized).not.toContain("127.0.0.1");
    expect(serialized).not.toContain("private query");
  });

  it("retains bounded transport causes without private error content", () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("private outer", {
      cause: new AggregateError(
        [
          Object.assign(new Error("private socket"), {
            code: "ECONNRESET",
            address: "private host",
            port: 5432,
          }),
        ],
        "private aggregate",
      ),
    });
    logRouteFailure("Read failed", 500, failure);
    const payload = JSON.parse(String(errorSpy.mock.calls[0]?.[0]));
    expect(payload.error).toEqual({
      name: "Error",
      transportCode: "ECONNRESET",
    });
    expect(JSON.stringify(payload)).not.toContain("private");
  });

  it("retains an allowlisted nested timeout name without inferring a cause from messages", () => {
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logRouteFailure(
      "Read failed",
      500,
      new Error("private outer", {
        cause: new DOMException("private timeout", "TimeoutError"),
      }),
    );
    expect(JSON.parse(String(errorSpy.mock.calls[0]?.[0])).error).toEqual({
      name: "Error",
      causeName: "TimeoutError",
    });
    errorSpy.mockClear();
    logRouteFailure(
      "Read failed",
      500,
      Object.assign(new Error("ETIMEDOUT"), {
        cause: {
          name: "PrivateErrorName",
          code: "PRIVATE_CODE",
          message: "secret",
        },
      }),
    );
    expect(JSON.parse(String(errorSpy.mock.calls[0]?.[0])).error).toEqual({
      name: "Error",
    });
  });

  it("生产环境日志序列化不因 BigInt 或循环引用失败", () => {
    vi.stubEnv("NODE_ENV", "production");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const context: Record<string, unknown> = { count: 1n };
    context.self = context;

    expect(() =>
      logAppEvent("info", "safe.serialization", context),
    ).not.toThrow();

    const [payload] = infoSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(payload))).toMatchObject({
      self: {
        count: "[BigInt]",
        self: "[Circular]",
      },
    });
  });

  it("生产环境不执行异常 toJSON 且不会泄露其内容", () => {
    vi.stubEnv("NODE_ENV", "production");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const secret = "private-to-json-value";
    const payload = {
      toJSON() {
        throw new Error(secret);
      },
    };

    expect(() =>
      logAppEvent("info", "safe.serialization", { payload }),
    ).not.toThrow();

    const [serialized] = infoSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(serialized))).toMatchObject({
      message: "safe.serialization",
      payload: { toJSON: "[Function]" },
    });
    expect(String(serialized)).not.toContain(secret);
  });
});
