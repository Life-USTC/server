export const transports = ["rest", "graphql", "mcp"] as const;
export type Transport = (typeof transports)[number];
export type Tokens = Record<Transport, string>;
export type Operation = {
  rest: {
    path: string;
    method: string;
    body?: Record<string, unknown>;
    form?: Record<string, string>;
  };
  graphql: { query: string; variables: Record<string, unknown>; field: string };
  mcp: { name: string; arguments: Record<string, unknown> };
};

/** Operation-only adapter; native errors and persisted-state expectations belong to each test. */
export function sendOperation(
  origin: string,
  transport: Transport,
  operation: Operation,
  token?: string,
  headers: Record<string, string> = {},
  signal?: AbortSignal,
) {
  return fetch(
    `${origin}${transport === "rest" ? operation.rest.path : `/api/${transport}`}`,
    {
      method: transport === "rest" ? operation.rest.method : "POST",
      signal,
      headers: {
        "content-type":
          transport === "rest" && operation.rest.form
            ? "application/x-www-form-urlencoded"
            : "application/json",
        accept: "application/json, text/event-stream",
        origin: origin,
        ...headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body:
        transport === "rest"
          ? operation.rest.form
            ? new URLSearchParams(operation.rest.form).toString()
            : operation.rest.body
              ? JSON.stringify(operation.rest.body)
              : undefined
          : JSON.stringify(
              transport === "graphql"
                ? {
                    query: operation.graphql.query,
                    variables: operation.graphql.variables,
                  }
                : {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "tools/call",
                    params: {
                      name: operation.mcp.name,
                      arguments: {
                        ...operation.mcp.arguments,
                        mode: "full",
                        locale: "zh-cn",
                      },
                    },
                  },
            ),
    },
  );
}
export async function nativeEnvelope(response: Response) {
  const text = await response.text();
  const encoded = response.headers
    .get("content-type")
    ?.includes("text/event-stream")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .at(-1)
        ?.slice(6)
    : text;
  if (!encoded) throw new Error("Missing transport response");
  return JSON.parse(encoded);
}

export async function invokeOperation(
  origin: string,
  transport: Transport,
  operation: Operation,
  token?: string,
  headers: Record<string, string> = {},
  signal?: AbortSignal,
) {
  const response = await sendOperation(
    origin,
    transport,
    operation,
    token,
    headers,
    signal,
  );
  const payload = await nativeEnvelope(response);
  const content =
    transport === "mcp" && payload.result?.content
      ? JSON.parse(
          payload.result.content.find(
            (part: { type: string }) => part.type === "text",
          ).text,
        )
      : transport === "graphql"
        ? payload.data?.[operation.graphql.field]
        : payload;
  return { response, payload, content };
}

export type OperationResult = Awaited<ReturnType<typeof invokeOperation>>;
