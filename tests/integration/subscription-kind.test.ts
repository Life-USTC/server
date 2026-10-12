import { describe, expect } from "vitest";
import {
  getSectionForCalendar,
  getUserCalendarRecord,
} from "@/features/calendar/server/calendar-export-data";
import { buildUserCalendarExport } from "@/features/calendar/server/calendar-export-service";
import { createSectionCalendar } from "@/features/calendar/server/ical";
import { getUserCalendarSubscription } from "@/features/subscriptions/server/subscription-calendar-read-model";
import { updateSubscriptionKind } from "@/features/subscriptions/server/subscription-kind";
import {
  appendUserSectionSubscriptions,
  batchUpdateUserSectionSubscriptions,
  importUserSectionSubscriptionsByCodes,
} from "@/features/subscriptions/server/subscription-write-model";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

const it = nodeProtocolTest.extend(
  "subscription",
  async ({ isolatedDatabase: { owner: db }, protocolRuntime }) =>
    protocolRuntime.run(() =>
      db.$transaction(async (tx) => {
        const userIds = [crypto.randomUUID(), crypto.randomUUID()];
        await tx.user.createMany({
          data: userIds.map((id) => ({
            id,
            email: `${id}@subscription-kind.test`,
            name: "Subscription kind test",
          })),
        });
        const semester = await tx.semester.create({
          data: { jwId: 1, code: "subscription-kind", nameCn: "订阅类型学期" },
        });
        const course = await tx.course.create({
          data: { jwId: 1, code: "SUBSCRIPTION", nameCn: "订阅类型课程" },
        });
        const section = await tx.section.create({
          data: {
            jwId: 1,
            code: "SUBSCRIPTION.01",
            courseId: course.id,
            semesterId: semester.id,
          },
        });
        const group = await tx.scheduleGroup.create({
          data: {
            jwId: 1,
            sectionId: section.id,
            no: 1,
            limitCount: 30,
            stdCount: 10,
            actualPeriods: 2,
            isDefault: true,
          },
        });
        await tx.schedule.create({
          data: {
            sectionId: section.id,
            scheduleGroupId: group.id,
            date: new Date("2026-04-29T00:00:00Z"),
            weekday: 3,
            startTime: 800,
            endTime: 935,
            startUnit: 1,
            endUnit: 2,
            periods: 2,
            weekIndex: 10,
          },
        });
        await tx.exam.create({
          data: {
            jwId: 1,
            sectionId: section.id,
            examDate: new Date("2026-06-29T00:00:00Z"),
            startTime: 900,
            endTime: 1100,
          },
        });
        return {
          db,
          userIds,
          sectionId: section.id,
          sectionJwId: section.jwId,
          sectionCode: section.code,
          semesterId: semester.id,
        };
      }),
    ),
);

