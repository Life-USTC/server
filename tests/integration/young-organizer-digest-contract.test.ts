import { refreshYoungNotifications } from "@/features/young/server/young-notification-service";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

it("young-workspace.digest", async ({ isolatedDatabase: { owner: fixture }, protocolRuntime, expect }) => {
  await protocolRuntime.run(async () => {
  const marker = crypto.randomUUID();
  const now = new Date("2035-09-15T10:00:00+08:00");
  const followAt = new Date("2035-09-14T12:00:00+08:00");
  const user = await fixture.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { email: `${marker}@digest.test`, name: "Digest owner" },
  });
  const organizers = await Promise.all(
    ["club", "other", "new"].map((name) =>
      tx.youngOrganizer.create({
        data: { name, normalizedName: `${name}-${marker}` },
      }),
    ),
  );
    await tx.userYoungOrganizerSubscription.createMany({
      data: organizers.map((organizer, index) => ({
        userId: user.id,
        organizerId: organizer.id,
        createdAt:
          index === 2
            ? now
            : index === 1
              ? new Date("2035-09-13T12:00:00+08:00")
              : followAt,
      })),
    });
    await tx.youngEvent.createMany({
      data: [
        {
          label: "eligible-A",
          organizer: 0,
          created: "2035-09-14T13:00:00+08:00",
          starts: "2035-09-16T10:00:00+08:00",
        },
        {
          label: "eligible-B",
          organizer: 0,
          created: "2035-09-14T23:59:59+08:00",
          starts: "2035-09-17T10:00:00+08:00",
        },
        {
          label: "at-day-start",
          organizer: 1,
          created: "2035-09-14T00:00:00+08:00",
          starts: "2035-09-15T12:00:00+08:00",
        },
        {
          label: "other-organizer",
          organizer: 1,
          created: "2035-09-14T13:00:00+08:00",
          starts: "2035-09-16T10:00:00+08:00",
        },
        {
          label: "before-follow",
          organizer: 0,
          created: "2035-09-14T11:59:59+08:00",
          starts: "2035-09-16T10:00:00+08:00",
        },
        {
          label: "at-follow",
          organizer: 0,
          created: "2035-09-14T12:00:00+08:00",
          starts: "2035-09-16T10:00:00+08:00",
        },
        {
          label: "today",
          organizer: 0,
          created: "2035-09-15T00:00:00+08:00",
          starts: "2035-09-16T10:00:00+08:00",
        },
        {
          label: "old",
          organizer: 0,
          created: "2035-09-13T23:00:00+08:00",
          starts: "2035-09-16T10:00:00+08:00",
        },
        {
          label: "started",
          organizer: 0,
          created: "2035-09-14T13:00:00+08:00",
          starts: "2035-09-15T09:59:59+08:00",
        },
        {
          label: "missing",
          organizer: 0,
          created: "2035-09-14T13:00:00+08:00",
          starts: "2035-09-16T10:00:00+08:00",
        },
        {
          label: "new-follow",
          organizer: 2,
          created: "2035-09-14T13:00:00+08:00",
          starts: "2035-09-16T10:00:00+08:00",
        },
      ].map((event) => ({
        youngId: `${marker}-${event.label}`,
        name: event.label,
        organizerId: organizers[event.organizer].id,
        createdAt: new Date(event.created),
        startAt: new Date(event.starts),
        sourceMissing: event.label === "missing",
        isActive: true,
        rawJson: {},
      })),
    });
    return user;
  });
    await refreshYoungNotifications(user.id, now);
    await refreshYoungNotifications(user.id, now);
    const notices = await fixture.youngNotification.findMany({
      where: { userId: user.id },
      orderBy: { title: "asc" },
      select: { title: true, body: true, kind: true },
    });
    expect(notices).toEqual([
      {
        title: "club",
        body: "2 个新活动 / new events: eligible-A · eligible-B",
        kind: "organizer_digest",
      },
      {
        title: "other",
        body: "2 个新活动 / new events: at-day-start · other-organizer",
        kind: "organizer_digest",
      },
    ]);
    expect(
      await fixture.userYoungEventSubscription.count({
        where: { userId: user.id },
      }),
    ).toBe(0);
  });
});
