import type { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDeferred } from "../../../shared/deferred";

type Socket = EventEmitter & {
  _cfReader: { read: () => Promise<ReadableStreamReadResult<Uint8Array>> };
  _cfSocket: { close?: () => Promise<void>; closed?: Promise<void> } | null;
  _listen: () => Promise<void>;
  _addClosedHandler: () => void;
  end: () => void;
};

// Node's default export is intentionally empty. Load the implementation that
// pg uses under workerd, including the installed Bun dependency patch.
const require = createRequire(import.meta.url);
const { CloudflareSocket } = require(
  join(dirname(require.resolve("pg-cloudflare/package.json")), "dist/index.js"),
) as { CloudflareSocket: new (ssl: boolean) => Socket };

describe("pg-cloudflare socket lifecycle", () => {
  it("settles a pending read without an error when end closes the socket", async () => {
    const socket = new CloudflareSocket(false);
    const read = createDeferred<ReadableStreamReadResult<Uint8Array>>();
    const closed = createDeferred();
    socket._cfReader = { read: () => read.promise };
    socket._cfSocket = {
      close: async () => {
        read.reject(new TypeError("This socket has been closed."));
        closed.resolve();
      },
    };
    const errors: unknown[] = [];
    socket.on("error", (error) => errors.push(error));

    const listening = socket._listen();
    const settled = expect(listening).resolves.toBeUndefined();
    socket.end();

    await settled;
    await closed.promise;
    expect(errors).toEqual([]);
  });

  it("settles a pending read after the peer closure has already been reported", async () => {
    const socket = new CloudflareSocket(false);
    const read = createDeferred<ReadableStreamReadResult<Uint8Array>>();
    const closed = createDeferred();
    socket._cfReader = { read: () => read.promise };
    socket._cfSocket = { closed: closed.promise };
    socket._addClosedHandler();
    const closeEvents: unknown[] = [];
    socket.on("close", () => closeEvents.push("close"));

    const listening = socket._listen();
    const settled = expect(listening).resolves.toBeUndefined();
    closed.resolve();
    await closed.promise;
    expect(closeEvents).toEqual(["close"]);
    read.reject(new TypeError("This socket has been closed."));

    await settled;
    expect(closeEvents).toEqual(["close"]);
  });

  it("preserves the original read error while the socket is active", async () => {
    const socket = new CloudflareSocket(false);
    const error = new Error("Network connection lost.");
    socket._cfReader = { read: () => Promise.reject(error) };

    await expect(socket._listen()).rejects.toBe(error);
  });
});
