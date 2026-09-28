import { expect } from "@playwright/test";
import { type ProtocolFixture, test as protocolTest } from "./_fixture";
import {
  nativeEnvelope,
  type Operation,
  sendOperation,
  type Transport,
  transports,
} from "./_transport";

async function invoke(
  h: ProtocolFixture,
  transport: Transport,
  operation: Operation,
  token?: string,
) {
  const response = await sendOperation(h.origin, transport, operation, token);
  const payload = await nativeEnvelope(response);
  const content =
    transport === "mcp" && payload.result?.content
      ? JSON.parse(
          payload.result.content.find(
            (part: { type: string }) => part.type === "text",
          ).text,
        )
      : transport === "graphql"
        ? payload.data?.[operation.graphql.field]
        : payload;
  return { response, payload, content };
}
type Result = Awaited<ReturnType<typeof invoke>>;
function successful(transport: Transport, result: Result) {
  expect(result.response.status, JSON.stringify(result.payload)).toBe(200);
  if (transport === "graphql") expect(result.payload.errors).toBeUndefined();
  if (transport === "mcp") {
    expect(result.payload.error).toBeUndefined();
    expect(result.payload.result.isError).not.toBe(true);
    expect(result.content.success).toBe(true);
  }
  return result.content;
}
function unauthorized(
  transport: Transport,
  result: Result,
  reason: "anonymous" | "read_scope",
) {
  expect(result.response.status).toBe(
    reason === "anonymous" || transport === "rest" ? 401 : 403,
  );
  if (transport === "graphql")
    expect(result.payload.errors[0].extensions.code).toBe(
      reason === "anonymous" ? "UNAUTHENTICATED" : "FORBIDDEN",
    );
  if (transport === "mcp") expect(result.payload.error).toBeDefined();
}

