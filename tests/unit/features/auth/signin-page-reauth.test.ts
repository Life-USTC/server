import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionFromHeadersMock } = vi.hoisted(() => ({
  getSessionFromHeadersMock: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

describe("sign-in page reauthentication", () => {
  beforeEach(() => {
    getSessionFromHeadersMock.mockReset().mockResolvedValue({
      user: { id: "admin-1" },
    });
  });

  function input(url: string) {
    return {
      locals: {
        authUser: { id: "admin-1" },
        locale: "en-us",
        publicSsr: false,
        requestId: "request-reauth",
      },
      request: new Request(url, {
        headers: { cookie: "better-auth.session_token=session-token" },
      }),
      url: new URL(url),
    } as never;
  }

  it("keeps the provider chooser open for an authenticated reauthentication request", async () => {
    const { loadSignInPage } = await import(
      "@/features/auth/server/signin-page-server"
    );

    await expect(
      loadSignInPage(
        input(
          "https://life.example/account/sign-in?reauth=1&callbackUrl=%2Fadmin%2Fbus",
        ),
      ),
    ).resolves.toMatchObject({
      callbackUrl: "/admin/bus",
      reauthentication: true,
      copy: {
        reauthenticationRequired: expect.stringMatching(/sign in again/i),
      },
    });
  });

  it("continues redirecting an existing session during ordinary sign-in", async () => {
    const { loadSignInPage } = await import(
      "@/features/auth/server/signin-page-server"
    );

    await expect(
      loadSignInPage(
        input(
          "https://life.example/account/sign-in?callbackUrl=%2Fadmin%2Fbus",
        ),
      ),
    ).rejects.toMatchObject({ location: "/admin/bus", status: 303 });
  });
});
