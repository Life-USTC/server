import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  type APIRequestContext,
  type APIResponse,
  type Request as BrowserRequest,
  expect,
  type Page,
} from "@playwright/test";
import type { Todo } from "../../../../../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "../../../../../shared/prisma";
import { withBrowserWorkflow } from "../../../../utils/browser-workflow";
import { test as workerTest } from "../../../../utils/owned-worker";
import { withSettledPageWrites } from "../../../../utils/settled-page-writes";
import { issueAccessToken } from "../../api/mcp/helpers";

export { expect };
export const roles = ["member", "suspended administrator"] as const;
type Role = (typeof roles)[number];
async function arrange(db: TestPrismaClient, role: Role, ids: string[]) {
  return db.$transaction(async (tx) => {
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
  });
}

type Actors = Awaited<ReturnType<typeof arrange>>;
type BrowserWorkflow = Parameters<Parameters<typeof withBrowserWorkflow>[1]>[0];
type Ownership = Actors & {
  origin: string;
  db: TestPrismaClient;
  run: (
    work: () => Promise<void>,
    effects: { calendarRebuilds: number },
  ) => Promise<void>;
  page: () => Promise<Page>;
  anonymous: () => Promise<APIRequestContext>;
  request: (
    mode: "cookie" | "oauth",
    channel: "rest" | "graphql",
  ) => Promise<APIRequestContext>;
  mcp: () => Promise<Client>;
  stored: (id: string) => Promise<Todo | null>;
  graphql: (
    request: APIRequestContext,
    query: string,
    variables?: object,
  ) => ReturnType<APIResponse["json"]>;
  seedCompleted: () => Promise<string>;
  unchanged: (additionalOwnedIds?: string[]) => Promise<void>;
};
type Producer = {
  backgroundErrors: string[];
  requests: {
    outcome: string;
    value: { method: string; path: string };
    result: number;
  }[];
  messages: { outcome: string; value: { type: string; userId: string } }[];
  purges: { outcome: string }[];
};
type Consumer = {
  attempts: {
    id: string;
    attempts: number;
    userId: string;
    ackCalls: number;
    retryCalls: number;
    complete: boolean;
    errors: string[];
  }[];
};

