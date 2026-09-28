import { createServer, type Server } from "node:http";
import type { RequestEvent } from "@sveltejs/kit";
import { getRequest, setResponse } from "@sveltejs/kit/node";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { getSchedulesRoute } from "@/lib/api/routes/academic-schedule-routes";
import { getSectionSchedulesRoute } from "@/lib/api/routes/academic-section-routes";
import { getCurrentCalendarSubscriptionRoute } from "@/lib/api/routes/calendar-subscriptions";
import { mcpPostRoute } from "@/lib/api/routes/mcp";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthRestAudienceUrls } from "@/lib/oauth/resource-urls";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";
import {
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "../shared/catalog-contract-fixture";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const graphql = createGraphqlRequestHandler(false);
let server: Server;
let origin: string;
type Filter = Record<string, number | string>;
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
              requestId: "schedule-subscription-parity",
            },
          } as unknown as RequestEvent);
        if (path === "/api/catalog/schedules")
          return getSchedulesRoute(request);
        if (path === "/api/workspace/subscriptions/current")
          return getCurrentCalendarSubscriptionRoute(request);
        const section = /^\/api\/catalog\/sections\/(\d+)\/schedules$/.exec(
          path,
        );
        return section
          ? getSectionSchedulesRoute(request, { jwId: section[1] })
          : new Response(null, { status: 404 });
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
async function rest(path: string, filter: Filter = {}, token?: string) {
  const params = new URLSearchParams(
    Object.entries(filter).map(([key, value]) => [key, String(value)]),
  );
  const response = await fetch(`${origin}${path}?${params}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(200);
  return body;
}
async function mcp(name: string, args: Filter = {}, token?: string) {
  const response = await fetch(`${origin}/api/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: { ...args, locale: "zh-cn", mode: "full" } },
    }),
  });
  const text = await response.text();
  expect(response.status, text).toBe(200);
  const data = response.headers
    .get("content-type")
    ?.includes("text/event-stream")
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
const ids = (rows: { id: number }[]) => rows.map((row) => row.id);
async function compareSchedules(filter: Filter, expected: number[]) {
  const pageSize = 2;
  const pages = Math.max(1, Math.ceil(expected.length / pageSize));
  for (let page = 1; page <= pages + 1; page++) {
    const response = await rest("/api/catalog/schedules", {
      ...filter,
      page,
      pageSize,
    });
    const tool = await mcp("catalog_schedule_list", {
      ...filter,
      page,
      limit: pageSize,
    });
    expect(ids(response.data), JSON.stringify(filter)).toEqual(
      expected.slice((page - 1) * pageSize, page * pageSize),
    );
    expect(ids(tool.data)).toEqual(ids(response.data));
    expect(response.pagination).toEqual({
      page,
      pageSize,
      total: expected.length,
      totalPages: pages,
    });
    expect(tool.pagination).toEqual(response.pagination);
  }
}
it("interface-hierarchy.public-schedule-read-parity", async () => {
  const fixture = await createCatalogContractFixture(db);
  const rooms = await Promise.all(
    [0, 1].map((index) =>
      db.room.create({
        data: {
          jwId: fixture.base + index,
          code: `${fixture.marker}-room-${index}`,
          nameCn: `契约教室${index}`,
          virtual: false,
          seats: 40,
          seatsForSection: 40,
        },
      }),
    ),
  );
  try {
    const section = fixture.sections[0];
    const group = await db.scheduleGroup.create({
      data: {
        jwId: fixture.base,
        sectionId: section.id,
        no: 1,
        limitCount: 10,
        stdCount: 0,
        actualPeriods: 2,
        isDefault: true,
      },
    });
    const tied: number[] = [];
    for (const offset of [15, 14, 13, 12, 11, 10]) {
      const row = await db.schedule.create({
        data: {
          id: fixture.base + offset,
          sectionId: section.id,
          scheduleGroupId: group.id,
          date: new Date("2030-01-01T00:00:00Z"),
          weekday: 2,
          startTime: 800,
          endTime: 900,
          periods: 1,
          weekIndex: 1,
          startUnit: 1,
          endUnit: 1,
          roomId: rooms[0].id,
          teacherParticipations: {
            create: { teacherId: fixture.teachers[0].id },
          },
        },
      });
      tied.unshift(row.id);
    }
    const other: number[] = [];
    for (const day of [1, 2]) {
      const row = await db.schedule.create({
        data: {
          sectionId: section.id,
          scheduleGroupId: group.id,
          date: new Date(`2030-01-0${day}T00:00:00Z`),
          weekday: day + 1,
          startTime: 1000,
          endTime: 1100,
          periods: 1,
          weekIndex: 1,
          startUnit: 2,
          endUnit: 2,
          roomId: rooms[1].id,
          teacherParticipations: {
            create: { teacherId: fixture.teachers[1].id },
          },
        },
      });
      other.push(row.id);
    }
    resetPublicRuntimeCacheForTest();
    const all = [...tied, ...other];
    for (const filter of [
      { sectionId: section.id },
      { sectionJwId: section.jwId },
      { sectionCode: section.code },
      { sectionId: section.id, sectionJwId: section.jwId },
    ] as Filter[])
      await compareSchedules(filter, all);
    for (const filter of [
      { teacherId: fixture.teachers[0].id },
      { teacherCode: fixture.teachers[0].code ?? "" },
      { roomId: rooms[0].id },
      { roomJwId: rooms[0].jwId },
      { teacherId: fixture.teachers[0].id, roomJwId: rooms[0].jwId },
    ] as Filter[])
      await compareSchedules({ sectionId: section.id, ...filter }, tied);
    await compareSchedules(
      {
        sectionId: section.id,
        weekday: 3,
        dateFrom: "2030-01-02T00:00:00Z",
        dateTo: "2030-01-02T00:00:00Z",
      },
      [other[1]],
    );
    for (const filter of [
      { sectionId: section.id, sectionJwId: fixture.sections[1].jwId },
      { sectionId: section.jwId },
      { sectionJwId: section.id },
      {
        sectionId: section.id,
        teacherId: fixture.teachers[0].id,
        teacherCode: fixture.teachers[1].code ?? "",
      },
      { sectionId: section.id, roomId: rooms[0].id, roomJwId: rooms[1].jwId },
      { sectionId: section.id, roomId: rooms[0].jwId },
      { sectionId: section.id, dateFrom: "2030-01-03T00:00:00Z" },
    ] as Filter[])
      await compareSchedules(filter, []);
    for (const limit of [2, 100]) {
      const filter = {
        dateFrom: "2030-01-01T00:00:00Z",
        dateTo: "2030-01-01T00:00:00Z",
        limit,
      };
      const response = await rest(
        `/api/catalog/sections/${section.jwId}/schedules`,
        filter,
      );
      const tool = await mcp("catalog_section_schedule_list", {
        ...filter,
        sectionJwId: section.jwId,
      });
      expect(ids(response)).toEqual([...tied, other[0]].slice(0, limit));
      expect(ids(tool.schedules)).toEqual(ids(response));
      expect(tool.found).toBe(true);
      expect(tool.section.jwId).toBe(section.jwId);
    }
  } finally {
    await cleanupCatalogContractFixture(db, fixture);
    await db.room.deleteMany({
      where: { id: { in: rooms.map((room) => room.id) } },
    });
    resetPublicRuntimeCacheForTest();
  }
});

