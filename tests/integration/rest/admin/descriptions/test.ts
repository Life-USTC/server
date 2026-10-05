/**
 * E2E tests for GET /api/admin/descriptions
 *
 * Admin-only endpoint listing descriptions for moderation.
 *
 * - GET returns `{ data: [...], pagination }` with detailed includes
 * - Supports `targetType` filter: "all", "section", "course", "teacher", "homework"
 * - Supports `hasContent` filter: "all", "withContent", "empty"
 * - Supports `search` parameter (content, course/section/teacher/homework names)
 * - Supports `page` and `pageSize` parameters; retired `limit` is rejected
 * - Descriptions are ordered by lastEditedAt desc, then updatedAt desc
 * - Returns 401 for unauthenticated or non-admin requests
 */
import { expect } from "@playwright/test";
import { test } from "./_fixture";

const BASE = "/api/admin/descriptions";

test.describe("GET /api/admin/descriptions 课程简介管理", () => {
  test("API 契约", { tag: "@Description/REST" }, async ({
    run,
    descriptionState,
  }) => {
    await run(async () => {
      const {
        admin: { request },
      } = descriptionState;
      const response = await request.get(BASE);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        data?: Array<{
          id?: string;
          content?: string;
          createdAt?: string;
          updatedAt?: string;
          lastEditedAt?: string | null;
          lastEditedById?: string | null;
          sectionId?: number | null;
          courseId?: number | null;
          teacherId?: number | null;
          homeworkId?: string | null;
          lastEditedBy?: { id?: string; name?: string | null } | null;
          section?: {
            jwId?: number | null;
            code?: string | null;
            course?: { jwId?: number; code?: string; nameCn?: string } | null;
          } | null;
          course?: { jwId?: number; code?: string; nameCn?: string } | null;
          teacher?: { id?: number; nameCn?: string } | null;
          homework?: {
            id?: string;
            title?: string;
            section?: {
              jwId?: number | null;
              code?: string | null;
              course?: { jwId?: number; code?: string; nameCn?: string } | null;
            } | null;
          } | null;
        }>;
      };

      expect((body.data?.length ?? 0) > 0).toBe(true);

      expect(body.data?.map((item) => item.id)).toEqual([
        descriptionState.assignment.id,
        descriptionState.teacher.id,
        descriptionState.course.id,
        descriptionState.section.id,
      ]);
      expect(body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: descriptionState.section.id,
            sectionId: descriptionState.section.sectionId,
            lastEditedById: descriptionState.owner.id,
          }),
          expect.objectContaining({
            id: descriptionState.course.id,
            courseId: descriptionState.course.courseId,
          }),
          expect.objectContaining({
            id: descriptionState.teacher.id,
            teacherId: descriptionState.teacher.teacherId,
          }),
          expect.objectContaining({
            id: descriptionState.assignment.id,
            homeworkId: descriptionState.assignment.homeworkId,
          }),
        ]),
      );
      expect(await descriptionState.db.auditLog.count()).toBe(0);
      const first = body.data?.[0];
      expect(typeof first?.id).toBe("string");
      expect(typeof first?.content).toBe("string");
      expect(typeof first?.createdAt).toBe("string");
      expect(typeof first?.updatedAt).toBe("string");
      expect(Object.hasOwn(first ?? {}, "lastEditedAt")).toBe(true);
      expect(Object.hasOwn(first ?? {}, "lastEditedById")).toBe(true);
    });
  });

  test("未认证请求返回 401", { tag: "@Description/REST" }, async ({
    run,
    request,
  }) => {
    await run(async () => {
      const response = await request.get(BASE);
      expect(response.status()).toBe(401);
    });
  });

  test("非管理员认证用户返回 401", { tag: "@Description/REST" }, async ({
    run,
    descriptionState,
  }) => {
    await run(async () => {
      const {
        owner: { request },
      } = descriptionState;
      const response = await request.get(BASE);
      expect(response.status()).toBe(401);
    });
  });

  test("管理员可按 targetType=section 筛选课程简介", {
    tag: "@Description/REST",
  }, async ({ run, descriptionState }) => {
    await run(async () => {
      const {
        admin: { request },
      } = descriptionState;
      const response = await request.get(`${BASE}?targetType=section`);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        data?: Array<{
          sectionId?: number | null;
          homeworkId?: string | null;
        }>;
      };
      expect((body.data?.length ?? 0) > 0).toBe(true);
      expect(body.data?.every((item) => item.sectionId !== null)).toBe(true);
      expect(body.data?.every((item) => item.homeworkId === null)).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data?.[0]).toMatchObject({
        sectionId: descriptionState.section.sectionId,
      });
    });
  });

  test("管理员可按 hasContent=withContent 筛选非空课程简介", {
    tag: "@Description/REST",
  }, async ({ run, descriptionState }) => {
    await run(async () => {
      const {
        admin: { request },
      } = descriptionState;
      const response = await request.get(`${BASE}?hasContent=withContent`);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        data?: Array<{ id?: string; content?: string }>;
      };
      expect((body.data?.length ?? 0) > 0).toBe(true);
      expect(body.data?.map((item) => item.id)).toEqual([
        descriptionState.assignment.id,
        descriptionState.teacher.id,
        descriptionState.course.id,
        descriptionState.section.id,
      ]);
      expect(
        body.data?.every((item) => item.content && item.content.length > 0),
      ).toBe(true);
    });
  });

  test("管理员可按 hasContent=empty 筛选空课程简介", {
    tag: "@Description/REST",
  }, async ({ run, descriptionState }) => {
    await run(async () => {
      const {
        admin: { request },
      } = descriptionState;
      const response = await request.get(`${BASE}?hasContent=empty`);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        data?: Array<{ id?: string; content?: string }>;
      };
      expect(body.data?.every((item) => item.content === "")).toBe(true);
      expect(body.data).toEqual([
        expect.objectContaining({ id: descriptionState.empty.id }),
      ]);
    });
  });

  test("管理员可按 search 搜索课程简介内容", {
    tag: "@Description/REST",
  }, async ({ run, descriptionState }) => {
    await run(async () => {
      const {
        admin: { request },
      } = descriptionState;
      const response = await request.get(
        `${BASE}?search=${encodeURIComponent("课程建议")}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        data?: Array<{ content?: string; sectionId?: number | null }>;
      };
      expect((body.data?.length ?? 0) > 0).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data?.[0]).toMatchObject({
        sectionId: descriptionState.section.sectionId,
      });
      expect(
        body.data?.some((item) => item.content?.includes("课程建议")),
      ).toBe(true);
    });
  });

  test("管理员可使用 pageSize 参数限制返回数量", {
    tag: "@Description/REST",
  }, async ({ run, descriptionState }) => {
    await run(async () => {
      const {
        admin: { request },
      } = descriptionState;
      const firstResponse = await request.get(`${BASE}?pageSize=1`);
      const secondResponse = await request.get(`${BASE}?page=2&pageSize=1`);
      expect(firstResponse.status()).toBe(200);
      expect(secondResponse.status()).toBe(200);
      const first = (await firstResponse.json()) as {
        data?: Array<{ id?: string }>;
        pagination?: { total?: number };
      };
      const second = (await secondResponse.json()) as {
        data?: Array<{ id?: string }>;
        pagination?: { page?: number; pageSize?: number; total?: number };
      };
      expect((first.pagination?.total ?? 0) > 1).toBe(true);
      expect(first.pagination?.total).toBe(4);
      expect(first.data?.[0]?.id).toBe(descriptionState.assignment.id);
      expect(second.data?.[0]?.id).toBe(descriptionState.teacher.id);
      expect(first.data).toHaveLength(1);
      expect(second.pagination).toMatchObject({
        page: 2,
        pageSize: 1,
        total: first.pagination?.total,
      });
      expect(second.data?.[0]?.id).not.toBe(first.data?.[0]?.id);
    });
  });

  test("无效 limit 参数返回 400", { tag: "@Description/REST" }, async ({
    run,
    descriptionState,
  }) => {
    await run(async () => {
      const {
        admin: { request },
      } = descriptionState;
      const response = await request.get(`${BASE}?pageSize=not-a-number`);
      expect(response.status()).toBe(400);
      expect(await descriptionState.db.description.count()).toBe(5);
      expect(await descriptionState.db.auditLog.count()).toBe(0);
    });
  });
});
