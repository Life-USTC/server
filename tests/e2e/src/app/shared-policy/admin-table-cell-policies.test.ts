import { expect, type Locator, type Page } from "@playwright/test";
import type { TestPrismaClient } from "../../../../shared/prisma";
import {
  test as adminTest,
  adminWriteChecks,
} from "../../../utils/admin-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

const longText =
  "Complete optional secondary context with a distinguishing ending that must remain readable even when the table cell is narrow";

async function createFixture(db: TestPrismaClient, adminId: string) {
  const marker = "table-policy";
  return db.$transaction(async (db) => {
    const section = await db.section.create({
      data: {
        jwId: 1,
        code: "TABLE.01",
        course: { create: { jwId: 1, code: "TABLE", nameCn: "表格测试课程" } },
        semester: {
          create: {
            jwId: 1,
            code: "2026-autumn",
            nameCn: "2026年秋季学期",
            startDate: new Date("2026-08-31T00:00:00Z"),
            endDate: new Date("2027-01-31T00:00:00Z"),
          },
        },
      },
    });
    const users = [];
    const comments = [];
    const versions = [];
    for (let index = 0; index < 3; index++) {
      const createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, index + 1));
      const user = await db.user.create({
        data: {
          name: `Table policy user ${index}`,
          createdAt,
          email: `table-row-${marker}-${index}@example.test`,
          username: index === 1 ? null : `tp${marker}${index}`,
        },
      });
      users.push(user);
      await db.userSuspension.create({
        data: {
          userId: user.id,
          createdById: adminId,
          createdAt,
          reason: index === 2 ? longText : "Table policy reason",
          // The first row exercises a fitting status detail. A localized expiry
          // timestamp can legitimately overflow with the CI runner's fonts.
          expiresAt: index === 0 ? null : new Date("2099-01-01T00:00:00Z"),
          liftedAt: index === 1 ? new Date("2026-01-02T00:00:00Z") : null,
        },
      });
      comments.push(
        await db.comment.create({
          data: {
            userId: user.id,
            sectionId: section.id,
            body: `Table policy comment ${index}`,
            createdAt,
            moderationNote:
              index === 1 ? null : index === 2 ? longText : "Short note",
          },
        }),
      );
      versions.push(
        await db.busScheduleVersion.create({
          data: {
            key: `table-policy-${marker}-${index}`,
            checksum: `table-policy-${marker}-${index}`,
            title: `Table policy version ${index}`,
            sourceMessage:
              index === 1 ? null : index === 2 ? longText : "Short source",
            rawJson: {},
            isEnabled: false,
            importedAt: new Date("2026-01-01T00:00:00Z"),
          },
        }),
      );
    }
    const teacher = await db.teacher.create({
      data: {
        jwId: 1_600_000_000,
        code: `TABLE-POLICY-${marker}`,
        nameCn: "表格未知值教师",
        nameEn: "Table unknown teacher",
      },
    });
    return { users, comments, versions, teacher, marker };
  });
}

const test = adminTest.extend<{
  fixture: Awaited<ReturnType<typeof createFixture>>;
}>({
  fixture: async ({ isolatedWorker, admin, page, run }, use) => {
    const fixture = await run(async () => {
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      await page.setViewportSize({ width: 1600, height: 1000 });
      return createFixture(isolatedWorker.database.owner, admin.id);
    });
    await use(fixture);
  },
});

function matrices(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return [
    {
      name: "bus",
      path: "/admin/bus",
      cell: 0,
      labels: fixture.versions.map((x) => x.title),
    },
    {
      name: "comments",
      path: "/admin/moderation?tab=comments&search=Table%20policy%20comment",
      cell: 0,
      labels: fixture.comments.map((x) => x.body),
    },
    {
      name: "suspensions",
      path: "/admin/moderation?tab=suspensions",
      cell: 0,
      labels: fixture.users.map((x) => x.name),
    },
    {
      name: "users",
      path: `/admin/users?search=${fixture.marker}`,
      cell: 4,
      labels: fixture.users.map((x) => x.name),
    },
  ];
}

function fixtureRow(page: Page, label: string) {
  return page
    .locator("table:visible tbody tr")
    .filter({ has: page.getByText(label, { exact: true }) });
}

async function secondaryHeight(cell: Locator) {
  return cell
    .locator('.text-xs:not([data-slot="badge"])')
    .evaluateAll((nodes) => {
      const visible = nodes.filter(
        (node) => node.getBoundingClientRect().height > 0,
      );
      return visible.length === 1
        ? visible[0].getBoundingClientRect().height
        : 0;
    });
}

