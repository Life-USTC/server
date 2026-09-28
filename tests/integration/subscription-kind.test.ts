import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
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
import { assertSubscriptionKindTransportAuthority } from "../shared/personal-state-write-parity";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
let userIds: string[] = [];
let sectionId: number;
let sectionJwId: number;
let sectionCode: string;
let semesterId: number;

beforeAll(async () => {
  const section = await db.section.findFirstOrThrow({
    where: {
      retiredAt: null,
      semesterId: { not: null },
      schedules: { some: {} },
    },
    select: { id: true, jwId: true, code: true, semesterId: true },
  });
  sectionId = section.id;
  sectionJwId = section.jwId;
  sectionCode = section.code;
  semesterId = section.semesterId as number;
});
beforeEach(async () => {
  userIds = [crypto.randomUUID(), crypto.randomUUID()];
  await db.user.createMany({
    data: userIds.map((id) => ({
      id,
      email: `${id}@subscription-kind.test`,
      name: "Subscription kind test",
    })),
  });
});
afterEach(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});
afterAll(() => db.$disconnect());

describe("personal subscription kinds", () => {
  it("subscription.kind-owner-existing-only", async () => {
    await assertSubscriptionKindTransportAuthority();
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
    for (const kind of ["regular", "auditor", "teaching_assistant"] as const) {
      expect(
        await updateSubscriptionKind({ userId: userIds[0], sectionJwId, kind }),
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

  it("subscription.ta-calendar", async () => {
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

it("subscription.personal-kind", async () => {
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

describe.each(["regular", "auditor", "teaching_assistant"] as const)(
  "existing %s subscription",
  (kind) => {
    it.each(["append", "batch add", "code import"] as const)(
      "%s preserves the existing kind and creation timestamp",
      async (operation) => {
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
      },
    );
  },
);
