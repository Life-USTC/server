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
import {
  applyWorkspaceTaskFilter,
  openWorkspaceTaskFilter,
  workspaceTaskFilterControl,
} from "../../../utils/workspace-task-filters";

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
      "Browse sample todos, subscriptions and catalog details. Changes and external actions are disabled.",
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
    readOnly:
      "你可以浏览待办、订阅和课程目录详情样例，无法修改数据或执行外部操作。",
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
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(
    1,
  );
  expect(
    await page.evaluate(
      () => typeof (window as Window & { gtag?: unknown }).gtag,
    ),
  ).toBe("function");
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/account/demo/enter" &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: copy[locale].enter, exact: true }).click(),
  ]);
  expect(response.status()).toBe(303);
  expect(response.request().isNavigationRequest()).toBe(true);
  await expect(page).toHaveURL(/\/workspace\/todos$/);
  await waitForUiSettled(page);
  await expect(page.getByTestId("demo-notice")).toContainText(
    copy[locale].identity,
  );
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(
    0,
  );
  expect(await page.evaluate(() => "gtag" in window)).toBe(false);
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
      fixtureVersion: "workspace-v1",
      referenceNow: "2026-09-24T09:00:00+08:00",
    },
    navigation: {
      userId: "demo:workspace-v1",
      pendingTodosCount: 2,
      subscribedSectionCount: 3,
    },
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
        await applyWorkspaceTaskFilter(
          page,
          workspaceTaskFilterControl(page, text.all),
        );
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
        await applyWorkspaceTaskFilter(
          page,
          workspaceTaskFilterControl(page, text.completed),
        );
        await expect(
          surface.getByRole("button", { name: text.library, exact: true }),
        ).toBeVisible();
        await expect(
          surface.getByRole("button", { name: text.reading, exact: true }),
        ).toHaveCount(0);
        await expect(
          surface.getByRole("button", { name: text.outline, exact: true }),
        ).toHaveCount(0);
        await applyWorkspaceTaskFilter(
          page,
          workspaceTaskFilterControl(page, text.incomplete),
        );
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

const subscriptionCopy = {
  "en-us": {
    heading: "Section Subscriptions",
    courses: ["Linear Algebra", "College Physics", "Data Structures"],
    course: "Course Name",
    teacher: "Teachers",
    auditor: "Auditor",
    teachers: ["Teacher Chen", "Teacher Lin"],
    add: "Add Section Subscription",
    bulk: "Bulk Add Section Subscriptions",
    feed: "Copy iCal Link",
    role: "Section subscription role",
    remove: "Unsubscribe from section",
    activities: "Activity subscriptions",
    semester: "Semester",
    autumn: "Fall 2026",
    credits: "Credits",
    apply: "Apply filters",
    empty: "No section subscriptions yet",
    menu: "Menu",
  },
  "zh-cn": {
    heading: "教学班订阅",
    courses: ["线性代数", "大学物理", "数据结构"],
    course: "课程名称",
    teacher: "教师",
    auditor: "旁听",
    teachers: ["陈老师", "林老师"],
    add: "添加教学班订阅",
    bulk: "批量添加教学班订阅",
    feed: "复制日历链接",
    role: "教学班订阅身份",
    remove: "取消订阅教学班",
    activities: "活动订阅",
    semester: "学期",
    autumn: "2026年秋季学期",
    credits: "学分",
    apply: "应用筛选",
    empty: "暂无教学班订阅",
    menu: "菜单",
  },
} as const;

