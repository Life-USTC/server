/** Public current-semester reads own dated catalog rows and a real Worker. */
import { expect } from "@playwright/test";
import { test } from "../../_shared/public-academic-fixture";

test.describe("GET /api/catalog/semesters/current", () => {
  test("契约", { tag: "@Catalog/REST" }, async ({ run, request, academic }) => {
    await run(async () => {
      const response = await request.get("/api/catalog/semesters/current");
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        jwId?: number;
        nameCn?: string;
        code?: string;
      };
      expect(body.jwId).toBe(academic.semester.jwId);
      expect(body.nameCn).toBe(academic.semester.nameCn);
      expect(typeof body.nameCn).toBe("string");
      expect(typeof body.code).toBe("string");
    });
  });

  test("返回 seed 学期", { tag: "@Catalog/REST" }, async ({
    run,
    request,
    academic,
  }) => {
    await run(async () => {
      const response = await request.get("/api/catalog/semesters/current");
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        jwId?: number;
        nameCn?: string;
        code?: string;
      };
      expect(body.jwId).toBe(academic.semester.jwId);
      expect(typeof body.nameCn).toBe("string");
      expect(body.code).toBe("PRIVATE-CURRENT");
    });
  });

  test("响应包含预期字段", { tag: "@Catalog/REST" }, async ({
    run,
    request,
    academic,
  }) => {
    await run(async () => {
      const response = await request.get("/api/catalog/semesters/current");
      expect(response.status()).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toHaveProperty("jwId");
      expect(body).toHaveProperty("nameCn");
      expect(body).toHaveProperty("startDate");
      expect(body).toHaveProperty("endDate");
      expect(body).toMatchObject({
        jwId: academic.semester.jwId,
        nameCn: "独立当前学期",
        startDate: expect.stringMatching(
          new RegExp(
            `^${academic.semester.startDate?.toISOString().slice(0, 10)}`,
          ),
        ),
        endDate: expect.stringMatching(
          new RegExp(
            `^${academic.semester.endDate?.toISOString().slice(0, 10)}`,
          ),
        ),
      });
    });
  });
});
