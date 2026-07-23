import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  adminCreateOAuthClientMock,
  deleteOAuthClientMock,
  logServerActionErrorMock,
  parseAdminOAuthCreateRequestMock,
  requireAdminPageMock,
} = vi.hoisted(() => ({
  adminCreateOAuthClientMock: vi.fn(),
  deleteOAuthClientMock: vi.fn(),
  logServerActionErrorMock: vi.fn(),
  parseAdminOAuthCreateRequestMock: vi.fn(),
  requireAdminPageMock: vi.fn(),
}));

vi.mock("@/features/admin/server/admin-page-data", () => ({
  requireAdminPage: requireAdminPageMock,
}));

vi.mock("@/features/admin/server/admin-oauth-create-request", () => ({
  parseAdminOAuthCreateRequest: parseAdminOAuthCreateRequestMock,
}));

vi.mock("@/lib/auth/core", () => ({
  authApi: {},
}));

vi.mock("@/lib/oauth/provider-api", () => ({
  asOAuthProviderApi: () => ({
    adminCreateOAuthClient: adminCreateOAuthClientMock,
  }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthClient: {
      delete: deleteOAuthClientMock,
    },
  },
}));

vi.mock("@/lib/log/app-logger", () => ({
  logServerActionError: logServerActionErrorMock,
}));

function request(body = new URLSearchParams()) {
  return new Request("https://life.example/admin/oauth", {
    body,
    method: "POST",
  });
}

describe("admin OAuth action error logging", () => {
  beforeEach(() => {
    adminCreateOAuthClientMock.mockReset();
    deleteOAuthClientMock.mockReset();
    logServerActionErrorMock.mockReset();
    parseAdminOAuthCreateRequestMock.mockReset();
    requireAdminPageMock.mockReset();
    requireAdminPageMock.mockResolvedValue(undefined);
  });

  it("logs unexpected create failures with the request id", async () => {
    parseAdminOAuthCreateRequestMock.mockResolvedValue({
      value: {
        name: "Test client",
        redirectUris: ["https://client.example/callback"],
        scopes: ["openid"],
        tokenEndpointAuthMethod: "client_secret_basic",
      },
    });
    adminCreateOAuthClientMock.mockRejectedValue(new Error("provider failed"));
    const { createAdminOAuthClientAction } = await import(
      "@/features/admin/server/admin-oauth-create-action"
    );

    const result = await createAdminOAuthClientAction(
      request(),
      "en-us",
      "request-create",
    );

    expect(result).toMatchObject({ status: 500 });
    expect(logServerActionErrorMock).toHaveBeenCalledWith(
      "admin.oauth-client.create.failed",
      expect.any(Error),
      {
        action: "create-client",
        requestId: "request-create",
        route: "/admin/oauth",
      },
    );
  });

  it("logs unexpected delete failures but not expected missing clients", async () => {
    const { deleteAdminOAuthClientAction } = await import(
      "@/features/admin/server/admin-oauth-delete-action"
    );
    deleteOAuthClientMock.mockRejectedValueOnce(new Error("database failed"));

    const failure = await deleteAdminOAuthClientAction(
      request(new URLSearchParams({ clientId: "client-1" })),
      "en-us",
      "request-delete",
    );

    expect(failure).toMatchObject({ status: 500 });
    expect(logServerActionErrorMock).toHaveBeenCalledWith(
      "admin.oauth-client.delete.failed",
      expect.any(Error),
      {
        action: "delete-client",
        requestId: "request-delete",
        route: "/admin/oauth",
      },
    );

    logServerActionErrorMock.mockReset();
    deleteOAuthClientMock.mockRejectedValueOnce({ code: "P2025" });
    const missing = await deleteAdminOAuthClientAction(
      request(new URLSearchParams({ clientId: "missing" })),
      "en-us",
      "request-missing",
    );

    expect(missing).toMatchObject({ status: 404 });
    expect(logServerActionErrorMock).not.toHaveBeenCalled();
  });
});
