import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();

vi.mock("better-auth", () => ({
  betterAuth: () => ({ api: { getSession: getSessionMock } }),
}));

vi.mock("@/lib/auth/better-auth-options", () => ({
  buildBetterAuthOptions: () => ({}),
}));

const rawSession = {
  session: { id: "session-1" },
  user: {
    id: "user-1",
    email: "user@example.test",
    name: "User",
  },
};

describe("request-scoped session resolution", () => {
  beforeEach(() => {
    vi.resetModules();
    getSessionMock.mockReset();
  });

  it("shares one Better Auth lookup for the same request headers", async () => {
    getSessionMock.mockResolvedValue(rawSession);
    const { getSessionFromHeaders } = await import("@/lib/auth/core");
    const headers = new Headers({
      cookie: "better-auth.session_token=session-token",
    });

    const [first, second] = await Promise.all([
      getSessionFromHeaders(headers),
      getSessionFromHeaders(headers),
    ]);

    expect(first?.user.id).toBe("user-1");
    expect(second).toEqual(first);
    expect(getSessionMock).toHaveBeenCalledOnce();
  });

  it("does not share sessions across different request header objects", async () => {
    getSessionMock.mockResolvedValue(rawSession);
    const { getSessionFromHeaders } = await import("@/lib/auth/core");

    await getSessionFromHeaders(new Headers({ cookie: "session-token" }));
    await getSessionFromHeaders(new Headers({ cookie: "session-token" }));

    expect(getSessionMock).toHaveBeenCalledTimes(2);
  });
});
