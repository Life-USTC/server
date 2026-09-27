import type { Handle } from "@sveltejs/kit";
import { afterEach, expect, it, vi } from "vitest";
import { handle } from "@/hooks.server";
import { createDeferred } from "../../../shared/deferred";
import { createWaitUntil } from "../../../shared/wait-until";

const { session, writeObservabilityBatch } = vi.hoisted(() => ({
  session: vi.fn(),
  writeObservabilityBatch: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeadersWithResponseHeaders: session,
}));
vi.mock("@/lib/db/feature-event-store", () => ({
  writeObservabilityBatch,
}));

const backgroundTasks = createWaitUntil();
const waitUntil = vi.fn(backgroundTasks.waitUntil);
afterEach(async () => {
  try {
    // Match the Worker's waitUntil lifetime, including when an assertion fails.
    await backgroundTasks.drain();
  } finally {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  }
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
      platform: {
        context: {
          waitUntil,
        },
      },
    },
    resolve: vi.fn().mockResolvedValue(response),
  } as unknown as Parameters<Handle>[0]);
}

it("schedules observation persistence separately from the cache-controlled response", async () => {
  const pendingWrite = createDeferred<void>();
  writeObservabilityBatch.mockReturnValueOnce(pendingWrite.promise);
  try {
    const response = await respond(
      "/api/workspace/overview",
      Response.json({ userId: "viewer-1" }),
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(writeObservabilityBatch).toHaveBeenCalledOnce();
    expect(writeObservabilityBatch).toHaveBeenCalledWith({
      features: [expect.objectContaining({ feature: "workspace.overview" })],
      issues: [],
    });
    expect(waitUntil).toHaveBeenCalledOnce();
  } finally {
    pendingWrite.resolve();
  }
});

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

it.each(["private, no-store", "private, max-age=1800"])(
  "enforces private no-store even over stored response metadata: %s",
  async (policy) => {
    const response = await respond(
      "/api/account/profile",
      Response.json(
        {},
        {
          headers: {
            "Cache-Control": policy,
            "Cloudflare-CDN-Cache-Control": "public, max-age=86400",
          },
        },
      ),
    );
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "no-store",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  },
);

it("rendering-and-cache.personal-overlays-10", async () => {
  for (const path of [
    "/api/account/profile",
    "/api/workspace/overview",
    "/api/community/comments",
    "/_internal/shell-bootstrap",
  ]) {
    for (const status of [200, 400, 401, 403, 404, 500]) {
      const response = await respond(
        path,
        Response.json(
          { privateValue: "viewer-1" },
          {
            status,
            headers: {
              "Cache-Control": "private, max-age=1800",
              "Cloudflare-CDN-Cache-Control": "public, max-age=86400",
            },
          },
        ),
        { cookie: "better-auth.session_token=private-session" },
      );
      expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
        "no-store",
      );
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
  }
});