export const test = workerTest.extend<{
  ownership: Ownership;
  ownerRole: Role;
  ownershipPage: Page | null;
}>({
  ownerRole: ["member", { option: true }],
  ownershipPage: null,
  ownership: async (
    {
      isolatedWorker,
      request: observer,
      playwright,
      run,
      ownershipPage,
      ownerRole,
    },
    use,
    testInfo,
  ) => {
    const db = isolatedWorker.database.owner;
    const origin = isolatedWorker.origin;
    const userIds = [crypto.randomUUID(), crypto.randomUUID()];
    const clientNames: string[] = [];
    const close: (() => Promise<void>)[] = [];
    const errors: unknown[] = [];
    const secret = { "x-test-storage-secret": "local-test-storage-observer" };
    const probeId = crypto.randomUUID();
    const probePath = "/__test/community-effects?id=" + probeId;
    const headers = { ...secret, "x-test-community-probe": probeId };
    let registered = false;
    let closing = false;
    let operation: Promise<void> | undefined;
    let actualBody: Promise<void> | undefined;
    let completed = false;
    let calendarRebuilds = 0;
    let actors: Actors | undefined;

    function requireOpen() {
      if (closing) throw new Error("Todo ownership fixture is closing");
    }
    function own(dispose: () => Promise<void>) {
      let disposed: Promise<void> | undefined;
      const finish = () => (disposed ??= Promise.resolve().then(dispose));
      close.push(finish);
      return finish;
    }
    async function newRequest(extraHTTPHeaders: Record<string, string> = {}) {
      requireOpen();
      const request = await playwright.request.newContext({
        baseURL: origin,
        extraHTTPHeaders: { ...headers, ...extraHTTPHeaders },
      });
      const dispose = own(() => request.dispose());
      if (closing) {
        await dispose();
        requireOpen();
      }
      return request;
    }
    const stored = (id: string) => db.todo.findUnique({ where: { id } });
    let finalization: Promise<void> | undefined;
    function finalize() {
      finalization ??= (async () => {
        const errors: unknown[] = [];
        closing = true;
        if (ownershipPage) {
          try {
            await ownershipPage.close();
          } catch (error) {
            errors.push(error);
          }
        }
        for (const dispose of close.reverse()) {
          try {
            await dispose();
          } catch (error) {
            errors.push(error);
          }
        }
        if (registered && actors) {
          try {
            const response = await observer.get(probePath, { headers: secret });
            expect(response.status()).toBe(200);
            const producer: Producer = await response.json();
            // Drain every registered actor before asserting counts, including
            // when an earlier business assertion interrupted a partial journey.
            const consumers: Record<string, Consumer> = {};
            const settled = await Promise.allSettled(
              userIds.map(async (userId) => {
                const expected = producer.messages.filter(
                  (message) => message.value.userId === userId,
                ).length;
                await expect
                  .poll(
                    async () => {
                      const response = await observer.get(
                        "/__test/calendar-consumer?userId=" + userId,
                        {
                          headers: secret,
                        },
                      );
                      expect(response.status()).toBe(200);
                      const consumer: Consumer = await response.json();
                      consumers[userId] = consumer;
                      return (
                        consumer.attempts.length >= expected &&
                        consumer.attempts.every((attempt) => attempt.complete)
                      );
                    },
                    {
                      timeout: 15_000,
                      message:
                        "Todo calendar consumers finish their native work",
                    },
                  )
                  .toBe(true);
              }),
            );
            const failed = settled.flatMap((result) =>
              result.status === "rejected" ? [result.reason] : [],
            );
            if (failed.length)
              throw new AggregateError(
                failed,
                "Todo calendar consumers did not settle",
              );

            expect(producer.backgroundErrors).toEqual([]);
            expect(producer.requests.length).toBeGreaterThan(0);
            for (const request of producer.requests)
              expect(request.outcome).toBe("fulfilled");
            expect(producer.purges).toEqual([]);
            for (const message of producer.messages)
              expect(message).toEqual({
                outcome: "fulfilled",
                value: { type: "user", userId: actors.actor.id },
              });
            if (completed)
              expect(producer.messages).toHaveLength(calendarRebuilds);

            for (const userId of userIds) {
              const expected =
                userId === actors.actor.id
                  ? completed
                    ? calendarRebuilds
                    : producer.messages.length
                  : 0;
              const consumer = consumers[userId];
              expect(consumer.attempts).toHaveLength(expected);
              expect(
                new Set(consumer.attempts.map((attempt) => attempt.id)).size,
              ).toBe(expected);
              for (const attempt of consumer.attempts)
                expect(attempt).toMatchObject({
                  attempts: 1,
                  userId,
                  ackCalls: 1,
                  retryCalls: 0,
                  complete: true,
                  errors: [],
                });
            }
            await testInfo.attach("todo-ownership-effects", {
              body: JSON.stringify({
                database: isolatedWorker.database.name,
                origin,
                clientNames,
                completed,
                calendarRebuilds,
                producer,
                consumers,
              }),
              contentType: "application/json",
            });
          } catch (error) {
            errors.push(error);
          } finally {
            try {
              expect(
                (
                  await observer.delete(probePath, { headers: secret })
                ).status(),
              ).toBe(204);
            } catch (error) {
              errors.push(error);
            }
          }
        }
        if (errors.length)
          throw new AggregateError(
            errors,
            "Todo ownership effects and cleanup failed",
          );
      })();
      return finalization;
    }
    async function withEffects(work: () => Promise<void>) {
      const outcomes = await Promise.allSettled([Promise.resolve().then(work)]);
      // The page-write wrapper has now fulfilled its submitted responses and
      // closed the page. Keep API/SDK contexts alive until the actual callback
      // completes too, including its final persisted-state observations.
      if (actualBody)
        outcomes.push(...(await Promise.allSettled([actualBody])));
      outcomes.push(...(await Promise.allSettled([finalize()])));
      const failures = [
        ...new Set(
          outcomes.flatMap((outcome) =>
            outcome.status === "rejected" ? [outcome.reason] : [],
          ),
        ),
      ];
      if (failures.length === 1) throw failures[0];
      if (failures.length)
        throw new AggregateError(failures, "Todo workflow and effects failed");
    }
    async function observeBrowserWrite(
      response: APIResponse,
      request: BrowserRequest,
    ) {
      if (!actors) throw new Error("Todo actors were not arranged");
      const url = new URL(request.url());
      const body = await response.text();
      expect(response.status()).toBe(200);
      if (url.pathname.startsWith("/api/workspace/todos/")) {
        expect(request.method()).toBe("DELETE");
        expect(JSON.parse(body)).toMatchObject({ success: true });
        const id = decodeURIComponent(
          url.pathname.slice("/api/workspace/todos/".length),
        );
        expect(await stored(id)).toBeNull();
        return;
      }
      const form = await new Request(request.url(), {
        method: request.method(),
        headers: request.headers(),
        body: request.postData() ?? "",
      }).formData();
      expect(JSON.parse(body)).toMatchObject({ type: "redirect", status: 303 });
      if (url.pathname === "/oauth/authorize") {
        expect(form.get("accept")).toBe("true");
        const clientId = new URLSearchParams(
          String(form.get("oauthQuery")),
        ).get("client_id");
        expect(clientId).toBeTruthy();
        if (!clientId) throw new Error("OAuth consent has no client ID");
        const consent = await db.oAuthConsent.findUnique({
          where: { clientId_userId: { clientId, userId: actors.actor.id } },
        });
        expect(consent).toMatchObject({
          clientId,
          userId: actors.actor.id,
          scopes: expect.arrayContaining([
            "workspace.todo:read",
            "workspace.todo:write",
          ]),
        });
        return;
      }
      expect(url.pathname).toBe("/workspace/todos");
      expect(JSON.parse(body)).toMatchObject({ location: "/workspace/todos" });
      const id = form.get("id");
      const title = String(form.get("title") ?? "").trim();
      const rows = await db.todo.findMany({
        where: {
          userId: actors.actor.id,
          ...(id ? { id: String(id) } : { title }),
        },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        title,
        content: String(form.get("content") ?? "").trim() || null,
        priority: String(form.get("priority")),
      });
    }
    try {
      actors = await run(() => arrange(db, ownerRole, userIds));
      const arranged = actors;
      expect(
        (await observer.post(probePath, { headers: secret })).status(),
      ).toBe(201);
      registered = true;
      for (const userId of userIds) {
        expect(
          (
            await observer.post("/__test/calendar-consumer?userId=" + userId, {
              headers: secret,
            })
          ).status(),
        ).toBe(201);
      }
      let session: ReturnType<typeof isolatedWorker.createSession> | undefined;
      const actorSession = () => {
        requireOpen();
        session ??= run(() => isolatedWorker.createSession(arranged.actor.id));
        return session;
      };
      const anonymous = () => newRequest();
      const page = async () => {
        requireOpen();
        if (!ownershipPage)
          throw new Error(
            "This ownership scenario must use browserTest for real UI",
          );
        const actor = await actorSession();
        await ownershipPage.context().setExtraHTTPHeaders(headers);
        await ownershipPage
          .context()
          .addCookies([
            actor.cookie,
            { name: "NEXT_LOCALE", value: "en-us", url: origin },
          ]);
        return ownershipPage;
      };
      const token = async (channel: "rest" | "graphql" | "mcp") => {
        const request = await anonymous();
        const consent = await page();
        const resource = `${origin}/api/${channel === "rest" ? "auth" : channel}`;
        const scopes = ["workspace.todo:read", "workspace.todo:write"];
        const { accessToken } = await issueAccessToken(consent, request, {
          scope: scopes.join(" "),
          clientScopes: scopes,
          owner: { worker: isolatedWorker, clientNames },
          resource,
        });
        return { accessToken, resource };
      };

      const provide = async (workflow?: BrowserWorkflow) => {
        try {
          await use({
            ...arranged,
            origin,
            db,
            stored,
            page,
            anonymous,
            run: (work, effects) => {
              if (closing || operation)
                return Promise.reject(
                  new Error(
                    "Todo ownership workflow is already owned or closing",
                  ),
                );
              calendarRebuilds = effects.calendarRebuilds;
              const body = () => {
                actualBody = Promise.resolve().then(async () => {
                  await work();
                  completed = true;
                });
                return actualBody;
              };
              operation = run(() =>
                workflow && ownershipPage
                  ? workflow.run(() =>
                      withEffects(() =>
                        withSettledPageWrites(
                          ownershipPage,
                          (url) =>
                            url.origin === origin &&
                            (url.pathname === "/workspace/todos" ||
                              url.pathname.startsWith(
                                "/api/workspace/todos/",
                              ) ||
                              url.pathname === "/oauth/authorize"),
                          () => workflow.body(body),
                          observeBrowserWrite,
                        ),
                      ),
                    )
                  : withEffects(body),
              );
              return operation;
            },
            graphql: async (request, query, variables = {}) =>
              (
                await request.post("/api/graphql", {
                  headers: { origin },
                  data: { query, variables },
                })
              ).json(),
            request: async (mode, channel) => {
              if (mode === "cookie") {
                const { cookie } = await actorSession();
                return newRequest({
                  cookie: cookie.name + "=" + cookie.value,
                  origin,
                });
              }
              const { accessToken } = await token(channel);
              return newRequest({ Authorization: "Bearer " + accessToken });
            },
            mcp: async () => {
              const { accessToken, resource } = await token("mcp");
              requireOpen();
              const transport = new StreamableHTTPClientTransport(
                new URL(resource),
                {
                  requestInit: {
                    headers: {
                      ...headers,
                      Authorization: "Bearer " + accessToken,
                    },
                  },
                },
              );
              const client = new Client({
                name: "todo-owner-contract",
                version: "1",
              });
              own(async () => {
                const results = await Promise.allSettled([client.close()]);
                results.push(
                  ...(await Promise.allSettled([transport.close()])),
                );
                const failures = results.flatMap((result) =>
                  result.status === "rejected" ? [result.reason] : [],
                );
                if (failures.length)
                  throw new AggregateError(failures, "Todo MCP close failed");
              });
              await client.connect(transport);
              requireOpen();
              return client;
            },
            seedCompleted: async () => {
              requireOpen();
              return (
                await db.todo.create({
                  data: {
                    userId: arranged.actor.id,
                    title: "Batch owned",
                    completed: true,
                  },
                })
              ).id;
            },
            unchanged: async (additionalOwnedIds = []) => {
              const ids = await db.todo.findMany({
                where: { userId: { in: userIds } },
                select: { id: true },
              });
              expect(ids.map((row) => row.id).sort()).toEqual(
                [
                  arranged.actor.todo.id,
                  arranged.other.todo.id,
                  ...additionalOwnedIds,
                ].sort(),
              );
              expect(await stored(arranged.actor.todo.id)).toEqual(
                arranged.actor.todo,
              );
              expect(await stored(arranged.other.todo.id)).toEqual(
                arranged.other.todo,
              );
            },
          });
        } finally {
          // This runs inside withBrowserWorkflow, so fixture interruption can
          // release the wrapper before joining its still-running native body.
          closing = true;
        }
      };
      if (ownershipPage) await withBrowserWorkflow(ownershipPage, provide);
      else await provide();
    } catch (error) {
      errors.push(error);
    } finally {
      closing = true;
      try {
        await operation;
      } catch (error) {
        errors.push(error);
      }
      try {
        await finalize();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, "Todo ownership fixture failed");
  },
});

// Only actual Web and OAuth consent journeys acquire a native page/browser.
// Cookie and anonymous protocol contracts retain the same private Worker.
export const browserTest = test.extend({
  ownershipPage: async ({ page }, use) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await use(page);
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
