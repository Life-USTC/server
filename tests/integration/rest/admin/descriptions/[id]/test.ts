import { expect } from "@playwright/test";
import { DESCRIPTION_CONTENT_MAX_LENGTH } from "@/features/descriptions/lib/description-limits";
import {
  originalContent,
  storedAudits,
  storedDescription,
  test,
} from "../../../descriptions/_fixture";

const base = "/api/admin/descriptions";
test.describe.configure({ mode: "parallel" });

test.describe("PATCH /api/admin/descriptions/[id] 课程简介管理", () => {
  test("API 契约", async ({ request }) => {
    const response = await request.patch(`${base}/missing-id`, { data: {} });
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toEqual(expect.any(String));
  });

  test("未认证 PATCH 返回 401", async ({
    request,
    descriptionState: state,
  }) => {
    const before = await storedDescription(state);
    const response = await request.patch(`${base}/${state.description.id}`, {
      data: { content: "should fail" },
    });
    expect(response.status()).toBe(401);
    expect(await storedDescription(state)).toEqual(before);
  });

  test("非管理员 PATCH 返回 401", async ({ descriptionState: state }) => {
    const before = await storedDescription(state);
    const response = await state.owner.request.patch(
      `${base}/${state.description.id}`,
      { data: { content: "should fail" } },
    );
    expect(response.status()).toBe(401);
    expect(await storedDescription(state)).toEqual(before);
  });

  test("管理员可更新课程简介并记录历史", async ({
    descriptionState: state,
    admin,
  }) => {
    const content = "Independent admin description update";
    const response = await admin.request.patch(
      `${base}/${state.description.id}`,
      { data: { content } },
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.description).toMatchObject({
      id: state.description.id,
      content,
      lastEditedById: admin.id,
    });
    const persisted = await storedDescription(state);
    expect(persisted).toMatchObject({
      content,
      lastEditedById: admin.id,
      lastEditedAt: expect.any(Date),
    });
    expect(persisted?.edits).toEqual([
      expect.objectContaining({
        editorId: admin.id,
        previousContent: originalContent,
        nextContent: content,
      }),
    ]);
    await expect
      .poll(() => storedAudits(state, "admin_description_moderate"))
      .toEqual([
        expect.objectContaining({ userId: admin.id, outcome: "success" }),
      ]);
    const read = await admin.request.get(
      `/api/community/descriptions?targetType=section&targetId=${state.section.id}`,
    );
    expect(read.status()).toBe(200);
    expect((await read.json()).description.content).toBe(content);
  });

  test("管理员 PATCH 拒绝过长的课程简介内容", async ({
    descriptionState: state,
    admin,
  }) => {
    const before = await storedDescription(state);
    const response = await admin.request.patch(
      `${base}/${state.description.id}`,
      { data: { content: "x".repeat(DESCRIPTION_CONTENT_MAX_LENGTH + 1) } },
    );
    expect(response.status()).toBe(400);
    expect(await storedDescription(state)).toEqual(before);
    expect(await storedAudits(state, "admin_description_moderate")).toEqual([]);
  });
});
