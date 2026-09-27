import { createServer, type Server } from "node:http";
import { getRequest, setResponse } from "@sveltejs/kit/node";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import {
  mcpDeleteRoute,
  mcpGetRoute,
  mcpOptionsRoute,
  mcpPostRoute,
} from "@/lib/api/routes/mcp";
import { putUploadObjectRoute } from "@/lib/api/routes/upload-object-put-route";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const userId = `mcp-http-${marker}`;
const clientId = `mcp-http-client-${marker}`;
const scopes = [
  "workspace.todo:read",
  "workspace.todo:write",
  "account.profile:read",
  "workspace.upload:write",
];
let server: Server;
let origin: string;
let grantId: string;
let token: string;
let publicJwksRequests = 0;
const call = (name: string, args: Record<string, unknown> = {}) => ({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: { name, arguments: args },
});
async function post(body: unknown, authorization?: string) {
  return fetch(`${origin}/api/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(authorization ? { authorization } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
async function payload(response: Response) {
  const text = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = text
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .at(-1)
      ?.slice(6);
    if (!data) throw new Error(`Missing MCP SSE data: ${text}`);
    return JSON.parse(data);
  }
  return JSON.parse(text);
}
async function sign(
  input: {
    resource?: string;
    scopes?: string[];
    expired?: boolean;
    grantId?: string;
  } = {},
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const signed = await signResourceBoundOAuthAccessToken({
    userId,
    clientId,
    grantId: input.grantId ?? grantId,
    scopes: input.scopes ?? scopes,
    resources: [input.resource ?? `${origin}/api/mcp`],
    issuedAt: input.expired ? issuedAt - 600 : issuedAt,
    expiresAt: input.expired ? issuedAt - 300 : issuedAt + 300,
  });
  if (!signed) throw new Error("Expected signed MCP token");
  return signed;
}
beforeAll(async () => {
  server = createServer(async (incoming, outgoing) => {
    try {
      const request = await getRequest({ request: incoming, base: origin });
      let response: Response;
      if (new URL(request.url).pathname === "/api/auth/jwks") {
        publicJwksRequests++;
        const { getBetterAuthInstance } = await import("@/lib/auth/core");
        response = await getBetterAuthInstance().handler(request);
      } else if (
        new URL(request.url).pathname === "/api/workspace/uploads/object"
      ) {
        response = await putUploadObjectRoute(request);
      } else {
        response = await (
          {
            POST: mcpPostRoute,
            GET: mcpGetRoute,
            DELETE: mcpDeleteRoute,
            OPTIONS: mcpOptionsRoute,
          }[request.method] ?? (() => new Response(null, { status: 405 }))
        )(request);
      }
      await setResponse(outgoing, response);
    } catch (error) {
      outgoing.statusCode = 500;
      outgoing.end(String(error));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing HTTP address");
  origin = `http://127.0.0.1:${address.port}`;
  vi.stubEnv("APP_PUBLIC_ORIGIN", origin);
  await db.user.create({
    data: { id: userId, email: `${userId}@example.test` },
  });
  const client = await db.oAuthClient.create({
    data: {
      clientId,
      name: "MCP HTTP contract",
      redirectUris: ["https://example.test/callback"],
      consents: { create: { userId, scopes } },
    },
    select: { consents: { select: { grantId: true } } },
  });
  grantId = client.consents[0].grantId;
  token = await sign();
});
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  await db.oAuthClient.deleteMany({ where: { clientId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
  vi.unstubAllEnvs();
});

it("mcp.public-catalog-access", async () => {
  for (const body of [
    { jsonrpc: "2.0", id: 1, method: "tools/list" },
    call("catalog_semester_list"),
  ]) {
    const response = await post(body);
    expect(response.status).toBe(200);
    const result = await payload(response);
    expect(result.error).toBeUndefined();
    expect(result.result.isError).not.toBe(true);
  }
  const privateResponse = await post(call("workspace_todo_list"));
  expect(privateResponse.status).toBe(401);
  expect(privateResponse.headers.get("www-authenticate")).toContain(
    'scope="account.profile:read"',
  );
  const failure = await payload(privateResponse);
  expect(failure.error.code).toBe(-32000);
});

it("mcp.invalid-credentials-no-downgrade", async () => {
  for (const credential of [
    "Bearer invalid",
    "Basic invalid",
    "DPoP invalid",
  ]) {
    const response = await post(call("catalog_semester_list"), credential);
    expect(response.status, credential).toBe(401);
    expect((await payload(response)).result).toBeUndefined();
  }
});

it("mcp.resource-bound-access-token", async () => {
  const valid = await post(call("workspace_todo_list"), `Bearer ${token}`);
  expect(valid.status).toBe(200);
  expect((await payload(valid)).result.structuredContent).toMatchObject({
    success: true,
    todos: [],
  });
  expect(publicJwksRequests).toBeGreaterThan(0);
  const { getBetterAuthInstance } = await import("@/lib/auth/core");
  const { decodeJwt } = await import("jose");
  const signJwt = getBetterAuthInstance().api.signJWT as (input: {
    body: { payload: Record<string, unknown> };
  }) => Promise<{ token: string }>;
  const wrongIssuer = await signJwt({
    body: {
      payload: { ...decodeJwt(token), iss: "https://wrong.example/api/auth" },
    },
  });
  for (const invalid of [
    wrongIssuer.token,
    "opaque-token",
    await sign({ resource: `${origin}/api/graphql` }),
    await sign({ expired: true }),
    await sign({ grantId: crypto.randomUUID() }),
    `${token.slice(0, token.lastIndexOf(".") + 1)}${"A".repeat(86)}`,
  ]) {
    const response = await post(
      call("workspace_todo_list"),
      `Bearer ${invalid}`,
    );
    expect(response.status).toBe(401);
    expect((await payload(response)).result).toBeUndefined();
  }
});

it("mcp.bootstrap-auth-challenge", async () => {
  for (const credential of [undefined, "Bearer invalid"]) {
    const response = await post(call("workspace_todo_list"), credential);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      'scope="account.profile:read"',
    );
    expect(response.headers.get("www-authenticate")).toContain(
      "resource_metadata=",
    );
    expect((await payload(response)).error.code).toBe(-32000);
  }
});

