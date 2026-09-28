import type { YoungEvent } from "../../../src/generated/prisma-node/client";
import { withE2ePrisma } from "./e2e-db/prisma";
import { test as accountTest } from "./isolated-account";

export const test = accountTest.extend<{
  activity: YoungEvent;
  activityConsumer: {
    organizerId: string;
    organizerName: string;
    notificationTitle: string;
  };
}>({
  activity: async ({ account, page }, use) => {
    const youngId = `isolated-activity-${crypto.randomUUID()}`;
    const requests = new Set<Promise<void>>();
    const requestErrors: unknown[] = [];
    let closing = false;
    const cleanup = async () => {
      closing = true;
      const results: PromiseSettledResult<unknown>[] = await Promise.allSettled(
        page
          .context()
          .pages()
          .map((open) => open.close()),
      );
      results.push(...(await Promise.allSettled([...requests])));
      results.push(
        ...(await Promise.allSettled([
          withE2ePrisma((db) =>
            db.$transaction([
              db.youngNotification.deleteMany({
                where: { userId: account.id },
              }),
              db.userYoungEventSubscription.deleteMany({
                where: { userId: account.id },
              }),
              // YoungEvent owns comments by a cascading foreign key.
              db.youngEvent.deleteMany({ where: { youngId } }),
            ]),
          ),
        ])),
      );
      const errors = [
        ...requestErrors,
        ...results.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        ),
      ];
      if (errors.length)
        throw new AggregateError(errors, "Owned activity lifecycle failed");
    };
    // Own the identifier before setup: failed setup and interrupted UI requests
    // are cleaned without requiring a successful mutation response.
    try {
      const event = await withE2ePrisma((db) =>
        db.youngEvent.create({
          data: {
            youngId,
            name: "Browser activity subscription",
            isActive: true,
            rawJson: {},
            startAt: new Date(Date.now() + 3_600_000),
            endAt: new Date(Date.now() + 7_200_000),
          },
        }),
      );
      await page.route(
        /\/api\/(?:workspace\/young-(?:event-subscriptions|notifications)\/[^/?]+(?:\/read)?|community\/comments)(?:\?|$)/,
        async (route) => {
          if (!["POST", "PUT", "DELETE"].includes(route.request().method()))
            return route.continue();
          const completion = (async () => {
            try {
              // Delegate real UI writes and wait for the Worker, including when
              // the test ends before its browser receives the response.
              const response = await route.fetch();
              try {
                await route.fulfill({ response });
              } catch (error) {
                if (
                  !(
                    closing &&
                    page.isClosed() &&
                    error instanceof Error &&
                    /^route\.fulfill: Target page, context or browser has been closed(?:\n|$)/.test(
                      error.message,
                    )
                  )
                )
                  throw error;
              }
            } catch (error) {
              requestErrors.push(error);
            }
          })();
          requests.add(completion);
          try {
            await completion;
          } finally {
            requests.delete(completion);
          }
        },
      );
      await use(event);
    } finally {
      await cleanup();
    }
  },
  activityConsumer: async ({ account, activity, page }, use) => {
    const organizerId = `activity-organizer-${crypto.randomUUID()}`;
    const organizerName = "Independent activity organizer";
    const notificationTitle = "Independent activity reminder";
    try {
      await withE2ePrisma((db) =>
        db.$transaction([
          db.youngOrganizer.create({
            data: {
              id: organizerId,
              name: organizerName,
              normalizedName: organizerId,
            },
          }),
          db.userYoungOrganizerSubscription.create({
            data: { userId: account.id, organizerId },
          }),
          db.userYoungEventSubscription.create({
            data: {
              userId: account.id,
              youngId: activity.youngId,
              observedState: "{}",
              remindSignup: true,
              remindDeadline: false,
              remindStart: true,
            },
          }),
          db.youngNotification.create({
            data: {
              userId: account.id,
              youngId: activity.youngId,
              kind: "event_changed",
              title: notificationTitle,
              body: "Activity details changed",
              dedupeKey: activity.youngId,
            },
          }),
        ]),
      );
      await use({ organizerId, organizerName, notificationTitle });
    } finally {
      try {
        await page.close();
      } finally {
        await withE2ePrisma((db) =>
          db.$transaction([
            db.userYoungOrganizerSubscription.deleteMany({
              where: { userId: account.id },
            }),
            db.youngOrganizer.deleteMany({ where: { id: organizerId } }),
          ]),
        );
      }
    }
  },
});
