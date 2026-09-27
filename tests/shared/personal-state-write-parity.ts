import { expect } from "vitest";
import {
  createWriteTransportHarness,
  type Operation,
  transports,
} from "./write-transport-harness";

export function busPreference(
  origin: number | null,
  destination: number | null,
  departed: boolean,
): Operation {
  const input = {
    preferredOriginCampusId: origin,
    preferredDestinationCampusId: destination,
    showDepartedTrips: departed,
  };
  return {
    rest: {
      path: "/api/workspace/bus-preferences",
      method: "POST",
      body: input,
    },
    graphql: {
      field: "busPreferencesSet",
      query:
        "mutation($input: BusPreferenceInput!) { busPreferencesSet(input:$input) { preferredOriginCampusId preferredDestinationCampusId showDepartedTrips } }",
      variables: { input },
    },
    mcp: { name: "workspace_bus_preferences_set", arguments: input },
  };
}
export function linkPin(slug: string, pinned: boolean): Operation {
  return {
    rest: {
      path: "/api/workspace/link-pins",
      method: "POST",
      form: {
        slug,
        action: pinned ? "pin" : "unpin",
        returnTo: "/catalog/links",
      },
    },
    graphql: {
      field: "linkPinSet",
      query:
        "mutation($slug:String!, $pinned:Boolean!) { linkPinSet(slug:$slug,pinned:$pinned) { pinnedSlugs } }",
      variables: { slug, pinned },
    },
    mcp: {
      name: "workspace_link_pin_set",
      arguments: { slug, action: pinned ? "pin" : "unpin" },
    },
  };
}
function subscriptionKind(jwId: number, kind: string): Operation {
  return {
    rest: {
      path: `/api/workspace/subscriptions/${jwId}`,
      method: "PATCH",
      body: { kind },
    },
    graphql: {
      field: "subscriptionKindUpdate",
      query:
        "mutation($id:Int!, $kind:SubscriptionKind!) { subscriptionKindUpdate(jwId:$id,kind:$kind) { kind sectionJwId } }",
      variables: { id: jwId, kind },
    },
    mcp: {
      name: "workspace_subscription_kind_update",
      arguments: { jwId, kind },
    },
  };
}
function youngSubscription(
  id: string,
  organizer: boolean,
  subscribed: boolean,
): Operation {
  const field = organizer
    ? "youngOrganizerSubscriptionSet"
    : "youngEventSubscriptionSet";
  return {
    rest: {
      path: `/api/workspace/young-${organizer ? "organizer" : "event"}-subscriptions/${id}`,
      method: "PUT",
      body: { subscribed },
    },
    graphql: {
      field,
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
function notificationRead(id: string): Operation {
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

export async function assertSubscriptionKindTransportAuthority() {
  const h = await createWriteTransportHarness(["workspace.subscription"]);
  const [owner, other] = h.actors;
  try {
    await h.db.userSectionSubscription.create({
      data: { userId: owner.id, sectionId: h.section.id },
    });
    const rows = () =>
      h.db.userSectionSubscription.findMany({
        where: { userId: { in: h.actors.map((a) => a.id) } },
        orderBy: { userId: "asc" },
      });
    const original = await rows();
    for (const transport of transports) {
      await h.call(
        transport,
        subscriptionKind(h.section.jwId, "auditor"),
        other,
        "not_found",
      );
      await h.call(
        transport,
        subscriptionKind(h.section.id, "auditor"),
        owner,
        "not_found",
      );
      for (const outcome of ["anonymous", "read_scope"] as const)
        await h.call(
          transport,
          subscriptionKind(h.section.jwId, "auditor"),
          owner,
          outcome,
        );
    }
    expect(await rows()).toEqual(original);
    for (const transport of transports)
      for (const kind of ["regular", "auditor", "teaching_assistant"]) {
        const result = await h.call(
          transport,
          subscriptionKind(h.section.jwId, kind),
          owner,
        );
        expect(result).toMatchObject({ sectionJwId: h.section.jwId, kind });
        expect(await rows()).toMatchObject([{ userId: owner.id, kind }]);
      }
    await h.db.userSuspension.create({
      data: { userId: owner.id, reason: h.fixture.marker },
    });
    for (const transport of transports) {
      await h.call(
        transport,
        subscriptionKind(h.section.jwId, "regular"),
        owner,
      );
      await h.call(
        transport,
        subscriptionKind(h.section.jwId, "auditor"),
        owner,
      );
      expect(await rows()).toMatchObject([
        { userId: owner.id, kind: "auditor" },
      ]);
    }
  } finally {
    await h.cleanup();
  }
}

export async function assertYoungWriteTransportAuthority() {
  const h = await createWriteTransportHarness([
    "workspace.young-subscription",
    "workspace.young-notification",
  ]);
  const youngId = `${h.fixture.marker}-event`;
  const organizerId = `${h.fixture.marker}-organizer`;
  const [owner, other] = h.actors;
  try {
    await h.db.youngOrganizer.create({
      data: { id: organizerId, name: organizerId, normalizedName: organizerId },
    });
    await h.db.youngEvent.create({
      data: {
        youngId,
        name: youngId,
        organizerId,
        rawJson: {},
        isActive: true,
      },
    });
    const notice = await h.db.youngNotification.create({
      data: {
        id: `${h.fixture.marker}-notice`,
        userId: owner.id,
        youngId,
        kind: "event_changed",
        title: "Owned notice",
        body: "Private body",
        dedupeKey: h.fixture.marker,
      },
    });
    const snapshot = async () => ({
      subscriptions: await h.db.userYoungEventSubscription.findMany({
        where: { youngId },
        orderBy: { userId: "asc" },
      }),
      follows: await h.db.userYoungOrganizerSubscription.findMany({
        where: { organizerId },
        orderBy: { userId: "asc" },
      }),
      notice: await h.db.youngNotification.findUnique({
        where: { id: notice.id },
      }),
    });
    const before = await snapshot();
    for (const transport of transports) {
      await h.call(
        transport,
        notificationRead(notice.id),
        other,
        "missing_notification",
      );
      await h.call(
        transport,
        notificationRead(`${h.fixture.marker}-missing`),
        owner,
        "missing_notification",
      );
      for (const operation of [
        youngSubscription(youngId, false, true),
        youngSubscription(organizerId, true, true),
        notificationRead(notice.id),
      ])
        for (const outcome of ["anonymous", "read_scope"] as const)
          await h.call(transport, operation, owner, outcome);
      for (const organizer of [false, true])
        await h.call(
          transport,
          youngSubscription(`${h.fixture.marker}-missing`, organizer, true),
          owner,
          "young_not_found",
        );
    }
    expect(await snapshot()).toEqual(before);
    for (const transport of transports) {
      for (const actor of h.actors) {
        for (const [id, organizer] of [
          [youngId, false],
          [organizerId, true],
        ] as const) {
          const result = await h.call(
            transport,
            youngSubscription(id, organizer, true),
            actor,
          );
          expect(result).toMatchObject({ subscribed: true });
          const state = await snapshot();
          expect(
            (organizer ? state.follows : state.subscriptions).some(
              (row) => row.userId === actor.id,
            ),
          ).toBe(true);
        }
      }
      const foreignBefore = await snapshot();
      for (const [id, organizer] of [
        [youngId, false],
        [organizerId, true],
      ] as const)
        expect(
          await h.call(
            transport,
            youngSubscription(id, organizer, false),
            other,
          ),
        ).toMatchObject({ subscribed: false });
      const after = await snapshot();
      expect(after.subscriptions).toEqual(
        foreignBefore.subscriptions.filter((row) => row.userId === owner.id),
      );
      expect(after.follows).toEqual(
        foreignBefore.follows.filter((row) => row.userId === owner.id),
      );
      expect(after.notice).toEqual(notice);
    }
    await h.db.userSuspension.create({
      data: { userId: owner.id, reason: h.fixture.marker },
    });
    for (const transport of transports) {
      for (const [id, organizer] of [
        [youngId, false],
        [organizerId, true],
      ] as const) {
        await h.call(transport, youngSubscription(id, organizer, false), owner);
        await h.call(transport, youngSubscription(id, organizer, true), owner);
      }
      // Unsubscribe removes unread notices, so create an isolated fresh notice for each transport.
      const ownNotice = await h.db.youngNotification.create({
        data: {
          userId: owner.id,
          youngId,
          kind: "event_changed",
          title: "Suspended owner's notice",
          body: "Private",
          dedupeKey: `${h.fixture.marker}-${transport}`,
        },
      });
      await h.call(transport, notificationRead(ownNotice.id), owner);
      expect(
        (
          await h.db.youngNotification.findUniqueOrThrow({
            where: { id: ownNotice.id },
          })
        ).readAt,
      ).not.toBeNull();
    }
  } finally {
    await h.db.youngNotification.deleteMany({ where: { youngId } });
    await h.db.userYoungEventSubscription.deleteMany({ where: { youngId } });
    await h.db.userYoungOrganizerSubscription.deleteMany({
      where: { organizerId },
    });
    await h.db.youngEvent.deleteMany({ where: { youngId } });
    await h.db.youngOrganizer.deleteMany({ where: { id: organizerId } });
    await h.cleanup();
  }
}

function homeworkCompletion(homeworkId: string, completed: boolean): Operation {
  return {
    rest: {
      path: `/api/workspace/homeworks/${homeworkId}/completion`,
      method: "PUT",
      body: { completed },
    },
    graphql: {
      field: "homeworkCompletionSet",
      query:
        "mutation($id:ID!, $completed:Boolean!) { homeworkCompletionSet(homeworkId:$id,completed:$completed) { homeworkId completed completedAt } }",
      variables: { id: homeworkId, completed },
    },
    mcp: {
      name: "workspace_homework_completion_set",
      arguments: { homeworkId, completed },
    },
  };
}

export async function assertHomeworkCompletionTransportOwnership() {
  const h = await createWriteTransportHarness(["workspace.homework"]);
  try {
    const homework = await h.db.homework.create({
      data: {
        sectionId: h.section.id,
        createdById: h.actors[0].id,
        title: "Shared homework",
      },
    });
    const deleted = await h.db.homework.create({
      data: {
        sectionId: h.section.id,
        createdById: h.actors[0].id,
        title: "Deleted homework",
        deletedAt: new Date(),
      },
    });
    for (const actor of h.actors)
      await h.db.homeworkCompletion.create({
        data: { homeworkId: homework.id, userId: actor.id },
      });
    const rows = () =>
      h.db.homeworkCompletion.findMany({
        where: { homeworkId: homework.id },
        orderBy: { userId: "asc" },
      });
    for (const transport of transports)
      for (const actor of h.actors) {
        const foreignBefore = (await rows()).filter(
          (row) => row.userId !== actor.id,
        );
        for (const completed of [false, true]) {
          const result = await h.call(
            transport,
            homeworkCompletion(homework.id, completed),
            actor,
          );
          const actual = transport === "mcp" ? result.completion : result;
          expect(actual.completed).toBe(completed);
          const own = (await rows()).find((row) => row.userId === actor.id);
          expect(
            actual.completedAt === null
              ? null
              : new Date(actual.completedAt).getTime(),
          ).toBe(own?.completedAt.getTime() ?? null);
          expect(
            (await rows()).filter((row) => row.userId !== actor.id),
          ).toEqual(foreignBefore);
        }
      }
    const before = await h.snapshot();
    for (const transport of transports) {
      for (const outcome of ["anonymous", "read_scope"] as const)
        await h.call(
          transport,
          homeworkCompletion(homework.id, false),
          h.actors[0],
          outcome,
        );
      for (const id of [deleted.id, `${h.fixture.marker}-missing`])
        for (const completed of [true, false])
          await h.call(
            transport,
            homeworkCompletion(id, completed),
            h.actors[0],
            "not_found",
          );
      expect(await h.snapshot()).toEqual(before);
    }
    await h.db.userSuspension.create({
      data: { userId: h.actors[0].id, reason: h.fixture.marker },
    });
    const foreignBefore = (await rows()).filter(
      (row) => row.userId !== h.actors[0].id,
    );
    for (const transport of transports)
      for (const completed of [false, true]) {
        await h.call(
          transport,
          homeworkCompletion(homework.id, completed),
          h.actors[0],
        );
        expect(
          (await rows()).some((row) => row.userId === h.actors[0].id),
        ).toBe(completed);
        expect(
          (await rows()).filter((row) => row.userId !== h.actors[0].id),
        ).toEqual(foreignBefore);
      }
    expect(
      await h.db.homework.findUnique({ where: { id: homework.id } }),
    ).toEqual(homework);
    expect(
      await h.db.homework.findUnique({ where: { id: deleted.id } }),
    ).toEqual(deleted);
  } finally {
    await h.cleanup();
  }
}
