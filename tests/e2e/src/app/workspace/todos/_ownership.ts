import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  type APIRequestContext,
  test as base,
  expect,
  type Page,
} from "@playwright/test";
import { sha256Base64Url } from "../../../../../shared/crypto";
import { PLAYWRIGHT_BASE_URL as BASE } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";

export { BASE, expect };
export const roles = ["member", "suspended administrator"] as const;
type Role = (typeof roles)[number];
export const stored = (id: string) =>
  withE2ePrisma((db) => db.todo.findUnique({ where: { id } }));
async function arrange(role: Role, ids: string[]) {
  return withE2ePrisma((db) =>
    db.$transaction(async (tx) => {
      const actors = [];
      for (const [index, id] of ids.entries()) {
        const isAdmin =
          index === 0 ? role === "suspended administrator" : role === "member";
        const name = `todo-${id.slice(0, 12)}`;
        const user = await tx.user.create({
          data: {
            id,
            name,
            username: name,
            email: `${id}@example.test`,
            emailVerified: true,
            isAdmin,
          },
        });
        if (isAdmin)
          await tx.userSuspension.create({
            data: { userId: id, reason: "Personal todos remain available" },
          });
        const todo = await tx.todo.create({
          data: {
            userId: id,
            title: `${name} private title`,
            content: `${name} secret content`,
          },
        });
        actors.push({ ...user, todo });
      }
      return { actor: actors[0], other: actors[1] };
    }),
  );
}
type Actors = Awaited<ReturnType<typeof arrange>>;
type Ownership = Actors & {
  page: () => Promise<Page>;
  anonymous: () => Promise<APIRequestContext>;
  request: (
    mode: "cookie" | "oauth",
    channel: "rest" | "graphql",
  ) => Promise<APIRequestContext>;
  mcp: () => Promise<Client>;
  seedCompleted: () => Promise<string>;
  unchanged: (additionalOwnedIds?: string[]) => Promise<void>;
};

