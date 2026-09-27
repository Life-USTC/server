import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { setCalendarExportRebuildSenderForTest } from "@/features/calendar/server/calendar-export-queue";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import {
  putHomeworkCompletionRoute,
  putHomeworkCompletionsRoute,
} from "@/lib/api/routes/homework-completion";
import { getHomeworkDetailRoute } from "@/lib/api/routes/homework-detail-read-route";
import { getHomeworksRoute } from "@/lib/api/routes/homework-list-read-route";
import {
  deleteHomeworkRoute,
  patchHomeworkRoute,
  postHomeworkRoute,
} from "@/lib/api/routes/homework-mutation-routes";
import { handleMcpRequest } from "@/lib/api/routes/mcp-request-handler";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma } from "@/lib/db/prisma";
import { createGraphqlYoga } from "@/lib/graphql/server";
import {
  getJwksUrlForOAuthVerification,
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
  getOAuthRestAudienceUrls,
} from "@/lib/mcp/urls";
import { createFixturePrisma } from "../../../shared/prisma";
import { createMcpHarness, type McpHarness } from "../_harness/client";

const db = createFixturePrisma();
const users = Array.from({ length: 3 }, () => crypto.randomUUID());
const clientId = `homework-transport-${crypto.randomUUID()}`;
const communityWrite = "community.section-homework:write";
const completionWrite = "workspace.homework:write";
const scopes = [communityWrite, completionWrite];
const grants: string[] = [];
const clients: McpHarness[] = [];
let onlyCommunity: Client;
let onlyCompletion: Client;
let sectionId: number;
let sectionJwId: number;
let publicId: string;
const title = `Public homework ${crypto.randomUUID()}`;
beforeAll(async () => {
  setCalendarExportRebuildSenderForTest(async () => {});
  await db.user.createMany({
    data: users.map((id, index) => ({
      id,
      name: `Homework transport ${index}`,
      email: `${id}@test.invalid`,
      isAdmin: index === 2,
    })),
  });
  await db.oAuthClient.create({
    data: {
      clientId,
      name: "Homework transport",
      scopes,
      redirectUris: ["https://client.example/callback"],
    },
  });
  for (const userId of users) {
    grants.push(
      (await db.oAuthConsent.create({ data: { clientId, userId, scopes } }))
        .grantId,
    );
    clients.push(await createMcpHarness(userId, scopes));
  }
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (request.url !== getJwksUrlForOAuthVerification())
        throw new Error(`Unexpected remote request: ${request.url}`);
      return getBetterAuthInstance().handler(request);
    },
  );
  onlyCommunity = await httpMcp(communityWrite);
  onlyCompletion = await httpMcp(completionWrite);
  const course = await db.course.findFirstOrThrow({ select: { id: true } });
  sectionJwId = 1_500_000_000 + Math.floor(Math.random() * 100_000_000);
  sectionId = (
    await db.section.create({
      data: {
        jwId: sectionJwId,
        code: `HWTRANSPORT.${sectionJwId}`,
        courseId: course.id,
      },
    })
  ).id;
  publicId = await fixtureHomework(title);
  await db.description.create({
    data: { homeworkId: publicId, content: "Public assignment details" },
  });
  await db.homeworkCompletion.create({
    data: { userId: users[0], homeworkId: publicId },
  });
});
afterAll(async () => {
  setCalendarExportRebuildSenderForTest();
  await Promise.all([
    ...clients.map((client) => client.close()),
    onlyCommunity?.close(),
    onlyCompletion?.close(),
  ]);
  vi.unstubAllGlobals();
  await db.auditLog.deleteMany({ where: { userId: { in: users } } });
  if (sectionId) {
    await db.homework.deleteMany({ where: { sectionId } });
    await db.section.delete({ where: { id: sectionId } });
  }
  await db.oAuthConsent.deleteMany({ where: { clientId } });
  await db.oAuthClient.deleteMany({ where: { clientId } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await Promise.all([
    db.$disconnect(),
    prisma.$disconnect(),
    authPrisma.$disconnect(),
  ]);
});
async function fixtureHomework(title = `Fixture ${crypto.randomUUID()}`) {
  const row = await db.homework.create({
    data: { sectionId, title, createdById: users[0] },
  });
  return row.id;
}
async function request(
  index: number,
  method: string,
  body?: unknown,
  allowedScopes = scopes,
  audience = getOAuthRestAudienceUrls()[0],
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await signResourceBoundOAuthAccessToken({
    clientId,
    userId: users[index],
    grantId: grants[index],
    scopes: allowedScopes,
    resources: [audience],
    issuedAt,
    expiresAt: issuedAt + 300,
  });
  if (!token) throw new Error("Expected signed resource token");
  return new Request(
    `https://example.test${audience === getOAuthGraphqlResourceUrl() ? "/api/graphql" : "/api/community/section-homeworks"}`,
    {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    },
  );
}
async function graphql(
  index: number,
  query: string,
  variables: Record<string, unknown>,
  allowedScopes = scopes,
) {
  return (
    await createGraphqlYoga(false).fetch(
      await request(
        index,
        "POST",
        { query, variables },
        allowedScopes,
        getOAuthGraphqlResourceUrl(),
      ),
      { locals: { locale: "zh-cn" } },
    )
  ).json();
}
async function httpMcp(scope: string) {
  const signed = await request(
    0,
    "POST",
    {},
    [scope],
    getOAuthMcpResourceUrl(),
  );
  const client = new Client({
    name: "homework-scope-contract",
    version: "1.0.0",
  });
  const transport = new StreamableHTTPClientTransport(
    new URL(getOAuthMcpResourceUrl()),
    {
      requestInit: {
        headers: { authorization: signed.headers.get("authorization") ?? "" },
      },
      fetch: async (input, init) => handleMcpRequest(new Request(input, init)),
    },
  );
  await client.connect(transport);
  return client;
}
async function httpCall(
  client: Client,
  name: string,
  args: Record<string, unknown>,
) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(JSON.stringify(result));
  if (result.structuredContent) return result.structuredContent;
  const content = result.content as { type: string; text?: string }[];
  const text = content.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Expected MCP JSON result");
  return JSON.parse(text);
}
const gqlDelete =
  "mutation($id: ID!) { homeworkDelete(id: $id) { success id } }";
const gqlCreate =
  "mutation($input: CreateHomeworkInput!) { homeworkCreate(input: $input) { id } }";
const gqlUpdate =
  'mutation($id: ID!) { homeworkUpdate(id: $id, input: {title: "Updated through transport"}) { id } }';
const gqlComplete =
  "mutation($id: ID!) { homeworkCompletionSet(homeworkId: $id, completed: true) { completed } }";
const gqlBatch =
  "mutation($id: ID!) { homeworkCompletionsSet(items: [{homeworkId: $id, completed: false}]) { results { success completed } } }";

it("homework.public-section-read", async () => {
  const response = await getHomeworksRoute(
    new Request(
      `https://example.test/api/community/section-homeworks?sectionJwId=${sectionJwId}`,
    ),
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.data).toMatchObject([{ id: publicId, title, completion: null }]);
  const detail = await getHomeworkDetailRoute(
    new Request(
      `https://example.test/api/community/section-homeworks/${publicId}`,
    ),
    { id: publicId },
  );
  expect(detail.status).toBe(200);
  expect(await detail.json()).toMatchObject({
    homework: {
      id: publicId,
      title,
      completion: null,
      description: { content: "Public assignment details" },
    },
  });
  const denied = await handleMcpRequest(
    new Request(getOAuthMcpResourceUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "community_section_homework_list",
          arguments: { sectionJwId, mode: "full" },
        },
      }),
    }),
  );
  expect(denied.status).toBe(401);
  expect(
    await db.homeworkCompletion.count({ where: { homeworkId: publicId } }),
  ).toBe(1);
});

