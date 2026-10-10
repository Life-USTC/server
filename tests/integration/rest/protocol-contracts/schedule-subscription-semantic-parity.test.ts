import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";
import { createCatalogContractFixture } from "../../../shared/catalog-contract-fixture";
import { createParityTokenSigner } from "./_parity-auth";
import { nativeEnvelope } from "./_transport";

type Filter = Record<string, number | string>;
function createReaders(origin: string, transport: "REST" | "GraphQL" | "MCP") {
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
    const body = await nativeEnvelope(response);
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.error).toBeUndefined();
    expect(body.result.isError, JSON.stringify(body)).not.toBe(true);
    return JSON.parse(
      body.result.content.find((part: { type: string }) => part.type === "text")
        .text,
    );
  }
  async function compareSchedules(filter: Filter, expected: number[]) {
    const pageSize = 2;
    const pages = Math.max(1, Math.ceil(expected.length / pageSize));
    for (let page = 1; page <= pages + 1; page++) {
      const response =
        transport === "REST"
          ? await rest("/api/catalog/schedules", { ...filter, page, pageSize })
          : await mcp("catalog_schedule_list", {
              ...filter,
              page,
              limit: pageSize,
            });
      expect(ids(response.data), JSON.stringify(filter)).toEqual(
        expected.slice((page - 1) * pageSize, page * pageSize),
      );
      expect(response.pagination).toEqual({
        page,
        pageSize,
        total: expected.length,
        totalPages: pages,
      });
    }
  }
  return { rest, mcp, compareSchedules };
}
const ids = (rows: { id: number }[]) => rows.map((row) => row.id);
for (const transport of ["REST", "MCP"] as const)
  test(
    `interface-hierarchy.public-schedule-read-parity through ${transport}`,
    { tag: `@Schedule/${transport}` },
    async ({ isolatedWorker, run }) =>
      run(async () => {
        const db = isolatedWorker.database.owner;
        const origin = isolatedWorker.origin;
        const { rest, mcp, compareSchedules } = createReaders(
          origin,
          transport,
        );
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
          {
            sectionId: section.id,
            roomId: rooms[0].id,
            roomJwId: rooms[1].jwId,
          },
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
          const expected = [...tied, other[0]].slice(0, limit);
          if (transport === "REST") {
            const response = await rest(
              `/api/catalog/sections/${section.jwId}/schedules`,
              filter,
            );
            expect(ids(response)).toEqual(expected);
          } else {
            const tool = await mcp("catalog_section_schedule_list", {
              ...filter,
              sectionJwId: section.jwId,
            });
            expect(ids(tool.schedules)).toEqual(expected);
            expect(tool.found).toBe(true);
            expect(tool.section.jwId).toBe(section.jwId);
          }
        }
      }),
  );
for (const transport of ["REST", "GraphQL", "MCP"] as const)
  test(
    `interface-hierarchy.subscription-read-parity through ${transport}`,
    { tag: `@Subscription/${transport}` },
    async ({ isolatedWorker, run }) =>
      run(async () => {
        const db = isolatedWorker.database.owner;
        const origin = isolatedWorker.origin;
        const { rest, mcp } = createReaders(origin, transport);
        const signToken = await createParityTokenSigner(isolatedWorker);
        const fixture = await createCatalogContractFixture(db);
        const userIds = [0, 1, 2].map(
          (index) => `${fixture.marker}-subscriber-${index}`,
        );
        const clientId = `${fixture.marker}-subscription-client`;
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
        await db.userSectionSubscription.createMany({
          data: [
            {
              userId: userIds[0],
              sectionId: first.id,
              kind: "teaching_assistant",
            },
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
            rest: `${origin}/api/auth`,
            graphql: `${origin}/api/graphql`,
            mcp: `${origin}/api/mcp`,
          })) {
            const issuedAt = Math.floor(Date.now() / 1000);
            const token = await signToken({
              clientId,
              grantId,
              userId,
              scopes,
              resource,
              issuedAt,
              expiresAt: issuedAt + 300,
            });
            if (!token) throw new Error("Missing signed token");
            tokens[transport] = token;
          }
          const project = (
            items: { id: number; jwId: number; kind: string }[],
          ) => items.map(({ id, jwId, kind }) => ({ id, jwId, kind }));
          if (transport === "REST") {
            const response = await rest(
              "/api/workspace/subscriptions/current",
              { userId: userIds[(index + 1) % 3] },
              tokens.rest,
            );
            expect(project(response.subscription.sections)).toEqual(
              expected[index],
            );
            expect(response.pagination).toBeUndefined();
          } else if (transport === "MCP") {
            const tool = await mcp(
              "workspace_subscription_list",
              {},
              tokens.mcp,
            );
            expect(project(tool.sections)).toEqual(expected[index]);
            expect(tool.pagination).toBeUndefined();
          }
          if (transport !== "GraphQL") continue;
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
                (row: {
                  kind: string;
                  section: { id: number; jwId: number };
                }) => ({
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
      }),
  );
