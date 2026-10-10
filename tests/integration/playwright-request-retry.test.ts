import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { type APIRequestContext, request } from "@playwright/test";
import { describe, expect, it } from "vitest";

describe("Playwright read-only request transport recovery", () => {
  it.for([
    {
      name: "recovers one connection reset",
      resets: 1,
      status: 200,
      attempts: 2,
    },
    {
      name: "stops after a second connection reset",
      resets: 2,
      status: 200,
      attempts: 2,
    },
    {
      name: "returns HTTP 500 without replaying the request",
      resets: 0,
      status: 500,
      attempts: 1,
    },
  ])(
    "$name",
    { tags: ["@Infrastructure/Runtime"] },
    async ({ resets, status, attempts }, { signal, onTestFinished }) => {
      let received = 0;
      const server = createServer((incoming, response) => {
        received += 1;
        if (received <= resets) {
          incoming.socket.destroy();
          return;
        }
        response.writeHead(status, { "Content-Type": "text/plain" });
        response.end("response body");
      });
      let context: APIRequestContext | undefined;
      let workflow: Promise<void> | undefined;
      onTestFinished(async () => {
        // Join setup and the full request/assertion callback after cancellation.
        const interrupted = signal.aborted;
        const [body] = await Promise.allSettled([workflow]);
        const failures: unknown[] = [];
        // Vitest already reports normal failures and its timeout, but ignores
        // distinct setup/body failures that arrive after the timeout settled.
        if (
          interrupted &&
          body.status === "rejected" &&
          body.reason !== signal.reason &&
          !(
            body.reason instanceof Error &&
            body.reason.name === "AbortError" &&
            body.reason.cause === signal.reason
          )
        )
          failures.push(body.reason);
        const results = await Promise.allSettled([
          Promise.resolve().then(() => context?.dispose()),
        ]);
        results.push(
          ...(await Promise.allSettled([
            new Promise<void>((resolve, reject) => {
              if (!server.listening) return resolve();
              server.close((error) => (error ? reject(error) : resolve()));
              server.closeAllConnections();
            }),
          ])),
        );
        failures.push(
          ...results.flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
          ),
        );
        if (failures.length)
          throw new AggregateError(failures, "Request recovery cleanup failed");
      });
      workflow = (async () => {
        const listening = once(server, "listening");
        server.listen(0, "127.0.0.1");
        await listening;
        signal.throwIfAborted();
        context = await request.newContext();
        signal.throwIfAborted();
        const { port } = server.address() as AddressInfo;
        const result = context.get(`http://127.0.0.1:${port}/read`, {
          maxRetries: 1,
          signal,
        });
        if (resets === 2) {
          await expect(result).rejects.toThrow("socket hang up");
        } else {
          const response = await result;
          expect(response.status()).toBe(status);
          expect(await response.text()).toBe("response body");
        }
        expect(received).toBe(attempts);
      })();
      await workflow;
    },
  );
});
