import { createServer, type Server } from "node:http";
import { getRequest, setResponse } from "@sveltejs/kit/node";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import {
  type CloudflareR2Bucket,
  runWithCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import {
  mcpDeleteRoute,
  mcpGetRoute,
  mcpOptionsRoute,
  mcpPostRoute,
} from "@/lib/api/routes/mcp";
import { getUploadDownloadRoute } from "@/lib/api/routes/upload-download-route";
import { putUploadObjectRoute } from "@/lib/api/routes/upload-object-put-route";
import { getOAuthRestAudienceUrls } from "@/lib/oauth/resource-urls";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../fixtures/dev-seed";
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
  "workspace.upload:read",
  "workspace.overview:read",
  "workspace.schedule:read",
  "workspace.calendar:read",
];
let server: Server;
let origin: string;
let grantId: string;
let token: string;
let publicJwksRequests = 0;
const objects = new Map<string, Uint8Array>();
const bucket: CloudflareR2Bucket = {
  async head(key) {
    const bytes = objects.get(key);
    return bytes
      ? { size: bytes.byteLength, httpMetadata: { contentType: "text/plain" } }
      : null;
  },
  async get(key) {
    const bytes = objects.get(key);
    return bytes
      ? {
          size: bytes.byteLength,
          body: new Response(new Uint8Array(bytes).buffer)
            .body as ReadableStream<Uint8Array>,
          httpMetadata: { contentType: "text/plain" },
        }
      : null;
  },
  async put(key, value) {
    objects.set(
      key,
      new Uint8Array(await new Response(value as BodyInit).arrayBuffer()),
    );
  },
  async delete(key) {
    objects.delete(key);
  },
};
function runtime<T>(work: () => T) {
  return runWithCloudflareRuntimeEnv(
    {
      HYPERDRIVE: { connectionString: process.env.DATABASE_URL ?? "" },
      HYPERDRIVE_AUTH: {
        connectionString: process.env.AUTH_DATABASE_URL ?? "",
      },
      R2_UPLOADS: bucket,
      USER_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
    },
    work,
  );
}
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
        response = await runtime(() => putUploadObjectRoute(request));
      } else if (
        /^\/api\/workspace\/uploads\/[^/]+\/download$/.test(
          new URL(request.url).pathname,
        )
      ) {
        response = await runtime(() =>
          getUploadDownloadRoute(request, {
            id: new URL(request.url).pathname.split("/")[4],
          }),
        );
      } else {
        response = await runtime(() =>
          (
            ({
              POST: mcpPostRoute,
              GET: mcpGetRoute,
              DELETE: mcpDeleteRoute,
              OPTIONS: mcpOptionsRoute,
            })[request.method] ?? (() => new Response(null, { status: 405 }))
          )(request),
        );
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
  const publicTools = [
    "catalog_section_calendar_feed_get",
    "catalog_link_list",
    "catalog_bus_timetable_get",
    "catalog_bus_route_list",
    "catalog_bus_route_get",
    "catalog_bus_route_search",
    "catalog_bus_departure_next",
    "catalog_weather_get",
    "catalog_rooms_map",
    "catalog_young_event_list",
    "catalog_young_event_get",
    "catalog_young_organizer_list",
    "catalog_young_organizer_get",
    "catalog_course_search",
    "catalog_course_get",
    "catalog_semester_list",
    "catalog_semester_current",
    "catalog_section_get",
    "catalog_section_search",
    "catalog_section_match_preview",
    "catalog_teacher_search",
    "catalog_teacher_get",
    "catalog_schedule_list",
    "catalog_section_schedule_list",
    "catalog_section_exam_list",
  ];
  const protectedTools = [
    "graphql_operation_run",
    "account_profile_get",
    "account_client_activity_list",
    "community_user_get",
    "workspace_todo_list",
    "workspace_todo_create",
    "workspace_todo_update",
    "workspace_todo_delete",
    "workspace_homework_list",
    "workspace_homework_completion_set",
    "community_section_homework_list",
    "community_section_homework_create",
    "community_section_homework_update",
    "community_section_homework_delete",
    "workspace_young_event_subscription_list",
    "workspace_young_event_subscription_get",
    "workspace_young_event_subscription_set",
    "workspace_young_organizer_subscription_list",
    "workspace_young_organizer_subscription_set",
    "workspace_young_notification_list",
    "workspace_young_notification_read",
    "workspace_young_organizer_subscription_get",
    "workspace_calendar_feed_get",
    "workspace_subscription_list",
    "workspace_subscription_add",
    "workspace_subscription_kind_update",
    "workspace_subscription_remove",
    "workspace_subscription_import",
    "workspace_calendar_event_list",
    "workspace_calendar_timeline_get",
    "community_comment_list",
    "community_comment_get",
    "community_comment_replies",
    "community_comment_create",
    "community_comment_update",
    "community_comment_delete",
    "community_comment_reaction_add",
    "community_comment_reaction_remove",
    "community_description_get",
    "community_description_set",
    "workspace_upload_list",
    "workspace_upload_rename",
    "workspace_upload_delete",
    "workspace_snapshot_get",
    "workspace_link_pin_list",
    "workspace_link_pin_set",
    "workspace_deadline_list",
    "workspace_overview_get",
    "workspace_schedule_next",
    "workspace_bus_preferences_get",
    "workspace_bus_preferences_set",
    "workspace_schedule_list",
    "workspace_exam_list",
  ];
  const discovery = await post({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  expect(discovery.status).toBe(200);
  expect(
    (await payload(discovery)).result.tools
      .map((tool: { name: string }) => tool.name)
      .sort(),
  ).toEqual([...publicTools, ...protectedTools].sort());
  // The boundary admits every public tool. Tools that declare mode reject its
  // invalid type in SDK validation; tools without mode may execute a public read.
  for (const name of publicTools) {
    const response = await post(call(name, { mode: 17 }));
    expect(response.status, name).toBe(200);
    expect(response.headers.get("www-authenticate"), name).toBeNull();
    const result = await payload(response);
    expect(result.error, name).toBeUndefined();
    if (result.result.isError) {
      expect(JSON.stringify(result.result), name).toMatch(
        /validation|invalid|expected/i,
      );
    } else {
      const content =
        result.result.structuredContent ??
        JSON.parse(
          result.result.content.find(
            (item: { type: string }) => item.type === "text",
          ).text,
        );
      expect(typeof content.success, name).toBe("boolean");
      expect(String(content.error ?? ""), name).not.toMatch(
        /unauth|forbidden|scope/i,
      );
    }
  }
  for (const name of protectedTools) {
    const response = await post(call(name));
    expect(response.status, name).toBe(401);
    expect(response.headers.get("www-authenticate"), name).toContain(
      'scope="account.profile:read"',
    );
    const result = await payload(response);
    expect(result.error.code, name).toBe(-32000);
    expect(result.result, name).toBeUndefined();
  }

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

it("mcp.time-override", { timeout: 30_000 }, async () => {
  const section = await db.section.findUniqueOrThrow({
    where: { jwId: DEV_SEED.section.jwId },
    select: { id: true },
  });
  await db.userSectionSubscription.create({
    data: { userId, sectionId: section.id },
  });
  const dueAt = `${DEV_SEED_ANCHOR.date}T18:00:00+08:00`;
  const todo = await db.todo.create({
    data: {
      userId,
      title: "[integration-test] product clock",
      dueAt: new Date(dueAt),
    },
  });
  const expired = await sign({ expired: true });
  const limited = await sign({ scopes: ["workspace.todo:read"] });
  const tools: Array<[string, Record<string, unknown>]> = [
    ["workspace_snapshot_get", {}],
    ["workspace_schedule_next", {}],
    ["workspace_calendar_timeline_get", {}],
    ["workspace_deadline_list", {}],
    ["workspace_overview_get", {}],
    [
      "catalog_bus_departure_next",
      {
        originCampusId: DEV_SEED.bus.originCampusId,
        destinationCampusId: DEV_SEED.bus.destinationCampusId,
      },
    ],
  ];
  async function invoke(
    name: string,
    args: Record<string, unknown>,
    atTime: string,
  ) {
    const response = await post(
      call(name, { ...args, atTime, mode: "full" }),
      `Bearer ${token}`,
    );
    expect(response.status, name).toBe(200);
    const body = await payload(response);
    expect(body.result.isError, name).not.toBe(true);
    expect(body.result.structuredContent.success, name).toBe(true);
    return body.result.structuredContent;
  }
  try {
    const before = Object.fromEntries(
      await Promise.all(
        tools.map(async ([name, args]) => [
          name,
          await invoke(name, args, DEV_SEED_ANCHOR.recommendedAtTime),
        ]),
      ),
    );
    const after = Object.fromEntries(
      await Promise.all(
        tools.map(async ([name, args]) => [
          name,
          await invoke(name, args, "2099-01-01T08:00:00+08:00"),
        ]),
      ),
    );
    for (const name of ["workspace_snapshot_get", "workspace_schedule_next"]) {
      expect(before[name].nextClass.at).toMatch(
        new RegExp(`^${DEV_SEED_ANCHOR.date}`),
      );
      expect(after[name].nextClass).toBeNull();
    }
    expect(before.workspace_calendar_timeline_get.range.from).toBe(
      `${DEV_SEED_ANCHOR.date}T00:00:00+08:00`,
    );
    expect(after.workspace_calendar_timeline_get.range.from).toBe(
      "2099-01-01T00:00:00+08:00",
    );
    expect(before.workspace_deadline_list.deadlines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "todo_due",
          at: dueAt,
          payload: expect.objectContaining({ id: todo.id }),
        }),
      ]),
    );
    expect(after.workspace_deadline_list.deadlines).toEqual([]);
    expect(
      before.workspace_overview_get.overview.todaySchedulesCount,
    ).toBeGreaterThan(0);
    expect(after.workspace_overview_get.overview.todaySchedulesCount).toBe(0);
    expect(
      new Date(before.catalog_bus_departure_next.atTime).toISOString(),
    ).toBe(new Date(DEV_SEED_ANCHOR.recommendedAtTime).toISOString());
    expect(
      new Date(after.catalog_bus_departure_next.atTime).toISOString(),
    ).toBe("2099-01-01T00:00:00.000Z");
    for (const [name, args] of tools) {
      for (const atTime of [
        DEV_SEED_ANCHOR.recommendedAtTime,
        "2099-01-01T08:00:00+08:00",
      ]) {
        const rejected = await post(
          call(name, { ...args, atTime }),
          `Bearer ${expired}`,
        );
        expect(rejected.status, name).toBe(401);
        expect((await payload(rejected)).result).toBeUndefined();
        if (name.startsWith("workspace_")) {
          const denied = await post(
            call(name, { ...args, atTime }),
            `Bearer ${limited}`,
          );
          expect(denied.status, name).toBe(403);
          expect((await payload(denied)).result).toBeUndefined();
        }
      }
    }
  } finally {
    await db.todo.delete({ where: { id: todo.id } });
    await db.userSectionSubscription.delete({
      where: { userId_sectionId: { userId, sectionId: section.id } },
    });
  }
});

