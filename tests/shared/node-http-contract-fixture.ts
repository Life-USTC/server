import { createServer } from "node:http";
import { Readable } from "node:stream";
import { finished, pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { getRequest } from "@sveltejs/kit/node";
import { nodeProtocolTest } from "./node-protocol-fixture";
import type { NodeProtocolRuntime } from "./node-protocol-runtime";

type Handler = (request: Request) => Response | Promise<Response>;

function ownHttpServer(runtime: NodeProtocolRuntime, handler: Handler) {
  let origin = "";
  let initialization: Promise<void> | undefined;
  let closing: Promise<void> | undefined;
  let accepting = true;
  const requests: Promise<void>[] = [];
  const handlers: Promise<void>[] = [];
  const responses = new Set<Response>();
  const server = createServer((incoming, outgoing) => {
    const handling = runtime.request(async () => {
      try {
        const request = await getRequest({ request: incoming, base: origin });
        const response = await handler(request);
        for (const [name, value] of response.headers)
          outgoing.setHeader(
            name,
            name === "set-cookie" ? response.headers.getSetCookie() : value,
          );
        outgoing.writeHead(response.status);
        // Own the native body pump through completion; setResponse resolves
        // before its detached stream writes and is insufficient for teardown.
        if (response.body) {
          await pipeline(
            Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>),
            outgoing,
          );
        } else {
          const sent = finished(outgoing, { cleanup: true });
          outgoing.end();
          await sent;
        }
      } catch (error) {
        if (!outgoing.destroyed) {
          if (!outgoing.headersSent) outgoing.statusCode = 500;
          const sent = finished(outgoing, { cleanup: true });
          outgoing.end(String(error));
          await sent;
        }
      }
    });
    handlers.push(handling);
    void handling.catch(() => undefined);
  });
  function initialize() {
    if (closing) return Promise.reject(new Error("HTTP fixture is closing"));
    initialization ??= (async () => {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          server.off("error", reject);
          resolve();
        });
      });
      if (closing) throw new Error("HTTP fixture is closing");
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing server address");
      origin = `http://127.0.0.1:${address.port}`;
    })();
    return initialization;
  }
  function fetchOwned(input: string | URL | Request, init?: RequestInit) {
    if (!accepting) return Promise.reject(new Error("HTTP fixture is closing"));
    const operation = fetch(input, init).then((response) => {
      responses.add(response);
      return response;
    });
    requests.push(
      operation.then(
        () => undefined,
        () => undefined,
      ),
    );
    return operation;
  }
  function close() {
    closing ??= (async () => {
      // Keep IO available to admitted workflow callbacks after their test timeout.
      // The enclosing protocolRuntime fixture owns and reports the cached
      // runtime rejection. This borrowed wait preserves shutdown ordering.
      await Promise.allSettled([runtime.drain()]);
      const results: PromiseSettledResult<void>[] = [];
      accepting = false;
      await initialization?.catch(() => undefined);
      for (let i = 0; i < requests.length; i++) await requests[i];
      results.push(
        ...(await Promise.allSettled(
          [...responses].map((response) =>
            response.body && !response.bodyUsed
              ? response.body.cancel()
              : undefined,
          ),
        )),
      );
      responses.clear();
      for (let i = 0; i < handlers.length; i++)
        results.push(...(await Promise.allSettled([handlers[i]])));
      // Preserve the full request/body drain before closing the listener.
      // Its original error is reported once by the enclosing runtime owner.
      await Promise.allSettled([runtime.close()]);
      results.push(
        ...(await Promise.allSettled([
          new Promise<void>((resolve, reject) => {
            if (!server.listening) return resolve();
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
          }),
        ])),
      );
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(failures, "HTTP fixture cleanup failed");
    })();
    return closing;
  }
  return {
    initialize,
    close,
    fetch: fetchOwned,
    get origin() {
      return origin;
    },
  };
}

export const nodeHttpTest = nodeProtocolTest.extend<{
  httpHandler: Handler;
  _httpResources: ReturnType<typeof ownHttpServer>;
  http: ReturnType<typeof ownHttpServer>;
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest fixture dependency syntax.
  httpHandler: async ({}, use) => {
    await use(() => {
      throw new Error("An HTTP contract handler is required");
    });
  },
  _httpResources: async (
    { protocolRuntime, httpHandler, onTestFinished },
    use,
  ) => {
    const server = ownHttpServer(protocolRuntime, httpHandler);
    try {
      await use(server);
    } finally {
      try {
        await server.close();
      } catch (error) {
        onTestFinished(() => {
          throw error;
        });
      }
    }
  },
  http: async ({ _httpResources }, use) => {
    await _httpResources.initialize();
    await use(_httpResources);
  },
});
