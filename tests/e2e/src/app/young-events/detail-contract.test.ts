import { expect, type Page } from "@playwright/test";
import type {
  Prisma,
  YoungEvent,
} from "../../../../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "../../../../shared/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

async function expectEventReadState(
  db: TestPrismaClient,
  events: YoungEvent[],
) {
  expect(await db.youngEvent.findMany({ orderBy: { id: "asc" } })).toEqual(
    events,
  );
  expect(await db.youngOrganizer.findMany()).toEqual([]);
  expect(await db.user.findMany()).toEqual([]);
  expect(await db.session.findMany()).toEqual([]);
  expect(await db.userYoungEventSubscription.findMany()).toEqual([]);
  expect(await db.userYoungOrganizerSubscription.findMany()).toEqual([]);
  expect(await db.youngNotification.findMany()).toEqual([]);
  expect(await db.auditLog.findMany()).toEqual([]);
}

async function withEvent(
  page: Page,
  db: TestPrismaClient,
  events: YoungEvent[],
  data: Partial<Prisma.YoungEventCreateInput>,
  run: (youngId: string) => Promise<void>,
) {
  const youngId = `detail-contract-${crypto.randomUUID()}`;
  const event = await db.youngEvent.create({
    data: { youngId, name: youngId, isActive: true, rawJson: {}, ...data },
  });
  events.push(event);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await gotoAndWaitForReady(page, `/catalog/young-events/${youngId}`);
    await run(youngId);
  }
}

test("young-event.display-known-values", async ({
  page,
  isolatedWorker,
  preferenceFlow,
  run,
}) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    const events: YoungEvent[] = [];
    await preferenceFlow.run(async () => {
      await withEvent(
        page,
        db,
        events,
        {
          requiresSignupInfo: true,
          allowedAttachmentTypes: ["pdf", "docx"],
          isOnline: true,
          onlineMeetingInfo: "800-414-186",
          externalSponsor: "External sponsor fixture",
        },
        async () => {
          // The detail page presents identity, badges and copy only; upstream
          // registration fields stay out of the rendered page.
          const banner = page.getByTestId("young-event-banner");
          await expect(banner.getByRole("heading", { level: 1 })).toBeVisible();
          await expect(
            banner.getByRole("button", {
              name: /^(订阅活动|Subscribe to event)$/,
            }),
          ).toBeVisible();
          await expect(
            page.getByText("800-414-186", { exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByText("PDF, DOCX", { exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByText("External sponsor fixture", { exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByText(
              /报名时需填写补充信息|Additional information required at registration/,
            ),
          ).toHaveCount(0);
        },
      );
    });
    await expectEventReadState(db, events);
  });
});

test("young-event.online-option-uncertainty", async ({
  page,
  isolatedWorker,
  preferenceFlow,
  run,
}) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    const events: YoungEvent[] = [];
    await preferenceFlow.run(async () => {
      for (const isOnline of [true, false, null]) {
        await withEvent(page, db, events, { isOnline }, async () => {
          const online = page.getByText(
            /^(提供线上会议|Online meeting available)$/,
          );
          if (isOnline === true) await expect(online).toBeVisible();
          else await expect(online).toHaveCount(0);
          await expect(
            page.getByText(/^(线下活动|In-person event)$/),
          ).toHaveCount(0);
        });
      }
    });
    await expectEventReadState(db, events);
  });
});

test("young-event.scope-uncertainty", async ({
  page,
  isolatedWorker,
  preferenceFlow,
  run,
}) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    const events: YoungEvent[] = [];
    await preferenceFlow.run(async () => {
      await withEvent(
        page,
        db,
        events,
        {
          signupScopeCode: "unrecognized-scope-99",
          signupDepartmentIds: ["opaque-department"],
        },
        async () => {
          await expect(
            page.getByText(
              /报名资格与面向范围请以第二课堂平台为准|Check the Second Classroom platform for eligibility/,
            ),
          ).toHaveCount(0);
          await expect(
            page.getByText("unrecognized-scope-99", { exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByText("opaque-department", { exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByText(
              /^(所有学生均可报名|All students are eligible|仅本院学生|Department members only)$/,
            ),
          ).toHaveCount(0);
        },
      );
    });
    await expectEventReadState(db, events);
  });
});

test("young-event.partial-time-uncertainty", async ({
  page,
  isolatedWorker,
  preferenceFlow,
  run,
}) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    const events: YoungEvent[] = [];
    await preferenceFlow.run(async () => {
      for (const endpoint of ["startAt", "endAt"] as const) {
        await withEvent(
          page,
          db,
          events,
          { [endpoint]: new Date("2035-09-24T00:30:00Z") },
          async () => {
            await expect(page.getByTestId("young-event-overview")).toHaveCount(
              0,
            );
            await expect(page.getByText("Invalid Date")).toHaveCount(0);
          },
        );
      }
    });
    await expectEventReadState(db, events);
  });
});

test("young-event.occupancy-uncertainty", async ({
  page,
  isolatedWorker,
  preferenceFlow,
  run,
}) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    const events: YoungEvent[] = [];
    await preferenceFlow.run(async () => {
      for (const appliedCount of [null, 0]) {
        await withEvent(
          page,
          db,
          events,
          { appliedCount, capacity: 20 },
          async (youngId) => {
            await expect(
              page
                .locator("dt")
                .filter({ hasText: /^(已报名|Applied|Registered)$/ }),
            ).toHaveCount(0);
            await gotoAndWaitForReady(
              page,
              `/catalog/young-events?search=${encodeURIComponent(youngId)}`,
            );
            await expect(
              page.locator(`a[href*="${youngId}"]:visible`).first(),
            ).toBeVisible();
            await expect(
              page.getByRole("cell", {
                name: /0 \/ 20|未提供 \/ 20|Not provided/,
              }),
            ).toHaveCount(0);
          },
        );
      }
    });
    await expectEventReadState(db, events);
  });
});
