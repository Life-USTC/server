import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getSectionForCalendar,
  getUserCalendarRecord,
} from "@/features/calendar/server/calendar-export-data";
import { buildUserCalendarExport } from "@/features/calendar/server/calendar-export-service";
import { createSectionCalendar } from "@/features/calendar/server/ical";
import { getUserCalendarSubscription } from "@/features/subscriptions/server/subscription-calendar-read-model";
import { updateSubscriptionKind } from "@/features/subscriptions/server/subscription-kind";
import { appendUserSectionSubscriptions } from "@/features/subscriptions/server/subscription-write-model";
import { createTestPrisma } from "../shared/prisma";

const db = createTestPrisma();
const userIds = [crypto.randomUUID(), crypto.randomUUID()];
let sectionId: number;
let sectionJwId: number;

beforeAll(async () => {
  const section = await db.section.findFirstOrThrow({
    where: { retiredAt: null, schedules: { some: {} } },
    select: { id: true, jwId: true },
  });
  sectionId = section.id;
  sectionJwId = section.jwId;
  await db.user.createMany({
    data: userIds.map((id) => ({
      id,
      email: `${id}@subscription-kind.test`,
      name: "Subscription kind test",
    })),
  });
});
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

describe("personal subscription kinds", () => {
  it("only updates existing owner subscriptions and preserves kinds on repeated additions", async () => {
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
    await expect(
      updateSubscriptionKind({
        userId: userIds[0],
        sectionJwId,
        kind: "invalid" as "regular",
      }),
    ).rejects.toThrow();
  });

  it("prefixes personal TA calendar events without altering public names or event IDs", async () => {
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
    expect([...ta.text.matchAll(/^UID:(.*)$/gm)].map((m) => m[1])).toEqual(
      [...regular.text.matchAll(/^UID:(.*)$/gm)].map((m) => m[1]),
    );
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
