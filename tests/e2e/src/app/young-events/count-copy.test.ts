import { expect } from "@playwright/test";
import type { Prisma } from "../../../../../src/generated/prisma-node/client";
import { createCountActor } from "../../../utils/localized-count-fixture";
import {
  countCopyCheck,
  prepareCountObservation,
} from "../../../utils/localized-count-observation";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../api/mcp/_fixture";

async function createYoungCountFixture(
  db: Prisma.TransactionClient,
  count: number,
) {
  const identity = await createCountActor(db);
  const { marker, owner } = identity;
  const contextOrganizer = await db.youngOrganizer.create({
    data: {
      name: "Count grammar detail context",
      normalizedName: `${marker}-context`,
    },
  });
  for (let index = 0; index < count; index++) {
    await db.youngOrganizer.create({
      data: {
        name: `${marker} organizer ${index}`,
        normalizedName: `${marker}-organizer-${index}`,
      },
    });
    await db.youngEvent.create({
      data: {
        youngId: `${marker}-event-${index}`,
        name: `${marker} event ${index}`,
        organizerId: contextOrganizer.id,
        isActive: true,
        startAt: new Date("2035-09-15T10:00:00+08:00"),
        endAt: new Date("2035-09-15T12:00:00+08:00"),
        rawJson: {},
      },
    });
    await db.youngNotification.create({
      data: {
        userId: owner.id,
        organizerId: contextOrganizer.id,
        kind: "organizer_digest",
        title: `Activity digest ${index + 1}`,
        body: `${count} 个新活动 / new events: Count grammar activity`,
        dedupeKey: `${marker}-${index}`,
        expiresAt: new Date("2099-01-01T00:00:00Z"),
      },
    });
  }
  return { ...identity, contextOrganizer };
}
for (const count of [0, 1, 2]) {
  test(`young.localized-count-copy count=${count}`, async ({
    page,
    request,
    isolatedWorker,
    calendarProtocolRun,
  }) => {
    test.setTimeout(300_000);
    const baseURL = isolatedWorker.origin;
    const db = isolatedWorker.database.owner;
    await calendarProtocolRun(async (io) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const f = await db.$transaction((tx) =>
        createYoungCountFixture(tx, count),
      );
      const actor = await isolatedWorker.createSession(f.owner.id);
      await io.observeCalendar(f.owner, [], { calendar: "absent" });
      const observation = await prepareCountObservation(
        isolatedWorker,
        request,
        f.owner.id,
      );
      for (const locale of ["en-us", "zh-cn"]) {
        await page.context().clearCookies();
        await page
          .context()
          .addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL }]);
        const en = locale === "en-us";
        const check = countCopyCheck(locale, count);
        const eventSummary = en
          ? `Showing ${count} of ${count} ${count === 1 ? "event" : "events"}`
          : `显示 ${count} 个活动中的 ${count} 个`;
        for (const item of [
          {
            name: "events",
            path: `/catalog/young-events?search=${f.marker}`,
          },
          {
            name: "calendar",
            path: `/catalog/young-events/calendar?search=${f.marker}&view=day&date=2035-09-15`,
          },
          {
            name: "organizer-history",
            path: `/catalog/young-events/organizers/${f.contextOrganizer.id}`,
          },
        ]) {
          await gotoAndWaitForReady(page, item.path);
          await check(
            page.locator('[data-slot="results-summary"] > p'),
            eventSummary,
            item.name,
          );
        }
        await gotoAndWaitForReady(
          page,
          `/catalog/young-events/organizers?search=${f.marker}`,
        );
        await check(
          page.locator('[data-slot="results-summary"] > p'),
          en
            ? `Showing ${count} of ${count} ${count === 1 ? "organizer" : "organizers"}`
            : `显示 ${count} 个主办方中的 ${count} 个`,
          "organizers",
        );

        await page.context().addCookies([actor.cookie]);
        await gotoAndWaitForReady(
          page,
          "/workspace/subscriptions/activities?view=notifications",
        );
        const notifications = page.locator(
          'main [data-slot="item-group"] > [data-slot="item"]',
        );
        await expect(notifications).toHaveCount(count);
        if (count > 0)
          await check(
            notifications.first().locator("p"),
            en
              ? `${count} new ${count === 1 ? "activity" : "activities"}: Count grammar activity`
              : `${count} 个新活动：Count grammar activity`,
            "digest",
          );
      }
      return observation.checks({
        feedTokenCreated: false,
        subscriptions: [],
        writes: [],
      });
    });
  });
}