it("mcp.http-methods", async () => {
  const get = await fetch(`${origin}/api/mcp`);
  expect(get.status).toBe(405);
  expect(get.headers.get("allow")).toBe("POST, DELETE, OPTIONS");
  await get.text();
  const options = await fetch(`${origin}/api/mcp`, {
    method: "OPTIONS",
    headers: { origin },
  });
  expect(options.status).toBe(204);
  expect(options.headers.get("access-control-allow-origin")).toBe(origin);
  for (const authorization of [
    undefined,
    `Bearer ${token}`,
    "Bearer invalid",
  ]) {
    const response = await fetch(`${origin}/api/mcp`, {
      method: "DELETE",
      headers: authorization ? { authorization } : {},
    });
    expect(response.status).toBe(
      authorization === "Bearer invalid" ? 401 : 200,
    );
    await response.text();
  }
});

it("mcp.complete-batch-scope-enforcement", async () => {
  const readToken = await sign({ scopes: ["workspace.todo:read"] });
  const batch = [
    call("workspace_todo_list"),
    { ...call("workspace_todo_create", { title: "must not write" }), id: 2 },
  ];
  const response = await post(batch, `Bearer ${readToken}`);
  expect(response.status).toBe(403);
  expect(response.headers.get("www-authenticate")).toContain(
    "workspace.todo:write",
  );
  expect(await db.todo.count({ where: { userId } })).toBe(0);
  const writeToken = await sign({ scopes: ["workspace.todo:write"] });
  const allowed = await post(
    call("workspace_todo_list"),
    `Bearer ${writeToken}`,
  );
  expect(allowed.status).toBe(200);
  expect((await payload(allowed)).result.structuredContent.success).toBe(true);
});

it("mcp.request-body-limit", async () => {
  const prefix = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });
  const exact =
    prefix + " ".repeat(65536 - new TextEncoder().encode(prefix).length);
  expect(new TextEncoder().encode(exact).length).toBe(65536);
  const accepted = await post(exact);
  expect(accepted.status).toBe(200);
  await payload(accepted);
  for (const auth of [undefined, "Bearer invalid", `Bearer ${token}`]) {
    const response = await post(`${exact} `, auth);
    expect(response.status).toBe(413);
    expect((await payload(response)).error.code).toBe(-32000);
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(exact));
      controller.enqueue(new TextEncoder().encode(" "));
      controller.close();
    },
  });
  const streamedRequest: RequestInit & { duplex: "half" } = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: stream,
    duplex: "half",
  };
  const streamed = await mcpPostRoute(
    new Request(`${origin}/api/mcp`, streamedRequest),
  );
  expect(streamed.status).toBe(413);
  expect((await payload(streamed)).error.code).toBe(-32000);
});

