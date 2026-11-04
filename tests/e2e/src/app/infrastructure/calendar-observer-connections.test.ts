import { createServer } from "node:http";
import type { Socket } from "node:net";
import { test as base, expect } from "@playwright/test";
import {
  createCalendarEffectObserver,
  withCalendarObserver,
} from "../../../utils/calendar-effects";
import { withCalendarProtocol } from "../../../utils/calendar-protocol-lifecycle";
import type { IsolatedWorker } from "../../../utils/isolated-worker";

type Endpoint = {
  origin: string;
  requests: {
    method: string;
    path: string;
    connection: number;
    host: string | undefined;
    secret: string | undefined;
  }[];
  expireConnections: () => void;
  resetConsumer: boolean;
  failRead: boolean;
  connections: Set<Socket>;
};

const test = base.extend<{ endpoint: Endpoint }>({
  baseURL: async ({ endpoint }, use) => {
    await use(endpoint.origin);
  },
  // biome-ignore lint/correctness/noEmptyPattern: Native fixture has no dependencies.
  endpoint: async ({}, use) => {
    const connections = new Set<Socket>();
    const expired = new Set<Socket>();
    const ids = new Map<Socket, number>();
    const endpoint: Endpoint = {
      origin: "",
      requests: [],
      connections,
      resetConsumer: false,
      failRead: false,
      expireConnections: () => {
        for (const socket of connections) expired.add(socket);
      },
    };
    let consumer = false;
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? "/", endpoint.origin).pathname;
      endpoint.requests.push({
        method: request.method ?? "",
        path,
        connection: ids.get(request.socket) as number,
        host: request.headers.host,
        secret: request.headers["x-test-storage-secret"] as string | undefined,
      });
      // Deterministically expose reuse after a phase boundary. The real
      // workerd reproduction closes its idle socket before the next I/O turn.
      if (expired.has(request.socket)) {
        request.socket.destroy();
        return;
      }
      if (path === "/__test/calendar-consumer") {
        if (request.method === "POST") {
          consumer = true;
          if (endpoint.resetConsumer) {
            request.socket.destroy();
            return;
          }
          response.writeHead(201).end();
        } else {
          response.writeHead(consumer ? 200 : 404, {
            "content-type": "application/json",
          });
          response.end(JSON.stringify({ attempts: [], calendar: null }));
        }
      } else if (request.method === "POST") {
        response.writeHead(201).end();
      } else if (request.method === "DELETE") {
        response.writeHead(204).end();
      } else {
        response.writeHead(endpoint.failRead ? 500 : 200, {
          "content-type": "application/json",
        });
        response.end(
          JSON.stringify({
            messages: [],
            purges: [],
            backgroundErrors: [],
            requests: [],
          }),
        );
      }
    });
    server.on("connection", (socket) => {
      ids.set(socket, ids.size + 1);
      connections.add(socket);
      socket.once("close", () => connections.delete(socket));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Expected a private observer port");
      endpoint.origin = `http://127.0.0.1:${address.port}`;
      await use(endpoint);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
});

for (const calendar of [false, true]) {
  test(`calendar observer phases use fresh connections, consumer=${calendar}`, {
    tag: "@Infrastructure/Runtime",
  }, async ({ page, playwright, endpoint }) => {
    let transportChecks = 0;
    let stateChecks = 0;
    await withCalendarProtocol(
      {
        page,
        isolatedWorker: { origin: endpoint.origin } as IsolatedWorker,
        createRequest: (headers) =>
          playwright.request.newContext({
            baseURL: endpoint.origin,
            extraHTTPHeaders: headers,
          }),
        runBody: (work) => work(),
      },
      async (io) => {
        endpoint.expireConnections();
        if (calendar) {
          await io.observeCalendar({ id: "actor" }, [], { calendar: "absent" });
          endpoint.expireConnections();
        }
        return {
          async verifyTransport({ effects }) {
            expect(effects.messages).toEqual([]);
            transportChecks++;
          },
          async verifyState() {
            stateChecks++;
          },
        };
      },
    );
    expect(transportChecks).toBe(1);
    expect(stateChecks).toBe(1);
    expect(page.isClosed()).toBe(true);
    expect(endpoint.requests.map(({ method, path }) => [method, path])).toEqual(
      [
        ["POST", "/__test/community-effects"],
        ...(calendar ? [["POST", "/__test/calendar-consumer"]] : []),
        ["GET", "/__test/community-effects"],
        ...(calendar ? [["GET", "/__test/calendar-consumer"]] : []),
        ["DELETE", "/__test/community-effects"],
      ],
    );
    expect(
      new Set(endpoint.requests.map(({ connection }) => connection)).size,
    ).toBe(calendar ? 4 : 3);
    await expect.poll(() => endpoint.connections.size).toBe(0);
  });
}

