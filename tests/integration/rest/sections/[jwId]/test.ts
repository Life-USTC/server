import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../e2e/utils/dev-seed";
import { assertApiContract } from "../../_shared/api-contract";

test("/api/catalog/sections/[jwId] 契约", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/catalog/sections/[jwId]",
  });
});

test("/api/catalog/sections/[jwId] 返回 teacherAssignments 与 exams", async ({
  request,
}) => {
  const response = await request.get(
    `/api/catalog/sections/${DEV_SEED.section.jwId}`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    teacherAssignments?: Array<Record<string, unknown>>;
    exams?: unknown[];
    code?: string;
  };
  expect(body.code).toBe(DEV_SEED.section.code);
  expect((body.teacherAssignments?.length ?? 0) > 0).toBe(true);
  for (const assignment of body.teacherAssignments ?? []) {
    expect(assignment).not.toHaveProperty("teacher");
  }
  expect((body.exams?.length ?? 0) > 0).toBe(true);
});

test("班级详情包含全部 SectionDetail 字段", async ({ request }) => {
  const response = await request.get(
    `/api/catalog/sections/${DEV_SEED.section.jwId}`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    code?: unknown;
    teachers?: Array<{ id?: unknown; nameCn?: unknown }>;
    schedules?: Array<{ endTime?: unknown; startTime?: unknown }>;
    scheduleGroups?: unknown[];
    exams?: unknown[];
    examMode?: unknown;
    teachLanguage?: unknown;
  };
  expect(typeof body.code).toBe("string");
  expect(Array.isArray(body.teachers)).toBe(true);
  const firstTeacher = body.teachers?.[0];
  if (firstTeacher) {
    expect(typeof firstTeacher.id).toBe("number");
    expect(typeof firstTeacher.nameCn).toBe("string");
    expect(firstTeacher).not.toHaveProperty("age");
    expect(firstTeacher).not.toHaveProperty("postcode");
    expect(firstTeacher).not.toHaveProperty("qq");
    expect(firstTeacher).not.toHaveProperty("wechat");
    expect(firstTeacher).not.toHaveProperty("email");
    expect(firstTeacher).not.toHaveProperty("mobile");
  }
  expect(Array.isArray(body.schedules)).toBe(true);
  expect(typeof body.schedules?.[0]?.startTime).toBe("string");
  expect(typeof body.schedules?.[0]?.endTime).toBe("string");
  expect(Array.isArray(body.scheduleGroups)).toBe(true);
  expect(Array.isArray(body.exams)).toBe(true);
  expect(Object.hasOwn(body, "examMode")).toBe(true);
  expect(Object.hasOwn(body, "teachLanguage")).toBe(true);
});
