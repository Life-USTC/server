import { expect, type Locator, type Page, test } from "@playwright/test";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

const longText =
  "Complete optional secondary context with a distinguishing ending that must remain readable even when the table cell is narrow";

async function createFixture(page: Page, baseURL: string | undefined) {
  if (!baseURL) throw new Error("Missing Playwright baseURL");
  const marker = `policy${test.info().title.at(-1)}`;
  const fixture = await withE2ePrisma(async (db) => {
    const admin = await db.user.create({
      data: {
        name: "Table policy administrator",
        username: `tpa${marker}`,
        email: `table-admin-${marker}@example.test`,
        isAdmin: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    });
    const section = await db.section.findFirstOrThrow({
      select: { id: true },
      orderBy: { id: "asc" },
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
          createdById: admin.id,
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
        jwId: 1_600_000_000 + Math.floor(Math.random() * 100_000_000),
        code: `TABLE-POLICY-${marker}`,
        nameCn: "表格未知值教师",
        nameEn: "Table unknown teacher",
      },
    });
    return { admin, users, comments, versions, teacher, marker };
  });
  await page
    .context()
    .addCookies([
      await createSignedSessionCookie(fixture.admin.id),
      { name: "NEXT_LOCALE", value: "en-us", url: baseURL },
    ]);
  await page.setViewportSize({ width: 1600, height: 1000 });
  return fixture;
}

async function cleanup(fixture: Awaited<ReturnType<typeof createFixture>>) {
  await withE2ePrisma(async (db) => {
    await db.comment.deleteMany({
      where: { id: { in: fixture.comments.map((x) => x.id) } },
    });
    await db.busScheduleVersion.deleteMany({
      where: { id: { in: fixture.versions.map((x) => x.id) } },
    });
    await db.teacher.delete({ where: { id: fixture.teacher.id } });
    await db.user.deleteMany({
      where: {
        id: { in: [fixture.admin.id, ...fixture.users.map((x) => x.id)] },
      },
    });
  });
}

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

test("ui.data-table-cells-1", async ({ page, baseURL }, testInfo) => {
  const fixture = await createFixture(page, baseURL);
  try {
    for (const matrix of matrices(fixture)) {
      await gotoAndWaitForReady(page, matrix.path);
      const populated = fixtureRow(page, matrix.labels[0]);
      const missing = fixtureRow(page, matrix.labels[1]);
      await expect(populated).toHaveCount(1);
      await expect(missing).toHaveCount(1);
      await page.locator("table:visible").screenshot({
        path: testInfo.outputPath(`secondary-${matrix.name}.png`),
      });
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
        .soft(second, `${matrix.name}: missing secondary line reserves space`)
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
  } finally {
    await cleanup(fixture);
  }
});

test("ui.data-table-cells-5", async ({ page, baseURL }) => {
  const fixture = await createFixture(page, baseURL);
  try {
    for (const matrix of matrices(fixture)) {
      await gotoAndWaitForReady(page, matrix.path);
      const cell = fixtureRow(page, matrix.labels[1])
        .locator("td")
        .nth(matrix.cell);
      const blank = cell.locator('[data-slot="truncated-text-placeholder"]');
      await expect(blank).toHaveCount(1);
      await expect(blank).toHaveAttribute("aria-hidden", "true");
      expect(await blank.ariaSnapshot()).toBe("");
      expect(await blank.innerText()).toBe("");
      if (matrix.name === "users") {
        const unknown = fixtureRow(page, matrix.labels[1]).locator("td").nth(1);
        expect(await unknown.ariaSnapshot()).toContain("no-username");
      }
    }
    await gotoAndWaitForReady(
      page,
      `/catalog/teachers?search=${fixture.teacher.code}`,
    );
    const title = fixtureRow(page, "Table unknown teacher (表格未知值教师)")
      .locator("td")
      .nth(3);
    await expect(title).toHaveText("Unknown");
    expect(await title.ariaSnapshot()).toContain("Unknown");
  } finally {
    await cleanup(fixture);
  }
});

test("ui.data-table-cells-6", async ({ page, baseURL }) => {
  const fixture = await createFixture(page, baseURL);
  try {
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
          await expect(cell.locator('[data-slot="truncated-text"]')).toHaveText(
            "Permanent",
          );
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
          expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.height);
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
  } finally {
    await cleanup(fixture);
  }
});
