const DISCOVERY_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

function withDiscoveryCorsHeaders(headers?: HeadersInit): Headers {
  const responseHeaders = new Headers(headers);
  for (const [key, value] of Object.entries(DISCOVERY_CORS_HEADERS)) {
    responseHeaders.set(key, value);
  }
  return responseHeaders;
}

export function getDiscoveryOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: withDiscoveryCorsHeaders(),
  });
}

export function getDiscoveryRedirectResponse(url: URL | string, status = 307) {
  const response = Response.redirect(url, status);
  const headers = withDiscoveryCorsHeaders(response.headers);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = withDiscoveryCorsHeaders(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

export function createDiscoveryJsonResponse(
  body: unknown,
  init: ResponseInit = {},
) {
  return jsonResponse(body, init);
}
