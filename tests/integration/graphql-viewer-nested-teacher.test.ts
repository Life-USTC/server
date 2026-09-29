import { describe, expect } from "vitest";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { graphqlViewerTest as it } from "../shared/graphql-viewer-fixture";

describe("GraphQL Viewer integration", () => {
  it("hydrates every nested Schedule Teacher field without a fallback query", async ({
    viewer: viewerCase,
  }) => {
    await viewerCase.run(async () => {
      const { execute, sessionCookie } = viewerCase;
      const { payload } = await execute(
        {
          query: /* GraphQL */ `
          {
            viewer: workspace {
              schedules(page: { pageSize: 1 }) {
                items {
                  teachers {
                    items {
                      id
                      department {
                        id
                      }
                      teacherTitle {
                        id
                        nameCn
                      }
                      sectionCount
                    }
                    pageInfo {
                      page
                      pageSize
                      total
                      totalPages
                    }
                  }
                }
              }
            }
          }
        `,
        },
        {
          cookie: sessionCookie,
          origin: new URL(getOAuthGraphqlResourceUrl()).origin,
        },
      );

      expect(payload.errors).toBeUndefined();
      const viewer = payload.data?.viewer as {
        schedules: {
          items: Array<{
            teachers: {
              items: Array<{
                sectionCount: number;
                teacherTitle: { id: number; nameCn: string } | null;
              }>;
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
      const teachers = viewer.schedules.items.flatMap(
        (schedule) => schedule.teachers.items,
      );
      const teacherPageInfo = viewer.schedules.items[0]?.teachers.pageInfo;
      expect(teachers.length).toBeGreaterThan(0);
      expect(teacherPageInfo).toMatchObject({
        page: 1,
        pageSize: 20,
      });
      expect(teacherPageInfo?.total).toBeGreaterThanOrEqual(teachers.length);
      expect(teacherPageInfo?.totalPages).toBe(
        Math.max(1, Math.ceil((teacherPageInfo?.total ?? 0) / 20)),
      );
      expect(
        teachers.every(
          (teacher) =>
            teacher.sectionCount >= 1 &&
            typeof teacher.teacherTitle?.nameCn === "string",
        ),
      ).toBe(true);
    });
  });
});
