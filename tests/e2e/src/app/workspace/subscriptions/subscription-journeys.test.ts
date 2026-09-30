import { expect } from "@playwright/test";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { test } from "../../../../utils/private-calendar-fixture";
import {
  authorizeSubscription,
  expectIndependentCalendarItems,
  expectSubscribedWebProjections,
  expectSubscriptionProtocol,
  expectSubscriptionRecords,
  observeSubscriptionRecords,
  observeSubscriptionState,
  signInSubscriptionOwner,
  subscribedCourseLink,
  subscriptionCall,
  subscriptionOverviewUrl,
  verifySectionSubscriptionWrite,
} from "../../../../utils/subscription-consumption";

test("subscription.journey-suspended-admin-personal-writes", async ({
  page,
  calendarProtocolRun,
  isolatedWorker,
  createCalendar,
}) => {
  let sectionJwId = 0;
  const writes: string[] = [];
  await calendarProtocolRun(
    async ({ observeCalendar }) => {
      const db = isolatedWorker.database.owner;
      const fixture = await createCalendar();

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: fixture.users[0].id },
          data: { isAdmin: true },
        });
        await tx.userSuspension.create({
          data: {
            userId: fixture.users[0].id,
            reason: "Personal subscription writes remain available",
          },
        });
      });
      sectionJwId = fixture.section.jwId;
      await observeCalendar(fixture.users[0], [
        { type: "user", userId: fixture.users[0].id },
        { type: "user", userId: fixture.users[0].id },
      ]);
      const records = await observeSubscriptionRecords(isolatedWorker);
      const started = Date.now();
      const initial = await observeSubscriptionState(fixture, isolatedWorker);
      expect(initial.sections).toEqual([
        { sectionId: fixture.section.id, kind: "regular" },
      ]);
      const session = await signInSubscriptionOwner(
        page,
        fixture,
        isolatedWorker,
      );
      await gotoAndWaitForReady(
        page,
        `/catalog/sections/${fixture.section.jwId}`,
      );
      await test.step("Suspended administrator may cancel their own subscription through Web", async () => {
        await page
          .getByRole("button", {
            name: "Unsubscribe from section",
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("button", {
            name: "Subscribe to section",
            exact: true,
          }),
        ).toBeVisible();
        expect(await observeSubscriptionState(fixture, isolatedWorker)).toEqual(
          {
            ...initial,
            sections: [],
          },
        );
      });
      await test.step("The same user may subscribe again without changing independent personal records", async () => {
        await page
          .getByRole("button", { name: "Subscribe to section", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "Subscribe to section" })
          .getByRole("button", { name: "Subscribe to section", exact: true })
          .click();
        await expect(
          page.getByRole("button", {
            name: "Unsubscribe from section",
            exact: true,
          }),
        ).toBeVisible();
        expect(await observeSubscriptionState(fixture, isolatedWorker)).toEqual(
          initial,
        );
      });
      return {
        async verifyTransport(observation) {
          expectSubscriptionProtocol(observation, 0, [], 0);
          expect(writes).toEqual(["?/unsubscribe", "?/subscribe"]);
        },
        async verifyState() {
          await expectSubscriptionRecords(isolatedWorker, records, {
            memberships: [
              {
                userId: fixture.users[0].id,
                sectionId: fixture.section.id,
                kind: "regular",
                createdAt: expect.any(Date),
              },
            ],
            feedUsers: [],
            sessions: [session],
            grants: [],
          });
          const membership = await db.userSectionSubscription.findUniqueOrThrow(
            {
              where: {
                userId_sectionId: {
                  userId: fixture.users[0].id,
                  sectionId: fixture.section.id,
                },
              },
            },
          );
          expect(membership.createdAt.getTime()).toBeGreaterThanOrEqual(
            started,
          );
          expect(membership.createdAt.getTime()).toBeLessThanOrEqual(
            Date.now(),
          );
        },
      };
    },
    async (response, request) => {
      writes.push(
        await verifySectionSubscriptionWrite(response, request, sectionJwId),
      );
    },
  );
});

