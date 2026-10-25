import { describe, expect, it } from "vitest";
import { getDemoCatalogPersonal } from "@/features/demo/server/demo-catalog";
import {
  getDemoHomework,
  getDemoHomeworks,
  getDemoHomeworksTabData,
  resolveDemoHomeworkSectionIds,
} from "@/features/demo/server/demo-homeworks";
import { getDemoNavigation } from "@/features/demo/server/demo-workspace";
import { getDemoCommentsRoute } from "@/lib/api/routes/demo-catalog-read-routes";
import {
  getDemoHomeworkAuditRoute,
  getDemoHomeworkDetailRoute,
  getDemoHomeworksRoute,
  getDemoSubscribedHomeworksRoute,
} from "@/lib/api/routes/demo-homework-read-routes";
import { commentsListResponseSchema } from "@/lib/api/schemas/comments-response-schemas";
import {
  homeworkItemSchema,
  homeworksListResponseSchema,
  subscribedHomeworksResponseSchema,
} from "@/lib/api/schemas/homeworks-response-schemas";

const request = (query = "") =>
  new Request(`https://life.test/api/community/section-homeworks${query}`);

describe("demo homework projection", () => {
  it.each(["zh-cn", "en-us"] as const)(
    "shares fixed homework states and section identities in %s",
    (locale) => {
      const items = getDemoHomeworks(locale).map((item) =>
        homeworkItemSchema.parse(item),
      );
      expect(items).toHaveLength(6);
      expect(
        items.map((item) => [
          item.id,
          item.completionRequired,
          Boolean(item.completion),
        ]),
      ).toEqual([
        ["demo-homework-determinants", true, false],
        ["demo-homework-vectors", true, false],
        ["demo-homework-matrices", true, true],
        ["demo-homework-project", true, false],
        ["demo-homework-physics", false, false],
        ["demo-homework-structures", false, false],
      ]);
      expect(items[1]).toMatchObject({
        title: locale === "en-us" ? "Vector spaces exercises" : "向量空间练习",
        submissionDueAt: "2026-09-25T18:00:00+08:00",
        section: { id: 101, jwId: 910001, course: { jwId: 920001 } },
      });
      expect(items[3]).toMatchObject({
        isMajor: true,
        requiresTeam: true,
        submissionDueAt: null,
      });
      const page = getDemoHomeworksTabData(locale);
      expect(page.homeworkSummaries.map((item) => item.id)).toEqual(
        items.map((item) => item.id),
      );
      expect(page.homeworkSummaries[1]).toMatchObject({
        description: items[1].description?.content,
        section: {
          jwId: 910001,
          courseName: items[1].section.course.namePrimary,
        },
      });
      expect(
        getDemoNavigation({
          fixtureVersion: "workspace-v1",
          expiresAt: 1790000000000,
        }).pendingHomeworksCount,
      ).toBe(3);
      expect(getDemoHomework("private", locale)).toBeNull();
      const personal = getDemoCatalogPersonal(
        910001,
        locale,
        "demo-homework-vectors",
      );
      expect(personal?.homeworkData.homeworks).toHaveLength(4);
      expect(personal?.homeworkData.homeworks[1]).toMatchObject({
        id: items[1].id,
        description: items[1].description,
      });
      expect(personal?.homeworkData.homeworks[0]).not.toHaveProperty(
        "description",
      );
      expect(
        getDemoCatalogPersonal(910001, locale, "demo-homework-physics"),
      ).toBeNull();
      expect(getDemoCatalogPersonal(910001, locale, "private")).toBeNull();
    },
  );

  it("accepts only known and mutually consistent section aliases", () => {
    expect(
      resolveDemoHomeworkSectionIds({
        sectionId: "101",
        sectionJwId: "910001",
        sectionIds: "101,101",
      }),
    ).toEqual([101]);
    expect(resolveDemoHomeworkSectionIds({ sectionIds: "102,101" })).toEqual([
      101, 102,
    ]);
    for (const input of [
      {},
      { sectionId: "999" },
      { sectionIds: "101,999" },
      { sectionId: "101", sectionJwId: "910002" },
      { sectionIds: "101,102", sectionId: "101" },
    ])
      expect(resolveDemoHomeworkSectionIds(input)).toBeNull();
  });

  it("retains bounded pagination and summary/detail response shapes", async () => {
    const workspace = subscribedHomeworksResponseSchema.parse(
      await getDemoSubscribedHomeworksRoute(
        request("?page=2&pageSize=2"),
        "en-us",
      ).json(),
    );
    expect(workspace.pagination).toMatchObject({
      page: 2,
      pageSize: 2,
      total: 6,
    });
    expect(workspace.data.map((item) => item.id)).toEqual([
      "demo-homework-matrices",
      "demo-homework-project",
    ]);
    const section = homeworksListResponseSchema.parse(
      await getDemoHomeworksRoute(
        request("?sectionId=101&pageSize=2"),
        "en-us",
      ).json(),
    );
    expect(section.pagination.total).toBe(4);
    expect(section.data[0]).not.toHaveProperty("description");
    expect(section.meta.viewer).toMatchObject({
      userId: null,
      isAuthenticated: false,
    });
    expect(
      getDemoHomeworksRoute(request("?sectionId=101&pageSize=51"), "en-us")
        .status,
    ).toBe(400);
    expect(
      getDemoSubscribedHomeworksRoute(request("?sectionId=999"), "en-us")
        .status,
    ).toBe(400);
    expect(
      getDemoHomeworksRoute(request("?sectionIds=101,999"), "en-us").status,
    ).toBe(404);
    expect(
      getDemoHomeworksRoute(
        request("?sectionId=101&sectionJwId=910002"),
        "en-us",
      ).status,
    ).toBe(404);
    expect(
      getDemoHomeworkDetailRoute(request(), "private", "en-us").status,
    ).toBe(404);
    expect(
      getDemoHomeworkDetailRoute(
        request("?sectionId=102"),
        "demo-homework-vectors",
        "en-us",
      ).status,
    ).toBe(404);
    expect(
      getDemoHomeworkDetailRoute(request(), "demo-homework-vectors", "en-us")
        .status,
    ).toBe(200);
    expect(
      await getDemoHomeworkAuditRoute(request("?sectionJwId=910001")).json(),
    ).toEqual({ auditLogs: [] });
    expect(getDemoHomeworkAuditRoute(request("?sectionId=999")).status).toBe(
      404,
    );
  });

  it("allows only known homework comment targets and matching aliases", async () => {
    const read = (query: string) =>
      getDemoCommentsRoute(request(`?targetType=homework&${query}`), "en-us");
    const response = commentsListResponseSchema.parse(
      await read(
        "targetId=demo-homework-vectors&homeworkId=demo-homework-vectors",
      ).json(),
    );
    expect(response).toMatchObject({
      data: [],
      meta: {
        viewer: { userId: null, isAuthenticated: false },
        target: {
          homeworkId: "demo-homework-vectors",
          homeworkTitle: "Vector spaces exercises",
          homeworkSectionJwId: 910001,
        },
      },
    });
    for (const query of [
      "targetId=private",
      "targetId=demo-homework-vectors&homeworkId=demo-homework-physics",
      "targetId=demo-homework-vectors&sectionJwId=910001",
    ])
      expect(read(query).status).toBe(404);
  });
});
