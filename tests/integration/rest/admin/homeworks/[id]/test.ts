import { expect } from "@playwright/test";
import { base, test } from "../_fixture";

test("未认证 DELETE 返回 401 JSON 且不修改作业", async ({
  run,
  request,
  homeworkState: state,
}) => {
  await run(async () => {
    const homework = state.homeworks[0];
    const response = await request.delete(`${base}/${homework.id}`);
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(
      await state.db.homework.findUnique({ where: { id: homework.id } }),
    ).toEqual(homework);
    expect(
      await state.db.auditLog.count({ where: { targetId: homework.id } }),
    ).toBe(0);
  });
});

test("非管理员 DELETE 返回 401 且不修改作业", async ({
  run,
  homeworkState: state,
}) => {
  await run(async () => {
    const homework = state.homeworks[0];
    expect(
      (await state.owner.request.delete(`${base}/${homework.id}`)).status(),
    ).toBe(401);
    expect(
      await state.db.homework.findUnique({ where: { id: homework.id } }),
    ).toEqual(homework);
    expect(
      await state.db.auditLog.count({ where: { targetId: homework.id } }),
    ).toBe(0);
  });
});

test("封禁管理员不能删除作业", async ({ run, homeworkState: state }) => {
  await run(async () => {
    const homework = state.homeworks[0];
    await state.db.userSuspension.create({
      data: { userId: state.admin.id, reason: "Known active suspension" },
    });
    expect(
      (await state.admin.request.delete(`${base}/${homework.id}`)).status(),
    ).toBe(403);
    expect(
      await state.db.homework.findUnique({ where: { id: homework.id } }),
    ).toEqual(homework);
    expect(
      await state.db.auditLog.count({ where: { targetId: homework.id } }),
    ).toBe(0);
  });
});

test("管理员删除不存在的作业返回 404", async ({ run, isolatedWorker }) => {
  await run(async () => {
    const admin = await isolatedWorker.createActor({ isAdmin: true });
    expect(
      (await admin.request.delete(`${base}/nonexistent-homework-id`)).status(),
    ).toBe(404);
    expect(
      await isolatedWorker.database.owner.auditLog.count({
        where: { action: "homework_delete" },
      }),
    ).toBe(0);
  });
});

test("管理员不能通过普通删除入口越过作者权限", async ({
  run,
  homeworkState: state,
}) => {
  await run(async () => {
    const homework = state.homeworks[0];
    const path = `/api/community/section-homeworks/${homework.id}`;
    expect((await state.admin.request.delete(path)).status()).toBe(403);
    expect((await state.admin.request.get(path)).status()).toBe(200);
    expect(
      await state.db.homework.findUnique({ where: { id: homework.id } }),
    ).toEqual(homework);
    expect(
      await state.db.auditLog.count({ where: { targetId: homework.id } }),
    ).toBe(0);
  });
});

test("管理员可删除作业且重放不重复写审计", async ({
  run,
  homeworkState: state,
}) => {
  await run(async () => {
    const homework = state.homeworks[0];
    const response = await state.admin.request.delete(`${base}/${homework.id}`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    const committed = await state.db.homework.findUniqueOrThrow({
      where: { id: homework.id },
    });
    expect(committed).toEqual({
      ...homework,
      deletedAt: expect.any(Date),
      deletedById: state.admin.id,
      updatedAt: expect.any(Date),
      updatedById: state.admin.id,
    });
    const audits = await state.db.auditLog.findMany({
      where: { targetId: homework.id },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "homework_delete",
      targetType: "homework",
      userId: state.admin.id,
      channel: "rest",
      outcome: "success",
    });

    const visible = await state.owner.request.get(
      "/api/community/section-homeworks",
      {
        params: { sectionId: state.section.id },
      },
    );
    expect(visible.status()).toBe(200);
    expect(
      (await visible.json()).data.map((item: { id: string }) => item.id),
    ).toEqual([state.homeworks[1].id]);
    const replay = await state.admin.request.delete(`${base}/${homework.id}`);
    expect(replay.status()).toBe(200);
    expect(await replay.json()).toEqual({ success: true });
    expect(
      await state.db.homework.findUnique({ where: { id: homework.id } }),
    ).toEqual(committed);
    expect(
      await state.db.auditLog.findMany({ where: { targetId: homework.id } }),
    ).toEqual(audits);
  });
});
