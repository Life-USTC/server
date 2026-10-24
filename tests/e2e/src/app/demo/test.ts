import { expect, type Page, type Route } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { createSignedDemoCookie } from "../../../../shared/demo-token";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { test as workerTest } from "../../../utils/owned-worker";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { expectRenderedUiQuality } from "../../../utils/ui-quality";
import { openWorkspaceTaskFilter } from "../../../utils/workspace-task-filters";

const test = workerTest.extend<{
  browserRun: (work: () => Promise<void>) => Promise<void>;
}>({
  browserRun: async ({ page, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work) => workflow.run(() => run(() => workflow.body(work))));
    });
  },
});

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });

const copy = {
  "en-us": {
    enter: "Enter demo",
    exit: "Exit demo",
    heading: "Todos",
    identity: "Demo account · Read only",
    readOnly:
      "Browse and filter sample todos. Adding, completing, editing and deleting are disabled.",
    unavailable: "Other features are not available in this demo yet.",
    language: "Language selector",
    all: "All",
    incomplete: "Incomplete",
    completed: "Completed",
    add: "Add Todo",
    edit: "Edit Todo",
    editRow: "Edit todo",
    remove: "Delete todo",
    complete: "Mark as complete",
    undo: "Mark as incomplete",
    reading: "Review linear algebra",
    description: "Read chapter 3 and note questions.",
    outline: "Organize course notes",
    library: "Return library books",
    yesterday: /Yesterday/i,
    tomorrow: /Tomorrow/i,
  },
  "zh-cn": {
    enter: "进入演示",
    exit: "退出演示",
    heading: "待办",
    identity: "演示账户 · 只读",
    readOnly: "你可以浏览和筛选待办样例，无法新增、完成、编辑或删除。",
    unavailable: "其他功能暂未开放演示。",
    language: "语言选择",
    all: "全部",
    incomplete: "未完成",
    completed: "已完成",
    add: "添加待办",
    edit: "编辑待办",
    editRow: "编辑待办",
    remove: "删除待办",
    complete: "标记为完成",
    undo: "取消完成",
    reading: "预习线性代数",
    description: "阅读第三章，记下需要讨论的问题。",
    outline: "整理课程笔记",
    library: "归还图书",
    yesterday: /昨天/,
    tomorrow: /明天/,
  },
} as const;
type Locale = keyof typeof copy;

async function enterDemo(page: Page, locale: Locale) {
  await gotoAndWaitForReady(page, "/account/sign-in", {
    browserHealth: {},
    expectMeaningfulContent: true,
    expectNoHorizontalOverflow: true,
    uiQuality: {},
  });
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/account/demo/enter" &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: copy[locale].enter, exact: true }).click(),
  ]);
  expect(response.status()).toBe(303);
  await expect(page).toHaveURL(/\/workspace\/todos$/);
  await waitForUiSettled(page);
  await expect(page.getByTestId("demo-notice")).toContainText(
    copy[locale].identity,
  );
}

async function expectApiSample(page: Page, locale: Locale) {
  const response = await page.request.get("/api/workspace/todos");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.json();
  expect(body).toMatchObject({
    counts: { incomplete: 2, completed: 1, overdue: 1 },
    todos: [
      {
        id: "demo-todo-reading",
        title: copy[locale].reading,
        priority: "high",
        completed: false,
        dueAt: "2026-09-23T18:00:00+08:00",
      },
      {
        id: "demo-todo-outline",
        title: copy[locale].outline,
        priority: "medium",
        completed: false,
        dueAt: "2026-09-25T18:00:00+08:00",
      },
      {
        id: "demo-todo-library",
        title: copy[locale].library,
        priority: "low",
        completed: true,
        dueAt: null,
      },
    ],
  });
  expect(body.todos).toHaveLength(3);
  const bootstrap = await page.request.get("/_internal/shell-bootstrap");
  expect(bootstrap.status()).toBe(200);
  expect(await bootstrap.json()).toMatchObject({
    viewer: null,
    demo: {
      fixtureVersion: "todos-v1",
      referenceNow: "2026-09-24T09:00:00+08:00",
    },
    navigation: { userId: "demo:todos-v1", pendingTodosCount: 2 },
  });
}

