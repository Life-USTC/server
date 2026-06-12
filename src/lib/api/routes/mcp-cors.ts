import { isTrustedAuthOrigin } from "@/lib/auth/auth-origins";

const MCP_CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "MCP-Session-Id, WWW-Authenticate",
} as const;

function appendVaryHeader(headers: Headers, value: string) {
  const existing = headers.get("Vary");
  const parts = new Set(
    (existing ? existing.split(",") : [])
      .map((item) => item.trim())
      .filter(Boolean),
  );
  parts.add(value);
  headers.set("Vary", Array.from(parts).join(", "));
}

export function buildMcpCorsHeaders(
  request: Request,
  responseHeaders?: HeadersInit,
) {
  const headers = new Headers(responseHeaders);
  for (const [key, value] of Object.entries(MCP_CORS_HEADERS)) {
    headers.set(key, value);
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    headers.set("Access-Control-Allow-Origin", "*");
    return headers;
  }

  headers.set("Access-Control-Allow-Origin", origin);
  appendVaryHeader(headers, "Origin");
  return headers;
}

export function withMcpCors(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: buildMcpCorsHeaders(request, headers),
  });
}

function buildInvalidOriginResponse() {
  return new Response(JSON.stringify({ error: "invalid_origin" }), {
    status: 403,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export function validateMcpOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }
  return isTrustedAuthOrigin(origin) ? null : buildInvalidOriginResponse();
}
