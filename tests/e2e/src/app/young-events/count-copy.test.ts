import { expect } from "@playwright/test";
import type { Prisma } from "../../../../../src/generated/prisma-node/client";
import { createCountActor } from "../../../utils/localized-count-fixture";
import {
  countCopyCheck,
  prepareCountObservation,
} from "../../../utils/localized-count-observation";
import { test } from "../../../utils/mcp-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

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
  const organizers = [];
  const events = [];
  for (let index = 0; index < count; index++) {
    const organizer = await db.youngOrganizer.create({
      data: {
        name: `${marker} organizer ${index}`,
        normalizedName: `${marker}-organizer-${index}`,
      },
    });
    organizers.push(organizer);
    const event = await db.youngEvent.create({
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
    events.push(event);
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
  return { ...identity, contextOrganizer, organizers, events };
}
for (const count of [0, 1, 2]) {
  test(`young.localized-count-copy count=${count}`, {
    tag: "@Young/Web",
  }, async ({ page, request, isolatedWorker, calendarProtocolRun }) => {
    test.setTimeout(300_000);
    const baseURL = isolatedWorker.origin;
    const db = isolatedWorker.database.owner;
    await calendarProtocolRun(async (io) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const f = await db.$transaction((tx) =>
        createYoungCountFixture(tx, count),
      );
      const eventLinks = f.events.map(({ youngId, name }) => ({
        href: `/catalog/young-events/${youngId}`,
        name,
      }));
      const organizerLinks = f.organizers.map(({ id, name }) => ({
        href: `/catalog/young-events/organizers/${id}`,
        name,
      }));
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
        for (const item of [
          {
            name: "events",
            path: `/catalog/young-events?search=${f.marker}`,
            links: page.locator("main table:visible tbody tr td:first-child a"),
            expected: eventLinks,
            empty: en ? "No events found" : "未找到活动",
          },
          {
            name: "calendar",
            path: `/catalog/young-events/calendar?search=${f.marker}&view=day&date=2035-09-15`,
            links: page.getByTestId("young-calendar-grid").getByRole("link"),
            expected: eventLinks,
            empty: en
              ? "No dated events in this range"
              : "此范围内没有日期明确的活动",
          },
          {
            name: "organizer-history",
            path: `/catalog/young-events/organizers/${f.contextOrganizer.id}`,
            links: page.locator('main [role="list"] > [role="listitem"] a'),
            expected: eventLinks,
            empty: en ? "No events found" : "未找到活动",
          },
          {
            name: "organizer-directory",
            path: `/catalog/young-events/organizers?search=${f.marker}`,
            links: page.locator("main table:visible tbody tr td:first-child a"),
            expected: organizerLinks,
            empty: en ? "No organizers found" : "未找到主办方",
          },
        ]) {
          await gotoAndWaitForReady(page, item.path);
          await expect(
            page.locator(
              '[data-slot="results-summary"], [data-slot="list-pagination"]',
            ),
          ).toHaveCount(0);
          await expect(item.links, item.name).toHaveCount(count);
          expect(
            await item.links.evaluateAll((links) =>
              links.map((link) => link.getAttribute("href")).sort(),
            ),
            item.name,
          ).toEqual(item.expected.map(({ href }) => href).sort());
          if (count === 0) {
            await expect(
              page
                .getByText(item.empty, { exact: true })
                .filter({ visible: true }),
            ).toBeVisible();
          } else {
            for (const expected of item.expected)
              await expect(
                item.links.filter({ hasText: expected.name }),
              ).toHaveAttribute("href", expected.href);
          }
        }

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
        sessionRefreshed: true,
        feedTokenCreated: false,
        subscriptions: [],
        writes: [],
      });
    });
  });
}