for (const locale of ["zh-cn", "en-us"] as const) {
  for (const width of [1280, 390]) {
    test(`demo.todos: read-only browsing ${locale} ${width}`, {
      tag: "@Account/Web",
    }, async ({ page, isolatedWorker, browserRun }) => {
      await browserRun(async () => {
        const text = copy[locale];
        await page.setViewportSize({ width, height: 844 });
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        await enterDemo(page, locale);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(
          page.getByRole("heading", { name: text.heading, level: 1 }),
        ).toBeVisible();
        const notice = page.getByTestId("demo-notice");
        await expect(notice).toContainText(text.readOnly);
        await expect(notice).toContainText(text.unavailable);
        await expect(notice).toContainText("2026");
        await expect(
          page.getByRole("button", { name: text.add, exact: true }),
        ).toBeDisabled();
        await expect(page.locator("#app-user-menu")).toHaveCount(0);

        const surface =
          width === 1280
            ? page.getByRole("table")
            : page.getByTestId("workspace-todos-cards");
        await expect(surface).toBeVisible();
        await openWorkspaceTaskFilter(page, "todos");
        await page.getByRole("radio", { name: text.all, exact: true }).click();
        await page.keyboard.press("Escape");
        for (const title of [text.reading, text.outline, text.library]) {
          await expect(
            surface.getByRole("button", { name: title, exact: true }),
          ).toBeVisible();
        }
        await expect(surface).toContainText(text.yesterday);
        await expect(surface).toContainText(text.tomorrow);
        for (const label of [text.complete, text.undo]) {
          const actions = surface.getByRole("button", {
            name: label,
            exact: true,
          });
          await expect(actions).toHaveCount(label === text.complete ? 2 : 1);
          for (const action of await actions.all())
            await expect(action).toBeDisabled();
        }
        const edits = surface.getByRole("button", {
          name: width === 1280 ? text.edit : text.editRow,
          exact: true,
        });
        await expect(edits).toHaveCount(3);
        for (const edit of await edits.all()) await expect(edit).toBeDisabled();

        await surface
          .getByRole("button", { name: text.reading, exact: true })
          .click();
        const dialog = page.getByRole("dialog", {
          name: text.reading,
          exact: true,
        });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(text.description);
        await expect(dialog).toContainText(text.readOnly);
        for (const label of [text.remove, text.complete, text.edit]) {
          await expect(
            dialog.getByRole("button", { name: label, exact: true }),
          ).toBeDisabled();
        }
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(
          surface.getByRole("button", { name: text.reading, exact: true }),
        ).toBeFocused();

        await openWorkspaceTaskFilter(page, "todos");
        await page
          .getByRole("radio", { name: text.completed, exact: true })
          .click();
        await expect(
          surface.getByRole("button", { name: text.library, exact: true }),
        ).toBeVisible();
        await expect(
          surface.getByRole("button", { name: text.reading, exact: true }),
        ).toHaveCount(0);
        await expect(
          surface.getByRole("button", { name: text.outline, exact: true }),
        ).toHaveCount(0);
        await page
          .getByRole("radio", { name: text.incomplete, exact: true })
          .click();
        await expect(
          surface.getByRole("button", { name: text.library, exact: true }),
        ).toHaveCount(0);
        for (const title of [text.reading, text.outline]) {
          await expect(
            surface.getByRole("button", { name: title, exact: true }),
          ).toBeVisible();
        }
        await page.keyboard.press("Escape");
        await expectApiSample(page, locale);
        await expectRenderedUiQuality(page);
        await expectNoPageHorizontalOverflow(page);

        const [exit] = await Promise.all([
          page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === "/account/demo/exit" &&
              response.request().method() === "POST",
          ),
          page.getByRole("button", { name: text.exit, exact: true }).click(),
        ]);
        expect(exit.status()).toBe(303);
        await expect(page).toHaveURL(/\/account\/sign-in$/);
        await waitForUiSettled(page);
        expect(
          (await page.context().cookies()).some(
            (cookie) => cookie.name === "life-ustc.demo",
          ),
        ).toBe(false);
        await page.goBack();
        await expect(page).toHaveURL(/\/account\/sign-in(?:\?|$)/);
        await expect(page.getByTestId("demo-notice")).toHaveCount(0);
        expect((await page.request.get("/api/workspace/todos")).status()).toBe(
          401,
        );
      });
    });
  }
}

test("demo.todos: locale switching keeps the shell, list and API consistent", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, browserRun }) => {
  await browserRun(async () => {
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "zh-cn", url: isolatedWorker.origin },
      ]);
    await enterDemo(page, "zh-cn");
    for (const locale of ["en-us", "zh-cn"] as const) {
      const previous = locale === "en-us" ? "zh-cn" : "en-us";
      await page
        .getByRole("button", { name: copy[previous].language, exact: true })
        .click();
      const [response] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/api/account/preferences" &&
            response.request().method() === "POST",
        ),
        page
          .getByRole("menuitemradio", {
            name: locale === "en-us" ? "English" : "中文",
            exact: true,
          })
          .click(),
      ]);
      expect(response.status()).toBe(200);
      expect(response.request().postDataJSON()).toEqual({ locale });
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await waitForUiSettled(page);
      await expect(page.getByTestId("demo-notice")).toContainText(
        copy[locale].identity,
      );
      await expect(
        page.getByRole("button", { name: copy[locale].reading, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: copy[previous].reading, exact: true }),
      ).toHaveCount(0);
      await expectApiSample(page, locale);
    }
  });
});

