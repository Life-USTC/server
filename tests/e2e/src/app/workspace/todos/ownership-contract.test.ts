import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { type APIRequestContext, expect, test } from "@playwright/test";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";
import { issueAccessToken, parseTextContent } from "../../api/mcp/helpers";

const listQuery =
  "{ workspace { todos { items { id title content completed } } } }";
const createQuery =
  "mutation($input: CreateTodoInput!) { todoCreate(input: $input) { id } }";
const updateQuery =
  "mutation($id: ID!, $input: UpdateTodoInput!) { todoUpdate(id: $id, input: $input) { id } }";
const deleteQuery = "mutation($id: ID!) { todoDelete(id: $id) { id success } }";

async function graphql(
  request: APIRequestContext,
  query: string,
  variables = {},
  headers: Record<string, string> = {},
) {
  const response = await request.post("/api/graphql", {
    headers: { origin: PLAYWRIGHT_BASE_URL, ...headers },
    data: { query, variables },
  });
  return response.json();
}

async function stored(id: string) {
  return withE2ePrisma((db) => db.todo.findUnique({ where: { id } }));
}

async function restContract(
  request: APIRequestContext,
  ownerId: string,
  ownId: string,
  foreignId: string,
  foreignOwnerId: string,
  headers: Record<string, string> = {},
) {
  const list = await request.get(
    `/api/workspace/todos?userId=${foreignOwnerId}`,
    { headers },
  );
  expect(list.status()).toBe(200);
  const body = await list.json();
  expect(body.todos.map((todo: { id: string }) => todo.id)).toEqual([ownId]);
  expect(body.counts).toMatchObject({ incomplete: 1, completed: 0 });
  for (const method of ["patch", "delete"] as const) {
    const response = await request[method](
      `/api/workspace/todos/${foreignId}`,
      { headers, data: { title: "foreign overwrite", completed: true } },
    );
    expect(response.status()).toBe(404);
  }
  const created = await request.post("/api/workspace/todos", {
    headers,
    data: { title: `REST ${crypto.randomUUID()}`, userId: foreignOwnerId },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).id;
  expect((await stored(id))?.userId).toBe(ownerId);
  expect(
    (
      await request.patch(`/api/workspace/todos/${id}`, {
        headers,
        data: { title: "REST edited", completed: true },
      })
    ).status(),
  ).toBe(200);
  expect(await stored(id)).toMatchObject({
    userId: ownerId,
    title: "REST edited",
    completed: true,
  });
  const completed = await request.patch("/api/workspace/todos/batch", {
    headers,
    data: {
      items: [
        { todoId: id, completed: false },
        { todoId: foreignId, completed: true },
      ],
    },
  });
  expect(completed.status()).toBe(200);
  expect((await completed.json()).results).toMatchObject([
    { todoId: id, success: true },
    { todoId: foreignId, success: false, error: { code: "not_found" } },
  ]);
  const deleted = await request.delete("/api/workspace/todos/batch", {
    headers,
    data: { ids: [id, foreignId] },
  });
  expect(deleted.status()).toBe(200);
  expect((await deleted.json()).results).toMatchObject([
    { id, success: true },
    { id: foreignId, success: false, error: { code: "not_found" } },
  ]);
  expect(await stored(id)).toBeNull();
}

async function graphqlContract(
  request: APIRequestContext,
  ownerId: string,
  ownId: string,
  foreignId: string,
  headers: Record<string, string> = {},
) {
  const list = await graphql(request, listQuery, {}, headers);
  expect(list.errors).toBeUndefined();
  expect(
    list.data.workspace.todos.items.map((todo: { id: string }) => todo.id),
  ).toEqual([ownId]);
  for (const query of [updateQuery, deleteQuery]) {
    const result = await graphql(
      request,
      query,
      { id: foreignId, input: { title: "foreign overwrite", completed: true } },
      headers,
    );
    expect(result.errors[0].extensions.code).toBe("NOT_FOUND");
  }
  const created = await graphql(
    request,
    createQuery,
    { input: { title: "GraphQL owned" } },
    headers,
  );
  expect(created.errors).toBeUndefined();
  const id = created.data.todoCreate.id;
  expect((await stored(id))?.userId).toBe(ownerId);
  const updated = await graphql(
    request,
    updateQuery,
    { id, input: { title: "GraphQL edited", completed: true } },
    headers,
  );
  expect(updated.errors).toBeUndefined();
  expect(await stored(id)).toMatchObject({
    userId: ownerId,
    title: "GraphQL edited",
    completed: true,
  });
  const completion = await graphql(
    request,
    "mutation($items: [TodoCompletionBatchItemInput!]!) { todoCompletionsSet(items: $items) { results { todoId success error { code } } } }",
    {
      items: [
        { todoId: id, completed: false },
        { todoId: foreignId, completed: true },
      ],
    },
    headers,
  );
  expect(completion.errors).toBeUndefined();
  expect(completion.data.todoCompletionsSet.results).toMatchObject([
    { todoId: id, success: true },
    { todoId: foreignId, success: false, error: { code: "NOT_FOUND" } },
  ]);
  const deletion = await graphql(
    request,
    "mutation($ids: [ID!]!) { todosDelete(ids: $ids) { results { id success error { code } } } }",
    { ids: [id, foreignId] },
    headers,
  );
  expect(deletion.errors).toBeUndefined();
  expect(deletion.data.todosDelete.results).toMatchObject([
    { id, success: true },
    { id: foreignId, success: false, error: { code: "NOT_FOUND" } },
  ]);
  expect(await stored(id)).toBeNull();
}

test("todo.personal-ownership", async ({ page, request }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const clientIds: string[] = [];
  const users = await withE2ePrisma(async (db) => {
    const users = [];
    for (const isAdmin of [false, true]) {
      const marker = `todo-owner-${crypto.randomUUID().slice(0, 10)}`;
      const user = await db.user.create({
        data: {
          name: marker,
          username: marker,
          email: `${marker}@example.test`,
          emailVerified: true,
          isAdmin,
        },
      });
      const todo = await db.todo.create({
        data: {
          userId: user.id,
          title: `${marker} private title`,
          content: `${marker} secret content`,
        },
      });
      users.push({ ...user, todo });
    }
    return users;
  });
  try {
    const foreign = users[1].todo;
    const anonWeb = await request.get("/workspace/todos", { maxRedirects: 0 });
    expect(anonWeb.status()).toBe(303);
    expect(anonWeb.headers().location).toContain("/account/sign-in?");
    for (const action of ["createTodo", "updateTodo"]) {
      const response = await request.post(`/workspace/todos?/${action}`, {
        headers: {
          origin: PLAYWRIGHT_BASE_URL,
          accept: "application/json",
          "x-sveltekit-action": "true",
        },
        form: {
          id: foreign.id,
          title: "Anonymous Web write",
          priority: "medium",
        },
      });
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        type: "failure",
        status: 401,
      });
    }
    expect((await request.get("/api/workspace/todos")).status()).toBe(401);
    for (const method of ["post", "patch", "delete"] as const) {
      const url =
        method === "post"
          ? "/api/workspace/todos"
          : `/api/workspace/todos/${foreign.id}`;
      expect(
        (
          await request[method](url, { data: { title: "Anonymous write" } })
        ).status(),
      ).toBe(401);
    }
    expect((await graphql(request, listQuery)).data.workspace).toBeNull();
    for (const [query, variables] of [
      [createQuery, { input: { title: "Anonymous write" } }],
      [updateQuery, { id: foreign.id, input: { title: "Anonymous write" } }],
      [deleteQuery, { id: foreign.id }],
    ] as const) {
      expect((await graphql(request, query, variables)).errors).toHaveLength(1);
    }
    for (const [name, args] of [
      ["workspace_todo_list", {}],
      ["workspace_todo_create", { title: "Anonymous write" }],
      ["workspace_todo_update", { id: foreign.id, title: "Anonymous write" }],
      ["workspace_todo_delete", { id: foreign.id }],
    ] as const) {
      const result = await request.post("/api/mcp", {
        headers: { accept: "application/json, text/event-stream" },
        data: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name, arguments: args },
        },
      });
      expect(result.status()).toBe(401);
      expect(await result.text()).not.toContain(foreign.content);
    }
    for (const [index, actor] of users.entries()) {
      const other = users[1 - index];
      const baseline = await stored(other.todo.id);
      await page.context().clearCookies();
      await page
        .context()
        .addCookies([
          await createSignedSessionCookie(actor.id),
          { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
        ]);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(
          page,
          `/workspace/todos?todoId=${other.todo.id}&userId=${other.id}`,
        );
        await expect(
          page
            .getByRole("button", { name: actor.todo.title, exact: true })
            .filter({ visible: true }),
        ).toBeVisible();
        await expect(
          page.getByText(other.todo.title, { exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByText(other.todo.content ?? "", { exact: true }),
        ).toHaveCount(0);
      }
      const webTitle = `Web owned ${crypto.randomUUID()}`;
      await page.getByRole("button", { name: "Add Todo", exact: true }).click();
      await page.getByLabel("Title", { exact: true }).fill(webTitle);
      await page
        .getByRole("button", { name: "Create Todo", exact: true })
        .click();
      await expect(
        page
          .getByRole("button", { name: webTitle, exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      const webTodo = await withE2ePrisma((db) =>
        db.todo.findFirstOrThrow({
          where: { userId: actor.id, title: webTitle },
        }),
      );
      await page
        .getByRole("button", { name: webTitle, exact: true })
        .filter({ visible: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Edit Todo", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByLabel("Title", { exact: true })
        .fill(`${webTitle} edited`);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Save Changes", exact: true })
        .click();
      await expect(
        page
          .getByRole("button", { name: `${webTitle} edited`, exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      expect(await stored(webTodo.id)).toMatchObject({
        title: `${webTitle} edited`,
        userId: actor.id,
      });
      await page
        .getByRole("button", { name: `${webTitle} edited`, exact: true })
        .filter({ visible: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete todo", exact: true })
        .click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      await expect.poll(() => stored(webTodo.id)).toBeNull();
      const forged = await page.request.post("/workspace/todos?/updateTodo", {
        headers: { origin: PLAYWRIGHT_BASE_URL },
        form: {
          id: other.todo.id,
          title: "Forged Web write",
          userId: actor.id,
          priority: "medium",
        },
      });
      expect(forged.status()).toBe(200);
      expect(await forged.json()).toMatchObject({
        type: "failure",
        status: 400,
      });
      await restContract(
        page.request,
        actor.id,
        actor.todo.id,
        other.todo.id,
        other.id,
      );
      await graphqlContract(
        page.request,
        actor.id,
        actor.todo.id,
        other.todo.id,
      );
      const scopes = ["workspace.todo:read", "workspace.todo:write"];
      for (const channel of ["rest", "graphql", "mcp"]) {
        const resource =
          channel === "rest"
            ? `${PLAYWRIGHT_BASE_URL}/api/auth`
            : `${PLAYWRIGHT_BASE_URL}/api/${channel}`;
        const token = await issueAccessToken(page, request, {
          scope: scopes.join(" "),
          clientScopes: scopes,
          resource,
        });
        clientIds.push(token.clientId);
        const headers = { Authorization: `Bearer ${token.accessToken}` };
        if (channel === "rest")
          await restContract(
            request,
            actor.id,
            actor.todo.id,
            other.todo.id,
            other.id,
            headers,
          );
        else if (channel === "graphql")
          await graphqlContract(
            request,
            actor.id,
            actor.todo.id,
            other.todo.id,
            headers,
          );
        else {
          const client = new Client({
            name: "todo-owner-contract",
            version: "1",
          });
          try {
            await client.connect(
              new StreamableHTTPClientTransport(new URL(resource), {
                requestInit: { headers },
              }),
            );
            const listed = parseTextContent(
              await client.callTool({
                name: "workspace_todo_list",
                arguments: { mode: "full", includeCompleted: true },
              }),
            ) as { todos: Array<{ id: string }> };
            expect(listed.todos.map((todo: { id: string }) => todo.id)).toEqual(
              [actor.todo.id],
            );
            for (const name of [
              "workspace_todo_update",
              "workspace_todo_delete",
            ]) {
              const result = parseTextContent(
                await client.callTool({
                  name,
                  arguments: {
                    id: other.todo.id,
                    title: "MCP foreign overwrite",
                  },
                }),
              );
              expect(result).toMatchObject({
                success: false,
                message: "Todo not found",
              });
            }
            const created = parseTextContent(
              await client.callTool({
                name: "workspace_todo_create",
                arguments: { title: "MCP owned", userId: other.id },
              }),
            ) as { id: string; success: boolean };
            expect(created.success).toBe(true);
            expect((await stored(created.id))?.userId).toBe(actor.id);
            const updated = parseTextContent(
              await client.callTool({
                name: "workspace_todo_update",
                arguments: {
                  id: created.id,
                  title: "MCP edited",
                  completed: true,
                },
              }),
            );
            expect(updated.success).toBe(true);
            expect(await stored(created.id)).toMatchObject({
              userId: actor.id,
              title: "MCP edited",
              completed: true,
            });
            expect(
              parseTextContent(
                await client.callTool({
                  name: "workspace_todo_delete",
                  arguments: { id: created.id },
                }),
              ).success,
            ).toBe(true);
            expect(await stored(created.id)).toBeNull();
          } finally {
            await client.close();
          }
        }
        expect(await stored(other.todo.id)).toEqual(baseline);
      }
      expect(await stored(other.todo.id)).toEqual(baseline);
      expect(await stored(actor.todo.id)).toEqual(actor.todo);
    }
  } finally {
    await withE2ePrisma(async (db) => {
      await db.oAuthClient.deleteMany({
        where: { clientId: { in: clientIds } },
      });
      await db.auditLog.deleteMany({
        where: { userId: { in: users.map((user) => user.id) } },
      });
      await db.user.deleteMany({
        where: { id: { in: users.map((user) => user.id) } },
      });
    });
  }
});