describe("personal subscription kinds", () => {
  it("subscription.kind-owner-existing-only", {
    tags: ["@Subscription/Service"],
  }, async ({ subscription, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const { userIds, sectionJwId, sectionId } = subscription;
      expect(
        await updateSubscriptionKind({
          userId: userIds[0],
          sectionJwId,
          kind: "auditor",
        }),
      ).toBeNull();
      await appendUserSectionSubscriptions({
        userId: userIds[0],
        sectionIds: [sectionId],
      });
      expect(
        (await getUserCalendarSubscription(userIds[0]))?.sections[0].kind,
      ).toBe("regular");
      await updateSubscriptionKind({
        userId: userIds[0],
        sectionJwId,
        kind: "teaching_assistant",
      });
      expect(
        await updateSubscriptionKind({
          userId: userIds[1],
          sectionJwId,
          kind: "auditor",
        }),
      ).toBeNull();
      const added = await appendUserSectionSubscriptions({
        userId: userIds[0],
        sectionIds: [sectionId, sectionId, 999_999_999],
      });
      expect(added).toMatchObject({ addedCount: 0, alreadySubscribedCount: 1 });
      expect(
        (await getUserCalendarSubscription(userIds[0]))?.sections,
      ).toMatchObject([{ kind: "teaching_assistant" }]);
      for (const kind of [
        "regular",
        "auditor",
        "teaching_assistant",
      ] as const) {
        expect(
          await updateSubscriptionKind({
            userId: userIds[0],
            sectionJwId,
            kind,
          }),
        ).toEqual({ sectionJwId, kind });
        expect(
          (await getUserCalendarSubscription(userIds[0]))?.sections[0].kind,
        ).toBe(kind);
      }
      await expect(
        updateSubscriptionKind({
          userId: userIds[0],
          sectionJwId,
          kind: "invalid" as "regular",
        }),
      ).rejects.toThrow();
    });
  });

  it("subscription.ta-calendar", { tags: ["@Subscription/Service"] }, async ({
    subscription,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const { userIds, sectionId, sectionJwId } = subscription;
      await appendUserSectionSubscriptions({
        userId: userIds[0],
        sectionIds: [sectionId],
      });
      await updateSubscriptionKind({
        userId: userIds[0],
        sectionJwId,
        kind: "regular",
      });
      const regularRecord = await getUserCalendarRecord(userIds[0]);
      if (!regularRecord) throw new Error("Expected test user");
      const regular = await buildUserCalendarExport(regularRecord, userIds[0]);
      await updateSubscriptionKind({
        userId: userIds[0],
        sectionJwId,
        kind: "teaching_assistant",
      });
      const taRecord = await getUserCalendarRecord(userIds[0]);
      if (!taRecord) throw new Error("Expected test user");
      const ta = await buildUserCalendarExport(taRecord, userIds[0]);
      expect(ta.text).toContain("SUMMARY:[TA] ");
      expect(regular.text).not.toContain("SUMMARY:[TA] ");
      const courseEventIds = (text: string) =>
        [...text.matchAll(/^UID:(.*)$/gm)]
          .map((match) => match[1])
          .filter((uid) => /\/(schedule|exam)\//.test(uid));
      expect(courseEventIds(regular.text).length).toBeGreaterThan(0);
      expect(
        courseEventIds(regular.text).some((uid) => uid.includes("/schedule/")),
      ).toBe(true);
      expect(
        courseEventIds(regular.text).some((uid) => uid.includes("/exam/")),
      ).toBe(true);
      expect(courseEventIds(ta.text)).toEqual(courseEventIds(regular.text));
      const section = await getSectionForCalendar(sectionJwId);
      if (!section) throw new Error("Expected test section");
      expect((await createSectionCalendar(section)).toString()).not.toContain(
        "SUMMARY:[TA] ",
      );
      expect(
        taRecord?.sectionSubscriptions[0].section.course.nameCn,
      ).not.toContain("[TA]");
    });
  });
});

it("subscription.personal-kind", { tags: ["@Subscription/Service"] }, async ({
  subscription,
  protocolRuntime,
}) => {
  await protocolRuntime.run(async () => {
    const { db, userIds, sectionId } = subscription;
    const before = await db.userSectionSubscription.findUnique({
      where: { userId_sectionId: { userId: userIds[0], sectionId } },
    });
    expect(before).toBeNull();
    await appendUserSectionSubscriptions({
      userId: userIds[0],
      sectionIds: [sectionId],
    });
    expect(
      await db.userSectionSubscription.findUnique({
        where: { userId_sectionId: { userId: userIds[0], sectionId } },
        select: { kind: true },
      }),
    ).toEqual({ kind: "regular" });
    const rows = await db.userSectionSubscription.findMany({
      where: { userId: userIds[0], sectionId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("regular");
    expect(
      (await getUserCalendarSubscription(userIds[0]))?.sections.map(
        (section) => section.kind,
      ),
    ).toEqual(["regular"]);
  });
});

describe.each(["regular", "auditor", "teaching_assistant"] as const)(
  "existing %s subscription",
  (kind) => {
    it.for(["append", "batch add", "code import"] as const)(
      "%s preserves the existing kind and creation timestamp",
      { tags: ["@Subscription/Service"] },
      async (operation, { subscription, protocolRuntime }) => {
        await protocolRuntime.run(async () => {
          const { db, userIds, sectionId, semesterId, sectionCode } =
            subscription;
          const before = await db.userSectionSubscription.create({
            data: { userId: userIds[0], sectionId, kind },
          });
          if (operation === "append") {
            await appendUserSectionSubscriptions({
              userId: userIds[0],
              sectionIds: [sectionId, sectionId],
            });
          } else if (operation === "batch add") {
            await batchUpdateUserSectionSubscriptions({
              userId: userIds[0],
              sectionIds: [sectionId],
              action: "add",
            });
          } else {
            await importUserSectionSubscriptionsByCodes({
              userId: userIds[0],
              semesterId,
              codes: [sectionCode],
            });
          }
          expect(
            await db.userSectionSubscription.findMany({
              where: { userId: userIds[0], sectionId },
            }),
          ).toEqual([before]);
        });
      },
    );
  },
);
