import { createServer, type Server } from "node:http";
import { getRequest, setResponse } from "@sveltejs/kit/node";
import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { getDescriptionRoute } from "@/lib/api/routes/description-read-route";
import { getHomeworksRoute } from "@/lib/api/routes/homework-list-read-route";
import { mcpPostRoute } from "@/lib/api/routes/mcp";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";
import {
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "../shared/catalog-contract-fixture";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
let server: Server;
let origin: string;
type Filter = Record<string, string | number | boolean | undefined>;
type Reader = { id: string; clientId: string; cookie: string; token: string };
function runtime<T>(work: () => T) {
  if (!process.env.DATABASE_URL || !process.env.AUTH_DATABASE_URL)
    throw new Error("Missing restricted database URLs");
  return runWithCloudflareRuntimeEnv(
    {
      HYPERDRIVE: { connectionString: process.env.DATABASE_URL },
      HYPERDRIVE_AUTH: { connectionString: process.env.AUTH_DATABASE_URL },
    },
    work,
  );
}
beforeAll(async () => {
  server = createServer(async (incoming, outgoing) => {
    try {
      const request = await getRequest({ request: incoming, base: origin });
      const response = await runtime(async () => {
        switch (new URL(request.url).pathname) {
          case "/api/auth/jwks":
            return getBetterAuthInstance().handler(request);
          case "/api/mcp":
            return mcpPostRoute(request);
          case "/api/community/section-homeworks":
            return getHomeworksRoute(request);
          case "/api/community/descriptions":
            return getDescriptionRoute(request);
          default:
            return new Response(null, { status: 404 });
        }
      });
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
});
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  await db.$disconnect();
  vi.unstubAllEnvs();
});
async function createReader(marker: string): Promise<Reader> {
  const id = `${marker}-reader`;
  const clientId = `${marker}-client`;
  const scopes = [
    "community.section-homework:read",
    "community.description:read",
    "community.comment:read",
  ];
  await db.user.create({ data: { id, email: `${id}@example.test`, name: id } });
  const sessionToken = crypto.randomUUID();
  await db.session.create({
    data: { userId: id, sessionToken, expires: new Date(Date.now() + 3600000) },
  });
  const context = await runtime(() => getBetterAuthInstance().$context);
  const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, context.secret)}`)}`;
  const client = await db.oAuthClient.create({
    data: {
      clientId,
      name: "Community read parity",
      redirectUris: ["https://example.test/callback"],
      consents: { create: { userId: id, scopes } },
    },
    include: { consents: true },
  });
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await runtime(() =>
    signResourceBoundOAuthAccessToken({
      clientId,
      userId: id,
      grantId: client.consents[0].grantId,
      scopes,
      resources: [`${origin}/api/mcp`],
      issuedAt,
      expiresAt: issuedAt + 600,
    }),
  );
  if (!token) throw new Error("Missing signed MCP token");
  return { id, clientId, cookie, token };
}
async function cleanupReaders(readers: Reader[]) {
  const ids = readers.map((reader) => reader.id);
  await db.auditLog.deleteMany({
    where: { OR: [{ userId: { in: ids } }, { subjectUserId: { in: ids } }] },
  });
  await db.oAuthClient.deleteMany({
    where: { clientId: { in: readers.map((reader) => reader.clientId) } },
  });
  await db.user.deleteMany({ where: { id: { in: ids } } });
}
async function response(path: string, filter: Filter, reader?: Reader) {
  const params = new URLSearchParams(
    Object.entries(filter)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
  return fetch(`${origin}${path}?${params}`, {
    headers: reader ? { cookie: reader.cookie } : {},
  });
}
async function rest(path: string, filter: Filter, reader?: Reader) {
  const result = await response(path, filter, reader);
  const body = await result.json();
  expect(result.status, JSON.stringify(body)).toBe(200);
  return body;
}
async function mcp(name: string, args: Filter, reader?: Reader) {
  const result = await fetch(`${origin}/api/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(reader ? { authorization: `Bearer ${reader.token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: { ...args, locale: "zh-cn", mode: "full" } },
    }),
  });
  const text = await result.text();
  expect(result.status, text).toBe(200);
  const data = result.headers.get("content-type")?.includes("text/event-stream")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .at(-1)
        ?.slice(6)
    : text;
  if (!data) throw new Error("Missing MCP response");
  const body = JSON.parse(data);
  expect(body.error).toBeUndefined();
  expect(body.result.isError, data).not.toBe(true);
  return JSON.parse(
    body.result.content.find((part: { type: string }) => part.type === "text")
      .text,
  );
}
const homeworkPath = "/api/community/section-homeworks";
function projectHomework(rows: Record<string, unknown>[]) {
  return rows.map(
    ({
      createdById: _createdById,
      updatedById: _updatedById,
      deletedById: _deletedById,
      ...row
    }) => row,
  );
}

