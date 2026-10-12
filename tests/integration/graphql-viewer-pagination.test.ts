import { describe, expect } from "vitest";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { graphqlViewerTest as it } from "../shared/graphql-viewer-fixture";

describe("GraphQL Viewer integration", () => {
  it("graphql.pagination", { tags: ["@GraphQL/GraphQL"] }, async ({
    viewer: viewerCase,
  }) => {
    await viewerCase.run(async () => {
      const { execute, graphqlBearer, sessionCookie } = viewerCase;
      async function verifyNestedPagination() {
        const headers = {
          cookie: sessionCookie,
          origin: new URL(getOAuthGraphqlResourceUrl()).origin,
        };
        const accepted = await execute(
          {
            query: /* GraphQL */ `
          {
            viewer: workspace {
              schedules(page: { pageSize: 1 }) {
                items {
                  defaultTeachers: teachers {
                    items { id }
                    pageInfo { page pageSize total totalPages }
                  }
                  participations: teacherParticipations {
                    items { teacher { id } periods exerciseClass }
                    pageInfo { page pageSize total totalPages }
                  }
                  maxTeachers: teachers(page: { pageSize: 100 }) {
                    items { id }
                    pageInfo { page pageSize total totalPages }
                  }
                }
              }
              exams(page: { pageSize: 1 }) {
                items {
                  defaultRooms: examRooms {
                    items { id room count }
                    pageInfo { page pageSize total totalPages }
                  }
                  maxRooms: examRooms(page: { pageSize: 100 }) {
                    items { id }
                    pageInfo { page pageSize total totalPages }
                  }
                }
              }
            }
          }
        `,
          },
          headers,
        );

        expect(accepted.payload.errors).toBeUndefined();
        const viewer = accepted.payload.data?.viewer as {
          schedules: {
            items: Array<{
              defaultTeachers: {
                items: Array<{ id: number }>;
                pageInfo: {
                  page: number;
                  pageSize: number;
                  total: number;
                  totalPages: number;
                };
              };
              participations: {
                items: Array<{
                  teacher: { id: number };
                  periods: number | null;
                  exerciseClass: boolean | null;
                }>;
                pageInfo: {
                  page: number;
                  pageSize: number;
                  total: number;
                  totalPages: number;
                };
              };
              maxTeachers: {
                items: Array<{ id: number }>;
                pageInfo: {
                  page: number;
                  pageSize: number;
                  total: number;
                  totalPages: number;
                };
              };
            }>;
          };
          exams: {
            items: Array<{
              defaultRooms: {
                items: Array<{ id: number }>;
                pageInfo: {
                  page: number;
                  pageSize: number;
                  total: number;
                  totalPages: number;
                };
              };
              maxRooms: {
                items: Array<{ id: number }>;
                pageInfo: {
                  page: number;
                  pageSize: number;
                  total: number;
                  totalPages: number;
                };
              };
            }>;
          };
        };
        const schedule = viewer.schedules.items[0];
        const exam = viewer.exams.items[0];
        expect(schedule).toBeDefined();
        expect(exam).toBeDefined();
        const expectFirstPage = (
          page:
            | {
                items: readonly unknown[];
                pageInfo: {
                  page: number;
                  pageSize: number;
                  total: number;
                  totalPages: number;
                };
              }
            | undefined,
          pageSize: number,
        ) => {
          expect(page?.pageInfo).toMatchObject({ page: 1, pageSize });
          expect(page?.items.length).toBeLessThanOrEqual(pageSize);
          expect(page?.pageInfo.total).toBeGreaterThanOrEqual(
            page?.items.length ?? 0,
          );
          expect(page?.pageInfo.totalPages).toBe(
            Math.max(1, Math.ceil((page?.pageInfo.total ?? 0) / pageSize)),
          );
        };
        expectFirstPage(schedule?.defaultTeachers, 20);
        expectFirstPage(schedule?.maxTeachers, 100);
        expectFirstPage(schedule?.participations, 20);
        expect(
          schedule?.participations.items.map(({ teacher }) => teacher.id),
        ).toEqual(schedule?.defaultTeachers.items.map(({ id }) => id));
        expect(
          schedule?.participations.items.every(
            ({ periods, exerciseClass }) =>
              periods === null && exerciseClass === null,
          ),
        ).toBe(true);
        expectFirstPage(exam?.defaultRooms, 20);
        expectFirstPage(exam?.maxRooms, 100);

        for (const nestedField of [
          "teachers(page: { pageSize: 101 })",
          "teacherParticipations(page: { pageSize: 101 })",
          "examRooms(page: { pageSize: 101 })",
        ]) {
          const parentField = nestedField.startsWith("examRooms")
            ? "exams"
            : "schedules";
          const rejected = await execute(
            {
              query: `{
            viewer: workspace {
              ${parentField}(page: { pageSize: 1 }) {
                items {
                  ${nestedField} { pageInfo { total } }
                }
              }
            }
          }`,
            },
            headers,
          );
          expect(rejected.payload.errors?.[0]?.extensions).toMatchObject({
            code: "BAD_USER_INPUT",
          });
        }
      }

      const headers = { authorization: `Bearer ${graphqlBearer}` };
      for (const field of [
        "todos",
        "subscribedSections",
        "homeworks",
        "schedules",
        "exams",
      ]) {
        for (const page of [
          undefined,
          { page: 1, pageSize: 1 },
          { page: 100, pageSize: 100 },
        ]) {
          const { payload } = await execute(
            {
              query: `query Pages($page: PageInput) { workspace { ${field}(page: $page) { pageInfo { page pageSize } } } }`,
              variables: { page },
            },
            headers,
          );
          expect(payload.errors, field).toBeUndefined();
          expect(payload.data).toMatchObject({
            workspace: {
              [field]: { pageInfo: page ?? { page: 1, pageSize: 20 } },
            },
          });
        }
        for (const page of [
          { page: 0 },
          { page: 101 },
          { pageSize: 0 },
          { pageSize: 101 },
        ]) {
          const { payload } = await execute(
            {
              query: `query Pages($page: PageInput) { workspace { ${field}(page: $page) { pageInfo { total } } } }`,
              variables: { page },
            },
            headers,
          );
          expect(payload.errors?.[0]?.extensions, field).toMatchObject({
            code: "BAD_USER_INPUT",
          });
        }
      }
      await verifyNestedPagination();
      const { graphqlScopeResolvers } = await import("@/lib/graphql/workspace");
      const teachers = Array.from({ length: 101 }, (_, index) => ({
        teacher: { id: index + 1 },
      }));
      const rooms = Array.from({ length: 101 }, (_, index) => ({
        id: index + 1,
      }));
      for (const pageSize of [20, 100]) {
        const pages = [
          graphqlScopeResolvers.Schedule.teachers(
            { teacherParticipations: teachers },
            { page: { pageSize } },
          ),
          graphqlScopeResolvers.Schedule.teacherParticipations(
            { teacherParticipations: teachers },
            { page: { pageSize } },
          ),
          graphqlScopeResolvers.Exam.examRooms(
            { examRooms: rooms },
            { page: { pageSize } },
          ),
        ];
        for (const page of pages) {
          expect(page.data).toHaveLength(pageSize);
          expect(page.pagination).toMatchObject({
            page: 1,
            pageSize,
            total: 101,
          });
        }
      }
    });
  });
});