it("interface-hierarchy.subscription-read-parity", async () => {
  const fixture = await createCatalogContractFixture(db);
  const userIds = [0, 1, 2].map(
    (index) => `${fixture.marker}-subscriber-${index}`,
  );
  const clientId = `${fixture.marker}-subscription-client`;
  try {
    await db.user.createMany({
      data: userIds.map((id) => ({ id, email: `${id}@example.test` })),
    });
    const scopes = ["workspace.subscription:read"];
    const client = await db.oAuthClient.create({
      data: {
        clientId,
        name: "Subscription parity",
        redirectUris: ["https://example.test/callback"],
        consents: { create: userIds.map((userId) => ({ userId, scopes })) },
      },
      include: { consents: true },
    });
    const newer = await db.semester.create({
      data: {
        jwId: fixture.base + 1,
        code: `${fixture.marker}-newer`,
        nameCn: "2030春",
      },
    });
    fixture.cleanupIds.semesters.push(newer.id);
    const rows: { id: number; jwId: number; kind: string }[] = [];
    for (const offset of [15, 14, 13, 12, 11, 10]) {
      const section = await db.section.create({
        data: {
          jwId: fixture.base + offset,
          code: `${fixture.marker}-same`,
          courseId: fixture.courses[0].id,
          semesterId: newer.id,
          ...(offset === 12
            ? { retiredAt: new Date("2025-01-01T00:00:00Z") }
            : {}),
        },
      });
      fixture.cleanupIds.sections.push(section.id);
      const kind = offset % 2 ? "auditor" : "regular";
      await db.userSectionSubscription.create({
        data: { userId: userIds[0], sectionId: section.id, kind },
      });
      rows.unshift({ id: section.id, jwId: section.jwId, kind });
    }
    const first = await db.section.create({
      data: {
        jwId: fixture.base + 16,
        code: `A-${fixture.marker}`,
        courseId: fixture.courses[0].id,
        semesterId: newer.id,
      },
    });
    fixture.cleanupIds.sections.push(first.id);
    await db.userSectionSubscription.createMany({
      data: [
        { userId: userIds[0], sectionId: first.id, kind: "teaching_assistant" },
        {
          userId: userIds[0],
          sectionId: fixture.sections[0].id,
          kind: "regular",
        },
        {
          userId: userIds[1],
          sectionId: rows[2].id,
          kind: "teaching_assistant",
        },
        { userId: userIds[1], sectionId: rows[4].id, kind: "auditor" },
      ],
    });
    const expected = [
      [
        { id: first.id, jwId: first.jwId, kind: "teaching_assistant" },
        ...rows,
        {
          id: fixture.sections[0].id,
          jwId: fixture.sections[0].jwId,
          kind: "regular",
        },
      ],
      [
        { ...rows[2], kind: "teaching_assistant" },
        { ...rows[4], kind: "auditor" },
      ],
      [],
    ];
    for (const [index, userId] of userIds.entries()) {
      const grantId = client.consents.find(
        (consent) => consent.userId === userId,
      )?.grantId;
      if (!grantId) throw new Error("Missing fixture grant");
      const tokens: Record<string, string> = {};
      for (const [transport, resource] of Object.entries({
        rest: getOAuthRestAudienceUrls()[0],
        graphql: `${origin}/api/graphql`,
        mcp: `${origin}/api/mcp`,
      })) {
        const issuedAt = Math.floor(Date.now() / 1000);
        const token = await runtime(() =>
          signResourceBoundOAuthAccessToken({
            clientId,
            grantId,
            userId,
            scopes,
            resources: [resource],
            issuedAt,
            expiresAt: issuedAt + 300,
          }),
        );
        if (!token) throw new Error("Missing signed token");
        tokens[transport] = token;
      }
      const project = (items: { id: number; jwId: number; kind: string }[]) =>
        items.map(({ id, jwId, kind }) => ({ id, jwId, kind }));
      const response = await rest(
        "/api/workspace/subscriptions/current",
        { userId: userIds[(index + 1) % 3] },
        tokens.rest,
      );
      const tool = await mcp("workspace_subscription_list", {}, tokens.mcp);
      expect(project(response.subscription.sections)).toEqual(expected[index]);
      expect(project(tool.sections)).toEqual(expected[index]);
      // REST/MCP expose the complete set with no pagination inputs or fabricated total.
      expect(response.pagination).toBeUndefined();
      expect(tool.pagination).toBeUndefined();
      const pages = Math.max(1, Math.ceil(expected[index].length / 2));
      for (let page = 1; page <= pages + 1; page++) {
        const result = await fetch(`${origin}/api/graphql`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${tokens.graphql}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            query:
              "query($page:PageInput){workspace{subscribedSections(page:$page){items{kind section{id jwId}} pageInfo{page pageSize total totalPages}}}}",
            variables: { page: { page, pageSize: 2 } },
          }),
        });
        expect(result.status).toBe(200);
        const body = await result.json();
        expect(body.errors).toBeUndefined();
        const resultPage = body.data.workspace.subscribedSections;
        expect(
          resultPage.items.map(
            (row: { kind: string; section: { id: number; jwId: number } }) => ({
              ...row.section,
              kind: row.kind,
            }),
          ),
        ).toEqual(expected[index].slice((page - 1) * 2, page * 2));
        expect(resultPage.pageInfo).toEqual({
          page,
          pageSize: 2,
          total: expected[index].length,
          totalPages: pages,
        });
      }
    }
  } finally {
    await db.oAuthClient.deleteMany({ where: { clientId } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await cleanupCatalogContractFixture(db, fixture);
  }
});
