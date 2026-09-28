import { createServer } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { RequestEvent } from "@sveltejs/kit";
import { getRequest } from "@sveltejs/kit/node";
import { postPublicationIngestionBatchRoute } from "@/lib/api/routes/publication-ingestion-routes";
import {
  getPublicationSourcesRoute,
  getPublicationsRoute,
  getPublicPublicationRoute,
} from "@/lib/api/routes/publication-public-routes";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import {
  type IsolatedDatabase,
  isolatedDatabaseTest,
} from "../shared/isolated-database";
import { createNodeRuntime } from "../shared/node-runtime";
import {
  type McpHarness,
  ownAnonymousMcpHarness,
  ownMcpHarness,
} from "./mcp/_harness/client";

function ownPublicationHttp(database: IsolatedDatabase) {
  const marker = crypto.randomUUID();
  const secret = `private-ingestion-${marker}`;
  const env = {
    HYPERDRIVE: { connectionString: database.connections.app },
    HYPERDRIVE_AUTH: { connectionString: database.connections.auth },
    PUBLICATION_INGESTION_SECRET: secret,
  };
  const runtime = createNodeRuntime(env);
  const graphqlHandler = createGraphqlRequestHandler(false);
  const responses = new Set<Response>();
  const requests: Promise<void>[] = [];
  const handlers: Promise<void>[] = [];
  const listenAbort = new AbortController();
  let origin = "";
  let initialization: Promise<void> | undefined;
  let closing: Promise<void> | undefined;
  const server = createServer((incoming, outgoing) => {
    const handling = (async () => {
      try {
        const request = await getRequest({ request: incoming, base: origin });
        const path = new URL(request.url).pathname;
        const response = await runtime.run(() =>
          path === "/api/graphql"
            ? graphqlHandler({
                request,
                locals: { authUser: null, locale: "en-us", requestId: marker },
              } as unknown as RequestEvent)
            : path === "/api/publications/sources"
              ? getPublicationSourcesRoute(request)
              : request.method === "POST"
                ? postPublicationIngestionBatchRoute(request)
                : path === "/api/publications"
                  ? getPublicationsRoute(request)
                  : getPublicPublicationRoute(request, {
                      id: path.slice(path.lastIndexOf("/") + 1),
                    }),
        );
        for (const [name, value] of response.headers)
          outgoing.setHeader(
            name,
            name === "set-cookie" ? response.headers.getSetCookie() : value,
          );
        outgoing.writeHead(response.status);
        // Own response EOF/cancellation; setResponse starts a detached pump.
        if (response.body)
          await pipeline(
            Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>),
            outgoing,
          );
        else outgoing.end();
      } catch {
        if (!outgoing.destroyed) {
          if (!outgoing.headersSent) outgoing.statusCode = 500;
          outgoing.end("Internal error");
        }
      }
    })();
    handlers.push(handling);
    void handling.catch(() => undefined);
  });

  function initialize() {
    if (closing)
      return Promise.reject(new Error("Publication HTTP is closing"));
    initialization ??= new Promise<void>((resolve, reject) => {
      const failed = (error: Error) => {
        server.off("error", failed);
        listenAbort.signal.removeEventListener("abort", aborted);
        reject(error);
      };
      const aborted = () =>
        failed(new Error("Publication HTTP setup cancelled"));
      listenAbort.signal.addEventListener("abort", aborted, { once: true });
      server.once("error", failed);
      server.listen(
        { port: 0, host: "127.0.0.1", signal: listenAbort.signal },
        () => {
          server.off("error", failed);
          listenAbort.signal.removeEventListener("abort", aborted);
          const address = server.address();
          if (!address || typeof address === "string")
            return reject(new Error("Missing publication HTTP address"));
          origin = `http://127.0.0.1:${address.port}`;
          resolve();
        },
      );
    });
    return initialization;
  }

  function fetchOwned(input: string | URL | Request, init?: RequestInit) {
    if (closing)
      return Promise.reject(new Error("Publication HTTP is closing"));
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
      listenAbort.abort();
      await initialization?.catch(() => undefined);
      for (const request of requests) await request;
      const outcomes = await Promise.allSettled(
        [...responses].map((response) =>
          response.body && !response.bodyUsed
            ? response.body.cancel()
            : undefined,
        ),
      );
      for (const handler of handlers) await handler;
      outcomes.push(...(await Promise.allSettled([runtime.close()])));
      outcomes.push(
        ...(await Promise.allSettled([
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (
                error &&
                (error as NodeJS.ErrnoException).code !==
                  "ERR_SERVER_NOT_RUNNING"
              )
                reject(error);
              else resolve();
            });
            server.closeAllConnections();
          }),
        ])),
      );
      responses.clear();
      const errors = outcomes.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (errors.length)
        throw new AggregateError(errors, "Publication HTTP cleanup failed");
    })();
    return closing;
  }

  function batch(label: string) {
    const sourceId = `http-${marker.slice(0, 20)}-${label}`;
    const batchId = `${marker}-${label}`;
    return {
      protocolVersion: "1",
      producerVersion: "integration-test",
      clientRunId: batchId,
      batchId,
      observedAt: "2026-09-01",
      sources: [
        {
          id: sourceId,
          name: label,
          organizationLevel: "university",
          allowedHosts: ["publication.example"],
        },
      ],
      items: [
        {
          sourceId,
          canonicalUrl: `https://publication.example/${marker}/${label}`,
          revisionHash: "a".repeat(64),
          observedAt: "2026-09-01",
          publicationType: "news",
          title: `${marker} ${label}`,
          objects: [],
        },
      ],
    };
  }

  return {
    db: database.owner,
    marker,
    secret,
    get origin() {
      return origin;
    },
    initialize,
    close,
    batch,
    fetch: fetchOwned,
    run: runtime.run,
    configureSecret(value: string) {
      env.PUBLICATION_INGESTION_SECRET = value;
    },
    post(
      body: unknown,
      headers: Record<string, string> = {
        "X-Publication-Ingestion-Secret": secret,
      },
    ) {
      return fetchOwned(`${origin}/api/ingestion/publications/batches`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
      });
    },
  };
}