for (const action of ["refresh", "exit"] as const) {
  test(`demo.session: expired session permits ${action}`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, browserRun }) => {
    await browserRun(async () => {
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      await enterDemo(page, "en-us");
      const expired = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000) - 901,
      });
      await page.context().addCookies([
        {
          ...expired,
          url: isolatedWorker.origin,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const denied = await page.request.get("/api/workspace/todos");
      expect(denied.status()).toBe(401);
      expect(await denied.json()).toEqual({ error: "DEMO_SESSION_INVALID" });
      if (action === "refresh") {
        await page.reload();
      } else {
        const [response] = await Promise.all([
          page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === "/account/demo/exit" &&
              response.request().method() === "POST",
          ),
          page.getByRole("button", { name: "Exit demo", exact: true }).click(),
        ]);
        expect(response.status()).toBe(303);
      }
      await expect(page).toHaveURL(/\/account\/sign-in$/);
      await waitForUiSettled(page);
      await expect(
        page.getByRole("button", { name: "Enter demo", exact: true }),
      ).toBeEnabled();
      await expect(page.getByTestId("demo-notice")).toHaveCount(0);
      expect(
        (await page.context().cookies()).some(
          (cookie) => cookie.name === "life-ustc.demo",
        ),
      ).toBe(false);
    });
  });
}

test("demo.session: late real-account responses cannot restore the previous viewer", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, browserRun }) => {
  await browserRun(async () => {
    const actor = await isolatedWorker.createActor();
    const title = "Private account task must stay private";
    await isolatedWorker.database.owner.todo.create({
      data: { userId: actor.id, title, priority: "high" },
    });
    await page
      .context()
      .addCookies([
        actor.cookie,
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await gotoAndWaitForReady(page, "/workspace/todos");
    await expect(
      page.getByRole("button", { name: title, exact: true }),
    ).toBeVisible();

    const shellReady = createDeferred();
    const todosReady = createDeferred();
    const released = createDeferred();
    const operations: Promise<void>[] = [];
    const errors: unknown[] = [];
    let shellReads = 0;
    let todoReads = 0;
    let holdSignedReads = true;
    const release = () => {
      released.resolve();
      shellReady.resolve();
      todosReady.resolve();
    };
    page.on("close", release);
    const handler = (route: Route) => {
      const operation = (async () => {
        if (!holdSignedReads) {
          await route.continue();
          return;
        }
        const path = new URL(route.request().url()).pathname;
        const response = await route.fetch({ maxRedirects: 0 });
        expect(response.status()).toBe(200);
        const body = await response.json();
        if (path === "/_internal/shell-bootstrap") {
          shellReads++;
          expect(body.viewer.id).toBe(actor.id);
          expect(body.navigation).toMatchObject({
            userId: actor.id,
            pendingTodosCount: 1,
          });
          shellReady.resolve();
        } else {
          todoReads++;
          expect(body.todos).toHaveLength(1);
          expect(body.todos[0].title).toBe(title);
          todosReady.resolve();
        }
        await released.promise;
        await route.fulfill({ response });
      })();
      operations.push(
        operation.catch((error: unknown) => {
          errors.push(error);
        }),
      );
      return operation;
    };
    const pattern = /\/(?:_internal\/shell-bootstrap|api\/workspace\/todos)$/;
    await page.route(pattern, handler);
    try {
      // Home requests the real signed-in shell; preserve its response until
      // after the native sign-out and Demo forms replace this document.
      await page
        .locator('a[href="/"]')
        .filter({ visible: true })
        .first()
        .click();
      await expect(page).toHaveURL(`${isolatedWorker.origin}/`);
      await shellReady.promise;
      await page.evaluate(() => {
        // This belongs to the old document. A form navigation may cancel it;
        // the Node route callback remains owned and joined below.
        void fetch("/api/workspace/todos")
          .then((response) => response.json())
          .catch(() => undefined);
      });
      await todosReady.promise;
      // Keep the handler installed while old responses are held: unregistering
      // it would release them. New identity requests pass through immediately.
      holdSignedReads = false;
      await page.locator("#app-user-menu").click();
      const [signOut] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/account/sign-out" &&
            response.request().method() === "POST",
        ),
        page.getByRole("menuitem", { name: "Sign Out", exact: true }).click(),
      ]);
      expect(signOut.status()).toBe(303);
      await expect(page).toHaveURL(`${isolatedWorker.origin}/`);
      await enterDemo(page, "en-us");
      released.resolve();
      await Promise.all(operations);
      expect(errors).toEqual([]);
      expect(shellReads).toBe(1);
      expect(todoReads).toBe(1);
      await expect(page.getByTestId("demo-notice")).toContainText(
        "Demo account · Read only",
      );
      await expect(page.locator("#app-user-menu")).toHaveCount(0);
      await expect(page.getByText(title, { exact: true })).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: "Review linear algebra",
          exact: true,
        }),
      ).toBeVisible();
      await expectApiSample(page, "en-us");
      expect(
        await isolatedWorker.database.owner.todo.count({
          where: { userId: actor.id, title },
        }),
      ).toBe(1);
    } catch (error) {
      errors.push(error);
    } finally {
      release();
      await Promise.all(operations);
      if (!page.isClosed()) await page.unroute(pattern, handler);
      page.off("close", release);
    }
    if (errors.length)
      throw new AggregateError(errors, "Previous account response failed");
  });
});
