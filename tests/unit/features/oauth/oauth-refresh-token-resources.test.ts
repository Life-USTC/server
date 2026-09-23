import { beforeEach, describe, expect, it, vi } from "vitest";
import { persistRefreshTokenResources } from "@/features/oauth/server/refresh-token-resources.server";
import { OAUTH_REFRESH_TOKEN_GRANT_TYPE } from "@/lib/oauth/constants";

const AUTH_RESOURCE = "https://life.example/api/auth";
const GRAPHQL_RESOURCE = "https://life.example/api/graphql";
const MCP_RESOURCE = "https://life.example/api/mcp";

vi.mock("@/lib/oauth/resource-urls", () => ({
  getOAuthProviderValidAudiences: () => [
    AUTH_RESOURCE,
    GRAPHQL_RESOURCE,
    MCP_RESOURCE,
  ],
}));

describe("OAuth refresh token resources", () => {
  const findUnique = vi.fn();
  const updateMany = vi.fn();
  const prisma = {
    oAuthRefreshToken: {
      findUnique,
      updateMany,
    },
  };

  beforeEach(() => {
    findUnique.mockReset();
    updateMany.mockReset();
    findUnique.mockResolvedValue({
      resources: [GRAPHQL_RESOURCE, MCP_RESOURCE],
    });
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("显式 resource 只持久化请求值与旧批准值的交集", async () => {
    await expect(
      persistRefreshTokenResources({
        grantType: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
        issuedRefreshToken: "new-refresh",
        prisma,
        refreshToken: "old-refresh",
        resourceValues: [GRAPHQL_RESOURCE],
      }),
    ).resolves.toMatchObject({ persisted: true, resourceCount: 1 });

    expect(updateMany).toHaveBeenCalledWith({
      where: { token: expect.any(String) },
      data: { resources: [GRAPHQL_RESOURCE] },
    });
  });

  it("省略 resource 才继承旧 refresh 的全部批准资源", async () => {
    await expect(
      persistRefreshTokenResources({
        grantType: OAUTH_REFRESH_TOKEN_GRANT_TYPE,
        issuedRefreshToken: "new-refresh",
        prisma,
        refreshToken: "old-refresh",
        resourceValues: [],
      }),
    ).resolves.toMatchObject({ persisted: true, resourceCount: 2 });

    expect(updateMany).toHaveBeenCalledWith({
      where: { token: expect.any(String) },
      data: { resources: [GRAPHQL_RESOURCE, MCP_RESOURCE] },
    });
  });
});
