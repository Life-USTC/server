import { expect, test, vi } from "vitest";

vi.mock("@/lib/log/app-logger", () => ({ logRouteFailure: vi.fn() }));

import {
  PRIVATE_SESSION_HEADERS,
  privateSessionJson,
  rejectBearerOnSessionRoute,
  withPrivateSessionHeaders,
} from "@/lib/api/internal-session-response";

function expectPrivateSessionHeaders(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
}

test("private session headers cannot be overridden by the caller", () => {
  const init = withPrivateSessionHeaders({
    headers: { "Cache-Control": "public, max-age=60", Allow: "GET" },
    status: 405,
  });
  const headers = new Headers(init.headers);

  expect(init.status).toBe(405);
  expect(headers.get("Allow")).toBe("GET");
  for (const [name, value] of Object.entries(PRIVATE_SESSION_HEADERS)) {
    expect(headers.get(name)).toBe(value);
  }
});

test("private session JSON carries the headers and the caller's status", async () => {
  const response = privateSessionJson({ ok: true }, { status: 404 });

  expect(response.status).toBe(404);
  expectPrivateSessionHeaders(response);
  expect(response.headers.get("Content-Type")).toContain("application/json");
  await expect(response.json()).resolves.toEqual({ ok: true });
});

test("Bearer credentials are rejected before a viewer is resolved", async () => {
  const response = rejectBearerOnSessionRoute(
    new Request("https://life.example/_internal/x", {
      headers: { Authorization: "Bearer token" },
    }),
  );

  expect(response?.status).toBe(401);
  expectPrivateSessionHeaders(response as Response);
  await expect(response?.json()).resolves.toEqual({
    error: "Session authentication required",
  });
});

test("cookie-only requests proceed", () => {
  expect(
    rejectBearerOnSessionRoute(
      new Request("https://life.example/_internal/x", {
        headers: { cookie: "session=1" },
      }),
    ),
  ).toBeNull();
});