it("interface-hierarchy.public-homework-read-parity", async () => {
  const fixture = await createCatalogContractFixture(db);
  const readers = [
    await createReader(`${fixture.marker}-owner`),
    await createReader(`${fixture.marker}-other`),
  ];
  const [section, otherSection] = fixture.sections;
  const ids = Array.from(
    { length: 10 },
    (_, i) => `${fixture.marker}-homework-${String(i).padStart(2, "0")}`,
  );
  try {
    await db.userSectionSubscription.createMany({
      data: readers.map((reader) => ({
        userId: reader.id,
        sectionId: section.id,
      })),
    });
    for (const index of [9, 8, 7, 6, 5, 4, 3, 2, 1, 0])
      await db.homework.create({
        data: {
          id: ids[index],
          sectionId: section.id,
          title: `${fixture.marker} assignment ${index}`,
          createdById: readers[0].id,
          submissionDueAt:
            index === 8
              ? null
              : new Date(
                  index === 6
                    ? "2035-09-14T10:00:00Z"
                    : index === 7
                      ? "2035-09-16T10:00:00Z"
                      : "2035-09-15T10:00:00Z",
                ),
          createdAt: new Date("2035-01-01T00:00:00.437Z"),
          ...(index === 9
            ? {
                deletedAt: new Date("2035-08-01T00:00:00Z"),
                deletedById: readers[0].id,
              }
            : {}),
        },
      });
    const other = await db.homework.create({
      data: {
        id: `${fixture.marker}-other-homework`,
        title: "Other section assignment",
        sectionId: otherSection.id,
        submissionDueAt: new Date("2035-09-13T00:00:00Z"),
      },
    });
    await db.homeworkCompletion.create({
      data: {
        userId: readers[0].id,
        homeworkId: ids[0],
        completedAt: new Date("2035-01-02T00:00:00.437Z"),
      },
    });
    const expected = [ids[6], ...ids.slice(0, 6), ids[7], ids[8]];
    for (const reader of readers)
      for (const includeDeleted of [false, true]) {
        const order = includeDeleted
          ? [ids[6], ...ids.slice(0, 6), ids[9], ids[7], ids[8]]
          : expected;
        const tools = await mcp(
          "community_section_homework_list",
          { sectionJwId: section.jwId, includeDeleted },
          reader,
        );
        expect(tools.found).toBe(true);
        expect(tools.section).toMatchObject({
          id: section.id,
          jwId: section.jwId,
        });
        expect(tools.homeworks.map((row: { id: string }) => row.id)).toEqual(
          order,
        );
        expect(tools.pagination).toBeUndefined();
        const completion = tools.homeworks.find(
          (row: { id: string }) => row.id === ids[0],
        ).completion;
        if (reader.id === readers[0].id) {
          expect(new Date(completion.completedAt).toISOString()).toBe(
            "2035-01-02T00:00:00.437Z",
          );
        } else expect(completion).toBeNull();
        for (const selector of [
          { sectionJwId: section.jwId },
          { sectionId: section.id },
          { sectionIds: String(section.id) },
        ]) {
          for (let page = 1; page <= Math.ceil(order.length / 2) + 1; page++) {
            const result = await rest(
              homeworkPath,
              { ...selector, includeDeleted, page, pageSize: 2 },
              reader,
            );
            expect(projectHomework(result.data)).toEqual(
              tools.homeworks.slice((page - 1) * 2, page * 2),
            );
            expect(result.pagination).toEqual({
              page,
              pageSize: 2,
              total: order.length,
              totalPages: Math.ceil(order.length / 2),
            });
          }
        }
        const defaults = await rest(
          homeworkPath,
          { sectionJwId: section.jwId, includeDeleted },
          reader,
        );
        expect(defaults.pagination).toMatchObject({
          page: 1,
          pageSize: 20,
          total: order.length,
        });
        expect(projectHomework(defaults.data)).toEqual(tools.homeworks);
      }
    const anonymous = await rest(homeworkPath, {
      sectionJwId: section.jwId,
      pageSize: 50,
    });
    expect(anonymous.data.map((row: { id: string }) => row.id)).toEqual(
      expected,
    );
    expect(
      anonymous.data.every(
        (row: { completion: unknown }) => row.completion === null,
      ),
    ).toBe(true);
    for (const filter of [
      { sectionIds: `${section.id},${otherSection.id},${section.id}` },
      { sectionId: section.id, sectionJwId: otherSection.jwId },
      { sectionIds: String(section.id), sectionJwId: otherSection.jwId },
    ]) {
      const result = await rest(homeworkPath, { ...filter, pageSize: 50 });
      expect(result.data.map((row: { id: string }) => row.id)).toEqual([
        other.id,
        ...expected,
      ]);
      expect(result.pagination.total).toBe(10);
    }
    expect(
      (await rest(homeworkPath, { sectionId: section.jwId })).data,
    ).toEqual([]);
    expect(
      (await response(homeworkPath, { sectionJwId: section.id })).status,
    ).toBe(404);
    expect(
      await mcp(
        "community_section_homework_list",
        { sectionJwId: section.id },
        readers[0],
      ),
    ).toMatchObject({ found: false });
    for (const bounds of [
      { page: 0 },
      { page: 101 },
      { pageSize: 0 },
      { pageSize: 51 },
    ])
      expect(
        (await response(homeworkPath, { sectionJwId: section.jwId, ...bounds }))
          .status,
      ).toBe(400);
  } finally {
    await cleanupCatalogContractFixture(db, fixture);
    await cleanupReaders(readers);
    resetPublicRuntimeCacheForTest();
  }
});

