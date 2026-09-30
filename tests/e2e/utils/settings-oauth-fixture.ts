import { createServer } from "node:http";
import type { Socket } from "node:net";
import { test as settingsTest } from "./settings-fixture";

const clientId = "settings-link-contract-client";
const authorizationPath = "/authorize/";

/** A real, owned authorization endpoint. This fixture verifies OAuth initiation;
 * token exchange and provider callbacks belong to their dedicated contracts. */
function ownAuthorizationServer() {
  const requests: URL[] = [];
  const sockets = new Set<Socket>();
  const responses = new Set<Promise<void>>();
  const errors: unknown[] = [];
  let origin = "";
  let initialization: Promise<void> | undefined;
  let closing: Promise<void> | undefined;
  const server = createServer((request, response) => {
    const finished = new Promise<void>((resolve, reject) => {
      response.once("finish", resolve);
      response.once("error", reject);
      response.once("close", () => {
        if (!response.writableFinished)
          reject(new Error("OAuth authorization response closed before finish"));
      });
    });
    responses.add(finished);
    void finished.then(
      () => responses.delete(finished),
      (error) => {
        errors.push(error);
        responses.delete(finished);
      },
    );
    try {
      const url = new URL(request.url ?? "/", origin);
      if (
        closing ||
        request.method !== "GET" ||
        url.pathname !== authorizationPath
      ) {
        errors.push(new Error("Unexpected local OAuth authorization request"));
        response.writeHead(404, { connection: "close" });
        response.end();
        return;
      }
      requests.push(url);
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        connection: "close",
      });
      response.end(
        '<!doctype html><html lang="en"><head><title>Local OAuth provider</title><link rel="icon" href="data:,"></head><body><h1>Authorize account connection</h1></body></html>',
      );
    } catch {
      // Request targets may contain OAuth state; never retain a parsing error
      // whose message embeds the incoming URL. The response owner settles too.
      errors.push(new Error("Local OAuth authorization handler failed"));
      response.destroy();
    }
  });
  server.on("error", (error) => errors.push(error));
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  function initialize() {
    if (closing) return Promise.reject(new Error("OAuth provider is closing"));
    initialization ??= (async () => {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          server.off("error", reject);
          resolve();
        });
      });
      if (closing) throw new Error("OAuth provider is closing");
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("OAuth authorization server has no TCP port");
      origin = `http://127.0.0.1:${address.port}`;
    })();
    return initialization;
  }
  function close() {
    closing ??= (async () => {
      await initialization?.catch(() => undefined);
      if (server.listening) {
        const closed = new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
        for (const socket of sockets) socket.destroy();
        await closed;
      }
      while (responses.size) await Promise.allSettled(responses);
      if (server.listening || sockets.size)
        errors.push(new Error("OAuth authorization server retained resources"));
      if (errors.length)
        throw new AggregateError(
          errors,
          "Local OAuth authorization server failed",
        );
    })();
    return closing;
  }
  return {
    initialize,
    close,
    requests,
    clientId,
    get origin() {
      return origin;
    },
  };
}

type AuthorizationServer = ReturnType<typeof ownAuthorizationServer>;

export const test = settingsTest.extend<{
  _authorizationResources: AuthorizationServer;
  authorizationProvider: AuthorizationServer;
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture dependencies.
  _authorizationResources: async ({}, use) => {
    const provider = ownAuthorizationServer();
    try {
      await use(provider);
    } finally {
      await provider.close();
    }
  },
  authorizationProvider: async ({ _authorizationResources }, use) => {
    await _authorizationResources.initialize();
    await use(_authorizationResources);
  },
  // The Worker depends on this provider, so it closes before the provider does.
  workerBindings: async ({ authorizationProvider }, use) => {
    await use({
      AUTH_OIDC_CLIENT_ID: clientId,
      AUTH_OIDC_CLIENT_SECRET: "settings-link-contract-secret",
      AUTH_OIDC_ISSUER: authorizationProvider.origin,
    });
  },
});
