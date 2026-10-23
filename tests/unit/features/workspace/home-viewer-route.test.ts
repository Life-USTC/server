import { beforeEach, expect, test, vi } from "vitest";

const { load, log } = vi.hoisted(() => ({ load: vi.fn(), log: vi.fn() }));
vi.mock("@/features/workspace/server/workspace-page-load", () => ({
  loadSignedWorkspacePage: load,
}));
vi.mock("@/lib/log/app-logger", () => ({ logRouteFailure: log }));

import { fallback, GET } from "@/routes/_internal/home/viewer/+server";

function event(userId?: string, authorization?: string) {
  const url = new URL(
    "https://example.test/_internal/home/viewer?snapshotAt=2026-10-23T09:00:00%2B08:00",
  );
  return {
    locals: { authUser: userId ? { id: userId } : null, locale: "en-us" },
    request: new Request(url, {
      headers: authorization ? { authorization } : {},
    }),
    url,
  };
}
function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
}
beforeEach(() => vi.resetAllMocks());

test("home viewer returns no personal projection without a session", async () => {
  const response = await GET(event() as never);
  expectPrivate(response);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ signedIn: false });
  expect(load).not.toHaveBeenCalled();
});

test.each([undefined, "owner"])(
  "home viewer rejects bearer with session %s before reading",
  async (owner) => {
    const response = await GET(event(owner, "Bearer token") as never);
    expectPrivate(response);
    expect(response.status).toBe(401);
    expect(load).not.toHaveBeenCalled();
  },
);

test("home viewer reuses the rich overview without duplicating static copy", async () => {
  const request = event("owner");
  load.mockResolvedValue({
    copy: { localized: "static" },
    signedIn: true,
    navStats: { user: { id: "owner" } },
    calendarSubscriptionUrl: null,
  });
  const response = await GET(request as never);
  expectPrivate(response);
  expect(await response.json()).toEqual({
    signedIn: true,
    navStats: { user: { id: "owner" } },
    calendarSubscriptionUrl: null,
  });
  expect(load).toHaveBeenCalledWith({
    ...request,
    tab: "overview",
    userId: "owner",
  });
});

test("home viewer keeps missing owners and read failures private", async () => {
  load.mockResolvedValue({ copy: {}, userMissing: true });
  const missing = await GET(event("owner") as never);
  expectPrivate(missing);
  expect(missing.status).toBe(404);
  expect(await missing.json()).toEqual({ signedIn: false });
  load.mockRejectedValue(new Error("private database detail"));
  const failure = await GET(event("owner") as never);
  expectPrivate(failure);
  expect(failure.status).toBe(500);
  expect(await failure.json()).toEqual({
    error: "Failed to load home overview",
  });
  expect(log).toHaveBeenCalledOnce();
});

test("home viewer rejects other methods without caching the response", async () => {
  const response = await fallback(event("owner") as never);
  expectPrivate(response);
  expect(response.status).toBe(405);
  expect(response.headers.get("allow")).toBe("GET");
  expect(load).not.toHaveBeenCalled();
});