test("subscription.journey-web-projections-and-cancellation", async ({
  page,
  calendarProtocolRun,
  isolatedWorker,
  createCalendar,
}) => {
  let sectionJwId = 0;
  const writes: string[] = [];
  await calendarProtocolRun(
    async ({ observeCalendar }) => {
      const db = isolatedWorker.database.owner;
      test.setTimeout(120_000);
      const fixture = await createCalendar();

      await db.userSectionSubscription.deleteMany({
        where: { userId: fixture.users[0].id },
      });
      sectionJwId = fixture.section.jwId;
      await observeCalendar(fixture.users[0], [
        { type: "user", userId: fixture.users[0].id },
        { type: "user", userId: fixture.users[0].id },
      ]);
      const records = await observeSubscriptionRecords(isolatedWorker);
      const initial = await observeSubscriptionState(fixture, isolatedWorker);
      expect(initial.sections).toEqual([]);
      const session = await signInSubscriptionOwner(
        page,
        fixture,
        isolatedWorker,
      );
      await test.step("Subscribe through the public teaching section, then verify the independent persisted state", async () => {
        await gotoAndWaitForReady(
          page,
          `/catalog/sections/${fixture.section.jwId}`,
        );
        await page
          .getByRole("button", { name: "Subscribe to section", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "Subscribe to section" })
          .getByRole("button", { name: "Subscribe to section", exact: true })
          .click();
        await expect(
          page.getByRole("button", {
            name: "Unsubscribe from section",
            exact: true,
          }),
        ).toBeVisible();
        expect(await observeSubscriptionState(fixture, isolatedWorker)).toEqual(
          {
            ...initial,
            sections: [{ sectionId: fixture.section.id, kind: "regular" }],
          },
        );
      });
      await test.step("The subscription feeds the list, calendar and current-class overview, and survives reload", async () => {
        await expectSubscribedWebProjections(page, fixture);
        await page.reload();
        await waitForUiSettled(page);
        await expect(
          page.getByTestId("workspace-overview-focus"),
        ).toContainText(String(fixture.course.nameEn));
        await page
          .getByTestId("workspace-overview-focus")
          .getByRole("link")
          .click();
        await expect(page).toHaveURL(
          new URL(
            `/catalog/sections/${fixture.section.jwId}`,
            isolatedWorker.origin,
          ).toString(),
        );
        await expect(
          page.getByRole("button", {
            name: "Unsubscribe from section",
            exact: true,
          }),
        ).toBeVisible();
      });
      await test.step("Cancel through the UI; remove academic projections while retaining independent personal records", async () => {
        await page
          .getByRole("button", {
            name: "Unsubscribe from section",
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("button", {
            name: "Subscribe to section",
            exact: true,
          }),
        ).toBeVisible();
        expect(await observeSubscriptionState(fixture, isolatedWorker)).toEqual(
          initial,
        );
        const window = `dateFrom=${fixture.date}&dateTo=${fixture.activityDate}`;
        for (const [path, key] of [
          ["schedules", "schedules"],
          ["exams", "data"],
          ["homeworks", "data"],
        ] as const) {
          const response = await page.request.get(
            `/api/workspace/${path}?${window}`,
          );
          expect(response.status()).toBe(200);
          expect((await response.json())[key]).toEqual([]);
        }
        const calendarResponse = await page.request.get(
          `/api/workspace/calendar/events?${window}`,
        );
        expect(calendarResponse.status()).toBe(200);
        const events = (await calendarResponse.json()).data;
        expect(
          events.map((event: { type: string }) => event.type).sort(),
        ).toEqual(["todo_due", "young_event"]);
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: `todo-${fixture.todo.id}` }),
            expect.objectContaining({ youngId: fixture.young.youngId }),
          ]),
        );
        await gotoAndWaitForReady(page, "/workspace/subscriptions");
        await expect(subscribedCourseLink(page, fixture)).toHaveCount(0);
        await expectIndependentCalendarItems(page, fixture);
        await gotoAndWaitForReady(page, subscriptionOverviewUrl);
        await expect(page.locator("#main-content")).not.toContainText(
          String(fixture.course.nameEn),
        );
        await expect(page.locator("#main-content")).not.toContainText(
          fixture.homework.title,
        );
        await expect(
          page
            .getByText(fixture.todo.title, { exact: true })
            .filter({ visible: true })
            .first(),
        ).toBeVisible();
        await page.reload();
        await waitForUiSettled(page);
        await expect(page.locator("#main-content")).not.toContainText(
          String(fixture.course.nameEn),
        );
        await gotoAndWaitForReady(
          page,
          `/catalog/sections/${fixture.section.jwId}`,
        );
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          String(fixture.course.nameEn),
        );
        await expect(
          page.getByRole("button", {
            name: "Subscribe to section",
            exact: true,
          }),
        ).toBeVisible();
      });
      return {
        async verifyTransport(observation) {
          expectSubscriptionProtocol(observation, 0, [], 0);
          expect(writes).toEqual(["?/subscribe", "?/unsubscribe"]);
        },
        async verifyState() {
          await expectSubscriptionRecords(isolatedWorker, records, {
            memberships: [],
            feedUsers: [fixture.users[0].id],
            sessions: [session],
            grants: [],
          });
        },
      };
    },
    async (response, request) => {
      writes.push(
        await verifySectionSubscriptionWrite(response, request, sectionJwId),
      );
    },
  );
});