test("consumer registration reset is reported without replaying the accepted POST", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, playwright, endpoint }) => {
  endpoint.resetConsumer = true;
  const failure = await withCalendarProtocol(
    {
      page,
      isolatedWorker: { origin: endpoint.origin } as IsolatedWorker,
      createRequest: (headers) =>
        playwright.request.newContext({
          baseURL: endpoint.origin,
          extraHTTPHeaders: headers,
        }),
      runBody: (work) => work(),
    },
    async (io) => {
      await io.observeCalendar({ id: "actor" }, [], { calendar: "absent" });
      throw new Error("An unacknowledged registration must fail");
    },
  ).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toContain("ECONNRESET");
  expect(endpoint.requests.map(({ method, path }) => [method, path])).toEqual([
    ["POST", "/__test/community-effects"],
    ["POST", "/__test/calendar-consumer"],
    ["GET", "/__test/community-effects"],
    ["GET", "/__test/calendar-consumer"],
    ["DELETE", "/__test/community-effects"],
  ]);
  expect(page.isClosed()).toBe(true);
  await expect.poll(() => endpoint.connections.size).toBe(0);
});

test("failed observation still drains and verifies independent state", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, playwright, endpoint }) => {
  endpoint.failRead = true;
  let stateChecks = 0;
  const failure = await withCalendarProtocol(
    {
      page,
      isolatedWorker: { origin: endpoint.origin } as IsolatedWorker,
      createRequest: (headers) =>
        playwright.request.newContext({
          baseURL: endpoint.origin,
          extraHTTPHeaders: headers,
        }),
      runBody: (work) => work(),
    },
    async () => ({
      async verifyTransport() {
        throw new Error(
          "A failed observation cannot establish transport effects",
        );
      },
      async verifyState() {
        expect(endpoint.requests.at(-1)?.method).toBe("DELETE");
        stateChecks++;
      },
    }),
  ).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toMatch(/Received:.*500/);
  expect(stateChecks).toBe(1);
  expect(endpoint.requests.map(({ method }) => method)).toEqual([
    "POST",
    "GET",
    "DELETE",
  ]);
  expect(page.isClosed()).toBe(true);
  await expect.poll(() => endpoint.connections.size).toBe(0);
});

test("calendar checkpoints own connections after registration and earlier collection", {
  tag: "@Infrastructure/Runtime",
}, async ({ endpoint }) => {
  const origin = endpoint.origin.replace("127.0.0.1", "localhost");
  const observer = createCalendarEffectObserver({
    origin,
    producerPath: "/__test/community-effects?id=checkpoints",
    account: { id: "actor" },
    calendar: "absent",
  });
  await observer.register();
  endpoint.expireConnections();
  const first = await observer.collect(0);
  observer.assert(first, []);
  endpoint.expireConnections();
  const second = await observer.collect(0);
  observer.assert(second, []);
  expect(second).toEqual(first);
  expect(
    endpoint.requests.every(({ host }) => host === new URL(origin).host),
  ).toBe(true);
  expect(endpoint.requests.map(({ method, path }) => [method, path])).toEqual([
    ["POST", "/__test/calendar-consumer"],
    ["GET", "/__test/community-effects"],
    ["GET", "/__test/calendar-consumer"],
    ["GET", "/__test/community-effects"],
    ["GET", "/__test/calendar-consumer"],
  ]);
  expect(
    new Set(endpoint.requests.map(({ connection }) => connection)).size,
  ).toBe(3);
  await expect.poll(() => endpoint.connections.size).toBe(0);
});

for (const fails of [false, true]) {
  test(`localhost observer preserves HTTP authority and closes after failure=${fails}`, {
    tag: "@Infrastructure/Runtime",
  }, async ({ endpoint }) => {
    const origin = endpoint.origin.replace("127.0.0.1", "localhost");
    const failure = new Error("Independent observation failed");
    let owned:
      | Parameters<Parameters<typeof withCalendarObserver>[1]>[0]
      | undefined;
    const result = await withCalendarObserver(origin, async (request) => {
      owned = request;
      for (const path of [
        "/__test/community-effects",
        "/__test/calendar-consumer",
      ]) {
        const response = await request.post(path, {
          headers: { "x-test-storage-secret": "private-probe" },
        });
        expect(response.status()).toBe(201);
        await response.body();
        expect(new URL(response.url()).hostname).toBe("127.0.0.1");
      }
      if (fails) throw failure;
      return "observed";
    }).catch((error: unknown) => error);
    expect(result).toBe(fails ? failure : "observed");
    expect(
      endpoint.requests.map(({ host, secret }) => ({ host, secret })),
    ).toEqual([
      { host: new URL(origin).host, secret: "private-probe" },
      { host: new URL(origin).host, secret: "private-probe" },
    ]);
    expect(
      new Set(endpoint.requests.map(({ connection }) => connection)).size,
    ).toBe(1);
    await expect.poll(() => endpoint.connections.size).toBe(0);
    if (!owned) throw new Error("Observer context was never created");
    await expect(owned.get("/__test/community-effects")).rejects.toThrow(
      /Target page, context or browser has been closed/,
    );
    expect(endpoint.requests).toHaveLength(2);
  });
}
