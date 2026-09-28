import { expect, type Locator, type Page, test } from "@playwright/test";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import {
  cleanupOtherCollectionPolicyFixture,
  createOtherCollectionPolicyFixture,
  type OtherCollectionPolicyFixture,
} from "../../../utils/other-collection-policy-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

let fixture: OtherCollectionPolicyFixture;
let busVersionId: number;
test.beforeAll(async () => {
  fixture = await createOtherCollectionPolicyFixture();
  await withE2ePrisma(async (db) => {
    const c = fixture.catalog;
    await db.comment.create({
      data: {
        sectionId: c.sections[0].id,
        userId: fixture.members[0].id,
        body: `${c.marker} moderation comment with a full readable content`,
      },
    });
    await db.homework.create({
      data: {
        sectionId: c.sections[0].id,
        createdById: fixture.admin.id,
        title: `${c.marker} moderation homework with a full readable title`,
      },
    });
    await db.description.create({
      data: {
        courseId: c.courses[0].id,
        content: `${c.marker} public description content`,
        lastEditedById: fixture.admin.id,
        lastEditedAt: new Date(),
      },
    });
    await db.userSuspension.create({
      data: {
        userId: fixture.members[0].id,
        createdById: fixture.admin.id,
        reason: `${c.marker} suspension reason with a complete explanation`,
        expiresAt: new Date("2099-01-01T00:00:00Z"),
      },
    });
    await db.oAuthClient.create({
      data: {
        clientId: `${c.marker}-client`,
        userId: fixture.admin.id,
        name: `${c.marker} OAuth client with a distinguishing long name`,
        redirectUris: ["https://example.test/callback"],
        tokenEndpointAuthMethod: "none",
        public: true,
        grantTypes: ["authorization_code"],
        responseTypes: ["code"],
      },
    });
    const bus = await db.busScheduleVersion.create({
      data: {
        key: `${c.marker}-bus`,
        checksum: `${c.marker}-bus`,
        title: `${c.marker} imported bus timetable with a complete title`,
        rawJson: {},
        isEnabled: false,
      },
    });
    busVersionId = bus.id;
  });
});
test.afterAll(async () => {
  if (busVersionId)
    await withE2ePrisma((db) =>
      db.busScheduleVersion.delete({ where: { id: busVersionId } }),
    );
  if (fixture) await cleanupOtherCollectionPolicyFixture(fixture);
});

