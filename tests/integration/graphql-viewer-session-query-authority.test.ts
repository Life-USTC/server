import { describe, expect } from "vitest";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { graphqlViewerTest as it } from "../shared/graphql-viewer-fixture";
import {
  assertOverviewCountsAreNumbers,
  normalizeGraphqlOverviewPayload,
} from "../shared/scenarios/overview";

describe("GraphQL Viewer integration", () => {
  it("graphql.session-query-authority", async ({ viewer: viewerCase }) => {
    await viewerCase.run(async () => {
      const {
        execute,
        firstScheduleDate,
        sessionCookie,
        firstUserId,
        firstSectionId,
        firstSectionJwId,
        secondSectionId,
      } = viewerCase;
      const shanghaiMidnightInstant = new Date(
        firstScheduleDate.getTime() - 8 * 60 * 60 * 1000,
      ).toISOString();
      const { response, payload } = await execute(
        {
          query: /* GraphQL */ `
          fragment SectionFields on Section {
            id
            jwId
            code
            credits
            period
            periodsPerWeek
            timesPerWeek
            stdCount
            limitCount
            remark
            course {
              id
              jwId
              code
              nameCn
              nameEn
            }
            semester {
              id
              jwId
              code
              nameCn
              startDate
              endDate
            }
            campus {
              id
              jwId
              code
              nameCn
              nameEn
            }
            openDepartment {
              id
              code
              nameCn
              nameEn
            }
            examMode {
              id
              nameCn
              nameEn
            }
            teachLanguage {
              id
              nameCn
              nameEn
            }
          }

          query ViewerBySession($date: DateTime!) {
            account {
              profile {
                id
                email
                username
                name
                isAdmin
                createdAt
                updatedAt
              }
            }
            viewer: workspace {
              overview(atTime: "2026-04-29T08:00:00+08:00") {
                atTime
                today
                incompleteTodos
                pendingHomeworks
                todaySchedules
                upcomingExams
              }
              todos {
                items {
                  id
                  title
                }
                pageInfo {
                  page
                  pageSize
                  total
                  totalPages
                }
              }
              subscribedSections {
                items {
                  kind
                  section { ...SectionFields }
                }
                pageInfo {
                  pageSize
                  total
                }
              }
              homeworks {
                items {
                  id
                  completed
                  completedAt
                  commentCount
                  section {
                    id
                    jwId
                    course {
                      id
                      category {
                        id
                        nameCn
                      }
                    }
                    campus {
                      id
                    }
                    openDepartment {
                      id
                    }
                    examMode {
                      id
                    }
                    teachLanguage {
                      id
                    }
                  }
                }
                pageInfo {
                  total
                }
              }
              schedules(filter: { dateFrom: $date, dateTo: $date }) {
                items {
                  id
                  date
                  section {
                    id
                    jwId
                  }
                  teachers(page: { pageSize: 1 }) {
                    items {
                      id
                      sectionCount
                    }
                    pageInfo {
                      total
                    }
                  }
                }
                pageInfo {
                  total
                }
              }
              exams {
                items {
                  id
                  examDate
                  section {
                    id
                    jwId
                  }
                }
                pageInfo {
                  total
                }
              }
            }
          }
        `,
          variables: { date: shanghaiMidnightInstant },
        },
        {
          cookie: sessionCookie,
          origin: new URL(getOAuthGraphqlResourceUrl()).origin,
        },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(payload.errors).toBeUndefined();
      const account = payload.data?.account as { profile: { id: string } };
      const viewer = payload.data?.viewer as {
        overview: {
          today: string;
          incompleteTodos?: number;
          pendingHomeworks?: number;
          todaySchedules?: number;
          upcomingExams?: number;
        };
        todos: {
          items: Array<{ title: string }>;
          pageInfo: { pageSize: number; total: number };
        };
        subscribedSections: {
          items: Array<{ kind: string; section: { id: number; jwId: number } }>;
          pageInfo: { pageSize: number; total: number };
        };
        homeworks: {
          items: Array<{ section: { id: number } }>;
          pageInfo: { total: number };
        };
        schedules: {
          items: Array<{ date: string; section: { id: number } }>;
          pageInfo: { total: number };
        };
        exams: {
          items: Array<{ section: { id: number } }>;
          pageInfo: { total: number };
        };
      };
      expect(account.profile.id).toBe(firstUserId);
      expect(viewer.overview.today).toBe("2026-04-29");
      assertOverviewCountsAreNumbers(
        normalizeGraphqlOverviewPayload(viewer.overview),
      );
      expect(viewer.todos.pageInfo).toMatchObject({ pageSize: 20, total: 1 });
      expect(viewer.todos.items[0]?.title).toContain("graphql-viewer-a");
      expect(viewer.subscribedSections.pageInfo).toMatchObject({
        pageSize: 20,
        total: 1,
      });
      expect(viewer.subscribedSections.items).toMatchObject([
        {
          kind: "regular",
          section: { id: firstSectionId, jwId: firstSectionJwId },
        },
      ]);
      for (const page of [viewer.homeworks, viewer.schedules, viewer.exams]) {
        expect(page.pageInfo.total).toBeGreaterThan(0);
        expect(
          page.items.every((item) => item.section.id === firstSectionId),
        ).toBe(true);
        expect(
          page.items.every((item) => item.section.id !== secondSectionId),
        ).toBe(true);
      }
      expect(
        viewer.schedules.items.every(
          (schedule) =>
            schedule.date === firstScheduleDate.toISOString().slice(0, 10),
        ),
      ).toBe(true);
    });
  });
});
