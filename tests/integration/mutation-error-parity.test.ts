import { createServer, type Server } from "node:http";
import type { RequestEvent } from "@sveltejs/kit";
import { getRequest, setResponse } from "@sveltejs/kit/node";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { deleteCommentRoute } from "@/lib/api/routes/comments-delete-route";
import { deleteHomeworkRoute } from "@/lib/api/routes/homework-mutation-routes";
import { mcpPostRoute } from "@/lib/api/routes/mcp";
import { deleteTodoRoute } from "@/lib/api/routes/todos";
import { deleteUploadRoute } from "@/lib/api/routes/upload-management-routes";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthRestAudienceUrls } from "@/lib/oauth/resource-urls";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const graphql = createGraphqlRequestHandler(false);
let server: Server | undefined;
let origin = "";
const routes = [
  { path: "/api/workspace/todos", handler: deleteTodoRoute },
  { path: "/api/workspace/uploads", handler: deleteUploadRoute },
  { path: "/api/community/comments", handler: deleteCommentRoute },
  { path: "/api/community/section-homeworks", handler: deleteHomeworkRoute },
];
const domains = {
  todo: {
    path: routes[0].path,
    field: "todoDelete",
    tool: "workspace_todo_delete",
    argument: "id",
  },
  upload: {
    path: routes[1].path,
    field: "uploadDelete",
    tool: "workspace_upload_delete",
    argument: "id",
  },
  comment: {
    path: routes[2].path,
    field: "commentDelete",
    tool: "community_comment_delete",
    argument: "commentId",
  },
  homework: {
    path: routes[3].path,
    field: "homeworkDelete",
    tool: "community_section_homework_delete",
    argument: "homeworkId",
  },
} as const;
type Domain = keyof typeof domains;
type Tokens = Record<"rest" | "graphql" | "mcp", string>;
function runtime<T>(work: () => T) {
  if (!process.env.DATABASE_URL || !process.env.AUTH_DATABASE_URL)
    throw new Error("Missing restricted runtime database URLs");
  return runWithCloudflareRuntimeEnv(
    {
      HYPERDRIVE: { connectionString: process.env.DATABASE_URL },
      HYPERDRIVE_AUTH: { connectionString: process.env.AUTH_DATABASE_URL },
      // Rate limiting is a separate contract; admit these requests at its boundary.
      USER_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
    },
    work,
  );
}
async function startHttpServer() {
  server = createServer(async (incoming, outgoing) => {
    try {
      const request = await getRequest({ request: incoming, base: origin });
      const response = await runtime(async () => {
        const path = new URL(request.url).pathname;
        if (path === "/api/auth/jwks") {
          const { getBetterAuthInstance } = await import("@/lib/auth/core");
          return getBetterAuthInstance().handler(request);
        }
        if (path === "/api/mcp") return mcpPostRoute(request);
        if (path === "/api/graphql")
          return graphql({
            request,
            locals: {
              authUser: null,
              locale: "zh-cn",
              requestId: "mutation-error-parity",
            },
          } as unknown as RequestEvent);
        const route = routes.find((entry) => path.startsWith(`${entry.path}/`));
        return route
          ? route.handler(request, { id: path.slice(route.path.length + 1) })
          : new Response(null, { status: 404 });
      });
      await setResponse(outgoing, response);
    } catch (error) {
      outgoing.statusCode = 500;
      outgoing.end(String(error));
    }
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing HTTP server address");
  origin = `http://127.0.0.1:${address.port}`;
  vi.stubEnv("APP_PUBLIC_ORIGIN", origin);
}

beforeAll(startHttpServer);
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
      server?.closeAllConnections();
    });
  await db.$disconnect();
  vi.unstubAllEnvs();
});