async function prepare(page: Page, baseURL: string | undefined, width: number) {
  if (!baseURL) throw new Error("Missing Playwright baseURL");
  await page
    .context()
    .addCookies([
      await createSignedSessionCookie(fixture.admin.id),
      { name: "NEXT_LOCALE", value: "en-us", url: baseURL },
    ]);
  await page.setViewportSize({ width, height: 900 });
}
function cases() {
  return [
    {
      name: "links",
      path: "/catalog/links",
      filter: true,
      summary: false,
      pagination: false,
    },
    {
      name: "sources",
      path: "/news/sources",
      filter: false,
      summary: true,
      pagination: false,
    },
    {
      name: "uploads",
      path: "/workspace/uploads",
      filter: false,
      summary: true,
      pagination: true,
    },
    {
      name: "users",
      path: `/admin/users?search=${fixture.catalog.marker}-member`,
      filter: true,
      summary: true,
      pagination: true,
    },
    ...["events", "organizers", "notifications"].map((view) => ({
      name: view,
      path: `/workspace/subscriptions/activities?view=${view}${view === "notifications" ? "&unread=true" : ""}`,
      filter: view === "notifications",
      summary: true,
      pagination: true,
    })),
    ...["comments", "descriptions", "homeworks", "suspensions"].map((tab) => ({
      name: tab,
      path: `/admin/moderation?tab=${tab}${tab === "suspensions" ? "" : `&search=${fixture.catalog.marker}`}`,
      filter: true,
      summary: tab === "descriptions",
      pagination: false,
    })),
    {
      name: "bus",
      path: "/admin/bus",
      filter: false,
      summary: false,
      pagination: false,
    },
    {
      name: "oauth",
      path: "/admin/oauth",
      filter: false,
      summary: true,
      pagination: false,
    },
  ];
}
function rows(page: Page, name: string, width: number) {
  if (["events", "organizers", "notifications"].includes(name))
    return page.locator('main [data-slot="item-group"] > [data-slot="item"]');
  if (width >= 1280) return page.locator("main table:visible tbody tr");
  if (name === "sources" || name === "uploads")
    return page.locator('main [role="list"]:visible > [role="listitem"]');
  if (name === "links") return page.locator('main a[data-slot="item"]:visible');
  return page.locator(
    'main [data-slot="admin-list-shell"]:visible [data-slot="item"]',
  );
}
async function precedes(first: Locator, second: Locator) {
  const next = await second.elementHandle();
  if (!next) throw new Error("Expected next layout region");
  expect(
    await first.evaluate(
      (node, next) =>
        Boolean(
          node.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      next,
    ),
  ).toBe(true);
}
function summary(page: Page, name: string) {
  if (name === "uploads")
    return page.locator(
      'main [data-slot="page-section-body"] > div[aria-label]',
    );
  if (["users", "descriptions", "oauth"].includes(name))
    return page.locator('main section > div > [data-slot="badge"]').first();
  return page.locator('main [data-slot="results-summary"]').first();
}

test("ui.other-collection-order", async ({ page, baseURL }) => {
  for (const width of [390, 1280]) {
    await prepare(page, baseURL, width);
    for (const item of cases()) {
      await gotoAndWaitForReady(page, item.path);
      const record = rows(page, item.name, width).first();
      await expect(record, item.name).toBeVisible();
      const heading = page.getByRole("heading", { level: 1 });
      await expect(heading).toBeVisible();
      let previous = heading;
      if (item.filter) {
        const filter =
          item.name === "notifications"
            ? page.getByRole("group", { name: "Filter reminders" })
            : page.getByRole("searchbox");
        await expect(filter).toBeVisible();
        await precedes(previous, filter);
        previous = filter;
      }
      if (item.summary) {
        const resultSummary = summary(page, item.name);
        await expect(resultSummary).toBeVisible();
        await precedes(previous, resultSummary);
        previous = resultSummary;
      }
      await precedes(previous, record);
      if (item.pagination) {
        const pagination = page.locator('[data-slot="list-pagination"]');
        await expect(pagination).toBeVisible();
        await precedes(rows(page, item.name, width).last(), pagination);
      }
    }
  }
});

test("ui.other-browse-responsive-lists", async ({ page, baseURL }) => {
  // This layout contract loads 13 collections at each of two widths. Retain
  // per-navigation deadlines; the complete matrix is not a 30-second SLA.
  test.setTimeout(90_000);
  for (const width of [320, 390]) {
    await prepare(page, baseURL, width);
    for (const item of cases()) {
      await gotoAndWaitForReady(page, item.path);
      const records = rows(page, item.name, width);
      expect(await records.count(), item.name).toBeGreaterThan(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        item.name,
      ).toBe(true);
      const boxes = await records.evaluateAll((elements) =>
        elements.map((element) => {
          element.scrollIntoView({
            behavior: "instant",
            block: "nearest",
            inline: "nearest",
          });
          const box = element.getBoundingClientRect();
          return {
            x: box.x,
            width: box.width,
            visible:
              getComputedStyle(element).visibility === "visible" &&
              box.width > 0 &&
              box.height > 0,
          };
        }),
      );
      for (const box of boxes) {
        expect(box.visible, `Expected visible ${item.name} record`).toBe(true);
        expect(box.x, item.name).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, item.name).toBeLessThanOrEqual(width);
      }
    }
  }
});
