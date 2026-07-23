import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { assertApiContract } from "../../_shared/api-contract";

test("/api/sections", async ({ request }) => {
  await assertApiContract(request, { routePath: "/api/sections" });
});

test("班级列表项包含所有必需的 SectionSummary 字段", async ({ request }) => {
  const response = await request.get(
    `/api/sections?search=${encodeURIComponent(DEV_SEED.section.code)}&limit=20`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: Array<{
      id?: unknown;
      jwId?: unknown;
      code?: unknown;
      course?: { nameCn?: unknown; nameEn?: unknown };
      semester?: { nameCn?: string } | null;
      credits?: unknown;
      stdCount?: unknown;
      limitCount?: unknown;
    }>;
  };
  const section = body.data?.find(
    (item) => item.jwId === DEV_SEED.section.jwId,
  );
  expect(section).toBeDefined();
  expect(typeof section?.id).toBe("number");
  expect(typeof section?.jwId).toBe("number");
  expect(typeof section?.code).toBe("string");
  expect(typeof section?.course?.nameCn).toBe("string");
  expect(Object.hasOwn(section?.course as object, "nameEn")).toBe(true);
  expect(Object.hasOwn(section as object, "semester")).toBe(true);
  expect(Object.hasOwn(section as object, "credits")).toBe(true);
  expect(typeof section?.stdCount).toBe("number");
  expect(typeof section?.limitCount).toBe("number");
});

test("班级列表项包含教师数组", async ({ request }) => {
  const response = await request.get(
    `/api/sections?search=${encodeURIComponent(DEV_SEED.section.code)}&limit=20`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: Array<{ jwId?: number; teachers?: unknown[] }>;
  };
  const section = body.data?.find(
    (item) => item.jwId === DEV_SEED.section.jwId,
  );
  expect(section).toBeDefined();
  expect(Array.isArray(section?.teachers)).toBe(true);
});

test("pageSize 参数控制班级列表页大小", async ({ request }) => {
  const response = await request.get("/api/sections?pageSize=1");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: unknown[];
    pagination?: { pageSize?: number };
  };
  expect(body.data?.length).toBeLessThanOrEqual(1);
  expect(body.pagination?.pageSize).toBe(1);
});

test("/api/sections 可按 teacherId 过滤到 seed 班级", async ({ request }) => {
  const teacherResponse = await request.get(
    `/api/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}&limit=5`,
  );
  expect(teacherResponse.status()).toBe(200);
  const teacherBody = (await teacherResponse.json()) as {
    data?: Array<{ id?: number }>;
  };
  const teacherId = teacherBody.data?.[0]?.id;
  expect(teacherId).toBeDefined();

  const response = await request.get(
    `/api/sections?teacherId=${teacherId}&limit=20`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: Array<{ code?: string }>;
  };
  expect(body.data?.some((item) => item.code === DEV_SEED.section.code)).toBe(
    true,
  );
});

test("/api/sections 可按课程 legacy jwId 过滤到 canonical 班级", async ({
  request,
}) => {
  const response = await request.get(
    `/api/sections?courseJwId=${DEV_SEED.course.legacyJwId}&limit=20`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: Array<{
      jwId?: number;
      course?: { jwId?: number };
    }>;
  };
  const section = body.data?.find(
    (item) => item.jwId === DEV_SEED.section.jwId,
  );
  expect(section).toBeDefined();
  expect(section?.course?.jwId).toBe(DEV_SEED.course.jwId);
});

test("/api/sections 可按高级 search 语法检索 seed 班级", async ({
  request,
}) => {
  const response = await request.get(
    `/api/sections?search=${encodeURIComponent(`teacher:${DEV_SEED.teacher.nameCn}`)}&limit=20`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: Array<{ jwId?: number; code?: string }>;
  };
  expect(body.data?.some((item) => item.jwId === DEV_SEED.section.jwId)).toBe(
    true,
  );
});

for (const [label, search] of [
  ["课程名称", DEV_SEED.course.nameCn],
  ["教师名称", DEV_SEED.teacher.nameCn],
] as const) {
  test(`/api/sections 普通搜索支持${label}并可限定学期`, async ({
    request,
  }) => {
    const response = await request.get(
      `/api/sections?search=${encodeURIComponent(search)}&semesterJwId=${DEV_SEED.semesterJwId}&pageSize=20`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ jwId?: number }>;
    };
    expect(body.data?.some((item) => item.jwId === DEV_SEED.section.jwId)).toBe(
      true,
    );
  });
}
