import type { Handle } from "@sveltejs/kit";
import { afterEach, expect, it, vi } from "vitest";
import { handle } from "@/hooks.server";

const { session } = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeadersWithResponseHeaders: session,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function respond(
  path: string,
  response: Response,
  headers: HeadersInit = {},
) {
  vi.stubEnv("NODE_ENV", "development");
  session.mockResolvedValue({
    session: {
      user: { id: "viewer-1", name: "Viewer", username: "viewer" },
    },
  });
  const url = new URL(`https://example.test${path}`);
  return handle({
    event: {
      url,
      request: new Request(url, { headers }),
      route: { id: path },
      params: {},
      locals: {},
      cookies: { get: () => undefined },
    },
    resolve: vi.fn().mockResolvedValue(response),
  } as unknown as Parameters<Handle>[0]);
}

it.each([
  "/api/account/profile",
  "/api/workspace/overview",
  "/api/community/comments",
  "/api/community/section-homeworks",
  "/_internal/shell-bootstrap",
])(
  "does not cache viewer JSON at %s even when the handler omits headers",
  async (path) => {
    const response = await respond(
      path,
      Response.json({ userId: "viewer-1" }),
      {
        cookie: "better-auth.session_token=viewer-session",
      },
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "no-store",
    );
  },
);

it.each([401, 403, 404, 500])(
  "does not cache a %i JSON error",
  async (status) => {
    const response = await respond(
      "/api/account/profile",
      Response.json({ error: "Rejected" }, { status }),
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "no-store",
    );
  },
);

it("preserves public catalog headers on signed-in requests", async () => {
  const response = await respond(
    "/api/catalog/courses",
    Response.json(
      { data: [] },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=60",
          "Cloudflare-CDN-Cache-Control": "public, max-age=60",
        },
      },
    ),
    { cookie: "better-auth.session_token=viewer-session" },
  );
  expect(response.headers.get("Cache-Control")).toBe(
    "public, max-age=0, s-maxage=60",
  );
  expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
    "public, max-age=60",
  );
});

it("does not let a CDN header override a private response", async () => {
  const response = await respond(
    "/api/account/profile",
    Response.json(
      {},
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Cloudflare-CDN-Cache-Control": "public, max-age=86400",
        },
      },
    ),
  );
  expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
});