const test = protocolTest.extend<{ youngFixture: undefined }>({
  youngFixture: [
    async ({ h }, use) => {
      try {
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
        await use(undefined);
      } finally {
        await h.db.userYoungEventSubscription.deleteMany({
          where: { youngId: h.youngId },
        });
        await h.db.userYoungOrganizerSubscription.deleteMany({
          where: { organizerId: h.organizerId },
        });
        await h.db.youngNotification.deleteMany({
          where: { userId: { in: h.actors.map((a) => a.id) } },
        });
      }
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
    test(`young ${target} updates preserve both owners through ${transport}`, async ({
      h,
    }) => {
      await seedSubscriptions(h, target === "event" ? "organizer" : "event");
      const ownedNotice = await notice(h, h.actors[0].id, target);
      const initial = await snapshot(h);
      for (const actor of h.actors) {
        const foreign = selected(await snapshot(h), target).filter(
          (row) => row.userId !== actor.id,
        );
        expect(
          successful(
            transport,
            await invoke(
              h,
              transport,
              subscription(h, target, true),
              actor.tokens[transport],
            ),
          ),
        ).toMatchObject({ subscribed: true });
        const state = await snapshot(h);
        expect(
          selected(state, target).filter((row) => row.userId !== actor.id),
        ).toEqual(foreign);
        expect(
          selected(state, target).filter((row) => row.userId === actor.id),
        ).toHaveLength(1);
        expect(state.notices).toEqual([ownedNotice]);
        expect(
          selected(state, target === "event" ? "organizer" : "event"),
        ).toEqual(
          selected(initial, target === "event" ? "organizer" : "event"),
        );
      }
      const before = await snapshot(h);
      expect(
        successful(
          transport,
          await invoke(
            h,
            transport,
            subscription(h, target, false),
            h.actors[1].tokens[transport],
          ),
        ),
      ).toMatchObject({ subscribed: false });
      const after = await snapshot(h);
      expect(selected(after, target)).toEqual(
        selected(before, target).filter((row) => row.userId === h.actors[0].id),
      );
      expect(after.notices).toEqual([ownedNotice]);
      expect(
        selected(after, target === "event" ? "organizer" : "event"),
      ).toEqual(selected(initial, target === "event" ? "organizer" : "event"));
    });
    test(`young ${target} authorization rejection preserves state through ${transport}`, async ({
      h,
    }) => {
      await seedSubscriptions(h, target);
      await notice(h, h.actors[0].id, target);
      const before = await snapshot(h);
      for (const reason of ["anonymous", "read_scope"] as const) {
        unauthorized(
          transport,
          await invoke(
            h,
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
    test(`young ${target} missing target preserves state through ${transport}`, async ({
      h,
    }) => {
      await seedSubscriptions(h, target);
      await notice(h, h.actors[0].id, target);
      const before = await snapshot(h);
      missingSubscription(
        transport,
        await invoke(
          h,
          transport,
          subscription(h, target, true, `${h.marker}-missing`),
          h.actors[0].tokens[transport],
        ),
      );
      expect(await snapshot(h)).toEqual(before);
    });
    test(`young ${target} remains personal during suspension through ${transport}`, async ({
      h,
    }) => {
      await seedSubscriptions(h, target);
      const owned = await notice(h, h.actors[0].id, target);
      const foreign = await notice(h, h.actors[1].id, target);
      await h.db.userSuspension.create({
        data: { userId: h.actors[0].id, reason: h.marker },
      });
      const before = await snapshot(h);
      for (const subscribed of [false, true]) {
        expect(
          successful(
            transport,
            await invoke(
              h,
              transport,
              subscription(h, target, subscribed),
              h.actors[0].tokens[transport],
            ),
          ),
        ).toMatchObject({ subscribed });
        const state = await snapshot(h);
        expect(
          selected(state, target).some((row) => row.userId === h.actors[0].id),
        ).toBe(subscribed);
        expect(
          selected(state, target).filter(
            (row) => row.userId !== h.actors[0].id,
          ),
        ).toEqual(
          selected(before, target).filter(
            (row) => row.userId !== h.actors[0].id,
          ),
        );
        expect(state.notices).toEqual([foreign]);
        expect(
          await h.db.youngNotification.findUnique({ where: { id: owned.id } }),
        ).toBeNull();
      }
    });
    test(`young ${target} unsubscribe removes only own unread notices through ${transport}`, async ({
      h,
    }) => {
      await seedSubscriptions(h, target);
      const unread = await notice(h, h.actors[0].id, target);
      await notice(h, h.actors[0].id, target, true);
      await notice(h, h.actors[1].id, target);
      const before = await snapshot(h);
      expect(
        successful(
          transport,
          await invoke(
            h,
            transport,
            subscription(h, target, false),
            h.actors[0].tokens[transport],
          ),
        ),
      ).toMatchObject({ subscribed: false });
      const after = await snapshot(h);
      expect(after.notices).toEqual(
        before.notices.filter((row) => row.id !== unread.id),
      );
      expect(selected(after, target)).toEqual(
        selected(before, target).filter((row) => row.userId !== h.actors[0].id),
      );
      expect(
        successful(
          transport,
          await invoke(
            h,
            transport,
            subscription(h, target, false),
            h.actors[0].tokens[transport],
          ),
        ),
      ).toMatchObject({ subscribed: false });
      expect(await snapshot(h)).toEqual(after);
    });
  }
for (const transport of transports) {
  test(`young notification rejects foreign and missing identifiers through ${transport}`, async ({
    h,
  }) => {
    const owned = await notice(h, h.actors[0].id, "event");
    await notice(h, h.actors[1].id, "event");
    const before = await snapshot(h);
    for (const [id, token] of [
      [owned.id, h.actors[1].tokens[transport]],
      [`${h.marker}-missing`, h.actors[0].tokens[transport]],
    ]) {
      missingNotification(
        transport,
        await invoke(h, transport, readNotice(id), token),
      );
      expect(await snapshot(h)).toEqual(before);
    }
  });
  test(`young notification authorization rejection preserves state through ${transport}`, async ({
    h,
  }) => {
    const owned = await notice(h, h.actors[0].id, "event");
    await notice(h, h.actors[1].id, "event");
    const before = await snapshot(h);
    for (const reason of ["anonymous", "read_scope"] as const) {
      unauthorized(
        transport,
        await invoke(
          h,
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
  test(`young notification read and replay preserve foreign state through ${transport}`, async ({
    h,
  }) => {
    const notices = await Promise.all(
      h.actors.map((a) => notice(h, a.id, "event")),
    );
    for (const [index, actor] of h.actors.entries()) {
      const before = await snapshot(h);
      expect(
        successful(
          transport,
          await invoke(
            h,
            transport,
            readNotice(notices[index].id),
            actor.tokens[transport],
          ),
        ),
      ).toMatchObject({ success: true });
      const after = await snapshot(h);
      expect(after.notices.filter((row) => row.userId !== actor.id)).toEqual(
        before.notices.filter((row) => row.userId !== actor.id),
      );
      const own = after.notices.find((row) => row.userId === actor.id);
      expect(own).toEqual({ ...notices[index], readAt: expect.any(Date) });
      expect(
        successful(
          transport,
          await invoke(
            h,
            transport,
            readNotice(notices[index].id),
            actor.tokens[transport],
          ),
        ),
      ).toMatchObject({ success: true });
      expect(await snapshot(h)).toEqual(after);
    }
  });
  test(`young notification remains personal during suspension through ${transport}`, async ({
    h,
  }) => {
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
          h,
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
}
