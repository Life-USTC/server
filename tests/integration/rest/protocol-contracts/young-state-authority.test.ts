import { expect } from "@playwright/test";
import {
  expectSuccessfulOperation as successful,
  expectAuthorizationRejected as unauthorized,
} from "./_assertions";
import { type ProtocolFixture, test as protocolTest } from "./_fixture";
import {
  invokeOperation as invoke,
  type Operation,
  type OperationResult as Result,
  type Transport,
  transports,
} from "./_transport";

const test = protocolTest.extend<{ youngFixture: undefined }>({
  youngFixture: [
    async ({ h, run }, use) => {
      await run(async () => {
        await h.db.youngOrganizer.create({
          data: {
            id: h.organizerId,
            name: h.organizerId,
            normalizedName: h.organizerId,
          },
        });
        await h.db.youngEvent.create({
          data: {
            youngId: h.youngId,
            name: h.youngId,
            organizerId: h.organizerId,
            rawJson: {},
            isActive: true,
          },
        });
      });
      await use(undefined);
    },
    { auto: true },
  ],
});
test.use({
  features: ["workspace.young-subscription", "workspace.young-notification"],
});
type Target = "event" | "organizer";
function subscription(
  h: ProtocolFixture,
  target: Target,
  subscribed: boolean,
  id = target === "event" ? h.youngId : h.organizerId,
): Operation {
  const organizer = target === "organizer";
  return {
    rest: {
      path: `/api/workspace/young-${organizer ? "organizer" : "event"}-subscriptions/${id}`,
      method: "PUT",
      body: { subscribed },
    },
    graphql: {
      field: organizer
        ? "youngOrganizerSubscriptionSet"
        : "youngEventSubscriptionSet",
      query: organizer
        ? "mutation($id:ID!, $subscribed:Boolean!) { youngOrganizerSubscriptionSet(organizerId:$id,subscribed:$subscribed) { subscribed } }"
        : "mutation($id:String!, $subscribed:Boolean!) { youngEventSubscriptionSet(youngId:$id,input:{subscribed:$subscribed}) { subscribed } }",
      variables: { id, subscribed },
    },
    mcp: {
      name: `workspace_young_${organizer ? "organizer" : "event"}_subscription_set`,
      arguments: { [organizer ? "organizerId" : "youngId"]: id, subscribed },
    },
  };
}
function readNotice(id: string): Operation {
  return {
    rest: {
      path: `/api/workspace/young-notifications/${id}/read`,
      method: "POST",
    },
    graphql: {
      field: "youngNotificationRead",
      query: "mutation($id:ID!) { youngNotificationRead(id:$id) { success } }",
      variables: { id },
    },
    mcp: { name: "workspace_young_notification_read", arguments: { id } },
  };
}
function missingSubscription(transport: Transport, result: Result) {
  expect(result.response.status).toBe(transport === "rest" ? 404 : 200);
  if (transport === "rest")
    expect(result.content.error).toEqual(expect.any(String));
  if (transport === "graphql")
    expect(result.payload.errors[0].extensions.code).toBe("NOT_FOUND");
  if (transport === "mcp") {
    expect(result.payload.error).toBeUndefined();
    expect(result.payload.result.isError).not.toBe(true);
    expect(result.content).toMatchObject({
      success: false,
      error: "not_found",
    });
  }
}
function missingNotification(transport: Transport, result: Result) {
  expect(result.response.status).toBe(transport === "rest" ? 404 : 200);
  if (transport === "rest")
    expect(result.content).toEqual({ error: "Notification not found" });
  if (transport === "graphql") expect(result.payload.errors).toBeUndefined();
  if (transport === "mcp") {
    expect(result.payload.error).toBeUndefined();
    expect(result.payload.result.isError).not.toBe(true);
  }
  if (transport !== "rest") expect(result.content.success).toBe(false);
}
async function seedSubscriptions(h: ProtocolFixture, target: Target) {
  if (target === "event")
    await h.db.userYoungEventSubscription.createMany({
      data: h.actors.map((a) => ({
        userId: a.id,
        youngId: h.youngId,
        observedState: JSON.stringify([
          h.youngId,
          null,
          null,
          null,
          false,
          null,
          null,
          null,
          null,
        ]),
      })),
    });
  else
    await h.db.userYoungOrganizerSubscription.createMany({
      data: h.actors.map((a) => ({ userId: a.id, organizerId: h.organizerId })),
    });
}
function notice(
  h: ProtocolFixture,
  userId: string,
  target: Target,
  read = false,
) {
  return h.db.youngNotification.create({
    data: {
      userId,
      youngId: target === "event" ? h.youngId : null,
      organizerId: target === "organizer" ? h.organizerId : null,
      kind: "event_changed",
      title: "Owned notice",
      body: "Private body",
      dedupeKey: `${h.marker}-${crypto.randomUUID()}`,
      readAt: read ? new Date("2026-01-01T00:00:00Z") : null,
    },
  });
}
async function snapshot(h: ProtocolFixture) {
  return {
    events: await h.db.userYoungEventSubscription.findMany({
      where: { userId: { in: h.actors.map((actor) => actor.id) } },
      orderBy: { userId: "asc" },
    }),
    organizers: await h.db.userYoungOrganizerSubscription.findMany({
      where: { userId: { in: h.actors.map((actor) => actor.id) } },
      orderBy: { userId: "asc" },
    }),
    notices: await h.db.youngNotification.findMany({
      where: { userId: { in: h.actors.map((a) => a.id) } },
      orderBy: { id: "asc" },
    }),
  };
}
function selected(state: Awaited<ReturnType<typeof snapshot>>, target: Target) {
  return target === "event" ? state.events : state.organizers;
}
for (const transport of transports)
  for (const target of ["event", "organizer"] as const) {
    for (const subscribed of [true, false]) {
      test(`young ${target} ${subscribed ? "subscribe" : "unsubscribe"} preserves foreign state through ${transport}`, {
        tag: `@Young/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
      }, async ({ run, h }) => {
        await run(async () => {
          const actor = h.actors[subscribed ? 0 : 1];
          await seedSubscriptions(h, "event");
          await seedSubscriptions(h, "organizer");
          if (subscribed) {
            if (target === "event")
              await h.db.userYoungEventSubscription.deleteMany({
                where: { userId: actor.id },
              });
            else
              await h.db.userYoungOrganizerSubscription.deleteMany({
                where: { userId: actor.id },
              });
          }
          await notice(h, h.actors[0].id, target);
          const before = await snapshot(h);
          expect(
            successful(
              transport,
              await invoke(
                h.origin,
                transport,
                subscription(h, target, subscribed),
                actor.tokens[transport],
              ),
            ),
          ).toMatchObject({ subscribed });
          const after = await snapshot(h);
          expect(
            selected(after, target).filter((row) => row.userId !== actor.id),
          ).toEqual(
            selected(before, target).filter((row) => row.userId !== actor.id),
          );
          const own = selected(after, target).filter(
            (row) => row.userId === actor.id,
          );
          if (subscribed) {
            expect(own).toEqual([
              expect.objectContaining({
                userId: actor.id,
                ...(target === "event"
                  ? { youngId: h.youngId }
                  : { organizerId: h.organizerId }),
                createdAt: expect.any(Date),
              }),
            ]);
          } else expect(own).toEqual([]);
          expect(after.notices).toEqual(before.notices);
          expect(
            selected(after, target === "event" ? "organizer" : "event"),
          ).toEqual(
            selected(before, target === "event" ? "organizer" : "event"),
          );
        });
      });
    }
    test(`young ${target} authorization rejection preserves state through ${transport}`, {
      tag: `@Young/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ run, h }) => {
      await run(async () => {
        await seedSubscriptions(h, target);
        await notice(h, h.actors[0].id, target);
        const before = await snapshot(h);
        for (const reason of ["anonymous", "read_scope"] as const) {
          unauthorized(
            transport,
            await invoke(
              h.origin,
              transport,
              subscription(h, target, true),
              reason === "anonymous"
                ? undefined
                : h.actors[0].readTokens[transport],
            ),
            reason,
          );
          expect(await snapshot(h)).toEqual(before);
        }
      });
    });
    test(`young ${target} missing target preserves state through ${transport}`, {
      tag: `@Young/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ run, h }) => {
      await run(async () => {
        await seedSubscriptions(h, target);
        await notice(h, h.actors[0].id, target);
        const before = await snapshot(h);
        missingSubscription(
          transport,
          await invoke(
            h.origin,
            transport,
            subscription(h, target, true, `${h.marker}-missing`),
            h.actors[0].tokens[transport],
          ),
        );
        expect(await snapshot(h)).toEqual(before);
      });
    });
    for (const subscribed of [false, true]) {
      test(`young ${target} ${subscribed ? "subscribe" : "unsubscribe"} remains personal during suspension through ${transport}`, {
        tag: `@Young/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
      }, async ({ run, h }) => {
        await run(async () => {
          await seedSubscriptions(h, target);
          if (subscribed) {
            if (target === "event")
              await h.db.userYoungEventSubscription.deleteMany({
                where: { userId: h.actors[0].id },
              });
            else
              await h.db.userYoungOrganizerSubscription.deleteMany({
                where: { userId: h.actors[0].id },
              });
          }
          const owned = await notice(h, h.actors[0].id, target);
          await notice(h, h.actors[1].id, target);
          await h.db.userSuspension.create({
            data: { userId: h.actors[0].id, reason: h.marker },
          });
          const before = await snapshot(h);
          expect(
            successful(
              transport,
              await invoke(
                h.origin,
                transport,
                subscription(h, target, subscribed),
                h.actors[0].tokens[transport],
              ),
            ),
          ).toMatchObject({ subscribed });
          const after = await snapshot(h);
          expect(
            selected(after, target).filter(
              (row) => row.userId === h.actors[0].id,
            ),
          ).toHaveLength(subscribed ? 1 : 0);
          expect(
            selected(after, target).filter(
              (row) => row.userId !== h.actors[0].id,
            ),
          ).toEqual(
            selected(before, target).filter(
              (row) => row.userId !== h.actors[0].id,
            ),
          );
          expect(after.notices).toEqual(
            subscribed
              ? before.notices
              : before.notices.filter((row) => row.id !== owned.id),
          );
          expect(
            selected(after, target === "event" ? "organizer" : "event"),
          ).toEqual(
            selected(before, target === "event" ? "organizer" : "event"),
          );
        });
      });
    }
    for (const repeat of [false, true]) {
      test(`young ${target} ${repeat ? "repeat unsubscribe" : "unsubscribe"} removes only own unread notices through ${transport}`, {
        tag: `@Young/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
      }, async ({ run, h }) => {
        await run(async () => {
          await seedSubscriptions(h, target);
          if (repeat) {
            if (target === "event")
              await h.db.userYoungEventSubscription.deleteMany({
                where: { userId: h.actors[0].id },
              });
            else
              await h.db.userYoungOrganizerSubscription.deleteMany({
                where: { userId: h.actors[0].id },
              });
          }
          const unread = repeat
            ? null
            : await notice(h, h.actors[0].id, target);
          await notice(h, h.actors[0].id, target, true);
          await notice(h, h.actors[1].id, target);
          const before = await snapshot(h);
          expect(
            successful(
              transport,
              await invoke(
                h.origin,
                transport,
                subscription(h, target, false),
                h.actors[0].tokens[transport],
              ),
            ),
          ).toMatchObject({ subscribed: false });
          const after = await snapshot(h);
          expect(after.notices).toEqual(
            before.notices.filter((row) => row.id !== unread?.id),
          );
          expect(selected(after, target)).toEqual(
            selected(before, target).filter(
              (row) => row.userId !== h.actors[0].id,
            ),
          );
          expect(
            selected(after, target === "event" ? "organizer" : "event"),
          ).toEqual(
            selected(before, target === "event" ? "organizer" : "event"),
          );
        });
      });
    }
  }
for (const transport of transports) {
  test(`young notification rejects foreign and missing identifiers through ${transport}`, {
    tag: `@Young/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
  }, async ({ run, h }) => {
    await run(async () => {
      const owned = await notice(h, h.actors[0].id, "event");
      await notice(h, h.actors[1].id, "event");
      const before = await snapshot(h);
      for (const [id, token] of [
        [owned.id, h.actors[1].tokens[transport]],
        [`${h.marker}-missing`, h.actors[0].tokens[transport]],
      ]) {
        missingNotification(
          transport,
          await invoke(h.origin, transport, readNotice(id), token),
        );
        expect(await snapshot(h)).toEqual(before);
      }
    });
  });
  test(`young notification authorization rejection preserves state through ${transport}`, {
    tag: `@Young/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
  }, async ({ run, h }) => {
    await run(async () => {
      const owned = await notice(h, h.actors[0].id, "event");
      await notice(h, h.actors[1].id, "event");
      const before = await snapshot(h);
      for (const reason of ["anonymous", "read_scope"] as const) {
        unauthorized(
          transport,
          await invoke(
            h.origin,
            transport,
            readNotice(owned.id),
            reason === "anonymous"
              ? undefined
              : h.actors[0].readTokens[transport],
          ),
          reason,
        );
        expect(await snapshot(h)).toEqual(before);
      }
    });
  });
  for (const alreadyRead of [false, true]) {
    test(`young notification ${alreadyRead ? "repeat read" : "read"} preserves foreign state through ${transport}`, {
      tag: `@Young/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ run, h }) => {
      await run(async () => {
        const actor = h.actors[alreadyRead ? 1 : 0];
        const owned = await notice(h, actor.id, "event", alreadyRead);
        await notice(h, h.actors[alreadyRead ? 0 : 1].id, "event", true);
        const before = await snapshot(h);
        expect(
          successful(
            transport,
            await invoke(
              h.origin,
              transport,
              readNotice(owned.id),
              actor.tokens[transport],
            ),
          ),
        ).toMatchObject({ success: true });
        expect(await snapshot(h)).toEqual({
          ...before,
          notices: before.notices.map((row) =>
            row.id === owned.id && !alreadyRead
              ? { ...row, readAt: expect.any(Date) }
              : row,
          ),
        });
      });
    });
  }
  test(`young notification remains personal during suspension through ${transport}`, {
    tag: `@Young/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
  }, async ({ run, h }) => {
    await run(async () => {
      const owned = await notice(h, h.actors[0].id, "event");
      await notice(h, h.actors[1].id, "event");
      await h.db.userSuspension.create({
        data: { userId: h.actors[0].id, reason: h.marker },
      });
      const before = await snapshot(h);
      expect(
        successful(
          transport,
          await invoke(
            h.origin,
            transport,
            readNotice(owned.id),
            h.actors[0].tokens[transport],
          ),
        ),
      ).toMatchObject({ success: true });
      const after = await snapshot(h);
      expect(after.notices).toEqual(
        before.notices.map((row) =>
          row.id === owned.id ? { ...row, readAt: expect.any(Date) } : row,
        ),
      );
      expect(after.events).toEqual(before.events);
      expect(after.organizers).toEqual(before.organizers);
    });
  });
}