export const test = base.extend<{ ownership: Ownership; ownerRole: Role }>({
  ownerRole: ["member", { option: true }],
  ownership: async ({ browser, playwright, ownerRole }, use) => {
    const userIds = [crypto.randomUUID(), crypto.randomUUID()];
    const clientNames: string[] = [];
    const close: (() => Promise<void>)[] = [];
    const errors: unknown[] = [];
    try {
      const actors = await arrange(ownerRole, userIds);
      const anonymous = async () => {
        const request = await playwright.request.newContext({ baseURL: BASE });
        close.push(() => request.dispose());
        return request;
      };
      const page = async () => {
        const context = await browser.newContext({
          baseURL: BASE,
          viewport: { width: 390, height: 900 },
        });
        close.push(() => context.close());
        await context.addCookies([
          await createSignedSessionCookie(actors.actor.id),
          { name: "NEXT_LOCALE", value: "en-us", url: BASE },
        ]);
        return context.newPage();
      };
      const token = async (channel: "rest" | "graphql" | "mcp") => {
        const request = await anonymous();
        const clientName = `todo-ownership-${crypto.randomUUID()}`;
        // Register ownership before the request: a lost response must not leak the client.
        clientNames.push(clientName);
        const scope = "workspace.todo:read workspace.todo:write";
        const redirectUri = `${BASE}/e2e/oauth/callback`;
        const resource = `${BASE}/api/${channel === "rest" ? "auth" : channel}`;
        const registration = await request.post("/api/auth/oauth2/register", {
          data: {
            application_type: "native",
            client_name: clientName,
            redirect_uris: [redirectUri],
            token_endpoint_auth_method: "none",
            grant_types: ["authorization_code"],
            response_types: ["code"],
            scope,
          },
        });
        expect(registration.status()).toBe(201);
        const { client_id: clientId } = await registration.json();
        expect(typeof clientId).toBe("string");
        const consent = await page();
        const verifier = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
        const state = crypto.randomUUID();
        const authorization = await consent.request.get(
          "/api/auth/oauth2/authorize",
          {
            maxRedirects: 0,
            params: {
              response_type: "code",
              client_id: clientId,
              redirect_uri: redirectUri,
              scope,
              state,
              prompt: "consent",
              code_challenge: await sha256Base64Url(verifier),
              code_challenge_method: "S256",
              resource,
            },
          },
        );
        expect(authorization.status()).toBe(302);
        expect(authorization.headers().location).toContain("/oauth/authorize?");
        await consent.goto(authorization.headers().location);
        await expect(
          consent.getByText(/回调主机|Redirect host/i),
        ).toBeVisible();
        await expect(
          consent.getByText(/本地应用|application on your device/i),
        ).toBeVisible();
        await consent.getByRole("button", { name: /允许|Allow/i }).click();
        await consent.waitForURL("**/e2e/oauth/callback**");
        const callback = new URL(consent.url());
        expect(callback.searchParams.get("state")).toBe(state);
        const code = callback.searchParams.get("code");
        expect(code).toBeTruthy();
        if (!code) throw new Error("Missing authorization code");
        const exchanged = await request.post("/api/auth/oauth2/token", {
          form: {
            grant_type: "authorization_code",
            client_id: clientId,
            code,
            code_verifier: verifier,
            redirect_uri: redirectUri,
            resource,
          },
        });
        expect(exchanged.status()).toBe(200);
        const body = await exchanged.json();
        expect(typeof body.access_token).toBe("string");
        return { accessToken: body.access_token as string, resource };
      };
      await use({
        ...actors,
        page,
        anonymous,
        request: async (mode, channel) => {
          if (mode === "cookie") return (await page()).request;
          const { accessToken } = await token(channel);
          const request = await playwright.request.newContext({
            baseURL: BASE,
            extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
          });
          close.push(() => request.dispose());
          return request;
        },
        mcp: async () => {
          const { accessToken, resource } = await token("mcp");
          const transport = new StreamableHTTPClientTransport(
            new URL(resource),
            {
              requestInit: {
                headers: { Authorization: `Bearer ${accessToken}` },
              },
            },
          );
          const client = new Client({
            name: "todo-owner-contract",
            version: "1",
          });
          close.push(
            () => transport.close(),
            () => client.close(),
          );
          await client.connect(transport);
          return client;
        },
        seedCompleted: async () =>
          (
            await withE2ePrisma((db) =>
              db.todo.create({
                data: {
                  userId: actors.actor.id,
                  title: "Batch owned",
                  completed: true,
                },
              }),
            )
          ).id,
        unchanged: async (additionalOwnedIds = []) => {
          const ids = await withE2ePrisma((db) =>
            db.todo.findMany({
              where: { userId: { in: userIds } },
              select: { id: true },
            }),
          );
          expect(ids.map((row) => row.id).sort()).toEqual(
            [
              actors.actor.todo.id,
              actors.other.todo.id,
              ...additionalOwnedIds,
            ].sort(),
          );
          expect(await stored(actors.actor.todo.id)).toEqual(actors.actor.todo);
          expect(await stored(actors.other.todo.id)).toEqual(actors.other.todo);
        },
      });
    } catch (error) {
      errors.push(error);
    } finally {
      // All transports finish before removing state, even if setup/connect/assertions fail.
      for (const dispose of close.reverse()) {
        try {
          await dispose();
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        await withE2ePrisma((db) =>
          db.$transaction(async (tx) => {
            const clients = await tx.oAuthClient.findMany({
              where: { name: { in: clientNames } },
              select: { clientId: true },
            });
            const clientIds = clients.map((client) => client.clientId);
            // Better Auth stores authorization-code payloads as JSON text, without a user FK.
            await tx.verificationToken.deleteMany({
              where: {
                OR: userIds.map((id) => ({
                  token: { contains: `"userId":"${id}"` },
                })),
              },
            });
            await tx.auditLog.deleteMany({
              where: {
                OR: [
                  { userId: { in: userIds } },
                  { subjectUserId: { in: userIds } },
                  { oauthClientId: { in: clientIds } },
                ],
              },
            });
            await tx.featureOperationEvent.deleteMany({
              where: { userId: { in: userIds } },
            });
            await tx.oAuthClient.deleteMany({
              where: { clientId: { in: clientIds } },
            });
            await tx.user.deleteMany({ where: { id: { in: userIds } } });
          }),
        );
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, "Todo ownership fixture failed");
  },
});

export const listQuery =
  "{ workspace { todos { items { id title content completed } } } }";
export const createQuery =
  "mutation($input: CreateTodoInput!) { todoCreate(input: $input) { id } }";
export const updateQuery =
  "mutation($id: ID!, $input: UpdateTodoInput!) { todoUpdate(id: $id, input: $input) { id } }";
export const deleteQuery =
  "mutation($id: ID!) { todoDelete(id: $id) { id success } }";
export async function graphql(
  request: APIRequestContext,
  query: string,
  variables = {},
) {
  return (
    await request.post("/api/graphql", {
      headers: { origin: BASE },
      data: { query, variables },
    })
  ).json();
}
