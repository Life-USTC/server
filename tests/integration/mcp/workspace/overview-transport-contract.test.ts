import { expect } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { getMyCompactOverviewRoute } from "@/lib/api/routes/workspace-overview-route";
import { createGraphqlYoga } from "@/lib/graphql/server";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthRestAudienceUrls,
} from "@/lib/mcp/urls";
import type { McpHarness } from "../_harness/client";
import { isolatedMcpTest } from "../_harness/isolated-context";

const contractTest = isolatedMcpTest.extend(
  "state",
  async ({ isolatedDatabase, mcpRuntime, mcpSessions }) => {
    const owner = isolatedDatabase.owner;
    const users = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];
    const clientId = `overview-parity-${crypto.randomUUID()}`;
    const scopes = ["workspace.overview:read"];
    const clients: McpHarness[] = [];
    const grants: string[] = [];
    const anchor = new Date("2027-01-15T10:30:00.437+08:00");
    const day = 86_400_000;
    const offsets = [
      -1,
      0,
      3_600_000,
      3_600_000,
      7 * day,
      7 * day + 1,
      3_600_000,
      null,
      8 * day,
    ];
    const todoIds = offsets.map(() => crypto.randomUUID());
    const homeworkIds = offsets.map(() => crypto.randomUUID());
    const examIds: number[] = [];
    const at = (offset: number) => new Date(anchor.getTime() + offset);
    const ids = (items: Sample[]) => items.map((item) => item.id);
    async function request(owner: number, path: string, body?: unknown) {
      const issuedAt = Math.floor(Date.now() / 1000);
      const token = await signResourceBoundOAuthAccessToken({
        clientId,
        userId: users[owner],
        grantId: grants[owner],
        scopes,
        resources: [
          body ? getOAuthGraphqlResourceUrl() : getOAuthRestAudienceUrls()[0],
        ],
        issuedAt,
        expiresAt: issuedAt + 300,
      });
      if (!token) throw new Error("Expected signed resource token");
      return new Request(`https://example.test${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    }
    async function restRead(
      owner: number,
      atTime: string,
      limit?: number,
      homeworkWindowDays?: number,
    ) {
      const query = new URLSearchParams({
        atTime,
        locale: "en-us",
        userId: users[2],
        ...(limit === undefined ? {} : { limit: String(limit) }),
        ...(homeworkWindowDays === undefined
          ? {}
          : { homeworkWindowDays: String(homeworkWindowDays) }),
      });
      // Register the Response before assertions or parsing can fail, so the
      // runtime also owns cancellation of an unread response body.
      const response = await mcpRuntime.run(async () =>
        getMyCompactOverviewRoute(
          await request(owner, `/api/workspace/overview?${query}`),
        ),
      );
      expect(response.status).toBe(200);
      return (await response.json()) as RestOverview;
    }
    async function graphRead(owner: number, atTime: string) {
      const response = await mcpRuntime.run(async () =>
        createGraphqlYoga(false).fetch(
          await request(owner, "/api/graphql", {
            query:
              "query($atTime: DateTime!) { workspace { overview(atTime: $atTime) { atTime today homeworkWindowEnd incompleteTodos completedTodos overdueTodos pendingHomeworks dueSoonHomeworks todaySchedules upcomingExams } } }",
            variables: { atTime },
          }),
          { locals: { locale: "en-us" } },
        ),
      );
      const result = await response.json();
      expect(result.errors).toBeUndefined();
      return result.data.workspace.overview;
    }

    const { courseId, sectionId } = await owner.$transaction(async (db) => {
      await db.user.createMany({
        data: users.map((id, i) => ({
          id,
          name: `Overview owner ${i}`,
          email: `${id}@test.invalid`,
        })),
      });
      await db.oAuthClient.create({
        data: {
          clientId,
          name: "Overview parity",
          scopes,
          redirectUris: ["https://client.example/callback"],
        },
      });
      for (const userId of users.slice(0, 2)) {
        grants.push(
          (await db.oAuthConsent.create({ data: { clientId, userId, scopes } }))
            .grantId,
        );
      }
      const marker = 1_800_000_000 + Math.floor(Math.random() * 100_000_000);
      const courseId = (
        await db.course.create({
          data: {
            jwId: marker,
            code: `PARITY${marker}`,
            nameCn: "概览课程",
            nameEn: "Overview course",
          },
        })
      ).id;
      const sectionId = (
        await db.section.create({
          data: { courseId, jwId: marker, code: `PARITY.${marker}` },
        })
      ).id;
      await db.userSectionSubscription.createMany({
        data: [users[0], users[2]].map((userId) => ({ userId, sectionId })),
      });
      // Deliberately insert in reverse display order. Equal deadlines use different creation instants.
      for (const i of [8, 7, 6, 5, 4, 3, 2, 1, 0]) {
        const dueAt = offsets[i] === null ? null : at(offsets[i]);
        const createdAt = at(-day + i * 1000);
        await db.todo.create({
          data: {
            id: todoIds[i],
            userId: users[0],
            title: `Todo ${i}`,
            dueAt,
            createdAt,
            completed: i === 6,
            priority: i % 2 ? "high" : "low",
          },
        });
        await db.homework.create({
          data: {
            id: homeworkIds[i],
            sectionId,
            title: `Homework ${i}`,
            submissionDueAt: dueAt,
            createdAt,
            deletedAt: i === 8 ? at(-1000) : null,
          },
        });
      }
      await db.homeworkCompletion.createMany({
        data: [
          { userId: users[0], homeworkId: homeworkIds[6] },
          { userId: users[2], homeworkId: homeworkIds[1] },
        ],
      });
      await db.todo.create({
        data: { userId: users[2], title: "Foreign pending todo", dueAt: at(0) },
      });
      const group = await db.scheduleGroup.create({
        data: {
          sectionId,
          jwId: marker,
          no: 1,
          isDefault: true,
          stdCount: 0,
          limitCount: 10,
          actualPeriods: 2,
        },
      });
      for (const [i, startTime] of [1100, 900, 1000, 800].entries()) {
        await db.schedule.create({
          data: {
            sectionId,
            scheduleGroupId: group.id,
            date: new Date(
              i === 3 ? "2027-01-16T00:00:00Z" : "2027-01-15T00:00:00Z",
            ),
            weekday: 5,
            weekIndex: 1,
            startUnit: 1,
            endUnit: 2,
            periods: 2,
            startTime,
            endTime: startTime + 50,
          },
        });
      }
      for (const [i, [startTime, endTime]] of [
        [900, 930],
        [1000, 1100],
        [1200, 1300],
        [1200, 1300],
        [800, 900],
      ].entries()) {
        examIds.push(
          (
            await db.exam.create({
              data: {
                sectionId,
                jwId: marker + i,
                examDate: new Date(
                  i === 4 ? "2027-01-16T00:00:00Z" : "2027-01-15T00:00:00Z",
                ),
                startTime,
                endTime,
                examMode: `Exam ${i}`,
              },
            })
          ).id,
        );
      }

      return { courseId, sectionId };
    });
    for (const userId of users.slice(0, 2)) {
      const session = mcpSessions.own(userId, scopes);
      clients.push(session.client);
      await session.initialize();
    }

    return {
      users,
      clientId,
      scopes,
      clients,
      grants,
      anchor,
      day,
      offsets,
      todoIds,
      homeworkIds,
      examIds,
      courseId,
      sectionId,
      at,
      ids,
      restRead,
      graphRead,
    };
  },
);

type Sample = { id: string | number; [key: string]: unknown };
type RestOverview = {
  user: {
    userId: string;
    name: string;
    image: string | null;
    isAdmin: boolean;
  };
  anchor: {
    atTime: string;
    todayStart: string;
    homeworkWindowEnd: string;
    limit: number;
  };
  counts: {
    todos: { incomplete: number; completed: number; overdue: number };
    pendingHomeworks: number;
    dueSoonHomeworks: number;
    todaySchedules: number;
    upcomingExams: number;
  };
  dueTodos: { total: number; items: Sample[] };
  homeworks: { total: number; items: Sample[] };
  exams: { total: number; items: Sample[] };
  schedules: { total: number; items: (Sample & { startTime: string })[] };
};
type McpOverview = {
  user: { id: string };
  overview: {
    pendingTodosCount: number;
    pendingHomeworksCount: number;
    todaySchedulesCount: number;
    upcomingExamsCount: number;
  };
  samples: {
    dueTodos: Sample[];
    dueHomeworks: Sample[];
    upcomingExams: Sample[];
  };
};

// One prepared-state consumer contract: these comparisons jointly prove that
// the same anchored overview keeps owner counts while limits/windows/modes alter
// only its supported projections. No business mutation or dependent journey is
// hidden in this matrix; expected counts and identities remain explicit below.
contractTest(
  "interface-hierarchy.overview-read-parity",
  async ({ state, isolatedDatabase, expect }) => {
    const db = isolatedDatabase.owner;
    const {
      users,
      clients,
      anchor,
      day,
      todoIds,
      homeworkIds,
      examIds,
      ids,
      restRead,
      graphRead,
    } = state;

    // GraphQL's overview is counts-only and exposes only atTime. REST/MCP also expose sample limit/window.
    for (const owner of [0, 1]) {
      for (const shift of [0, 1]) {
        const atTime =
          shift === 0 ? anchor.toISOString() : "2027-01-15T10:30:00.438+08:00";
        const rest = await restRead(owner, atTime);
        const graph = await graphRead(owner, atTime);
        expect(rest.user.userId).toBe(users[owner]);
        expect(new Date(rest.anchor.atTime).getTime()).toBe(
          anchor.getTime() + shift,
        );
        expect(new Date(graph.atTime).getTime()).toBe(anchor.getTime() + shift);
        expect(new Date(graph.homeworkWindowEnd).getTime()).toBe(
          anchor.getTime() + shift + 7 * day,
        );
        expect(new Date(rest.anchor.homeworkWindowEnd).getTime()).toBe(
          anchor.getTime() + shift + 7 * day,
        );
        expect(graph.today).toBe("2027-01-15");
        expect(rest.counts).toEqual(
          owner === 0
            ? {
                todos: { incomplete: 8, completed: 1, overdue: 1 + shift },
                pendingHomeworks: 7,
                dueSoonHomeworks: 4,
                todaySchedules: 3,
                upcomingExams: 4,
              }
            : {
                todos: { incomplete: 0, completed: 0, overdue: 0 },
                pendingHomeworks: 0,
                dueSoonHomeworks: 0,
                todaySchedules: 0,
                upcomingExams: 0,
              },
        );
        expect(graph).toMatchObject({
          incompleteTodos: rest.counts.todos.incomplete,
          completedTodos: rest.counts.todos.completed,
          overdueTodos: rest.counts.todos.overdue,
          pendingHomeworks: rest.counts.pendingHomeworks,
          dueSoonHomeworks: rest.counts.dueSoonHomeworks,
          todaySchedules: rest.counts.todaySchedules,
          upcomingExams: rest.counts.upcomingExams,
        });
        const expectedIndices = shift === 0 ? [1, 3, 2, 4] : [3, 2, 4, 5];
        for (const limit of [undefined, 1, 2, 50]) {
          const sampled =
            limit === undefined ? rest : await restRead(owner, atTime, limit);
          const size = limit ?? 3;
          expect(sampled.counts).toEqual(rest.counts);
          expect(sampled.anchor.limit).toBe(size);
          expect(sampled.dueTodos.total).toBe(owner === 0 ? 4 : 0);
          expect(sampled.homeworks.total).toBe(owner === 0 ? 4 : 0);
          expect(sampled.exams.total).toBe(owner === 0 ? 4 : 0);
          expect(ids(sampled.dueTodos.items)).toEqual(
            owner === 0
              ? expectedIndices.slice(0, size).map((i) => todoIds[i])
              : [],
          );
          expect(ids(sampled.homeworks.items)).toEqual(
            owner === 0
              ? expectedIndices.slice(0, size).map((i) => homeworkIds[i])
              : [],
          );
          expect(ids(sampled.exams.items)).toEqual(
            owner === 0 ? examIds.slice(1).slice(0, size) : [],
          );
          expect(sampled.schedules.items.map((item) => item.startTime)).toEqual(
            owner === 0 ? ["09:00", "10:00", "11:00"].slice(0, size) : [],
          );
          for (const mode of ["default", "full"] as const) {
            const mcp = await clients[owner].call<McpOverview>(
              "workspace_overview_get",
              {
                atTime,
                locale: "en-us",
                mode,
                ...(limit === undefined ? {} : { limit }),
              },
            );
            expect(mcp.user.id).toBe(users[owner]);
            expect(mcp.overview).toEqual({
              pendingTodosCount: sampled.counts.todos.incomplete,
              pendingHomeworksCount: sampled.counts.pendingHomeworks,
              todaySchedulesCount: sampled.counts.todaySchedules,
              upcomingExamsCount: sampled.counts.upcomingExams,
            });
            expect(ids(mcp.samples.dueTodos)).toEqual(
              ids(sampled.dueTodos.items),
            );
            expect(ids(mcp.samples.dueHomeworks)).toEqual(
              ids(sampled.homeworks.items),
            );
            expect(ids(mcp.samples.upcomingExams)).toEqual(
              ids(sampled.exams.items),
            );
            if (mode === "full") {
              expect(mcp.samples).toEqual({
                dueTodos: sampled.dueTodos.items,
                dueHomeworks: sampled.homeworks.items,
                upcomingExams: sampled.exams.items,
              });
            } else {
              expect(mcp.samples.dueTodos).toEqual(
                sampled.dueTodos.items.map(
                  ({ id, title, priority, dueAt }) => ({
                    id,
                    title,
                    priority,
                    dueAt,
                  }),
                ),
              );
              expect(mcp.samples.dueHomeworks).toMatchObject(
                sampled.homeworks.items.map(
                  ({ id, title, submissionDueAt }) => ({
                    id,
                    title,
                    submissionDueAt,
                  }),
                ),
              );
              expect(mcp.samples.upcomingExams).toMatchObject(
                sampled.exams.items.map(
                  ({ id, examDate, startTime, endTime }) => ({
                    id,
                    examDate,
                    startTime,
                    endTime,
                  }),
                ),
              );
            }
          }
        }
      }
    }
    for (const homeworkWindowDays of [1, 8]) {
      const atTime = anchor.toISOString();
      const rest = await restRead(0, atTime, 50, homeworkWindowDays);
      const expected = homeworkWindowDays === 1 ? [1, 3, 2] : [1, 3, 2, 4, 5];
      expect(ids(rest.homeworks.items)).toEqual(
        expected.map((i) => homeworkIds[i]),
      );
      expect(ids(rest.dueTodos.items)).toEqual(
        [...expected, ...(homeworkWindowDays === 8 ? [8] : [])].map(
          (i) => todoIds[i],
        ),
      );
      const mcp = await clients[0].call<McpOverview>("workspace_overview_get", {
        atTime,
        homeworkWindowDays,
        limit: 50,
        mode: "full",
        locale: "en-us",
      });
      expect(mcp.samples).toEqual({
        dueTodos: rest.dueTodos.items,
        dueHomeworks: rest.homeworks.items,
        upcomingExams: rest.exams.items,
      });
      expect(rest.counts.dueSoonHomeworks).toBe(expected.length);
      expect(new Date(rest.anchor.homeworkWindowEnd).getTime()).toBe(
        anchor.getTime() + homeworkWindowDays * day,
      );
    }
    // Observe stored domain facts independently of all three projections.
    expect(
      await db.userSectionSubscription.findMany({
        select: { userId: true, sectionId: true },
        orderBy: { userId: "asc" },
      }),
    ).toEqual(
      [
        { userId: users[0], sectionId: state.sectionId },
        { userId: users[2], sectionId: state.sectionId },
      ].sort((left, right) => left.userId.localeCompare(right.userId)),
    );
    expect(
      await db.todo.findMany({
        where: { userId: users[0] },
        select: { id: true, completed: true },
        orderBy: { id: "asc" },
      }),
    ).toEqual(
      todoIds
        .map((id, index) => ({ id, completed: index === 6 }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    );
    expect(
      await db.homeworkCompletion.findMany({
        select: { userId: true, homeworkId: true },
        orderBy: { userId: "asc" },
      }),
    ).toEqual(
      [
        { userId: users[0], homeworkId: homeworkIds[6] },
        { userId: users[2], homeworkId: homeworkIds[1] },
      ].sort((left, right) => left.userId.localeCompare(right.userId)),
    );
    expect(
      await db.homework.count({ where: { sectionId: state.sectionId } }),
    ).toBe(9);
    expect(await db.todo.count({ where: { userId: users[1] } })).toBe(0);
    expect(
      await db.todo.findMany({
        where: { userId: users[2] },
        select: { title: true, completed: true },
      }),
    ).toEqual([{ title: "Foreign pending todo", completed: false }]);
    // Signing and verification must use this database's own auth key.
    expect(await db.jwks.count()).toBe(1);
  },
);
