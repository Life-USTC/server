import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { BASE, expect, roles, stored, test } from "./_ownership";

for (const role of roles)
  test.describe(`todo ownership Web ${role}`, () => {
    test.use({ ownerRole: role });
    for (const width of [1280, 390])
      test(`consumer hides foreign rows at ${width}px`, async ({
        ownership: f,
      }) => {
        const page = await f.page();
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(
          page,
          `/workspace/todos?todoId=${f.other.todo.id}&userId=${f.other.id}`,
        );
        await expect(
          page
            .getByRole("button", { name: f.actor.todo.title, exact: true })
            .filter({ visible: true }),
        ).toBeVisible();
        await expect(
          page.getByText(f.other.todo.title, { exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByText(f.other.todo.content ?? "", { exact: true }),
        ).toHaveCount(0);
        await f.unchanged();
      });
    test("mobile owner create edit delete journey", async ({
      ownership: f,
    }) => {
      const page = await f.page();
      await gotoAndWaitForReady(page, "/workspace/todos");
      const title = "Web owned todo";
      await page.getByRole("button", { name: "Add Todo", exact: true }).click();
      await page.getByLabel("Title", { exact: true }).fill(title);
      await page
        .getByRole("button", { name: "Create Todo", exact: true })
        .click();
      await expect(
        page
          .getByRole("button", { name: title, exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      const row = await withE2ePrisma((db) =>
        db.todo.findFirstOrThrow({ where: { userId: f.actor.id, title } }),
      );
      await page
        .getByRole("button", { name: title, exact: true })
        .filter({ visible: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Edit Todo", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByLabel("Title", { exact: true })
        .fill(`${title} edited`);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Save Changes", exact: true })
        .click();
      await expect(
        page
          .getByRole("button", { name: `${title} edited`, exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      expect(await stored(row.id)).toMatchObject({
        title: `${title} edited`,
        userId: f.actor.id,
      });
      await page
        .getByRole("button", { name: `${title} edited`, exact: true })
        .filter({ visible: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete todo", exact: true })
        .click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      await expect.poll(() => stored(row.id)).toBeNull();
      await expect(
        page.getByRole("button", { name: `${title} edited`, exact: true }),
      ).toHaveCount(0);
      await f.unchanged();
    });
    test("forged foreign Web update is rejected without effects", async ({
      ownership: f,
    }) => {
      const page = await f.page();
      const response = await page.request.post("/workspace/todos?/updateTodo", {
        headers: { origin: BASE },
        form: {
          id: f.other.todo.id,
          title: "Forged Web write",
          userId: f.actor.id,
          priority: "medium",
        },
      });
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        type: "failure",
        status: 400,
      });
      await f.unchanged();
    });
  });
