import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCloudflareNamedCache,
  getCloudflareRequestContext,
  getCloudflareRuntimeContext,
  getCloudflareRuntimeTaskScheduler,
  registerCloudflareRuntimeCleanup,
  runCloudflareTraceSpan,
  runWithCloudflareRuntimeEnv,
  setCloudflareRequestContext,
} from "@/lib/adapters/cloudflare-runtime";
import { createDeferred } from "../../../shared/deferred";

describe("Cloudflare runtime tracing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a custom span and attaches bounded semantic attributes", async () => {
    const setAttribute = vi.fn();
    const enterSpan = vi.fn(
      <T>(
        _name: string,
        callback: (span: {
          readonly isTraced: boolean;
          setAttribute: typeof setAttribute;
        }) => T,
      ) => callback({ isTraced: true, setAttribute }),
    );

    const result = await runWithCloudflareRuntimeEnv(
      {},
      () =>
        runCloudflareTraceSpan(
          "mcp.authenticate",
          {
            "http.request.method": "POST",
            "mcp.rpc_count": 1,
            omitted: undefined,
          },
          () => "ok",
        ),
      { tracing: { enterSpan } },
    );

    expect(result).toBe("ok");
    expect(enterSpan).toHaveBeenCalledWith(
      "mcp.authenticate",
      expect.any(Function),
    );
    expect(setAttribute).toHaveBeenCalledWith("http.request.method", "POST");
    expect(setAttribute).toHaveBeenCalledWith("mcp.rpc_count", 1);
    expect(setAttribute).not.toHaveBeenCalledWith("omitted", undefined);
  });

  it("runs callbacks unchanged outside the Workers runtime", () => {
    expect(runCloudflareTraceSpan("app.test", {}, () => 42)).toBe(42);
  });

  it("lets traced callbacks attach result attributes", async () => {
    const setAttribute = vi.fn();
    const enterSpan = vi.fn(
      <T>(
        _name: string,
        callback: (span: {
          readonly isTraced: boolean;
          setAttribute: typeof setAttribute;
        }) => T,
      ) => callback({ isTraced: true, setAttribute }),
    );

    const result = await runWithCloudflareRuntimeEnv(
      {},
      () =>
        runCloudflareTraceSpan(
          "response.serialize",
          { "response.format": "json" },
          (span) => {
            span?.setAttribute("http.response.body.size", 17);
            return "serialized";
          },
        ),
      { tracing: { enterSpan } },
    );

    expect(result).toBe("serialized");
    expect(setAttribute).toHaveBeenCalledWith("response.format", "json");
    expect(setAttribute).toHaveBeenCalledWith("http.response.body.size", 17);
  });

  it("passes no span when tracing is unavailable", () => {
    let callbackSpan: unknown = "not-called";
    expect(
      runCloudflareTraceSpan("app.test", {}, (span) => {
        callbackSpan = span;
        return 42;
      }),
    ).toBe(42);
    expect(callbackSpan).toBeUndefined();
  });

  it("propagates errors from callbacks that attach attributes", async () => {
    const enterSpan = vi.fn(
      <T>(
        _name: string,
        callback: (span: {
          readonly isTraced: boolean;
          setAttribute(): void;
        }) => T,
      ) => callback({ isTraced: true, setAttribute() {} }),
    );
    const failure = new Error("serialize failed");

    await expect(
      runWithCloudflareRuntimeEnv(
        {},
        () =>
          runCloudflareTraceSpan("response.serialize", {}, () => {
            throw failure;
          }),
        { tracing: { enterSpan } },
      ),
    ).rejects.toBe(failure);
  });

  it("keeps named caches request-scoped and preserves the waitUntil receiver", async () => {
    const cache = { match: vi.fn(), put: vi.fn() };
    const open = vi.fn(async () => cache);
    vi.stubGlobal("caches", { open });
    const scheduled: Promise<unknown>[] = [];
    const executionContext = {
      waitUntil(this: unknown, promise: Promise<unknown>) {
        expect(this).toBe(executionContext);
        scheduled.push(promise);
      },
    };

    const selectedCache = await runWithCloudflareRuntimeEnv(
      {},
      async () => {
        const scheduleTask = getCloudflareRuntimeTaskScheduler();
        expect(scheduleTask).toBeTypeOf("function");
        scheduleTask?.(Promise.resolve("done"));
        return await getCloudflareNamedCache("detail-core-v1");
      },
      executionContext,
    );

    expect(selectedCache).toBe(cache);
    expect(open).toHaveBeenCalledWith("detail-core-v1");
    expect(scheduled).toHaveLength(1);
    await expect(scheduled[0]).resolves.toBe("done");
    expect(getCloudflareNamedCache("outside-request")).toBeUndefined();
    expect(getCloudflareRuntimeTaskScheduler()).toBeUndefined();
  });

  it("inherits waitUntil and tracing through nested runtime scopes", async () => {
    const waitUntil = vi.fn();
    const span = { isTraced: true, setAttribute: vi.fn() };
    const enterSpan = vi.fn(
      (_name: string, callback: (value: typeof span) => unknown) =>
        callback(span),
    );

    await runWithCloudflareRuntimeEnv(
      { OUTER: "present" },
      async () => {
        setCloudflareRequestContext({
          method: "PATCH",
          requestId: "11111111-1111-4111-8111-111111111111",
          route: "/api/workspace/subscriptions",
        });
        await runWithCloudflareRuntimeEnv(undefined, async () => {
          expect(getCloudflareRuntimeTaskScheduler()).toBeTypeOf("function");
          expect(getCloudflareRequestContext()).toEqual({
            method: "PATCH",
            requestId: "11111111-1111-4111-8111-111111111111",
            route: "/api/workspace/subscriptions",
          });
          getCloudflareRuntimeTaskScheduler()?.(Promise.resolve());
          runCloudflareTraceSpan("nested", {}, () => undefined);
        });
      },
      { tracing: { enterSpan }, waitUntil },
    );

    expect(waitUntil).toHaveBeenCalledOnce();
    expect(enterSpan).toHaveBeenCalledWith("nested", expect.any(Function));
  });

  it("awaits request-scoped cleanup before resolving", async () => {
    const events: string[] = [];

    await runWithCloudflareRuntimeEnv({}, async () => {
      registerCloudflareRuntimeCleanup(async () => {
        await Promise.resolve();
        events.push("cleanup");
      });
      events.push("callback");
    });

    expect(events).toEqual(["callback", "cleanup"]);
  });

  it("defers cleanup until a response body finishes streaming", async () => {
    const cleanup = vi.fn();

    const response = await runWithCloudflareRuntimeEnv({}, () => {
      registerCloudflareRuntimeCleanup(cleanup);
      return new Response("streamed");
    });

    expect(cleanup).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toBe("streamed");
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("cleans up when a response body is canceled", async () => {
    const cleanup = vi.fn();
    const cancel = vi.fn();

    const response = await runWithCloudflareRuntimeEnv({}, () => {
      registerCloudflareRuntimeCleanup(cleanup);
      return new Response(new ReadableStream({ cancel }));
    });

    await response.body?.cancel("client disconnected");
    expect(cancel).toHaveBeenCalledWith("client disconnected");
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("preserves callback errors when cleanup also fails", async () => {
    const callbackFailure = new Error("callback failed");

    await expect(
      runWithCloudflareRuntimeEnv({}, () => {
        registerCloudflareRuntimeCleanup(() => {
          throw new Error("cleanup failed");
        });
        throw callbackFailure;
      }),
    ).rejects.toBe(callbackFailure);
  });

  it("releases a client first acquired by background work after response EOF", async () => {
    const scheduled: Promise<unknown>[] = [];
    const cleanup = vi.fn();
    const gate = createDeferred();
    let cache!: Map<symbol, unknown>;
    const response = await runWithCloudflareRuntimeEnv(
      {},
      () => {
        const context = getCloudflareRuntimeContext();
        if (!context) throw new Error("Missing runtime context");
        cache = context.cache;
        getCloudflareRuntimeTaskScheduler()?.(
          gate.promise.then(() => {
            cache.set(Symbol("late-client"), {});
            registerCloudflareRuntimeCleanup(cleanup);
          }),
        );
        return new Response("complete before background work");
      },
      { waitUntil: (task: Promise<unknown>) => scheduled.push(task) },
    );

    await expect(response.text()).resolves.toBe(
      "complete before background work",
    );
    expect(cleanup).not.toHaveBeenCalled();
    gate.resolve();
    await Promise.all(scheduled);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(cache.size).toBe(0);
  });

  it.each(["cancel", "bodyless", "throw"])(
    "keeps resources alive for deferred work when the request ends by %s",
    async (end) => {
      const gate = createDeferred();
      const scheduled: Promise<unknown>[] = [];
      const cleanup = vi.fn();
      const failure = new Error("request failed");
      const result = runWithCloudflareRuntimeEnv(
        {},
        () => {
          registerCloudflareRuntimeCleanup(cleanup);
          getCloudflareRuntimeTaskScheduler()?.(
            gate.promise.then(() => {
              expect(cleanup).not.toHaveBeenCalled();
            }),
          );
          if (end === "throw") throw failure;
          return end === "bodyless"
            ? new Response(null, { status: 204 })
            : new Response("unused");
        },
        { waitUntil: (task: Promise<unknown>) => scheduled.push(task) },
      );
      if (end === "throw") await expect(result).rejects.toBe(failure);
      else await (await result).body?.cancel();
      expect(cleanup).not.toHaveBeenCalled();
      gate.resolve();
      await Promise.all(scheduled);
      expect(cleanup).toHaveBeenCalledOnce();
    },
  );

  it("drains background followups before cleanup even when a task rejects", async () => {
    const first = createDeferred();
    const followup = createDeferred();
    const scheduled: Promise<unknown>[] = [];
    const cleanup = vi.fn();
    const failure = new Error("background write failed");
    const response = await runWithCloudflareRuntimeEnv(
      {},
      () => {
        registerCloudflareRuntimeCleanup(cleanup);
        getCloudflareRuntimeTaskScheduler()?.(
          first.promise.then(() => {
            getCloudflareRuntimeTaskScheduler()?.(followup.promise);
            throw failure;
          }),
        );
        return new Response("sent");
      },
      { waitUntil: (task: Promise<unknown>) => scheduled.push(task) },
    );
    await response.text();
    first.resolve();
    await expect(scheduled[0]).rejects.toBe(failure);
    expect(cleanup).not.toHaveBeenCalled();
    followup.resolve();
    const results = await Promise.allSettled(scheduled);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
