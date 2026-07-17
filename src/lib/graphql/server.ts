import type { RequestEvent } from "@sveltejs/kit";
import { createYoga } from "graphql-yoga";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { GRAPHQL_ENDPOINT, GRAPHQL_LIMITS } from "./constants";
import { createGraphqlLoaders } from "./loaders";
import { createDeadline } from "./request-deadline";
import {
  type GraphqlContext,
  type GraphqlServerContext,
  graphqlSchema,
} from "./schema";
import { createGraphqlSecurityPlugins } from "./security";

class GraphqlBodyTooLargeError extends Error {}

function graphqlErrorResponse(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({
      errors: [{ message, extensions: { code } }],
    }),
    {
      status,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/graphql-response+json; charset=utf-8",
      },
    },
  );
}

function noStore(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function readBodyWithinLimit(
  request: Request,
  signal: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > GRAPHQL_LIMITS.bodyBytes
  ) {
    throw new GraphqlBodyTooLargeError();
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const onAbort = () => {
    void reader.cancel(signal.reason);
  };
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    while (true) {
      if (signal.aborted) throw signal.reason;
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > GRAPHQL_LIMITS.bodyBytes) {
        await reader.cancel();
        throw new GraphqlBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function createGraphqlRequestHandler(production: boolean) {
  const yoga = createYoga<GraphqlServerContext, GraphqlContext>({
    schema: graphqlSchema,
    graphqlEndpoint: GRAPHQL_ENDPOINT,
    fetchAPI: { Response },
    context: ({ locals }) => ({
      locale: locals.locale ?? DEFAULT_LOCALE,
      loaders: createGraphqlLoaders(locals.locale ?? DEFAULT_LOCALE),
    }),
    graphiql: !production,
    maskedErrors: true,
    batching: { limit: GRAPHQL_LIMITS.requestBatch },
    multipart: false,
    plugins: createGraphqlSecurityPlugins(production),
  });

  return async function handleGraphqlRequest(event: RequestEvent) {
    const { request } = event;
    const deadline = createDeadline(request.signal, GRAPHQL_LIMITS.timeoutMs);

    try {
      const init: RequestInit = {
        method: request.method,
        headers: request.headers,
        signal: deadline.signal,
      };
      if (request.method === "POST") {
        init.body = await readBodyWithinLimit(request, deadline.signal);
      }

      return noStore(await yoga.fetch(request.url, init, event));
    } catch (error) {
      if (error instanceof GraphqlBodyTooLargeError) {
        return graphqlErrorResponse(
          413,
          "REQUEST_TOO_LARGE",
          `GraphQL request body must not exceed ${GRAPHQL_LIMITS.bodyBytes} bytes.`,
        );
      }
      if (deadline.timedOut()) {
        return graphqlErrorResponse(
          504,
          "REQUEST_TIMEOUT",
          "GraphQL request timed out.",
        );
      }
      return graphqlErrorResponse(
        500,
        "INTERNAL_SERVER_ERROR",
        "Unexpected error.",
      );
    } finally {
      deadline.cleanup();
    }
  };
}
