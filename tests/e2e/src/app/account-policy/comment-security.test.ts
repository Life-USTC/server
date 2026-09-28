import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, test } from "@playwright/test";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { DEV_SEED } from "../../../utils/dev-seed";
import {
  createOAuthClientFixture,
  deleteOAuthClientsByName,
  PLAYWRIGHT_BASE_URL,
} from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { authorizeDeviceBearer } from "../../../utils/oauth-device-bearer";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";
import { parseTextContent } from "../api/mcp/helpers";

test("cases.content-security.suspended-user-1", async ({ page }) => {
  test.setTimeout(60_000);
  const marker = `comment-security-${crypto.randomUUID()}`;
  const scope = restWriteScope("community.comment");
  const user = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        name: "Comment security user",
        username: `cs${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}@example.test`,
      },
    }),
  );
  const client = await createOAuthClientFixture({
    name: marker,
    scopes: [scope],
    grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
    tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  });
  const mcpClient = await createOAuthClientFixture({
    name: marker,
    scopes: [scope],
    grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
    tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  });
  const graphqlClient = await createOAuthClientFixture({
    name: marker,
    scopes: [scope],
    grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
    tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  });
  const mcp = new Client({ name: "comment-security", version: "1.0.0" });
  try {
    await page.context().addCookies([await createSignedSessionCookie(user.id)]);
    const token = await authorizeDeviceBearer(
      page.request,
      PLAYWRIGHT_BASE_URL,
      client.clientId,
      scope,
    );
    const mcpToken = await authorizeDeviceBearer(
      page.request,
      PLAYWRIGHT_BASE_URL,
      mcpClient.clientId,
      scope,
      "/api/mcp",
    );
    const graphqlToken = await authorizeDeviceBearer(
      page.request,
      PLAYWRIGHT_BASE_URL,
      graphqlClient.clientId,
      scope,
      "/api/graphql",
    );
    const headers = {
      authorization: `Bearer ${token}`,
      cookie: "",
      origin: PLAYWRIGHT_BASE_URL,
    };
    await mcp.connect(
      new StreamableHTTPClientTransport(
        new URL(`${PLAYWRIGHT_BASE_URL}/api/mcp`),
        { requestInit: { headers: { authorization: `Bearer ${mcpToken}` } } },
      ),
    );
    const input = {
      targetType: "section",
      sectionJwId: DEV_SEED.section.jwId,
      body: marker,
    };
    const graphql = () =>
      page.request.post("/api/graphql", {
        headers: { ...headers, authorization: `Bearer ${graphqlToken}` },
        data: {
          query:
            "mutation Create($input: CreateCommentInput!) { commentCreate(input: $input) { id } }",
          variables: { input: { ...input, targetType: "SECTION" } },
        },
      });
    for (const useBearer of [false, true]) {
      const response = await page.request.post("/api/community/comments", {
        data: input,
        ...(useBearer ? { headers } : {}),
      });
      expect(response.status(), await response.text()).toBe(201);
    }
    const initialGraphql = await graphql();
    expect(initialGraphql.status()).toBe(200);
    const initialGraphqlBody = await initialGraphql.json();
    expect(initialGraphqlBody.errors).toBeUndefined();
    expect(initialGraphqlBody.data.commentCreate.id).toEqual(
      expect.any(String),
    );
    expect(
      parseTextContent(
        await mcp.callTool({
          name: "community_comment_create",
          arguments: input,
        }),
      ),
    ).toMatchObject({ success: true });
    expect(
      await withE2ePrisma((db) =>
        db.comment.count({ where: { userId: user.id } }),
      ),
    ).toBe(4);
    await withE2ePrisma((db) =>
      db.userSuspension.create({ data: { userId: user.id, reason: marker } }),
    );
    for (const useBearer of [false, true]) {
      const response = await page.request.post("/api/community/comments", {
        data: input,
        ...(useBearer ? { headers } : {}),
      });
      expect(response.status(), await response.text()).toBe(403);
      expect(await response.json()).toEqual({
        error: "Suspended",
        reason: marker,
      });
    }
    const blockedGraphql = await graphql();
    expect(blockedGraphql.status()).toBe(403);
    expect(await blockedGraphql.json()).toMatchObject({
      errors: [
        {
          message: "Comment writes are suspended.",
          extensions: { code: "FORBIDDEN" },
        },
      ],
    });
    expect(
      parseTextContent(
        await mcp.callTool({
          name: "community_comment_create",
          arguments: input,
        }),
      ),
    ).toMatchObject({ success: false, error: "suspended", reason: marker });
    for (const locale of ["en-us", "zh-cn"]) {
      expect(
        (
          await page.request.post("/api/account/preferences", {
            data: { locale },
          })
        ).status(),
      ).toBe(200);
      await gotoAndWaitForReady(
        page,
        `/catalog/sections/${DEV_SEED.section.jwId}`,
      );
      await expect(
        page.locator("#comments").getByRole("heading", {
          name: locale === "en-us" ? "Account Suspended" : "账号已被封禁",
        }),
      ).toBeVisible();
      await page
        .locator("#comments")
        .getByRole("button", {
          name: locale === "en-us" ? "Post comment" : "发布评论",
          exact: true,
        })
        .click();
      await expect(page.locator("#comments textarea")).toBeDisabled();
    }
    expect(
      await withE2ePrisma((db) =>
        db.comment.count({ where: { userId: user.id } }),
      ),
    ).toBe(4);
    const grant = await withE2ePrisma((db) =>
      db.oAuthConsent.findUniqueOrThrow({
        where: {
          clientId_userId: { clientId: client.clientId, userId: user.id },
        },
      }),
    );
    expect(grant.scopes).toContain(scope);
  } finally {
    await mcp.close();
    await withE2ePrisma(async (db) => {
      await db.comment.deleteMany({ where: { userId: user.id } });
      await db.auditLog.deleteMany({ where: { userId: user.id } });
    });
    await deleteOAuthClientsByName(marker);
    await withE2ePrisma((db) => db.user.delete({ where: { id: user.id } }));
  }
});