it("interface-hierarchy.description-read-parity", async () => {
  const fixture = await createCatalogContractFixture(db);
  const reader = await createReader(fixture.marker);
  try {
    const homework = await db.homework.create({
      data: { title: "Description target", sectionId: fixture.sections[0].id },
    });
    const targets = [
      {
        type: "section",
        id: fixture.sections[0].id,
        public: { sectionJwId: fixture.sections[0].jwId },
        relation: { sectionId: fixture.sections[0].id },
        wrong: { sectionJwId: fixture.sections[0].id },
        empty: { sectionJwId: fixture.sections[1].jwId },
      },
      {
        type: "course",
        id: fixture.courses[0].id,
        public: { courseJwId: fixture.courses[0].jwId },
        relation: { courseId: fixture.courses[0].id },
        wrong: { courseJwId: fixture.courses[0].id },
        empty: { courseJwId: fixture.courses[1].jwId },
      },
      {
        type: "teacher",
        id: fixture.teachers[0].id,
        public: { teacherId: fixture.teachers[0].id },
        relation: { teacherId: fixture.teachers[0].id },
        wrong: { teacherId: fixture.teachers[0].jwId },
        empty: { teacherId: fixture.teachers[1].id },
      },
      {
        type: "homework",
        id: homework.id,
        public: { homeworkId: homework.id },
        relation: { homeworkId: homework.id },
        wrong: { homeworkId: `${fixture.marker}-missing` },
        empty: null,
      },
    ];
    for (const target of targets) {
      const content = `# ${target.type}\n\n${fixture.marker} source **Markdown**`;
      const description = await db.description.create({
        data: { ...target.relation, content, lastEditedById: reader.id },
      });
      const historyIds = [];
      // Ascending insertion opposes the descending unique-ID tie-breaker, including the 20-row boundary.
      for (let index = 0; index < 24; index++) {
        const id = `${fixture.marker}-${target.type}-edit-${String(index).padStart(2, "0")}`;
        await db.descriptionEdit.create({
          data: {
            id,
            descriptionId: description.id,
            editorId: reader.id,
            nextContent: `revision ${index}`,
            previousContent: index ? `revision ${index - 1}` : null,
            createdAt: new Date("2035-01-01T00:00:00.437Z"),
          },
        });
        historyIds.unshift(id);
      }
      const old = await db.descriptionEdit.create({
        data: {
          descriptionId: description.id,
          nextContent: "older",
          createdAt: new Date("2034-01-01T00:00:00Z"),
        },
      });
      for (const selector of [target.public, { targetId: target.id }]) {
        const filter = { targetType: target.type, ...selector };
        const result = await rest(
          "/api/community/descriptions",
          filter,
          reader,
        );
        const tools = await mcp("community_description_get", filter, reader);
        const { found, success, target: toolTarget, ...payload } = tools;
        expect(success).toBe(true);
        expect(found).toBe(true);
        expect(toolTarget).toMatchObject({
          type: target.type,
          targetId: target.id,
        });
        expect(payload).toEqual(result);
        expect(result.description).toMatchObject({
          id: description.id,
          content,
        });
        expect(result.history.map((row: { id: string }) => row.id)).toEqual(
          historyIds.slice(0, 20),
        );
        expect(
          result.history.some((row: { id: string }) => row.id === old.id),
        ).toBe(false);
      }
      const wrong = { targetType: target.type, ...target.wrong };
      expect(
        (await response("/api/community/descriptions", wrong, reader)).status,
      ).toBe(404);
      expect(
        await mcp("community_description_get", wrong, reader),
      ).toMatchObject({ found: false, error: "target_not_found" });
      if (target.empty) {
        const filter = { targetType: target.type, ...target.empty };
        const result = await rest(
          "/api/community/descriptions",
          filter,
          reader,
        );
        expect(result.description.id).toBeNull();
        expect(result.history).toEqual([]);
        const tools = await mcp("community_description_get", filter, reader);
        expect(tools.description).toEqual(result.description);
        expect(tools.history).toEqual([]);
      }
      expect(
        await db.descriptionEdit.count({
          where: { descriptionId: description.id },
        }),
      ).toBe(25);
    }
  } finally {
    await cleanupCatalogContractFixture(db, fixture);
    await cleanupReaders([reader]);
    resetPublicRuntimeCacheForTest();
  }
});