async function navigateDemoWorkspace(
  page: Page,
  locale: Locale,
  width: number,
  tab: "todos" | "subscriptions",
) {
  if (width < 1024)
    await page
      .getByRole("button", { name: subscriptionCopy[locale].menu, exact: true })
      .click();
  const link = page
    .getByRole("link", {
      name: new RegExp(
        `^${tab === "todos" ? copy[locale].heading : subscriptionCopy[locale].heading}$`,
        "i",
      ),
    })
    .filter({ visible: true });
  await expect(link).toHaveCount(1);
  await expect(link).toBeEnabled();
  await expect(link).toHaveAttribute("href", `/workspace/${tab}`);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/workspace/${tab}$`));
  await waitForUiSettled(page);
}

async function expectSubscriptionSample(page: Page, locale: Locale) {
  const text = subscriptionCopy[locale];
  const response = await page.request.get(
    "/api/workspace/subscriptions/current",
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(await response.json()).toMatchObject({
    subscription: {
      userId: "demo:workspace-v1",
      calendarPath: null,
      calendarUrl: null,
      sections: [
        {
          jwId: 910001,
          kind: "regular",
          credits: 4,
          course: { namePrimary: text.courses[0] },
          teachers: [
            { namePrimary: text.teachers[0] },
            { namePrimary: text.teachers[1] },
          ],
        },
        {
          jwId: 910002,
          kind: "auditor",
          credits: 3,
          course: { namePrimary: text.courses[1] },
          teachers: [{ namePrimary: text.teachers[0] }],
        },
        {
          jwId: 910003,
          kind: "teaching_assistant",
          credits: 3.5,
          course: { namePrimary: text.courses[2] },
          teachers: [{ namePrimary: text.teachers[1] }],
        },
      ],
    },
  });
  const links = page
    .getByTestId("subscription-course-link")
    .filter({ visible: true });
  await expect(links).toHaveText([...text.courses]);
  for (const [index, link] of (await links.all()).entries()) {
    await expect(link).toHaveRole("link");
    await expect(link).toHaveAttribute(
      "href",
      `/catalog/sections/${910001 + index}`,
    );
  }
  await expectApiSample(page, locale);
}

for (const locale of ["zh-cn", "en-us"] as const) {
  for (const width of [1280, 390]) {
    test(`demo.subscriptions: read-only browsing ${locale} ${width}`, {
      tag: "@Account/Web",
    }, async ({ page, isolatedWorker, browserRun }) => {
      await browserRun(async () => {
        const text = subscriptionCopy[locale];
        await page.setViewportSize({ width, height: 844 });
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        await enterDemo(page, locale);
        const unexpectedRequests: string[] = [];
        page.on("request", (request) => {
          const url = new URL(request.url());
          if (
            url.origin !== isolatedWorker.origin ||
            (url.pathname.startsWith("/api/") &&
              url.pathname !== "/api/workspace/todos") ||
            (request.method() !== "GET" && request.method() !== "HEAD")
          )
            unexpectedRequests.push(`${request.method()} ${url.pathname}`);
        });
        await navigateDemoWorkspace(page, locale, width, "subscriptions");
        await expect(
          page.getByRole("heading", { name: text.heading, level: 1 }),
        ).toBeVisible();
        await expect(page.getByTestId("demo-notice")).toContainText(
          copy[locale].readOnly,
        );
        await expectSubscriptionSample(page, locale);
        for (const name of [text.add, text.bulk, text.feed])
          await expect(
            page.getByRole("button", { name, exact: true }),
          ).toBeDisabled();
        for (const name of [text.role, text.remove]) {
          const actions = page
            .getByRole("button", { name, exact: true })
            .filter({ visible: true });
          await expect(actions).toHaveCount(3);
          for (const action of await actions.all())
            await expect(action).toBeDisabled();
        }
        await expect(
          page
            .getByRole("main")
            .getByRole("button", { name: text.activities, exact: true }),
        ).toBeDisabled();
        await expect(
          page.locator('a[href^="/catalog/"]').filter({ visible: true }),
        ).toHaveCount(6);
        const links = page
          .getByTestId("subscription-course-link")
          .filter({ visible: true });
        const apply = page.getByRole("button", {
          name: text.apply,
          exact: true,
        });
        const filters = page.locator("#subscriptions-filters");
        await expect(filters).toHaveCount(1);
        await expect(apply).toHaveCount(1);
        for (const name of [
          text.semester,
          text.course,
          text.teacher,
          text.credits,
        ])
          await expect(
            page.getByRole("main").getByRole("button", { name, exact: true }),
          ).toHaveCount(1);
        const semesterTrigger = filters.getByRole("button", {
          name: text.semester,
          exact: true,
        });
        await semesterTrigger.click();
        const semester = page.locator('[data-filter-field="semester"]');
        await semester
          .getByRole("checkbox", { name: text.autumn, exact: true })
          .check();
        await page.keyboard.press("Escape");
        const credits = filters.getByRole("button", {
          name: text.credits,
          exact: true,
        });
        await credits.click();
        const dialog = page.getByRole("dialog", {
          name: text.credits,
          exact: true,
        });
        await dialog.getByRole("combobox").selectOption("gte");
        await dialog.getByRole("spinbutton").fill("3.5");
        await page.keyboard.press("Escape");
        await expect(links).toHaveCount(3);
        await apply.click();
        await expect(links).toHaveText([text.courses[0]]);
        await credits.click();
        await dialog.getByRole("combobox").selectOption("gt");
        await dialog.getByRole("spinbutton").fill("4");
        await page.keyboard.press("Escape");
        await apply.click();
        await expect(links).toHaveCount(0);
        await expect(page.getByText(text.empty, { exact: true })).toBeVisible();
        await credits.click();
        await dialog.getByRole("spinbutton").fill("");
        await page.keyboard.press("Escape");
        await semesterTrigger.click();
        await semester
          .getByRole("checkbox", { name: text.autumn, exact: true })
          .uncheck();
        await page.keyboard.press("Escape");
        await apply.click();
        await expectSubscriptionSample(page, locale);
        const teacherTrigger = filters.getByRole("button", {
          name: text.teacher,
          exact: true,
        });
        await teacherTrigger.click();
        const teacher = page.locator('[data-filter-field="teacher"]');
        await teacher
          .getByRole("checkbox", { name: text.teachers[0], exact: true })
          .check();
        await page.keyboard.press("Escape");
        const courseTrigger = filters.getByRole("button", {
          name: text.course,
          exact: true,
        });
        await courseTrigger.click();
        const course = page.getByRole("dialog", {
          name: text.course,
          exact: true,
        });
        await course
          .getByRole("textbox", { name: text.course, exact: true })
          .fill(text.courses[1]);
        await course
          .getByRole("checkbox", { name: text.auditor, exact: true })
          .check();
        await page.keyboard.press("Escape");
        await expect(links).toHaveCount(3);
        await apply.click();
        await expect(links).toHaveText([text.courses[1]]);
        await teacherTrigger.click();
        await teacher
          .getByRole("checkbox", { name: text.teachers[0], exact: true })
          .uncheck();
        await page.keyboard.press("Escape");
        await courseTrigger.click();
        await course
          .getByRole("textbox", { name: text.course, exact: true })
          .fill("");
        await course
          .getByRole("checkbox", { name: text.auditor, exact: true })
          .uncheck();
        await page.keyboard.press("Escape");
        await apply.click();
        await expectSubscriptionSample(page, locale);
        await expectRenderedUiQuality(page);
        await expectNoPageHorizontalOverflow(page);
        expect(unexpectedRequests).toEqual([]);
        await navigateDemoWorkspace(page, locale, width, "todos");
        await expect(
          page.getByRole("button", { name: copy[locale].reading, exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: copy[locale].exit, exact: true })
          .click();
        await expect(page).toHaveURL(/\/account\/sign-in$/);
        expect(
          (
            await page.request.get("/api/workspace/subscriptions/current")
          ).status(),
        ).toBe(401);
      });
    });
  }
}

test("demo.subscriptions: locale changes keep page, API and navigation consistent", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, browserRun }) => {
  await browserRun(async () => {
    await page.setViewportSize({ width: 1280, height: 844 });
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "zh-cn", url: isolatedWorker.origin },
      ]);
    await enterDemo(page, "zh-cn");
    await navigateDemoWorkspace(page, "zh-cn", 1280, "subscriptions");
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
      await expect(
        page.getByRole("heading", {
          name: subscriptionCopy[locale].heading,
          level: 1,
        }),
      ).toBeVisible();
      await expectSubscriptionSample(page, locale);
    }
  });
});

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

for (const locale of ["zh-cn", "en-us"] as const) {
  for (const width of [1280, 390]) {
    test(`demo.catalog: linked read-only details ${locale} ${width}`, {
      tag: "@Account/Web",
    }, async ({ page, isolatedWorker, browserRun }) => {
      await browserRun(async () => {
        await page.setViewportSize({ width, height: 844 });
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        await enterDemo(page, locale);
        const unexpected: string[] = [];
        const errors: string[] = [];
        const reads = new Set<string>();
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("request", (request) => {
          const url = new URL(request.url());
          if (
            url.origin !== isolatedWorker.origin ||
            !["GET", "HEAD"].includes(request.method())
          )
            unexpected.push(`${request.method()} ${url.pathname}`);
          if (
            url.pathname.startsWith("/api/") ||
            url.pathname.startsWith("/_internal/")
          )
            reads.add(`${url.pathname}${url.search}`);
        });
        page.on("response", (response) => {
          if (response.status() >= 400)
            errors.push(
              `${response.status()} ${new URL(response.url()).pathname}`,
            );
        });
        await gotoAndWaitForReady(page, "/workspace/subscriptions");
        await page
          .getByTestId("subscription-course-link")
          .filter({ visible: true })
          .first()
          .click();
        await expect(page).toHaveURL(/\/catalog\/sections\/910001$/);
        await waitForUiSettled(page);
        const sectionName = locale === "zh-cn" ? "线性代数" : "Linear Algebra";
        const teacherName = locale === "zh-cn" ? "陈老师" : "Teacher Chen";
        const sampleDescription =
          locale === "zh-cn"
            ? "这份样例介绍课程内容。"
            : "This sample introduces the course topics.";
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          sectionName,
        );
        await expect(page.getByTestId("demo-notice")).toContainText(
          copy[locale].readOnly,
        );
        await expect(page.locator("#introduction")).toContainText(
          sampleDescription,
        );
        for (const [selector, name] of [
          ["#introduction", /编辑|Edit/i],
          ["#calendar", /添加到日历|Add to Calendar/i],
          ["#homework", /^(新建|Create)$/i],
          ["#comments", /发布评论|Post comment/i],
        ] as const) {
          const section = page.locator(selector);
          await section.scrollIntoViewIfNeeded();
          await expect(section.getByRole("button", { name })).toBeDisabled();
        }
        await expect(page.locator("#exams")).toContainText("2027");
        await expect(page.locator("#exams")).toContainText("14:00");
        await expect(page.locator("#calendar")).toContainText(
          locale === "zh-cn" ? "演示教室" : "Demo classroom",
        );
        const calendarTeachers = page.locator(
          '#calendar a[href^="/catalog/teachers/"]',
        );
        await expect(calendarTeachers).toHaveText(
          locale === "zh-cn"
            ? ["陈老师", "林老师"]
            : ["Teacher Chen", "Teacher Lin"],
        );
        for (const link of await calendarTeachers.all()) {
          const bounds = await link.boundingBox();
          expect(bounds?.width).toBeGreaterThanOrEqual(24);
          expect(bounds?.height).toBeGreaterThanOrEqual(24);
        }
        await expect(
          page.getByRole("main").locator('a[href^="/account/sign-in"]'),
        ).toHaveCount(0);
        await expect(
          page.locator('script[type="application/ld+json"]'),
        ).toHaveCount(0);
        await expect(page.locator("#comments")).not.toContainText(
          locale === "zh-cn" ? "登录后" : "Sign in to share",
        );
        await expectRenderedUiQuality(page);
        await expectNoPageHorizontalOverflow(page);
        expect(
          [...reads].some((url) =>
            url.startsWith("/_internal/catalog/sections/910001/viewer"),
          ),
        ).toBe(true);
        const loadDiscussion = page
          .locator("#comments")
          .getByRole("button", { name: /: (加载评论|Load comments)$/ });
        await expect(loadDiscussion).toHaveCount(2);
        await loadDiscussion.first().click();
        await expect(loadDiscussion).toHaveCount(1);
        await loadDiscussion.first().click();
        await expect(loadDiscussion).toHaveCount(0);
        expect(
          [...reads].some((url) => url.includes("targetType=section-teacher")),
        ).toBe(true);

        const courseLink = page
          .locator('a[href="/catalog/courses/920001"]')
          .filter({ visible: true })
          .first();
        await courseLink.scrollIntoViewIfNeeded();
        await courseLink.click();
        await expect(page).toHaveURL(/\/catalog\/courses\/920001$/);
        await waitForUiSettled(page);
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          sectionName,
        );
        await expect(page.getByTestId("demo-notice")).toContainText(
          copy[locale].readOnly,
        );
        await expect(page.locator("#introduction")).toContainText(
          sampleDescription,
        );
        await page.locator("#comments").scrollIntoViewIfNeeded();
        await expect(
          page
            .locator("#comments")
            .getByRole("button", { name: /发布评论|Post comment/i }),
        ).toBeDisabled();
        await expect(
          page.locator('script[type="application/ld+json"]'),
        ).toHaveCount(0);
        await expectRenderedUiQuality(page);
        await expectNoPageHorizontalOverflow(page);

        const sectionLink = page
          .locator('#sections a[href="/catalog/sections/910001"]')
          .filter({ visible: true })
          .first();
        await sectionLink.scrollIntoViewIfNeeded();
        await sectionLink.click();
        await expect(page).toHaveURL(/\/catalog\/sections\/910001$/);
        await waitForUiSettled(page);
        const teacherLink = page
          .locator('a[href="/catalog/teachers/401"]')
          .filter({ visible: true })
          .first();
        await teacherLink.scrollIntoViewIfNeeded();
        await teacherLink.click();
        await expect(page).toHaveURL(/\/catalog\/teachers\/401$/);
        await waitForUiSettled(page);
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          teacherName,
        );
        await expect(page.getByTestId("demo-notice")).toContainText(
          copy[locale].readOnly,
        );
        await page.locator("#comments").scrollIntoViewIfNeeded();
        await expect(
          page
            .locator("#comments")
            .getByRole("button", { name: /发布评论|Post comment/i }),
        ).toBeDisabled();
        await expect(
          page.locator('script[type="application/ld+json"]'),
        ).toHaveCount(0);
        await expectRenderedUiQuality(page);
        await expectNoPageHorizontalOverflow(page);
        await page.reload();
        await waitForUiSettled(page);
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          teacherName,
        );
        await page.goBack();
        await expect(page).toHaveURL(/\/catalog\/sections\/910001$/);
        await waitForUiSettled(page);
        await expect(page.getByTestId("demo-notice")).toBeVisible();
        expect(unexpected).toEqual([]);
        expect(errors).toEqual([]);
      });
    });
  }
}
