import type { Cookies } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  accountFindFirstMock,
  getSessionFromHeadersMock,
  linkAccountFromSvelteActionMock,
  logServerActionErrorMock,
} = vi.hoisted(() => ({
  accountFindFirstMock: vi.fn(),
  getSessionFromHeadersMock: vi.fn(),
  linkAccountFromSvelteActionMock: vi.fn(),
  logServerActionErrorMock: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock("@/lib/auth/svelte-auth-actions", () => ({
  linkAccountFromSvelteAction: linkAccountFromSvelteActionMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    account: {
      findFirst: accountFindFirstMock,
    },
  },
}));

vi.mock("@/lib/log/app-logger", () => ({
  logServerActionError: logServerActionErrorMock,
}));

import { refreshWelcomeOAuthProfile } from "@/features/welcome/server/welcome-oauth-refresh-action";

const cookies = {} as Cookies;
const locals = {
  authUser: null,
  locale: "en-us" as const,
  publicSsr: false,
  requestId: "request-1",
};

function request(providerId: string) {
  return new Request("https://life.example/account/welcome?/refreshOAuth", {
    body: new URLSearchParams({
      callbackUrl: "/account/settings",
      providerId,
    }),
    method: "POST",
  });
}

describe("refreshWelcomeOAuthProfile", () => {
  beforeEach(() => {
    accountFindFirstMock.mockReset();
    getSessionFromHeadersMock.mockReset();
    linkAccountFromSvelteActionMock.mockReset();
    logServerActionErrorMock.mockReset();
    getSessionFromHeadersMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("reauthorizes only a provider linked to the current user", async () => {
    accountFindFirstMock.mockResolvedValue({ id: "account-1" });
    linkAccountFromSvelteActionMock.mockResolvedValue({
      url: "https://provider.example/authorize",
    });

    await expect(
      refreshWelcomeOAuthProfile({
        cookies,
        locals,
        request: request("github"),
      }),
    ).rejects.toMatchObject({
      location: "https://provider.example/authorize",
      status: 303,
    });
    expect(accountFindFirstMock).toHaveBeenCalledWith({
      where: { userId: "user-1", provider: "github" },
      select: { id: true },
    });
    expect(linkAccountFromSvelteActionMock).toHaveBeenCalledWith({
      providerId: "github",
      callbackUrl:
        "/account/welcome?callbackUrl=%2Faccount%2Fsettings&oauthRefreshed=1",
      headers: expect.any(Headers),
      cookies,
    });
  });

  it("rejects a provider that is not linked to the current user", async () => {
    accountFindFirstMock.mockResolvedValue(null);

    const result = await refreshWelcomeOAuthProfile({
      cookies,
      locals,
      request: request("google"),
    });

    expect(result.status).toBe(400);
    expect(result.data).toEqual({
      message: "That sign-in account is not linked to the current user.",
    });
    expect(linkAccountFromSvelteActionMock).not.toHaveBeenCalled();
  });
});
