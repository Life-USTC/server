import { beforeEach, describe, expect, it, vi } from "vitest";

const { listPageMock, resolvePrincipalMock } = vi.hoisted(() => ({
  listPageMock: vi.fn(),
  resolvePrincipalMock: vi.fn(),
}));

vi.mock("@/features/settings/server/account-activity", async (original) => {
  const actual =
    await original<
      typeof import("@/features/settings/server/account-activity")
    >();
  return { ...actual, listOAuthClientActivityPage: listPageMock };
});

vi.mock("@/lib/auth/api-auth", () => ({
  resolveApiPrincipal: resolvePrincipalMock,
}));

import { getAccountClientActivityRoute } from "@/lib/api/routes/account-client-activity-route";

describe("GET /api/account/client-activity", () => {
  beforeEach(() => {
    listPageMock.mockReset();
    resolvePrincipalMock.mockReset();
  });

  it("拒绝 cookie session，避免把全账户活动当作客户端活动暴露", async () => {
    resolvePrincipalMock.mockResolvedValue({
      kind: "session",
      userId: "user-1",
    });
    const response = await getAccountClientActivityRoute(
      new Request("https://life.example/api/account/client-activity"),
    );
    expect(response.status).toBe(401);
    expect(listPageMock).not.toHaveBeenCalled();
  });

  it("只把 verified principal 的 userId+clientId+grantId 传给领域查询", async () => {
    resolvePrincipalMock.mockResolvedValue({
      kind: "oauth",
      userId: "verified-user",
      clientId: "verified-client",
      grantId: "verified-grant",
      scopes: new Set(["account.client-activity:read"]),
    });
    listPageMock.mockResolvedValue({ items: [], nextCursor: null });

    const response = await getAccountClientActivityRoute(
      new Request(
        "https://life.example/api/account/client-activity?userId=attacker&clientId=other&limit=10",
      ),
    );
    expect(response.status).toBe(200);
    expect(listPageMock).toHaveBeenCalledWith(
      {
        userId: "verified-user",
        clientId: "verified-client",
        grantId: "verified-grant",
      },
      { cursor: undefined, limit: 10 },
    );
  });
});
