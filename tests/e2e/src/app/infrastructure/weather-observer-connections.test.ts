import { createServer } from "node:http";
import type { Socket } from "node:net";
import { test as base, expect } from "@playwright/test";
import {
  arrangeWeatherCache,
  readWeatherCache,
} from "../../../utils/weather-cache-fixture";

type Endpoint = {
  origin: string;
  requests: { method: string; key: string | null; connection: number }[];
  connections: Set<Socket>;
  expireConnections: () => void;
  failure: "none" | "reset-write" | "reset-read" | "http-read";
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
    const snapshots = new Map<string | null, unknown>();
    const endpoint: Endpoint = {
      origin: "",
      requests: [],
      connections,
      failure: "none",
      expireConnections: () => {
        for (const socket of connections) expired.add(socket);
      },
    };
    const server = createServer(async (request, response) => {
      const key = new URL(request.url ?? "/", endpoint.origin).searchParams.get(
        "locationKey",
      );
      endpoint.requests.push({
        method: request.method ?? "",
        key,
        connection: ids.get(request.socket) as number,
      });
      // Expose a connection crossing a completed phase without timing sleeps.
      // The real workerd reproduction expires its socket before the next I/O turn.
      if (expired.has(request.socket)) {
        request.socket.destroy();
        return;
      }
      if (request.method === "PUT") {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        snapshots.set(key, JSON.parse(Buffer.concat(chunks).toString()));
        if (endpoint.failure === "reset-write") {
          request.socket.destroy();
          return;
        }
        response.writeHead(204).end();
      } else {
        if (endpoint.failure === "reset-read") {
          request.socket.destroy();
          return;
        }
        response.writeHead(endpoint.failure === "http-read" ? 500 : 200, {
          "content-type": "application/json",
        });
        response.end(JSON.stringify(snapshots.get(key)));
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
        throw new Error("Expected a private weather fixture port");
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

test("weather checkpoints own connections after setup and earlier reads", {
  tag: "@Infrastructure/Runtime",
}, async ({ endpoint }) => {
  const snapshots = await arrangeWeatherCache(endpoint.origin);
  endpoint.expireConnections();
  expect(await readWeatherCache(endpoint.origin, "ustc-main")).toEqual(
    snapshots[0],
  );
  endpoint.expireConnections();
  expect(await readWeatherCache(endpoint.origin, "ustc-gaoxin")).toEqual(
    snapshots[1],
  );
  expect(endpoint.requests.map(({ method, key }) => [method, key])).toEqual([
    ["PUT", "ustc-main"],
    ["GET", "ustc-main"],
    ["PUT", "ustc-gaoxin"],
    ["GET", "ustc-gaoxin"],
    ["GET", "ustc-main"],
    ["GET", "ustc-gaoxin"],
  ]);
  const setupConnections = endpoint.requests
    .slice(0, 4)
    .map(({ connection }) => connection);
  const first = endpoint.requests[4].connection;
  const second = endpoint.requests[5].connection;
  expect(setupConnections).not.toContain(first);
  expect(setupConnections).not.toContain(second);
  expect(first).not.toBe(second);
  await expect.poll(() => endpoint.connections.size).toBe(0);
});

test("weather setup reports a lost write acknowledgement without replay", {
  tag: "@Infrastructure/Runtime",
}, async ({ endpoint }) => {
  endpoint.failure = "reset-write";
  await expect(arrangeWeatherCache(endpoint.origin)).rejects.toThrow(
    "ECONNRESET",
  );
  expect(endpoint.requests.map(({ method, key }) => [method, key])).toEqual([
    ["PUT", "ustc-main"],
  ]);
  await expect.poll(() => endpoint.connections.size).toBe(0);
});

for (const failure of ["reset-read", "http-read"] as const) {
  test(`weather observation propagates ${failure} and closes its connection`, {
    tag: "@Infrastructure/Runtime",
  }, async ({ endpoint }) => {
    await arrangeWeatherCache(endpoint.origin);
    endpoint.failure = failure;
    await expect(
      readWeatherCache(endpoint.origin, "ustc-main"),
    ).rejects.toThrow(
      failure === "reset-read" ? "ECONNRESET" : /Received:.*500/,
    );
    expect(endpoint.requests.map(({ method, key }) => [method, key])).toEqual([
      ["PUT", "ustc-main"],
      ["GET", "ustc-main"],
      ["PUT", "ustc-gaoxin"],
      ["GET", "ustc-gaoxin"],
      ["GET", "ustc-main"],
    ]);
    await expect.poll(() => endpoint.connections.size).toBe(0);
  });
}