type PublicationHttp = ReturnType<typeof ownPublicationHttp>;
type OwnedMcp = ReturnType<typeof ownMcpHarness>;

export const publicationHttpTest = isolatedDatabaseTest.extend<{
  _publicationHttpResources: PublicationHttp;
  http: PublicationHttp;
  _publicationMcpResources: OwnedMcp[];
  publicationMcp: McpHarness[];
}>({
  _publicationHttpResources: async ({ isolatedDatabase }, use) => {
    const owned = ownPublicationHttp(isolatedDatabase);
    try {
      await use(owned);
    } finally {
      await owned.close();
    }
  },
  http: async ({ _publicationHttpResources }, use) => {
    await _publicationHttpResources.initialize();
    await use(_publicationHttpResources);
  },
  _publicationMcpResources: async ({ http }, use) => {
    const owned: OwnedMcp[] = [];
    async function closeClients() {
      const results = await Promise.allSettled(
        owned.map(({ client }) => client.close()),
      );
      const errors = results.flatMap((r) =>
        r.status === "rejected" ? [r.reason] : [],
      );
      if (errors.length)
        throw new AggregateError(errors, "Publication MCP cleanup failed");
    }
    try {
      owned.push(ownAnonymousMcpHarness());
      owned.push(ownMcpHarness(`${http.marker}-publication-reader`));
      await use(owned);
    } finally {
      await closeClients();
    }
  },
  publicationMcp: async ({ _publicationMcpResources }, use) => {
    for (const owned of _publicationMcpResources) await owned.initialize();
    await use(_publicationMcpResources.map(({ client }) => client));
  },
});
