import type { RequestEvent } from "@sveltejs/kit";
import {
  createYoga,
  type MaskError,
  maskError as maskUnexpectedGraphqlError,
} from "graphql-yoga";
import { GraphqlAuthError } from "./auth";
import { GRAPHQL_ENDPOINT, GRAPHQL_LIMITS } from "./constants";
import {
  createGraphqlContext,
  type GraphqlContext,
  type GraphqlServerContext,
} from "./context";
import { createGraphqlObservabilityPlugin } from "./observability";
import { createDeadline } from "./request-deadline";
import { graphqlSchema } from "./schema";
import { createGraphqlSecurityPlugins } from "./security";

class GraphqlBodyTooLargeError extends Error {}

function graphqlErrorResponse(
  status: number,
  code: string,
  message: string,
  extensions: Record<string, unknown> = {},
) {
  return new Response(
    JSON.stringify({
      errors: [{ message, extensions: { code, ...extensions } }],
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

const SAFE_GRAPHQL_ERROR_CODES = new Set([
  "BAD_USER_INPUT",
  "FORBIDDEN",
  "UNAUTHENTICATED",
]);

const maskGraphqlError: MaskError = (error, message, isDev) => {
  const graphqlError = error as Error & {
    extensions?: Record<string, unknown>;
  };
  if (
    error instanceof Error &&
    error.name === "GraphQLError" &&
    typeof graphqlError.extensions?.code === "string" &&
    SAFE_GRAPHQL_ERROR_CODES.has(graphqlError.extensions.code)
  ) {
    return error;
  }
  return maskUnexpectedGraphqlError(error, message, isDev);
};

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
    context: createGraphqlContext,
    graphiql: !production,
    logging: false,
    maskedErrors: { maskError: maskGraphqlError },
    batching: { limit: GRAPHQL_LIMITS.requestBatch },
    multipart: false,
    plugins: [
      createGraphqlObservabilityPlugin(),
      ...createGraphqlSecurityPlugins(production),
    ],
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
      if (error instanceof GraphqlAuthError) {
        return graphqlErrorResponse(error.status, error.code, error.message, {
          requiredScopes: error.requiredScopes,
        });
      }
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
