import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { parseTextContent } from "../api/mcp/helpers";
import { test } from "./content-security-fixture";

for (const method of ["Web", "REST", "GraphQL", "MCP"] as const)
  test(`cases.content-security.suspended-user-1 through ${method}`, {
    tag: `@Comment/${method}`,
  }, async ({ page, isolatedWorker, commentSecurityRun }) => {
    test.setTimeout(60_000);
    await commentSecurityRun(method, async (f) => {
      const headers = {
        authorization: `Bearer ${f.token}`,
        cookie: "",
        origin: isolatedWorker.origin,
      };
      const input = {
        targetType: "section",
        sectionJwId: f.section.jwId,
        body: f.marker,
      };
      const graphql = () =>
        page.request.post("/api/graphql", {
          headers: { ...headers, authorization: `Bearer ${f.graphqlToken}` },
          data: {
            query:
              "mutation Create($input: CreateCommentInput!) { commentCreate(input: $input) { id } }",
            variables: { input: { ...input, targetType: "SECTION" } },
          },
        });
      if (method === "REST")
        for (const useBearer of [false, true]) {
          const send = () =>
            page.request.post("/api/community/comments", {
              data: input,
              ...(useBearer ? { headers } : {}),
            });
          const response = useBearer
            ? await f.measure("rest", false, send)
            : await send();
          expect(response.status(), await response.text()).toBe(201);
          const { id } = await response.json();
          expect(id).toEqual(expect.any(String));
          f.commentIds[useBearer ? "rest" : "session"] = id;
        }
      if (method === "GraphQL") {
        const initialGraphql = await f.measure("graphql", false, graphql);
        expect(initialGraphql.status()).toBe(200);
        const initialGraphqlBody = await initialGraphql.json();
        expect(initialGraphqlBody.errors).toBeUndefined();
        expect(initialGraphqlBody.data.commentCreate.id).toEqual(
          expect.any(String),
        );
        f.commentIds.graphql = initialGraphqlBody.data.commentCreate.id;
      }
      if (method === "MCP") {
        const initialMcp = parseTextContent(
          await f.measure("mcp", false, () =>
            f.mcp.callTool({
              name: "community_comment_create",
              arguments: input,
            }),
          ),
        );
        expect(initialMcp).toMatchObject({ success: true });
        expect(initialMcp.id).toEqual(expect.any(String));
        f.commentIds.mcp = initialMcp.id as string;
      }
      const expectedCount = method === "REST" ? 2 : method === "Web" ? 0 : 1;
      expect(await f.db.comment.count({ where: { userId: f.userId } })).toBe(
        expectedCount,
      );
      const beforeSuspension = await f.db.comment.findMany({
        orderBy: { id: "asc" },
      });
      await f.suspend();
      if (method === "REST")
        for (const useBearer of [false, true]) {
          const send = () =>
            page.request.post("/api/community/comments", {
              data: input,
              ...(useBearer ? { headers } : {}),
            });
          const response = useBearer
            ? await f.measure("rest", true, send)
            : await send();
          expect(response.status(), await response.text()).toBe(403);
          expect(await response.json()).toEqual({
            error: "Suspended",
            reason: f.marker,
          });
        }
      if (method === "GraphQL") {
        const blockedGraphql = await f.measure("graphql", true, graphql);
        expect(blockedGraphql.status()).toBe(403);
        expect(await blockedGraphql.json()).toMatchObject({
          errors: [
            {
              message: "Comment writes are suspended.",
              extensions: { code: "FORBIDDEN" },
            },
          ],
        });
      }
      // This is a domain refusal in a successful MCP result, not an isError reply.
      if (method === "MCP")
        expect(
          parseTextContent(
            await f.measure("mcp", false, () =>
              f.mcp.callTool({
                name: "community_comment_create",
                arguments: input,
              }),
            ),
          ),
        ).toMatchObject({
          success: false,
          error: "suspended",
          reason: f.marker,
        });
      if (method === "Web")
        for (const locale of ["en-us", "zh-cn"]) {
          const preference = await page.request.post(
            "/api/account/preferences",
            {
              data: { locale },
            },
          );
          await preference.body();
          expect(preference.status()).toBe(200);
          await gotoAndWaitForReady(
            page,
            `/catalog/sections/${f.section.jwId}`,
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
      expect(await f.db.comment.count({ where: { userId: f.userId } })).toBe(
        expectedCount,
      );
      expect(await f.db.comment.findMany({ orderBy: { id: "asc" } })).toEqual(
        beforeSuspension,
      );
      const grant = await f.db.oAuthConsent.findUniqueOrThrow({
        where: {
          clientId_userId: {
            clientId: f.clients.rest.clientId,
            userId: f.userId,
          },
        },
      });
      expect(grant.scopes).toContain(f.scope);
    });
  });
