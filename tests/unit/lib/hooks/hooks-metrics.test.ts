import type { Handle } from "@sveltejs/kit";
import { afterEach, expect, it, vi } from "vitest";
import { handle } from "@/hooks.server";

const { session, pageFinish, pageError } = vi.hoisted(() => ({
  session: vi.fn(),
  pageFinish: vi.fn(),
  pageError: vi.fn(),
}));
vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeadersWithResponseHeaders: session,
}));
vi.mock("@/lib/metrics/page-observability", () => ({
  recordPageRequestFinish: pageFinish,
  recordPageRequestError: pageError,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("handles machine scrapes without session resolution or page observations", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const url = new URL("https://example.test/metrics");
  const request = new Request(url, {
    headers: {
      authorization: "Bearer metrics-secret",
      cookie: "better-auth.session_token=stale-cookie",
    },
  });
  const resolve = vi
    .fn()
    .mockResolvedValue(
      new Response("metrics\n", { headers: { "content-type": "text/plain" } }),
    );
  const input = {
    event: {
      url,
      request,
      route: { id: "/metrics" },
      params: {},
      locals: {},
      cookies: { get: () => undefined },
    },
    resolve,
  } as unknown as Parameters<Handle>[0];
  const response = await handle(input);
  expect(response.status).toBe(200);
  expect(session).not.toHaveBeenCalled();
  expect(pageFinish).not.toHaveBeenCalled();
  expect(pageError).not.toHaveBeenCalled();
  expect(resolve).toHaveBeenCalledOnce();
});