it("mcp.request-batch-limit", async () => {
  for (const [count, status, code] of [
    [0, 400, -32600],
    [51, 413, -32000],
  ]) {
    const response = await post(
      Array.from({ length: count }, (_, id) => ({
        jsonrpc: "2.0",
        id,
        method: "tools/list",
      })),
    );
    expect(response.status).toBe(status);
    expect((await payload(response)).error.code).toBe(code);
  }
  const response = await post(
    Array.from({ length: 50 }, (_, id) => ({
      jsonrpc: "2.0",
      id,
      method: "tools/list",
    })),
  );
  expect(response.status).toBe(200);
  const text = await response.text();
  const messages = response.headers
    .get("content-type")
    ?.includes("text/event-stream")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => JSON.parse(line.slice(6)))
    : JSON.parse(text);
  expect(messages).toHaveLength(50);
  expect(
    messages
      .map((message: { id: number }) => message.id)
      .sort((a: number, b: number) => a - b),
  ).toEqual(Array.from({ length: 50 }, (_, id) => id));
  expect(messages.every((message: { error?: unknown }) => !message.error)).toBe(
    true,
  );
});

it("mcp.catalog-search-length", async () => {
  for (const name of [
    "catalog_course_search",
    "catalog_section_search",
    "catalog_teacher_search",
  ]) {
    for (const length of [1, 2, 200, 201]) {
      const response = await post(
        call(name, { search: "x".repeat(length), limit: 1 }),
      );
      expect(response.status).toBe(200);
      const result = await payload(response);
      if (length === 1 || length === 201) {
        expect(result.result.isError, `${name}:${length}`).toBe(true);
        expect(result.result.structuredContent).toBeUndefined();
      } else {
        expect(result.result.isError, `${name}:${length}`).not.toBe(true);
        expect(result.result.structuredContent).toMatchObject({
          success: true,
          data: [],
        });
      }
    }
  }
});

it("mcp.catalog-pagination", async () => {
  for (const name of [
    "catalog_semester_list",
    "catalog_course_search",
    "catalog_section_search",
    "catalog_teacher_search",
  ]) {
    for (const args of [
      {},
      { page: 1, limit: 1 },
      { page: 100, limit: 100 },
      { page: 0 },
      { page: 101 },
      { limit: 0 },
      { limit: 101 },
    ]) {
      const response = await post(call(name, args));
      expect(response.status).toBe(200);
      const result = await payload(response);
      const invalid =
        args.page === 0 ||
        args.page === 101 ||
        args.limit === 0 ||
        args.limit === 101;
      if (invalid)
        expect(result.result.isError, `${name}:${JSON.stringify(args)}`).toBe(
          true,
        );
      else {
        expect(result.result.isError, name).not.toBe(true);
        expect(result.result.structuredContent.pagination).toMatchObject({
          page: args.page ?? 1,
          pageSize: args.limit ?? 20,
        });
        expect(result.result.structuredContent.data.length).toBeLessThanOrEqual(
          args.limit ?? 20,
        );
      }
    }
  }
});

it("mcp.graphql-authorization", async () => {
  const credential = await sign({ scopes: ["workspace.todo:read"] });
  for (const args of [
    { operationId: "account.profile.get.v1" },
    {
      document:
        "query PrivateAlias { hidden: account { ...Profile } } fragment Profile on Account { profile { id email } }",
    },
  ]) {
    const response = await post(
      call("graphql_operation_run", args),
      `Bearer ${credential}`,
    );
    expect(response.status).toBe(200);
    const result = await payload(response);
    expect(result.result.isError).toBe(true);
    expect(result.result._meta["mcp/www_authenticate"]).toEqual([
      expect.stringContaining('scope="account.profile:read"'),
    ]);
    expect(result.result._meta["mcp/www_authenticate"][0]).toContain(
      'error="insufficient_scope"',
    );
    expect(JSON.stringify(result.result.structuredContent)).not.toContain(
      `${userId}@example.test`,
    );
  }
});

it("mcp.upload-put-resource-isolation", async () => {
  const credential = await sign({ scopes: ["workspace.upload:write"] });
  const key = `uploads/${userId}/${crypto.randomUUID()}`;
  const pending = await db.uploadPending.create({
    data: {
      key,
      userId,
      filename: "private.txt",
      size: 1,
      attemptId: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 300_000),
      phase: "reserved",
    },
  });
  try {
    const response = await fetch(
      `${origin}/api/workspace/uploads/object?key=${encodeURIComponent(key)}`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${credential}`,
          "content-type": "text/plain",
        },
        body: "x",
      },
    );
    expect(response.status).toBe(401);
    await response.text();
    expect(
      await db.uploadPending.findUnique({ where: { id: pending.id } }),
    ).toEqual(pending);
    expect(await db.upload.findUnique({ where: { key } })).toBeNull();
  } finally {
    await db.uploadPending.deleteMany({ where: { id: pending.id } });
  }
});
