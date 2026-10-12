import { expect } from "@playwright/test";
import {
  originalContent,
  storedAudits,
  storedDescription,
  test,
} from "../../../descriptions/_fixture";

const base = "/api/admin/descriptions";
test.describe.configure({ mode: "parallel" });

test.describe("PATCH /api/admin/descriptions/[id] 课程简介管理", () => {
  test("API 契约", { tag: "@Description/REST" }, async ({ run, request }) => {
    await run(async () => {
      const response = await request.patch(`${base}/missing-id`, { data: {} });
      expect(response.status()).toBe(401);
      expect((await response.json()).error).toEqual(expect.any(String));
    });
  });

  test("未认证 PATCH 返回 401", { tag: "@Description/REST" }, async ({
    run,
    request,
    descriptionState: state,
  }) => {
    await run(async () => {
      const before = await storedDescription(state);
      const response = await request.patch(`${base}/${state.description.id}`, {
        data: { content: "should fail" },
      });
      expect(response.status()).toBe(401);
      expect(await storedDescription(state)).toEqual(before);
    });
  });

  test("非管理员 PATCH 返回 401", { tag: "@Description/REST" }, async ({
    run,
    descriptionState: state,
  }) => {
    await run(async () => {
      const before = await storedDescription(state);
      const response = await state.owner.request.patch(
        `${base}/${state.description.id}`,
        { data: { content: "should fail" } },
      );
      expect(response.status()).toBe(401);
      expect(await storedDescription(state)).toEqual(before);
    });
  });

  for (const [label, content] of [
    ["ordinary content", "Independent admin description update"],
    ["empty content", ""],
    ["preserved whitespace", "  Independent description  "],
    ["4000 ASCII code units", "x".repeat(4000)],
    ["4000 Unicode code units", "😀".repeat(2000)],
  ] as const) {
    test(`管理员可更新课程简介并记录历史: ${label}`, {
      tag: "@Description/REST",
    }, async ({ run, descriptionState: state, admin }) => {
      await run(async () => {
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
    });
  }

  for (const [label, content] of [
    ["4001 ASCII code units", "x".repeat(4001)],
    ["4001 Unicode code units", `${"😀".repeat(2000)}x`],
  ] as const) {
    test(`管理员 PATCH 拒绝过长的课程简介内容: ${label}`, {
      tag: "@Description/REST",
    }, async ({ run, descriptionState: state, admin }) => {
      await run(async () => {
        const before = await storedDescription(state);
        const response = await admin.request.patch(
          `${base}/${state.description.id}`,
          { data: { content } },
        );
        expect(response.status()).toBe(400);
        expect(await storedDescription(state)).toEqual(before);
        expect(await storedAudits(state, "admin_description_moderate")).toEqual(
          [],
        );
      });
    });
  }
});
