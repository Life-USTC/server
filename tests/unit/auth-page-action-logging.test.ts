import type { Cookies } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  linkAccountFromSvelteActionMock,
  logServerActionErrorMock,
  requireSettingsUserMock,
  signInFromSvelteActionMock,
  unlinkSettingsAccountMock,
} = vi.hoisted(() => ({
  linkAccountFromSvelteActionMock: vi.fn(),
  logServerActionErrorMock: vi.fn(),
  requireSettingsUserMock: vi.fn(),
  signInFromSvelteActionMock: vi.fn(),
  unlinkSettingsAccountMock: vi.fn(),
}));

vi.mock("@/lib/auth/svelte-auth-actions", () => ({
  applyAuthResponseCookies: vi.fn(),
  linkAccountFromSvelteAction: linkAccountFromSvelteActionMock,
  signInFromSvelteAction: signInFromSvelteActionMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logServerActionError: logServerActionErrorMock,
}));

vi.mock("@/features/settings/server/settings-page-data", () => ({
  requireSettingsUser: requireSettingsUserMock,
}));

vi.mock("@/lib/auth/core", () => ({
  authApi: { signOut: vi.fn() },
}));

vi.mock("@/features/settings/server/account-deletion-service", () => ({
  deleteOwnAccount: vi.fn(),
}));

vi.mock("@/features/settings/server/settings-account-unlink", () => ({
  unlinkSettingsAccount: unlinkSettingsAccountMock,
}));

import { signInPageDefaultAction } from "@/features/auth/server/signin-page-server";
import {
  linkSettingsAccountAction,
  unlinkSettingsAccountAction,
} from "@/features/settings/server/settings-account-actions";

const cookies = {} as Cookies;

describe("auth page action logging", () => {
  beforeEach(() => {
    linkAccountFromSvelteActionMock.mockReset();
    logServerActionErrorMock.mockReset();
    requireSettingsUserMock.mockReset();
    signInFromSvelteActionMock.mockReset();
    unlinkSettingsAccountMock.mockReset();
    requireSettingsUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("records unexpected sign-in action failures with the request id", async () => {
    const privateError = new TypeError("private provider detail");
    signInFromSvelteActionMock.mockRejectedValue(privateError);

    const result = await signInPageDefaultAction({
      cookies,
      locals: {
        authUser: null,
        locale: "zh-cn",
        requestId: "request-1",
      },
      request: new Request("https://life.example/signin", {
        body: new URLSearchParams({
          callbackUrl: "/",
          providerId: "github",
        }),
        method: "POST",
      }),
    });

    expect(result.status).toBe(400);
    expect(logServerActionErrorMock).toHaveBeenCalledWith(
      "auth.signin.failed",
      privateError,
      {
        action: "signin",
        requestId: "request-1",
        route: "/signin",
      },
    );
  });

  it("records unexpected account-link failures with the request id", async () => {
    const privateError = new TypeError("private provider detail");
    linkAccountFromSvelteActionMock.mockRejectedValue(privateError);
    const request = new Request("https://life.example/settings/accounts", {
      body: new URLSearchParams({ providerId: "github" }),
      method: "POST",
    });

    const result = await linkSettingsAccountAction({
      cookies,
      locale: "zh-cn",
      request,
      requestId: "request-2",
      url: new URL(request.url),
    });

    expect(result.status).toBe(400);
    expect(logServerActionErrorMock).toHaveBeenCalledWith(
      "settings.account-link.failed",
      privateError,
      {
        action: "link-account",
        requestId: "request-2",
        route: "/settings/accounts",
      },
    );
  });

  it.each([
    ["last_account", 400],
    ["not_linked", 404],
  ] as const)("maps unlink status %s to %i", async (status, expectedStatus) => {
    unlinkSettingsAccountMock.mockResolvedValue(status);
    const request = new Request(
      "https://life.example/account/settings/accounts",
      {
        body: new URLSearchParams({ provider: "github" }),
        method: "POST",
      },
    );

    const result = await unlinkSettingsAccountAction({
      locale: "zh-cn",
      request,
      url: new URL(request.url),
    });

    expect(result.status).toBe(expectedStatus);
    expect(unlinkSettingsAccountMock).toHaveBeenCalledWith("user-1", "github");
  });

  it("redirects after unlinking the account", async () => {
    unlinkSettingsAccountMock.mockResolvedValue("unlinked");
    const request = new Request(
      "https://life.example/account/settings/accounts",
      {
        body: new URLSearchParams({ provider: "github" }),
        method: "POST",
      },
    );

    await expect(
      unlinkSettingsAccountAction({
        locale: "zh-cn",
        request,
        url: new URL(request.url),
      }),
    ).rejects.toMatchObject({
      location: "/account/settings/accounts?message=AccountDisconnected",
      status: 303,
    });
  });
});