it("oauth.transport-cors", async () => {
  const preflight = await fetch(`${origin}/api/mcp`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers":
        "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
    },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("access-control-allow-origin")).toBe(origin);
  const allowed = preflight.headers
    .get("access-control-allow-headers")!
    .toLowerCase()
    .split(/,\s*/);
  expect(allowed).toEqual(
    expect.arrayContaining([
      "authorization",
      "content-type",
      "mcp-protocol-version",
      "mcp-session-id",
      "last-event-id",
    ]),
  );
  for (const authorization of [undefined, `Bearer ${token}`]) {
    const response = await fetch(`${origin}/api/mcp`, {
      method: "POST",
      headers: {
        Origin: origin,
        "content-type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(call("workspace_todo_list")),
    });
    expect(response.status).toBe(authorization ? 200 : 401);
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(response.headers.get("vary")).toContain("Origin");
    expect(response.headers.get("access-control-expose-headers")).toContain(
      "MCP-Session-Id",
    );
    expect(response.headers.get("access-control-expose-headers")).toContain(
      "WWW-Authenticate",
    );
    if (!authorization)
      expect(response.headers.get("www-authenticate")).toContain("Bearer");
    await response.text();
  }
});

it("oauth.transport-origin-validation", async () => {
  const priorCanonical = process.env.APP_CANONICAL_ORIGIN;
  const canonical = "https://canonical.example";
  vi.stubEnv("APP_CANONICAL_ORIGIN", canonical);
  try {
    for (const requestOrigin of [
      undefined,
      canonical,
      origin,
      origin.replace("127.0.0.1", "localhost"),
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://evil.example",
      "null",
      "invalid-origin",
    ]) {
      const trusted =
        requestOrigin === undefined ||
        requestOrigin === canonical ||
        requestOrigin.startsWith("http://localhost:") ||
        requestOrigin.startsWith("http://127.0.0.1:");
      for (const method of ["POST", "OPTIONS", "GET", "DELETE"]) {
        const response = await fetch(`${origin}/api/mcp`, {
          method,
          headers: {
            ...(requestOrigin ? { Origin: requestOrigin } : {}),
            "content-type": "application/json",
            Accept: "application/json, text/event-stream",
          },
          ...(method === "POST"
            ? { body: JSON.stringify(call("catalog_semester_list")) }
            : {}),
        });
        expect(response.status, `${method}:${requestOrigin}`).toBe(
          trusted
            ? method === "OPTIONS"
              ? 204
              : method === "GET"
                ? 405
                : 200
            : 403,
        );
        if (!trusted) {
          expect(await response.json()).toEqual({ error: "invalid_origin" });
          expect(
            response.headers.get("access-control-allow-origin"),
          ).toBeNull();
        } else await response.text();
      }
    }
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://preview.example");
    const preview = await fetch(`${origin}/api/mcp`, {
      method: "OPTIONS",
      headers: { Origin: "https://preview.example" },
    });
    expect(preview.status).toBe(204);
  } finally {
    vi.stubEnv("APP_PUBLIC_ORIGIN", origin);
    vi.stubEnv("APP_CANONICAL_ORIGIN", priorCanonical);
  }
});

