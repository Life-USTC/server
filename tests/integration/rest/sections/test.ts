import { expect } from "@playwright/test";
import { DEV_SEED } from "../../../e2e/utils/dev-seed";
import { assertApiContract } from "../_shared/api-contract";
import { test } from "../_shared/catalog-reader-fixture";

test("/api/catalog/sections", async ({ run, request }) => {
  return run(async () => {
    await assertApiContract(request, { routePath: "/api/catalog/sections" });
  });
});

test("pageSize 参数控制班级列表页大小", async ({ run, request }) => {
  return run(async () => {
    const response = await request.get("/api/catalog/sections?pageSize=1");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: unknown[];
      pagination?: { pageSize?: number };
    };
    expect(body.data?.length).toBeLessThanOrEqual(1);
    expect(body.pagination?.pageSize).toBe(1);
  });
});

test("/api/catalog/sections 可按 teacherId 过滤到 seed 班级", async ({
  run,
  request,
}) => {
  return run(async () => {
    const teacherResponse = await request.get(
      `/api/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}&pageSize=5`,
    );
    expect(teacherResponse.status()).toBe(200);
    const teacherBody = (await teacherResponse.json()) as {
      data?: Array<{ id?: number }>;
    };
    const teacherId = teacherBody.data?.[0]?.id;
    expect(teacherId).toBeDefined();

    const response = await request.get(
      `/api/catalog/sections?teacherId=${teacherId}&pageSize=20`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ code?: string }>;
    };
    expect(body.data?.some((item) => item.code === DEV_SEED.section.code)).toBe(
      true,
    );
  });
});

test("/api/catalog/sections 可按高级 search 语法检索 seed 班级", async ({
  run,
  request,
}) => {
  return run(async () => {
    const response = await request.get(
      `/api/catalog/sections?search=${encodeURIComponent(`teacher:${DEV_SEED.teacher.nameCn}`)}&pageSize=20`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ jwId?: number; code?: string }>;
    };
    expect(body.data?.some((item) => item.jwId === DEV_SEED.section.jwId)).toBe(
      true,
    );
  });
});

for (const [label, search] of [
  ["课程名称", DEV_SEED.course.nameCn],
  ["教师名称", DEV_SEED.teacher.nameCn],
] as const) {
  test(`/api/catalog/sections 普通搜索支持${label}并可限定学期`, async ({
    run,
    request,
  }) => {
    return run(async () => {
      const response = await request.get(
        `/api/catalog/sections?search=${encodeURIComponent(search)}&semesterJwId=${DEV_SEED.semesterJwId}&pageSize=20`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        data?: Array<{ jwId?: number }>;
      };
      expect(
        body.data?.some((item) => item.jwId === DEV_SEED.section.jwId),
      ).toBe(true);
    });
  });
}
