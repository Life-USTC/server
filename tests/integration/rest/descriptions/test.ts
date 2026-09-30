import { expect } from "@playwright/test";
import {
  base,
  originalContent,
  storedAudits,
  storedDescription,
  test,
} from "./_fixture";

test.describe.configure({ mode: "parallel" });

test("/api/community/descriptions 接口契约", async ({
  run,
  request,
  descriptionState: state,
}) => {
  await run(async () => {
    const response = await request.get(
      `${base}?targetType=section&targetId=${state.section.id}`,
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.description).toMatchObject({
      id: state.description.id,
      content: originalContent,
    });
    expect(body.history).toEqual([]);
    expect(body.viewer).toMatchObject({
      isAuthenticated: false,
      isAdmin: false,
    });
  });
});

test("/api/community/descriptions GET 返回已准备的描述内容", async ({
  run,
  request,
  descriptionState: state,
}) => {
  await run(async () => {
    const response = await request.get(
      `${base}?targetType=section&targetId=${state.section.id}`,
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.description).toMatchObject({
      id: state.description.id,
      content: originalContent,
    });
    expect(body.description.content).toContain("课程建议");
    expect(body.viewer).toMatchObject({
      isAuthenticated: false,
      isAdmin: false,
    });
  });
});

test("/api/community/descriptions GET 接受公开 section JW id", async ({
  run,
  request,
  descriptionState: state,
}) => {
  await run(async () => {
    const response = await request.get(
      `${base}?targetType=section&sectionJwId=${state.section.jwId}`,
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.description).toMatchObject({
      id: state.description.id,
      content: originalContent,
    });
    expect(body.viewer).toMatchObject({
      isAuthenticated: false,
      isAdmin: false,
    });
  });
});

test("/api/community/descriptions GET 无效 targetType 返回 400", async ({
  run,
  request,
}) => {
  await run(async () => {
    expect(
      (await request.get(`${base}?targetType=invalid&targetId=1`)).status(),
    ).toBe(400);
  });
});

test("/api/community/descriptions GET 缺少 targetId 返回 400", async ({
  run,
  request,
}) => {
  await run(async () => {
    expect((await request.get(`${base}?targetType=section`)).status()).toBe(
      400,
    );
  });
});

test("/api/community/descriptions GET 不存在的 target 返回 404", async ({
  run,
  request,
  descriptionState: state,
}) => {
  await run(async () => {
    await state.db.section.delete({ where: { id: state.section.id } });
    expect(
      (
        await request.get(
          `${base}?targetType=section&sectionJwId=${state.section.jwId}`,
        )
      ).status(),
    ).toBe(404);
  });
});

test("/api/community/descriptions POST 未登录返回 401", async ({
  run,
  request,
  descriptionState: state,
}) => {
  await run(async () => {
    const before = await storedDescription(state);
    const response = await request.post(base, {
      data: {
        targetType: "section",
        targetId: String(state.section.id),
        content: "should fail",
      },
    });
    expect(response.status()).toBe(401);
    expect(await storedDescription(state)).toEqual(before);
  });
});

test("/api/community/descriptions POST 登录后更新描述且重复提交无副作用", async ({
  run,
  descriptionState: state,
}) => {
  await run(async () => {
    const { request } = state.owner;
    const original = await request.get(
      `${base}?targetType=section&targetId=${state.section.id}`,
    );
    expect(original.status()).toBe(200);
    expect((await original.json()).description).toMatchObject({
      id: state.description.id,
      content: originalContent,
    });
    const content = "Independent REST description update";
    const data = {
      targetType: "section",
      targetId: String(state.section.id),
      content,
    };
    const response = await request.post(base, { data });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      id: state.description.id,
      updated: true,
    });
    const persisted = await storedDescription(state);
    expect(persisted).toMatchObject({
      content,
      lastEditedById: state.owner.id,
      lastEditedAt: expect.any(Date),
    });
    expect(persisted?.edits).toEqual([
      expect.objectContaining({
        editorId: state.owner.id,
        previousContent: originalContent,
        nextContent: content,
      }),
    ]);
    await expect
      .poll(() => storedAudits(state, "description_edit"))
      .toEqual([
        expect.objectContaining({ userId: state.owner.id, outcome: "success" }),
      ]);
    const audits = await storedAudits(state, "description_edit");
    const read = await request.get(
      `${base}?targetType=section&targetId=${state.section.id}`,
    );
    expect(read.status()).toBe(200);
    expect((await read.json()).description.content).toBe(content);
    const repeat = await request.post(base, { data });
    expect(repeat.status()).toBe(200);
    expect(await repeat.json()).toEqual({
      id: state.description.id,
      updated: false,
    });
    expect(await storedDescription(state)).toEqual(persisted);
    expect(await storedAudits(state, "description_edit")).toEqual(audits);
  });
});

test("/api/community/descriptions POST 接受公开 section JW id", async ({
  run,
  descriptionState: state,
}) => {
  await run(async () => {
    const { request } = state.owner;
    const path = `${base}?targetType=section&sectionJwId=${state.section.jwId}`;
    const original = await request.get(path);
    expect(original.status()).toBe(200);
    expect((await original.json()).description).toMatchObject({
      id: state.description.id,
      content: originalContent,
    });
    const content = "Independent public-id REST description update";
    const response = await request.post(base, {
      data: { targetType: "section", sectionJwId: state.section.jwId, content },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      id: state.description.id,
      updated: true,
    });
    const persisted = await storedDescription(state);
    expect(persisted).toMatchObject({
      content,
      lastEditedById: state.owner.id,
      lastEditedAt: expect.any(Date),
    });
    expect(persisted?.edits).toEqual([
      expect.objectContaining({
        editorId: state.owner.id,
        previousContent: originalContent,
        nextContent: content,
      }),
    ]);
    await expect
      .poll(() => storedAudits(state, "description_edit"))
      .toEqual([
        expect.objectContaining({ userId: state.owner.id, outcome: "success" }),
      ]);
    const read = await request.get(path);
    expect(read.status()).toBe(200);
    expect((await read.json()).description.content).toBe(content);
  });
});

test("/api/community/descriptions POST 不存在的 target 返回 404", async ({
  run,
  descriptionState: state,
}) => {
  await run(async () => {
    await state.db.section.delete({ where: { id: state.section.id } });
    const response = await state.owner.request.post(base, {
      data: {
        targetType: "section",
        targetId: String(state.section.id),
        content: "target does not exist",
      },
    });
    expect(response.status()).toBe(404);
    expect(await storedDescription(state)).toBeNull();
  });
});
