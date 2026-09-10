import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { createHomeworkEditorFixture } from "../../../../utils/homework-editor-fixture";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";

for (const width of [1280, 390]) {
  test(`homework creation offers class deadlines and live preview at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await createHomeworkEditorFixture(page);
    try {
      const preferences = await page.request.post("/api/account/preferences", {
        data: { locale: "zh-cn" },
      });
      expect(preferences.ok()).toBe(true);
      await gotoAndWaitForReady(page, "/workspace/homeworks");
      await page.getByTestId("workspace-homeworks-add").click();
      const dialog = page.getByRole("dialog", { name: "新建作业" });
      const sectionSelect = dialog.locator('select[name="sectionId"]');
      await sectionSelect.selectOption(String(fixture.sections[0].id));
      const option = sectionSelect.locator("option:checked");
      await expect(option).toContainText(DEV_SEED.teacher.nameCn);
      await expect(option).not.toContainText(fixture.sections[0].code);

      const title = dialog.getByTestId("workspace-homework-title");
      const editor = dialog.getByRole("textbox", { name: "说明", exact: true });
      const markdown = "## 第一次作业\n\n- 完成 **第一题**\n- 提交到课堂";
      await title.fill(`第一次作业 ${width}`);
      await editor.fill(markdown);
      const preview = dialog.locator('[data-slot="markdown-preview"]');
      await expect(
        preview.getByRole("heading", { name: "第一次作业" }),
      ).toBeVisible();
      await expect(preview.locator("strong")).toHaveText("第一题");
      await editor.fill(markdown.replace("第一题", "第二题"));
      await expect(preview.locator("strong")).toHaveText("第二题");
      await expect(dialog.locator('input[name="description"]')).toHaveCount(1);
      await expect(dialog.locator('input[name="description"]')).toHaveValue(
        markdown.replace("第一题", "第二题"),
      );
      if (width >= 1024) {
        const [titleBox, editorBox] = await Promise.all([
          title.boundingBox(),
          editor.boundingBox(),
        ]);
        expect(titleBox).not.toBeNull();
        expect(editorBox).not.toBeNull();
        if (!titleBox || !editorBox)
          throw new Error("Expected both form columns");
        expect(editorBox.x).toBeGreaterThan(titleBox.x + titleBox.width);
      }

      for (const [index, section] of fixture.sections.entries()) {
        await sectionSelect.selectOption(String(section.id));
        await dialog.getByRole("button", { name: "常用截止时间" }).click();
        await page.getByRole("menuitem", { name: /08:00/ }).first().click();
        await expect(
          dialog.locator('input[name="submissionDueAt"]'),
        ).toHaveValue(fixture.dueValues[index]);
      }
      const submit = dialog.getByTestId("workspace-homework-create");
      await submit.click();
      await expect(dialog).not.toBeVisible();
      const result = await page.request.get("/api/workspace/homeworks");
      expect(result.ok()).toBe(true);
      const body = await result.json();
      const saved = body.data.find(
        (item: { title: string }) => item.title === `第一次作业 ${width}`,
      );
      expect(saved).toBeDefined();
      expect(saved.description.content).toBe(
        markdown.replace("第一题", "第二题"),
      );
      expect(new Date(saved.submissionDueAt).toISOString()).toBe(
        new Date(`${fixture.dueValues[1]}:00+08:00`).toISOString(),
      );
    } finally {
      await fixture.cleanup();
    }
  });
}
