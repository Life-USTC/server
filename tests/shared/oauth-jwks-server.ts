import { createServer } from "node:http";
import { finished } from "node:stream/promises";
import { getBetterAuthInstance } from "@/lib/auth/core";
import type { createNodeRuntime } from "./node-runtime";
import { oauthProviderTest } from "./oauth-provider-runtime";

// The actual provider's JWKS endpoint stays reachable while admitted token
// verification finishes, including when its owning test has timed out.
function ownJwksServer() {
  let origin = "";
  let requestRuntime: ReturnType<typeof createNodeRuntime>["run"] | undefined;
  let initialization: Promise<void> | undefined;
  let closing: Promise<void> | undefined;
  const handlers: Promise<void>[] = [];
  const server = createServer((incoming, outgoing) => {
    const handling = (async () => {
      try {
        if (closing || !requestRuntime)
          throw new Error("OAuth JWKS server is not accepting requests");
        await requestRuntime(async () => {
          const response = await getBetterAuthInstance().handler(
            new Request(`${origin}${incoming.url}`),
          );
          const body = Buffer.from(await response.arrayBuffer());
          outgoing.writeHead(
            response.status,
            Object.fromEntries(response.headers),
          );
          const sent = finished(outgoing, { cleanup: true });
          outgoing.end(body);
          await sent;
        });
      } catch {
        if (!outgoing.destroyed) {
          if (!outgoing.headersSent) outgoing.writeHead(500);
          outgoing.end();
        }
      }
    })();
    handlers.push(handling);
    void handling.catch(() => undefined);
  });
  function initialize() {
    if (closing)
      return Promise.reject(new Error("OAuth JWKS server is closing"));
    initialization ??= (async () => {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, () => {
          server.off("error", reject);
          resolve();
        });
      });
      if (closing) throw new Error("OAuth JWKS server is closing");
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Expected local HTTP listener");
      origin = `http://localhost:${address.port}`;
    })();
    return initialization;
  }
  function close() {
    closing ??= (async () => {
      await initialization?.catch(() => undefined);
      const results: PromiseSettledResult<unknown>[] = [];
      for (let index = 0; index < handlers.length; index++)
        results.push(...(await Promise.allSettled([handlers[index]])));
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
        throw new AggregateError(failures, "OAuth JWKS cleanup failed");
    })();
    return closing;
  }
  return {
    initialize,
    close,
    get origin() {
      return origin;
    },
    bind(runtime: NonNullable<typeof requestRuntime>) {
      requestRuntime = runtime;
    },
  };
}

export const oauthJwksTest = oauthProviderTest.extend<{
  oauthEnvironment: Record<string, string>;
  _jwksResources: ReturnType<typeof ownJwksServer>;
  _listeningJwks: ReturnType<typeof ownJwksServer>;
  jwks: { origin: string };
}>({
  // The dependency ensures the listener closes before its private database.
  _jwksResources: async ({ isolatedDatabase: _database }, use) => {
    const server = ownJwksServer();
    try {
      await use(server);
    } finally {
      await server.close();
    }
  },
  _listeningJwks: async ({ _jwksResources }, use) => {
    await _jwksResources.initialize();
    await use(_jwksResources);
  },
  oauthEnvironment: async ({ _listeningJwks }, use) => {
    await use({
      APP_PUBLIC_ORIGIN: _listeningJwks.origin,
      APP_CANONICAL_ORIGIN: _listeningJwks.origin,
    });
  },
  jwks: async ({ _listeningJwks, oauthRuntime }, use) => {
    _listeningJwks.bind(oauthRuntime.request);
    await use({ origin: _listeningJwks.origin });
  },
});
