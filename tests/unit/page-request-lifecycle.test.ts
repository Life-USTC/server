import { type Handle, redirect } from "@sveltejs/kit";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app-env", () => ({
  getOptionalTrimmedEnv: (name: string) =>
    name === "NODE_ENV" ? "development" : undefined,
  loadEnv: vi.fn(),
}));

import { handle, handleError } from "@/hooks.server";

function handleInput(
  resolve: Parameters<Handle>[0]["resolve"],
  input: {
    headers?: HeadersInit;
    method?: string;
    pathname?: string;
    routeId?: Parameters<Handle>[0]["event"]["route"]["id"];
    spanNames?: string[];
  } = {},
) {
  const url = new URL(
    `https://life.example${input.pathname ?? "/catalog-page-data/courses"}`,
  );
  const span = {
    addEvent: () => span,
    addLink: () => span,
    addLinks: () => span,
    end: () => {},
    isRecording: () => false,
    recordException: () => {},
    setAttribute: () => span,
    setAttributes: () => span,
    setStatus: () => span,
    spanContext: () => ({
      spanId: "0000000000000000",
      traceFlags: 0,
      traceId: "00000000000000000000000000000000",
    }),
    updateName: () => span,
  };
  const event: Parameters<Handle>[0]["event"] = {
    cookies: {
      delete: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(() => []),
      serialize: vi.fn(() => ""),
      set: vi.fn(),
    },
    fetch,
    getClientAddress: () => "127.0.0.1",
    isDataRequest: false,
    isRemoteRequest: false,
    isSubRequest: false,
    locals: {
      authUser: null,
      locale: "zh-cn",
      requestId: "",
    },
    params: {},
    platform: input.spanNames
      ? {
          context: {
            tracing: {
              enterSpan: (
                name: string,
                callback: (span: { setAttribute: () => void }) => unknown,
              ) => {
                input.spanNames?.push(name);
                return callback({ setAttribute: () => {} });
              },
            },
          },
        }
      : undefined,
    request: new Request(url, {
      headers: input.headers,
      method: input.method ?? "GET",
    }),
    route: { id: input.routeId ?? "/catalog-page-data/[kind]" },
    setHeaders: vi.fn(),
    tracing: {
      current: span,
      enabled: false,
      root: span,
    },
    url,
  };
  return {
    event,
    resolve,
  };
}

function pageEvents(
  calls: ReadonlyArray<ReadonlyArray<unknown>>,
  event: "page.request.error" | "page.request.finish",
) {
  return calls.filter((call) => {
    const [prefix, value] = call;
    return (
      prefix === "[app]" &&
      typeof value === "object" &&
      value !== null &&
      "event" in value &&
      value.event === event
    );
  });
}

function apiEvents(calls: ReadonlyArray<ReadonlyArray<unknown>>) {
  return calls.filter(([prefix]) => prefix === "[api]");
}

describe("SvelteKit page request lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records JSON responses and propagates the server request id", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const response = await handle(
      handleInput(async () => Response.json({ ok: true })),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/i);
    expect(pageEvents(info.mock.calls, "page.request.finish")).toHaveLength(1);
    expect(pageEvents(info.mock.calls, "page.request.finish")[0]?.[1]).toEqual(
      expect.objectContaining({
        ioObservedDurationMs: expect.any(Number),
        route: "/catalog-page-data/[kind]",
        status: 200,
      }),
    );
  });

  it("records thrown redirects exactly once before preserving them", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await expect(
      handle(
        handleInput(async () => {
          throw redirect(303, "/signin");
        }),
      ),
    ).rejects.toMatchObject({ location: "/signin", status: 303 });

    expect(pageEvents(info.mock.calls, "page.request.finish")).toHaveLength(1);
    expect(pageEvents(info.mock.calls, "page.request.finish")[0]?.[1]).toEqual(
      expect.objectContaining({ status: 303 }),
    );
  });

  it("records unexpected failures as correlated page errors", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      handle(
        handleInput(async () => {
          throw new TypeError("database unavailable");
        }),
      ),
    ).rejects.toThrow("database unavailable");

    expect(pageEvents(error.mock.calls, "page.request.error")).toHaveLength(1);
    expect(pageEvents(error.mock.calls, "page.request.error")[0]?.[1]).toEqual(
      expect.objectContaining({
        errorName: "TypeError",
        requestId: expect.any(String),
        status: 500,
      }),
    );
  });

  it("classifies the exact /api path as an API request", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const response = await handle(
      handleInput(async () => Response.json({ error: "Not found" }), {
        pathname: "/api",
        routeId: "/api/[...path]",
      }),
    );

    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/i);
    expect(pageEvents(info.mock.calls, "page.request.finish")).toHaveLength(0);
    expect(apiEvents(info.mock.calls)).toEqual([
      expect.arrayContaining([
        "[api]",
        expect.objectContaining({ event: "request.start", path: "/api" }),
      ]),
      expect.arrayContaining([
        "[api]",
        expect.objectContaining({ event: "request.finish", path: "/api" }),
      ]),
    ]);
  });

  it("records server errors with the request id and normalized route", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { event } = handleInput(async () => new Response(), {
      pathname: "/sections/159446",
      routeId: "/sections/[jwId]",
    });
    event.locals.requestId = "request-1";

    expect(
      handleError({
        error: new TypeError("private database detail"),
        event,
        message: "Internal Error",
        status: 500,
      }),
    ).toEqual({ message: "Internal Error" });

    expect(error).toHaveBeenCalledWith(
      "[app]",
      expect.objectContaining({
        event: "sveltekit.server-error",
        method: "GET",
        requestId: "request-1",
        route: "/sections/[jwId]",
        status: 500,
      }),
      expect.anything(),
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("/sections/159446");
  });

  it("wires the SvelteKit dispatch through the Worker trace span", async () => {
    const spanNames: string[] = [];
    vi.spyOn(console, "info").mockImplementation(() => {});

    await handle(
      handleInput(async () => Response.json({ ok: true }), { spanNames }),
    );

    expect(spanNames).toContain("app.sveltekit.resolve");
  });

  it("records a thrown API request exactly once with a server request id", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      handle(
        handleInput(
          async () => {
            throw new TypeError("private database detail");
          },
          {
            headers: { "x-request-id": "client-controlled-request-id" },
            pathname: "/api/todos/123",
            routeId: "/api/todos/[id]",
          },
        ),
      ),
    ).rejects.toThrow("private database detail");

    const events = apiEvents([...info.mock.calls, ...error.mock.calls]);
    expect(
      events.filter(
        ([, value]) =>
          typeof value === "object" &&
          value !== null &&
          "event" in value &&
          value.event === "request.start",
      ),
    ).toHaveLength(1);
    expect(
      events.filter(
        ([, value]) =>
          typeof value === "object" &&
          value !== null &&
          "event" in value &&
          value.event === "request.error",
      ),
    ).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain(
      "client-controlled-request-id",
    );
  });
});