it("homework.transport-creator-delete", async () => {
  for (const transport of ["rest", "graphql", "mcp"] as const) {
    const id = await fixtureHomework();
    for (const foreign of [1, 2]) {
      if (transport === "rest")
        expect(
          (await deleteHomeworkRoute(await request(foreign, "DELETE"), { id }))
            .status,
        ).toBe(403);
      else if (transport === "graphql")
        expect(
          (await graphql(foreign, gqlDelete, { id })).errors[0].extensions.code,
        ).toBe("FORBIDDEN");
      else
        expect(
          await clients[foreign].call("community_section_homework_delete", {
            homeworkId: id,
          }),
        ).toMatchObject({ success: false, error: "forbidden" });
      expect(
        (await db.homework.findUniqueOrThrow({ where: { id } })).deletedAt,
      ).toBeNull();
    }
    if (transport === "rest")
      expect(
        (await deleteHomeworkRoute(await request(0, "DELETE"), { id })).status,
      ).toBe(200);
    else if (transport === "graphql")
      expect(await graphql(0, gqlDelete, { id })).toMatchObject({
        data: { homeworkDelete: { success: true, id } },
      });
    else
      expect(
        await clients[0].call("community_section_homework_delete", {
          homeworkId: id,
        }),
      ).toMatchObject({ success: true, deletedId: id });
    expect(
      await db.homework.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({ deletedById: users[0], deletedAt: expect.any(Date) });
  }
});

it("homework.oauth-write-gates", async () => {
  for (const transport of ["rest", "graphql", "mcp"] as const) {
    const id = await fixtureHomework();
    const input = { sectionJwId, title: `Scope-gated ${transport}` };
    const before = await db.homework.count({ where: { sectionId } });
    const rowBefore = await db.homework.findUniqueOrThrow({ where: { id } });
    if (transport === "rest") {
      expect(
        (
          await postHomeworkRoute(
            await request(0, "POST", input, [completionWrite]),
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await patchHomeworkRoute(
            await request(0, "PATCH", { title: "Denied" }, [completionWrite]),
            { id },
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await deleteHomeworkRoute(
            await request(0, "DELETE", undefined, [completionWrite]),
            { id },
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await putHomeworkCompletionRoute(
            await request(0, "PUT", { completed: true }, [communityWrite]),
            { id },
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await putHomeworkCompletionsRoute(
            await request(
              0,
              "PUT",
              { items: [{ homeworkId: id, completed: true }] },
              [communityWrite],
            ),
          )
        ).status,
      ).toBe(401);
    } else if (transport === "graphql") {
      for (const [query, variables, wrongScope] of [
        [gqlCreate, { input }, completionWrite],
        [gqlUpdate, { id }, completionWrite],
        [gqlDelete, { id }, completionWrite],
        [gqlComplete, { id }, communityWrite],
        [gqlBatch, { id }, communityWrite],
      ] as const) {
        const denied = await graphql(0, query, variables, [wrongScope]);
        expect(denied.errors).toHaveLength(1);
        expect(denied.data).toBeNull();
      }
    } else {
      for (const [tool, args] of [
        ["community_section_homework_create", input],
        [
          "community_section_homework_update",
          { homeworkId: id, title: "Denied" },
        ],
        ["community_section_homework_delete", { homeworkId: id }],
      ] as const)
        await expect(httpCall(onlyCompletion, tool, args)).rejects.toThrow();
      await expect(
        httpCall(onlyCommunity, "workspace_homework_completion_set", {
          homeworkId: id,
          completed: true,
        }),
      ).rejects.toThrow();
    }
    expect(await db.homework.count({ where: { sectionId } })).toBe(before);
    expect(await db.homework.findUniqueOrThrow({ where: { id } })).toEqual(
      rowBefore,
    );
    expect(
      await db.homeworkCompletion.count({ where: { homeworkId: id } }),
    ).toBe(0);
    if (transport === "rest") {
      expect(
        (
          await postHomeworkRoute(
            await request(0, "POST", input, [communityWrite]),
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await patchHomeworkRoute(
            await request(0, "PATCH", { title: "Updated through transport" }, [
              communityWrite,
            ]),
            { id },
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await putHomeworkCompletionRoute(
            await request(0, "PUT", { completed: true }, [completionWrite]),
            { id },
          )
        ).status,
      ).toBe(200);
      expect(
        await db.homeworkCompletion.count({ where: { homeworkId: id } }),
      ).toBe(1);
      expect(
        (
          await putHomeworkCompletionsRoute(
            await request(
              0,
              "PUT",
              { items: [{ homeworkId: id, completed: false }] },
              [completionWrite],
            ),
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await deleteHomeworkRoute(
            await request(0, "DELETE", undefined, [communityWrite]),
            { id },
          )
        ).status,
      ).toBe(200);
    } else if (transport === "graphql") {
      for (const [query, variables, scope] of [
        [gqlCreate, { input }, communityWrite],
        [gqlUpdate, { id }, communityWrite],
        [gqlComplete, { id }, completionWrite],
        [gqlBatch, { id }, completionWrite],
        [gqlDelete, { id }, communityWrite],
      ] as const) {
        const allowed = await graphql(0, query, variables, [scope]);
        expect(allowed.errors).toBeUndefined();
        expect(allowed.data).not.toBeNull();
        if (query === gqlComplete)
          expect(
            await db.homeworkCompletion.count({ where: { homeworkId: id } }),
          ).toBe(1);
      }
    } else {
      expect(
        await httpCall(
          onlyCommunity,
          "community_section_homework_create",
          input,
        ),
      ).toHaveProperty("id");
      expect(
        await httpCall(onlyCommunity, "community_section_homework_update", {
          homeworkId: id,
          title: "Updated through transport",
        }),
      ).toMatchObject({ success: true });
      expect(
        await httpCall(onlyCompletion, "workspace_homework_completion_set", {
          homeworkId: id,
          completed: true,
        }),
      ).toMatchObject({ success: true, completion: { completed: true } });
      expect(
        await db.homeworkCompletion.count({ where: { homeworkId: id } }),
      ).toBe(1);
      expect(
        await httpCall(onlyCompletion, "workspace_homework_completion_set", {
          homeworkId: id,
          completed: false,
        }),
      ).toMatchObject({ success: true, completion: { completed: false } });
      expect(
        await httpCall(onlyCommunity, "community_section_homework_delete", {
          homeworkId: id,
        }),
      ).toMatchObject({ success: true });
    }
    expect(await db.homework.count({ where: { sectionId } })).toBe(before + 1);
    expect(
      await db.homework.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({
      title: "Updated through transport",
      deletedById: users[0],
      deletedAt: expect.any(Date),
    });
    expect(
      await db.homeworkCompletion.count({ where: { homeworkId: id } }),
    ).toBe(0);
  }
});
