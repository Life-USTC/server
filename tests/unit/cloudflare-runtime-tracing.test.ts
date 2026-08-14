import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCloudflareNamedCache,
  getCloudflareRuntimeTaskScheduler,
  registerCloudflareRuntimeCleanup,
  runCloudflareTraceSpan,
  runWithCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";

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
});