test("ui.data-table-cells-1", { tag: "@Admin/Web" }, async ({
  adminFlow,
  run,
  page,
  fixture,
}) => {
  await run(() =>
    adminFlow.run(
      async () => {
        for (const matrix of matrices(fixture)) {
          await gotoAndWaitForReady(page, matrix.path);
          const populated = fixtureRow(page, matrix.labels[0]);
          const missing = fixtureRow(page, matrix.labels[1]);
          await expect(populated).toHaveCount(1);
          await expect(missing).toHaveCount(1);

          const first = await secondaryHeight(
            populated.locator("td").nth(matrix.cell),
          );
          const second = await secondaryHeight(
            missing.locator("td").nth(matrix.cell),
          );
          expect
            .soft(first, `${matrix.name}: populated secondary line`)
            .toBeGreaterThan(0);
          expect
            .soft(
              second,
              `${matrix.name}: missing secondary line reserves space`,
            )
            .toBe(first);
          const longRow = fixtureRow(page, matrix.labels[2]);
          if (matrix.name === "bus" || matrix.name === "comments") {
            const context = longRow.getByText(
              matrix.name === "comments"
                ? `Moderation note (optional): ${longText}`
                : longText,
              { exact: true },
            );
            await context.hover();
            await expect(
              page.locator('[data-slot="tooltip-content"]:visible'),
            ).toContainText(longText);
            await page.keyboard.press("Escape");
          }
          const buttons = longRow.getByRole("button");
          expect(await buttons.count()).toBeGreaterThan(0);
          for (const button of await buttons.all()) {
            await button.scrollIntoViewIfNeeded();
            await expect(button).toBeInViewport({ ratio: 1 });
            const box = await button.boundingBox();
            expect(box?.width).toBeGreaterThan(0);
            expect(box?.height).toBeGreaterThan(0);
          }
        }
      },
      {},
      adminWriteChecks([]),
    ),
  );
});

for (const domain of ["Admin", "Teacher"] as const) {
  test(`ui.data-table-cells-5 ${domain}`, { tag: `@${domain}/Web` }, async ({
    adminFlow,
    run,
    page,
    fixture,
  }) => {
    await run(() =>
      adminFlow.run(
        async () => {
          if (domain === "Admin") {
            for (const matrix of matrices(fixture)) {
              await gotoAndWaitForReady(page, matrix.path);
              const cell = fixtureRow(page, matrix.labels[1])
                .locator("td")
                .nth(matrix.cell);
              const blank = cell.locator(
                '[data-slot="truncated-text-placeholder"]',
              );
              await expect(blank).toHaveCount(1);
              await expect(blank).toHaveAttribute("aria-hidden", "true");
              expect(await blank.ariaSnapshot()).toBe("");
              expect(await blank.innerText()).toBe("");
              if (matrix.name === "users") {
                const unknown = fixtureRow(page, matrix.labels[1])
                  .locator("td")
                  .nth(1);
                expect(await unknown.ariaSnapshot()).toContain("No ID");
              }
            }
          }
          if (domain === "Teacher") {
            await gotoAndWaitForReady(
              page,
              `/catalog/teachers?search=${fixture.teacher.code}`,
            );
            const title = fixtureRow(
              page,
              "Table unknown teacher (表格未知值教师)",
            )
              .locator("td")
              .nth(3);
            await expect(title).toHaveText("Unknown");
            expect(await title.ariaSnapshot()).toContain("Unknown");
          }
        },
        {},
        adminWriteChecks([]),
      ),
    );
  });
}

test("ui.data-table-cells-6", { tag: "@Admin/Web" }, async ({
  adminFlow,
  run,
  page,
  fixture,
}) => {
  await run(() =>
    adminFlow.run(
      async () => {
        const columns: Record<string, number[]> = {
          bus: [2, 5],
          comments: [4],
          suspensions: [3],
          users: [3, 4],
        };
        for (const matrix of matrices(fixture)) {
          await gotoAndWaitForReady(page, matrix.path);
          const row = fixtureRow(page, matrix.labels[0]);
          await expect(row).toHaveCount(1);
          for (const index of columns[matrix.name]) {
            const cell = row.locator("td").nth(index);
            await expect(cell).toHaveText(/\S/);
            if (matrix.name === "users" && index === 4) {
              await expect(
                cell.locator('[data-slot="truncated-text"]'),
              ).toHaveText("Permanent");
            }
            await expect(cell.locator("[title]")).toHaveCount(0);
            await cell.hover();
            await expect(
              page.locator('[data-slot="tooltip-content"]:visible'),
            ).toHaveCount(0);
            for (const text of await cell
              .locator('[data-slot="truncated-text"]')
              .all()) {
              const geometry = await text.evaluate((node) => ({
                width: node.clientWidth,
                scrollWidth: node.scrollWidth,
                height: node.clientHeight,
                scrollHeight: node.scrollHeight,
              }));
              expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
              expect(geometry.scrollHeight).toBeLessThanOrEqual(
                geometry.height,
              );
              await text.hover();
              await expect(
                page.locator('[data-slot="tooltip-content"]:visible'),
              ).toHaveCount(0);
              await text.focus();
              await expect(
                page.locator('[data-slot="tooltip-content"]:visible'),
              ).toHaveCount(0);
              await text.blur();
            }
          }
          const actions = row.getByRole("button");
          expect(await actions.count()).toBeGreaterThan(0);
          for (const action of await actions.all()) {
            await expect(
              action.locator('[data-slot="truncated-text"]'),
            ).toHaveCount(0);
            expect(await action.getAttribute("title")).toBeNull();
            const label = await action.getAttribute("aria-label");
            if (!label) throw new Error("Expected an explicit action label");
            await action.focus();
            await expect(
              page.locator('[data-slot="tooltip-content"]:visible'),
            ).toHaveText(label);
            await page.keyboard.press("Escape");
            await action.blur();
          }
        }
      },
      {},
      adminWriteChecks([]),
    ),
  );
});