async function fixture() {
  const marker = crypto.randomUUID();
  const owner = await db.user.create({
    data: { email: `${marker}-owner@errors.test` },
  });
  const other = await db.user.create({
    data: { email: `${marker}-other@errors.test` },
  });
  const scopes = [
    "workspace.todo:write",
    "workspace.upload:write",
    "community.comment:write",
    "community.section-homework:write",
  ];
  const clientId = `errors-${marker}`;
  const client = await db.oAuthClient.create({
    data: {
      clientId,
      name: "Error contract",
      scopes,
      redirectUris: ["https://example.test/callback"],
      consents: { create: { userId: owner.id, scopes } },
    },
    include: { consents: true },
  });
  const tokens = {} as Tokens;
  for (const [transport, resource] of Object.entries({
    rest: getOAuthRestAudienceUrls()[0],
    graphql: `${origin}/api/graphql`,
    mcp: `${origin}/api/mcp`,
  })) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const token = await runtime(() =>
      signResourceBoundOAuthAccessToken({
        clientId,
        grantId: client.consents[0].grantId,
        userId: owner.id,
        scopes,
        resources: [resource],
        issuedAt,
        expiresAt: issuedAt + 600,
      }),
    );
    if (!token) throw new Error("Missing signed access token");
    tokens[transport as keyof Tokens] = token;
  }
  return {
    owner,
    other,
    tokens,
    async cleanup() {
      const ids = [owner.id, other.id];
      await db.comment.deleteMany({ where: { userId: { in: ids } } });
      await db.homework.deleteMany({ where: { createdById: { in: ids } } });
      await db.auditLog.deleteMany({
        where: {
          OR: [{ userId: { in: ids } }, { subjectUserId: { in: ids } }],
        },
      });
      await db.oAuthClient.delete({ where: { clientId } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    },
  };
}
async function rejectDelete(
  domain: Domain,
  id: string,
  tokens: Tokens,
  meaning: "not_found" | "forbidden" | "locked" | "suspended",
) {
  const binding = domains[domain];
  const rest = await fetch(`${origin}${binding.path}/${id}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${tokens.rest}` },
  });
  expect(rest.status, await rest.clone().text()).toBe(
    meaning === "not_found" ? 404 : 403,
  );
  const restBody = await rest.json();
  const graph = await fetch(`${origin}/api/graphql`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokens.graphql}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: `mutation($id: ID!) { ${binding.field}(id: $id) { success } }`,
      variables: { id },
    }),
  });
  expect(graph.status).toBe(meaning === "not_found" ? 404 : 403);
  const graphBody = await graph.json();
  expect(graphBody.errors).toHaveLength(1);
  expect(graphBody.errors[0].extensions.code).toBe(
    meaning === "not_found" ? "NOT_FOUND" : "FORBIDDEN",
  );
  const mcp = await fetch(`${origin}/api/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokens.mcp}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: binding.tool,
        arguments: { [binding.argument]: id, mode: "full" },
      },
    }),
  });
  expect(mcp.status).toBe(200);
  const text = await mcp.text();
  const payload = mcp.headers.get("content-type")?.includes("text/event-stream")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .at(-1)
        ?.slice(6)
    : text;
  if (!payload) throw new Error("Missing MCP response");
  const envelope = JSON.parse(payload);
  expect(envelope.error).toBeUndefined();
  expect(envelope.result.isError, payload).not.toBe(true);
  const mcpBody = JSON.parse(
    envelope.result.content.find(
      (item: { type: string }) => item.type === "text",
    ).text,
  );
  expect(mcpBody).toMatchObject({ success: false, error: meaning });
  return {
    rest: restBody,
    graphql: graphBody.errors.map(
      (error: { message: string; extensions: { code: string } }) => ({
        message: error.message,
        code: error.extensions.code,
      }),
    ),
    mcp: mcpBody,
  };
}

it("interface-hierarchy.private-delete-error-parity", async () => {
  const f = await fixture();
  try {
    const todo = await db.todo.create({
      data: { userId: f.other.id, title: "foreign private todo" },
    });
    const upload = await db.upload.create({
      data: {
        userId: f.other.id,
        key: `errors/${crypto.randomUUID()}`,
        filename: "foreign-private.txt",
        size: 1,
      },
    });
    for (const [domain, row] of [
      ["todo", todo],
      ["upload", upload],
    ] as const) {
      const foreign = await rejectDelete(domain, row.id, f.tokens, "not_found");
      const missing = await rejectDelete(
        domain,
        crypto.randomUUID(),
        f.tokens,
        "not_found",
      );
      expect(foreign).toEqual(missing);
      expect(JSON.stringify(foreign)).not.toContain(f.other.id);
    }
    expect(await db.todo.findUnique({ where: { id: todo.id } })).toEqual(todo);
    expect(await db.upload.findUnique({ where: { id: upload.id } })).toEqual(
      upload,
    );
  } finally {
    await f.cleanup();
  }
});

it("interface-hierarchy.shared-delete-error-parity", async () => {
  const f = await fixture();
  try {
    const section = await db.section.findFirstOrThrow({
      where: { retiredAt: null },
    });
    const comment = await db.comment.create({
      data: {
        userId: f.other.id,
        sectionId: section.id,
        body: "public foreign comment",
      },
    });
    const locked = await db.comment.create({
      data: {
        userId: f.owner.id,
        sectionId: section.id,
        body: "locked owned comment",
        status: "deleted",
        deletedAt: new Date(),
      },
    });
    const homework = await db.homework.create({
      data: {
        createdById: f.other.id,
        sectionId: section.id,
        title: "public foreign homework",
      },
    });
    for (const [domain, row] of [
      ["comment", comment],
      ["homework", homework],
    ] as const) {
      await rejectDelete(domain, row.id, f.tokens, "forbidden");
      await rejectDelete(domain, crypto.randomUUID(), f.tokens, "not_found");
    }
    await rejectDelete("comment", locked.id, f.tokens, "locked");
    expect(await db.comment.findUnique({ where: { id: comment.id } })).toEqual(
      comment,
    );
    expect(await db.comment.findUnique({ where: { id: locked.id } })).toEqual(
      locked,
    );
    expect(
      await db.homework.findUnique({ where: { id: homework.id } }),
    ).toEqual(homework);
  } finally {
    await f.cleanup();
  }
});

it("interface-hierarchy.suspended-delete-error-parity", async () => {
  const f = await fixture();
  try {
    const section = await db.section.findFirstOrThrow({
      where: { retiredAt: null },
    });
    const comment = await db.comment.create({
      data: {
        userId: f.owner.id,
        sectionId: section.id,
        body: "owned comment",
      },
    });
    const homework = await db.homework.create({
      data: {
        createdById: f.owner.id,
        sectionId: section.id,
        title: "owned homework",
      },
    });
    const upload = await db.upload.create({
      data: {
        userId: f.owner.id,
        key: `errors/${crypto.randomUUID()}`,
        filename: "owned.txt",
        size: 1,
      },
    });
    await db.userSuspension.create({
      data: { userId: f.owner.id, reason: "contract suspension" },
    });
    for (const [domain, row] of [
      ["comment", comment],
      ["homework", homework],
      ["upload", upload],
    ] as const)
      await rejectDelete(domain, row.id, f.tokens, "suspended");
    expect(await db.comment.findUnique({ where: { id: comment.id } })).toEqual(
      comment,
    );
    expect(
      await db.homework.findUnique({ where: { id: homework.id } }),
    ).toEqual(homework);
    expect(await db.upload.findUnique({ where: { id: upload.id } })).toEqual(
      upload,
    );
  } finally {
    await f.cleanup();
  }
});