test("subscription.journey-mcp-to-open-web-refresh", async ({
  page,
  calendarProtocolRun,
  isolatedWorker,
  oauthOwner,
  createCalendar,
}) => {
  await calendarProtocolRun(async ({ request, mcp, observeCalendar }) => {
    test.setTimeout(90_000);
    const fixture = await createCalendar();
    await observeCalendar(fixture.users[0], [
      { type: "user", userId: fixture.users[0].id },
      { type: "user", userId: fixture.users[0].id },
    ]);
    const records = await observeSubscriptionRecords(isolatedWorker);
    const session = await signInSubscriptionOwner(
      page,
      fixture,
      isolatedWorker,
    );
    const grant = await authorizeSubscription(
      page,
      request,
      oauthOwner,
      session,
      {
        scope: "workspace.subscription:write",
        channel: "mcp",
        reads: 0,
        writes: 2,
      },
    );
    const client = await mcp(
      { name: "subscription-refresh-journey", version: "1" },
      grant.accessToken,
    );
    const started = Date.now();
    const initial = await observeSubscriptionState(fixture, isolatedWorker);
    await test.step("Open the subscribed list before changing it through a separate MCP connection", async () => {
      await gotoAndWaitForReady(page, "/workspace/subscriptions");
      await expect(subscribedCourseLink(page, fixture)).toBeVisible();
      const result = await subscriptionCall(grant, "write", () =>
        client.callTool({
          name: "workspace_subscription_remove",
          arguments: { jwId: fixture.section.jwId },
        }),
      );
      expect(result.isError).not.toBe(true);
      expect(await observeSubscriptionState(fixture, isolatedWorker)).toEqual({
        ...initial,
        sections: [],
      });
      // Refresh is the promised synchronization point; no realtime push is assumed.
      await page.reload();
      await waitForUiSettled(page);
      await expect(subscribedCourseLink(page, fixture)).toHaveCount(0);
    });
    await test.step("An external add becomes visible after refresh and feeds the calendar again", async () => {
      const result = await subscriptionCall(grant, "write", () =>
        client.callTool({
          name: "workspace_subscription_add",
          arguments: { jwId: fixture.section.jwId },
        }),
      );
      expect(result.isError).not.toBe(true);
      expect(await observeSubscriptionState(fixture, isolatedWorker)).toEqual(
        initial,
      );
      await page.reload();
      await waitForUiSettled(page);
      await expect(subscribedCourseLink(page, fixture)).toHaveText(
        String(fixture.course.nameEn),
      );
      await gotoAndWaitForReady(page, fixture.academicUrl());
      await expect(
        page
          .locator(`a[href="/catalog/sections/${fixture.section.jwId}"]`)
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
    });

    return {
      async verifyTransport(observation) {
        expectSubscriptionProtocol(
          observation,
          1,
          ["workspace_subscription_remove", "workspace_subscription_add"],
          1,
        );
      },
      async verifyState() {
        await expectSubscriptionRecords(isolatedWorker, records, {
          memberships: [
            {
              userId: fixture.users[0].id,
              sectionId: fixture.section.id,
              kind: "regular",
              createdAt: expect.any(Date),
            },
          ],
          feedUsers: [fixture.users[0].id],
          sessions: [session],
          grants: [grant],
        });
        const membership =
          await isolatedWorker.database.owner.userSectionSubscription.findUniqueOrThrow(
            {
              where: {
                userId_sectionId: {
                  userId: fixture.users[0].id,
                  sectionId: fixture.section.id,
                },
              },
            },
          );
        expect(membership.createdAt.getTime()).toBeGreaterThanOrEqual(started);
        expect(membership.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
      },
    };
  });
});
