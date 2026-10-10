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
  async ({
    mcpWorkflow,
    signal,
    isolatedDatabase,
    mcpRuntime,
    mcpSessions,
  }) => {
    const setupResult = await mcpWorkflow.run(async () => {
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

      const { courseId, sectionId, catalogMarker } = await owner.$transaction(
        async (db) => {
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
              (
                await db.oAuthConsent.create({
                  data: { clientId, userId, scopes },
                })
              ).grantId,
            );
          }
          const marker =
            1_800_000_000 + Math.floor(Math.random() * 100_000_000);
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
            data: {
              userId: users[2],
              title: "Foreign pending todo",
              dueAt: at(0),
            },
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

          return { courseId, sectionId, catalogMarker: marker };
        },
      );
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
        catalogMarker,
        at,
        ids,
        restRead,
        graphRead,
      };
    });
    signal.throwIfAborted();
    return setupResult;
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

// Each entry point consumes an independently prepared state. Expected rows below
// use only fixture inputs; no API response or production projection is an oracle.
for (const method of ["REST", "GraphQL", "MCP"] as const)
  contractTest(
    `interface-hierarchy.overview-read-parity through ${method}`,
    { tags: [`@Overview/${method}`] },
    async ({ mcpWorkflow, state, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
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
        const timestamp = (date: Date) =>
          `${new Date(date.getTime() + 8 * 3_600_000).toISOString().slice(0, date.getUTCMilliseconds() ? 23 : 19)}+08:00`;
        const expectedCourse = {
          id: state.courseId,
          jwId: state.catalogMarker,
          code: `PARITY${state.catalogMarker}`,
          nameCn: "概览课程",
          nameEn: "Overview course",
          namePrimary: "Overview course",
          nameSecondary: "概览课程",
        };
        const expectedSection = {
          id: state.sectionId,
          jwId: state.catalogMarker,
          code: `PARITY.${state.catalogMarker}`,
          course: expectedCourse,
          semester: null,
        };
        function expectedTodo(index: number) {
          const offset = state.offsets[index];
          return {
            id: todoIds[index],
            title: `Todo ${index}`,
            priority: index % 2 ? "high" : "low",
            dueAt: offset === null ? null : timestamp(state.at(offset)),
            createdAt: timestamp(state.at(-day + index * 1000)),
          };
        }
        function expectedHomework(index: number) {
          const offset = state.offsets[index];
          return {
            id: homeworkIds[index],
            sectionId: state.sectionId,
            title: `Homework ${index}`,
            publishedAt: null,
            submissionStartAt: null,
            submissionDueAt:
              offset === null ? null : timestamp(state.at(offset)),
            description: null,
            section: {
              jwId: state.catalogMarker,
              course: {
                nameCn: "概览课程",
                nameEn: "Overview course",
                namePrimary: "Overview course",
                nameSecondary: "概览课程",
              },
            },
            completionRequired: true,
            completion: null,
            commentCount: 0,
          };
        }
        function expectedExam(index: number) {
          return {
            id: examIds[index],
            jwId: state.catalogMarker + index,
            examDate:
              index === 4
                ? "2027-01-16T08:00:00+08:00"
                : "2027-01-15T08:00:00+08:00",
            startTime: [900, 1000, 1200, 1200, 800][index],
            endTime: [930, 1100, 1300, 1300, 900][index],
            examType: null,
            examMode: `Exam ${index}`,
            examTakeCount: null,
            section: expectedSection,
            examBatch: null,
            examRooms: [],
          };
        }
        function expectedSamples(
          todoIndices: number[],
          homeworkIndices: number[],
          exams: number[],
          mode: "default" | "full",
        ) {
          const full = {
            dueTodos: todoIndices.map(expectedTodo),
            dueHomeworks: homeworkIndices.map(expectedHomework),
            upcomingExams: exams.map(expectedExam),
          };
          if (mode === "full") return full;
          return {
            dueTodos: full.dueTodos.map(({ id, title, priority, dueAt }) => ({
              id,
              title,
              priority,
              dueAt,
            })),
            dueHomeworks: full.dueHomeworks.map(
              ({
                id,
                title,
                publishedAt,
                submissionStartAt,
                submissionDueAt,
                completionRequired,
                completion,
              }) => ({
                id,
                title,
                publishedAt,
                submissionStartAt,
                submissionDueAt,
                completionRequired,
                completion,
                section: {
                  jwId: state.catalogMarker,
                  course: { namePrimary: "Overview course" },
                },
              }),
            ),
            upcomingExams: full.upcomingExams.map((exam) => ({
              ...exam,
              section: {
                ...expectedSection,
                course: {
                  id: state.courseId,
                  jwId: state.catalogMarker,
                  code: `PARITY${state.catalogMarker}`,
                  namePrimary: "Overview course",
                },
              },
            })),
          };
        }
        function counts(owner: number, shift: number) {
          return owner === 0
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
              };
        }
        const mcpCounts = (owner: number) => ({
          pendingTodosCount: owner === 0 ? 8 : 0,
          pendingHomeworksCount: owner === 0 ? 7 : 0,
          todaySchedulesCount: owner === 0 ? 3 : 0,
          upcomingExamsCount: owner === 0 ? 4 : 0,
        });
        for (const owner of [0, 1]) {
          for (const shift of [0, 1]) {
            const atTime =
              shift === 0
                ? anchor.toISOString()
                : "2027-01-15T10:30:00.438+08:00";
            const expectedCounts = counts(owner, shift);
            if (method === "GraphQL") {
              const graph = await graphRead(owner, atTime);
              expect(new Date(graph.atTime).getTime()).toBe(
                anchor.getTime() + shift,
              );
              expect(new Date(graph.homeworkWindowEnd).getTime()).toBe(
                anchor.getTime() + shift + 7 * day,
              );
              expect(graph.today).toBe("2027-01-15");
              expect(graph).toMatchObject({
                incompleteTodos: expectedCounts.todos.incomplete,
                completedTodos: expectedCounts.todos.completed,
                overdueTodos: expectedCounts.todos.overdue,
                pendingHomeworks: expectedCounts.pendingHomeworks,
                dueSoonHomeworks: expectedCounts.dueSoonHomeworks,
                todaySchedules: expectedCounts.todaySchedules,
                upcomingExams: expectedCounts.upcomingExams,
              });
              continue;
            }
            const expectedIndices =
              owner === 0 ? (shift === 0 ? [1, 3, 2, 4] : [3, 2, 4, 5]) : [];
            for (const limit of [undefined, 1, 2, 50]) {
              const size = limit ?? 3;
              const indices = expectedIndices.slice(0, size);
              const examIndices =
                owner === 0 ? [1, 2, 3, 4].slice(0, size) : [];
              if (method === "REST") {
                const sampled = await restRead(owner, atTime, limit);
                expect(sampled.user).toEqual({
                  userId: users[owner],
                  name: `Overview owner ${owner}`,
                  image: null,
                  isAdmin: false,
                });
                expect(new Date(sampled.anchor.atTime).getTime()).toBe(
                  anchor.getTime() + shift,
                );
                expect(
                  new Date(sampled.anchor.homeworkWindowEnd).getTime(),
                ).toBe(anchor.getTime() + shift + 7 * day);
                expect(sampled.counts).toEqual(expectedCounts);
                expect(sampled.anchor.limit).toBe(size);
                expect(sampled.dueTodos.total).toBe(owner === 0 ? 4 : 0);
                expect(sampled.homeworks.total).toBe(owner === 0 ? 4 : 0);
                expect(sampled.exams.total).toBe(owner === 0 ? 4 : 0);
                expect(ids(sampled.dueTodos.items)).toEqual(
                  indices.map((i) => todoIds[i]),
                );
                expect(ids(sampled.homeworks.items)).toEqual(
                  indices.map((i) => homeworkIds[i]),
                );
                expect(ids(sampled.exams.items)).toEqual(
                  examIndices.map((i) => examIds[i]),
                );
                expect(
                  sampled.schedules.items.map((item) => item.startTime),
                ).toEqual(
                  owner === 0 ? ["09:00", "10:00", "11:00"].slice(0, size) : [],
                );
                expect({
                  dueTodos: sampled.dueTodos.items,
                  dueHomeworks: sampled.homeworks.items,
                  upcomingExams: sampled.exams.items,
                }).toEqual(
                  expectedSamples(indices, indices, examIndices, "full"),
                );
              } else {
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
                  expect(mcp.overview).toEqual(mcpCounts(owner));
                  expect(ids(mcp.samples.dueTodos)).toEqual(
                    indices.map((i) => todoIds[i]),
                  );
                  expect(ids(mcp.samples.dueHomeworks)).toEqual(
                    indices.map((i) => homeworkIds[i]),
                  );
                  expect(ids(mcp.samples.upcomingExams)).toEqual(
                    examIndices.map((i) => examIds[i]),
                  );
                  expect(mcp.samples).toEqual(
                    expectedSamples(indices, indices, examIndices, mode),
                  );
                }
              }
            }
          }
        }
        if (method !== "GraphQL")
          for (const homeworkWindowDays of [1, 8]) {
            const atTime = anchor.toISOString();
            const expected =
              homeworkWindowDays === 1 ? [1, 3, 2] : [1, 3, 2, 4, 5];
            const expectedTodos = [
              ...expected,
              ...(homeworkWindowDays === 8 ? [8] : []),
            ];
            const samples = expectedSamples(
              expectedTodos,
              expected,
              [1, 2, 3, 4],
              "full",
            );
            if (method === "REST") {
              const rest = await restRead(0, atTime, 50, homeworkWindowDays);
              expect(ids(rest.homeworks.items)).toEqual(
                expected.map((i) => homeworkIds[i]),
              );
              expect(ids(rest.dueTodos.items)).toEqual(
                expectedTodos.map((i) => todoIds[i]),
              );
              expect({
                dueTodos: rest.dueTodos.items,
                dueHomeworks: rest.homeworks.items,
                upcomingExams: rest.exams.items,
              }).toEqual(samples);
              expect(rest.counts.dueSoonHomeworks).toBe(expected.length);
              expect(new Date(rest.anchor.homeworkWindowEnd).getTime()).toBe(
                anchor.getTime() + homeworkWindowDays * day,
              );
            } else {
              const mcp = await clients[0].call<McpOverview>(
                "workspace_overview_get",
                {
                  atTime,
                  homeworkWindowDays,
                  limit: 50,
                  mode: "full",
                  locale: "en-us",
                },
              );
              expect(mcp.user.id).toBe(users[0]);
              expect(mcp.overview).toEqual(mcpCounts(0));
              expect(mcp.samples).toEqual(samples);
            }
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
        // HTTP bearer signing uses this database's key; the in-process MCP session receives an owned auth context without issuing a JWT.
        expect(await db.jwks.count()).toBe(method === "MCP" ? 0 : 1);
      }),
  );
