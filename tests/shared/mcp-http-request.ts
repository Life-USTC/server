const protocolVersion = "2026-07-28";

/** Current wire envelope for raw HTTP contracts; SDK clients build their own. */
function envelope(data: unknown, inputHeaders?: HeadersInit) {
  const headers = new Headers(inputHeaders);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { data, headers: Object.fromEntries(headers) };
  }
  const message = data as Record<string, unknown>;
  if (typeof message.method !== "string") {
    return { data, headers: Object.fromEntries(headers) };
  }
  const params = (message.params ?? {}) as Record<string, unknown>;
  if (!headers.has("MCP-Protocol-Version"))
    headers.set("MCP-Protocol-Version", protocolVersion);
  if (!headers.has("MCP-Method")) headers.set("MCP-Method", message.method);
  if (typeof params.name === "string" && !headers.has("MCP-Name"))
    headers.set("MCP-Name", params.name);
  return {
    data: {
      ...message,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": protocolVersion,
          "io.modelcontextprotocol/clientInfo": {
            name: "http-contract",
            version: "1",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
          ...(params._meta as Record<string, unknown> | undefined),
        },
      },
    },
    headers: Object.fromEntries(headers),
  };
}

export function mcpPostOptions<
  T extends { data?: unknown; headers?: Record<string, string> },
>(options: T) {
  return { ...options, ...envelope(options.data, options.headers) };
}

export function mcpFetchOptions<T extends RequestInit>(options: T) {
  let data: unknown;
  try {
    data = JSON.parse(String(options.body));
  } catch {
    return options;
  }
  const payload = envelope(data, options.headers);
  return {
    ...options,
    headers: payload.headers,
    body: JSON.stringify(payload.data),
  };
}
