import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { request } from "@playwright/test";
import { describe, expect, it } from "vitest";

describe("Playwright read-only request transport recovery", () => {
  it.each([
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
  ])("$name", async ({ resets, status, attempts }) => {
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
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const context = await request.newContext();
    try {
      const { port } = server.address() as AddressInfo;
      const result = context.get(`http://127.0.0.1:${port}/read`, {
        maxRetries: 1,
      });
      if (resets === 2) {
        await expect(result).rejects.toThrow("socket hang up");
      } else {
        const response = await result;
        expect(response.status()).toBe(status);
        expect(await response.text()).toBe("response body");
      }
      expect(received).toBe(attempts);
    } finally {
      await context.dispose();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