it("upload.mcp-transfer-boundary", async () => {
  const credentials = await sign({
    scopes: ["workspace.upload:write", "workspace.upload:read"],
  });
  const authorization = `Bearer ${credentials}`;
  const content = "private object bytes unique to this contract";
  async function operation(
    operationId: string,
    variables: Record<string, unknown>,
  ) {
    const response = await post(
      call("graphql_operation_run", {
        operationId,
        variables,
        confirmed: true,
        locale: "en-us",
      }),
      authorization,
    );
    expect(response.status).toBe(200);
    const result = (await payload(response)).result;
    expect(JSON.stringify(result)).not.toContain(content);
    expect(
      result.content.every((item: { type: string }) => item.type === "text"),
    ).toBe(true);
    return result;
  }
  let key: string | undefined;
  let uploadId: string | undefined;
  try {
    const pendingBefore = await db.uploadPending.count({ where: { userId } });
    for (const field of ["bytes", "file", "body"]) {
      const denied = await operation("workspace.upload.session.create.v1", {
        input: {
          filename: "boundary.txt",
          size: content.length,
          [field]: "unaccepted-binary-input",
        },
      });
      expect(denied.isError).toBe(true);
    }
    expect(await db.uploadPending.count({ where: { userId } })).toBe(
      pendingBefore,
    );
    expect(objects.size).toBe(0);
    const created = await operation("workspace.upload.session.create.v1", {
      input: {
        filename: "boundary.txt",
        contentType: "text/plain",
        size: content.length,
      },
    });
    expect(created.isError).not.toBe(true);
    expect(created.structuredContent.success).toBe(true);
    const session = created.structuredContent.data.uploadSessionCreate;
    key = session.key;
    expect(Object.keys(session).sort()).toEqual([
      "key",
      "maxFileSizeBytes",
      "quotaBytes",
      "url",
      "usedBytes",
    ]);
    expect(new URL(session.url).origin).toBe(origin);
    expect(new URL(session.url).pathname).toBe("/api/workspace/uploads/object");
    expect(new URL(session.url).searchParams.get("key")).toBe(key);
    expect(
      (await db.uploadPending.findUniqueOrThrow({ where: { key } })).phase,
    ).toBe("reserved");
    const rejectedPut = await fetch(session.url, {
      method: "PUT",
      headers: { authorization, "content-type": "text/plain" },
      body: content,
    });
    expect(rejectedPut.status).toBe(401);
    await rejectedPut.text();
    expect(objects.size).toBe(0);
    expect(
      (await db.uploadPending.findUniqueOrThrow({ where: { key } })).phase,
    ).toBe("reserved");
    const restToken = await sign({
      resource: getOAuthRestAudienceUrls()[0],
      scopes: ["workspace.upload:write", "workspace.upload:read"],
    });
    const put = await fetch(session.url, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${restToken}`,
        "content-type": "text/plain",
      },
      body: content,
    });
    expect(put.status).toBe(200);
    await put.text();
    expect(
      (await db.uploadPending.findUniqueOrThrow({ where: { key } })).phase,
    ).toBe("uploaded");
    const completionInput = {
      key,
      filename: "boundary.txt",
      contentType: "text/plain",
    };
    for (const field of ["bytes", "file", "body"])
      expect(
        (
          await operation("workspace.upload.complete.v1", {
            input: { ...completionInput, [field]: "unaccepted-binary-input" },
          })
        ).isError,
      ).toBe(true);
    expect(await db.upload.count({ where: { key } })).toBe(0);
    const completed = await operation("workspace.upload.complete.v1", {
      input: completionInput,
    });
    expect(completed.structuredContent.success).toBe(true);
    const upload =
      completed.structuredContent.data.uploadSessionComplete.upload;
    uploadId = upload.id;
    expect(upload.size).toBe(content.length);
    expect(Object.keys(upload).sort()).toEqual([
      "createdAt",
      "filename",
      "id",
      "key",
      "size",
    ]);
    const renamed = await operation("workspace.upload.rename.v1", {
      id: uploadId,
      filename: "renamed.txt",
    });
    expect(renamed.structuredContent.data.uploadRename.upload.filename).toBe(
      "renamed.txt",
    );
    const downloadUrl = `${origin}/api/workspace/uploads/${uploadId}/download`;
    const deniedDownload = await fetch(downloadUrl, {
      headers: { authorization },
    });
    expect(deniedDownload.status).toBe(401);
    await deniedDownload.text();
    const download = await fetch(downloadUrl, {
      headers: { authorization: `Bearer ${restToken}` },
    });
    expect(download.status).toBe(200);
    expect(await download.text()).toBe(content);
    const deleted = await operation("workspace.upload.delete.v1", {
      id: uploadId,
    });
    expect(deleted.structuredContent.data.uploadDelete).toMatchObject({
      id: uploadId,
      success: true,
      deletedSize: content.length,
    });
    expect(objects.size).toBe(0);
    expect(await db.upload.count({ where: { key } })).toBe(0);
  } finally {
    if (uploadId)
      await db.auditLog.deleteMany({ where: { targetId: uploadId } });
    if (key) {
      await db.upload.deleteMany({ where: { key } });
      await db.uploadPending.deleteMany({ where: { key } });
      objects.delete(key);
    }
  }
});
