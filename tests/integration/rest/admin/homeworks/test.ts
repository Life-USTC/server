import { expect } from "@playwright/test";
import { base, test } from "./_fixture";

test("未认证列表请求返回 401 JSON", async ({ run, request }) => {
  await run(async () => {
    const response = await request.get(base);
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });
});

test("非管理员认证用户返回 401", async ({ run, isolatedWorker }) => {
  await run(async () => {
    const user = await isolatedWorker.createActor();
    expect((await user.request.get(base)).status()).toBe(401);
  });
});

test("管理员可列出作业并包含关键字段", async ({
  run,
  homeworkState: state,
}) => {
  await run(async () => {
    const response = await state.admin.request.get(base);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(3);
    const homework = state.homeworks[1];
    expect(
      body.data.find((item: { id: string }) => item.id === homework.id),
    ).toMatchObject({
      id: homework.id,
      title: "Recent homework",
      submissionDueAt: "2100-01-01T08:00:00+08:00",
      createdAt: "2026-09-02T08:00:00+08:00",
      updatedAt: "2026-09-04T08:00:00+08:00",
      deletedAt: null,
      section: {
        id: state.section.id,
        jwId: state.section.jwId,
        code: state.section.code,
        course: { nameCn: state.catalog.courses[0].nameCn },
      },
      createdBy: { id: state.owner.id, name: "Isolated Worker actor" },
    });
  });
});

for (const [status, indices] of [
  ["all", [1, 0, 2]],
  ["active", [1, 0]],
  ["deleted", [2]],
] as const) {
  test(`管理员按 status=${status} 筛选并排序作业`, async ({
    run,
    homeworkState: state,
  }) => {
    await run(async () => {
      const response = await state.admin.request.get(
        `${base}?status=${status}`,
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.map((item: { id: string }) => item.id)).toEqual(
        indices.map((index) => state.homeworks[index].id),
      );
      expect(
        body.data.map((item: { deletedAt: string | null }) => item.deletedAt),
      ).toEqual(
        indices.map((index) =>
          index === 2 ? "2026-09-04T08:00:00+08:00" : null,
        ),
      );
      expect(body.pagination.total).toBe(indices.length);
    });
  });
}

for (const field of [
  "title",
  "course",
  "section-code",
  "course-code",
  "missing",
] as const) {
  test(`管理员按 search=${field} 搜索作业`, async ({
    run,
    homeworkState: state,
  }) => {
    await run(async () => {
      const search = {
        title: "Recent homework",
        course: state.catalog.courses[0].nameCn,
        "section-code": state.section.code,
        "course-code": state.catalog.courses[0].code,
        missing: "No matching homework",
      }[field];
      if (search === null) throw new Error("Expected a prepared section code");
      const response = await state.admin.request.get(base, {
        params: { search },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      const indices =
        field === "title" ? [1] : field === "missing" ? [] : [1, 0, 2];
      expect(body.data.map((item: { id: string }) => item.id)).toEqual(
        indices.map((index) => state.homeworks[index].id),
      );
      expect(body.pagination.total).toBe(indices.length);
    });
  });
}

test("管理员可分页读取独立且完整的作业列表", async ({
  run,
  homeworkState: state,
}) => {
  await run(async () => {
    for (const [index, expected] of [
      state.homeworks[1],
      state.homeworks[0],
      state.homeworks[2],
      null,
    ].entries()) {
      const response = await state.admin.request.get(base, {
        params: { page: index + 1, pageSize: 1 },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.pagination).toEqual({
        page: index + 1,
        pageSize: 1,
        total: 3,
        totalPages: 3,
      });
      expect(body.data.map((item: { id: string }) => item.id)).toEqual(
        expected ? [expected.id] : [],
      );
    }
  });
});

for (const query of ["pageSize=not-a-number", "limit=1"]) {
  test(`管理员列表拒绝无效参数 ${query}`, async ({ run, isolatedWorker }) => {
    await run(async () => {
      const admin = await isolatedWorker.createActor({ isAdmin: true });
      expect((await admin.request.get(`${base}?${query}`)).status()).toBe(400);
    });
  });
}
