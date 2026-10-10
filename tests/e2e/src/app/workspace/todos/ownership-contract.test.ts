import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { browserTest, expect, roles, test } from "./_ownership";

for (const role of roles)
  test.describe(`todo ownership Web ${role}`, () => {
    test.use({ ownerRole: role });
    for (const width of [1280, 390])
      browserTest(
        `consumer hides foreign rows at ${width}px`,
        { tag: "@Todo/Web" },
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const page = await f.page();
              await page.setViewportSize({ width, height: 900 });
              await gotoAndWaitForReady(
                page,
                `/workspace/todos?todoId=${f.other.todo.id}&userId=${f.other.id}`,
              );
              await expect(
                page
                  .getByRole("button", {
                    name: f.actor.todo.title,
                    exact: true,
                  })
                  .filter({ visible: true }),
              ).toBeVisible();
              await expect(
                page.getByText(f.other.todo.title, { exact: true }),
              ).toHaveCount(0);
              await expect(
                page.getByText(f.other.todo.content ?? "", { exact: true }),
              ).toHaveCount(0);
              await f.unchanged();
            },
            { calendarRebuilds: 0 },
          );
        },
      );
    browserTest(
      "mobile owner create persists authenticated ownership",
      { tag: "@Todo/Web" },
      async ({ ownership: f }) => {
        await f.run(
          async () => {
            const page = await f.page();
            await gotoAndWaitForReady(page, "/workspace/todos");
            const title = "Web owned todo";
            await page
              .getByRole("button", { name: "Add Todo", exact: true })
              .click();
            await page.getByLabel("Title", { exact: true }).fill(title);
            const [created] = await Promise.all([
              page.waitForResponse(
                (response) =>
                  response.request().method() === "POST" &&
                  new URL(response.url()).pathname === "/workspace/todos" &&
                  new URL(response.url()).searchParams.has("/createTodo"),
              ),
              page
                .getByRole("button", { name: "Create Todo", exact: true })
                .click(),
            ]);
            expect(created.status()).toBe(200);
            expect(await created.json()).toMatchObject({
              type: "redirect",
              status: 303,
              location: "/workspace/todos",
            });
            await expect(
              page
                .getByRole("button", { name: title, exact: true })
                .filter({ visible: true }),
            ).toBeVisible();
            const row = await f.db.todo.findFirstOrThrow({
              where: { userId: f.actor.id, title },
            });
            expect(row).toEqual({
              id: expect.any(String),
              userId: f.actor.id,
              title,
              content: null,
              completed: false,
              priority: "medium",
              dueAt: null,
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
            });
            await f.unchanged([row.id]);
          },
          { calendarRebuilds: 1 },
        );
      },
    );
    browserTest(
      "mobile owner update preserves authenticated ownership",
      { tag: "@Todo/Web" },
      async ({ ownership: f }) => {
        await f.run(
          async () => {
            const title = "Web original";
            const row = await f.seedTodo({
              title,
              content: "Retained Web content",
              priority: "high",
              dueAt: new Date("2026-10-05T12:00:00+08:00"),
            });
            const page = await f.page();
            await gotoAndWaitForReady(page, "/workspace/todos");
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
            const [updated] = await Promise.all([
              page.waitForResponse(
                (response) =>
                  response.request().method() === "POST" &&
                  new URL(response.url()).pathname === "/workspace/todos" &&
                  new URL(response.url()).searchParams.has("/updateTodo"),
              ),
              page
                .getByRole("dialog")
                .getByRole("button", { name: "Save Changes", exact: true })
                .click(),
            ]);
            expect(updated.status()).toBe(200);
            expect(await updated.json()).toMatchObject({
              type: "redirect",
              status: 303,
              location: "/workspace/todos",
            });
            await expect(
              page
                .getByRole("button", { name: `${title} edited`, exact: true })
                .filter({ visible: true }),
            ).toBeVisible();
            expect(await f.stored(row.id)).toEqual({
              ...row,
              title: `${title} edited`,
              updatedAt: expect.any(Date),
            });
            await expect(
              page.getByRole("button", { name: title, exact: true }),
            ).toHaveCount(0);
            await f.unchanged([row.id]);
          },
          { calendarRebuilds: 1 },
        );
      },
    );
    browserTest(
      "mobile owner delete removes an independently prepared todo",
      { tag: "@Todo/Web" },
      async ({ ownership: f }) => {
        await f.run(
          async () => {
            const title = "Web removable";
            const row = await f.seedTodo({
              title,
              content: "Private deletion target",
            });
            const page = await f.page();
            await gotoAndWaitForReady(page, "/workspace/todos");
            await page
              .getByRole("button", { name: title, exact: true })
              .filter({ visible: true })
              .click();
            await page
              .getByRole("dialog")
              .getByRole("button", { name: "Delete todo", exact: true })
              .click();
            const [deleted] = await Promise.all([
              page.waitForResponse(
                (response) =>
                  response.request().method() === "DELETE" &&
                  new URL(response.url()).pathname ===
                    `/api/workspace/todos/${row.id}`,
              ),
              page
                .getByRole("alertdialog")
                .getByRole("button", { name: "Delete", exact: true })
                .click(),
            ]);
            expect(deleted.status()).toBe(200);
            expect(await deleted.json()).toMatchObject({ success: true });
            await expect.poll(() => f.stored(row.id)).toBeNull();
            await expect(
              page.getByRole("button", {
                name: title,
                exact: true,
              }),
            ).toHaveCount(0);
            await f.unchanged();
          },
          { calendarRebuilds: 1 },
        );
      },
    );
    test("forged foreign Web update is rejected without effects", {
      tag: "@Todo/Web",
    }, async ({ ownership: f }) => {
      await f.run(
        async () => {
          const request = await f.request("cookie", "rest");
          const response = await request.post("/workspace/todos?/updateTodo", {
            headers: { origin: f.origin },
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
        },
        { calendarRebuilds: 0 },
      );
    });
  });
