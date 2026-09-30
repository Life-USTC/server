import {
  getSectionForCalendar,
  getSectionsForCalendar,
  getUserCalendarRecord,
} from "@/features/calendar/server/calendar-export-data";
import { getCoursePage } from "@/features/catalog/server/course-page-data";
import {
  findSectionByJwId,
  findSectionDetailByJwId,
} from "@/features/catalog/server/course-section-read-queries";
import { findSectionCodeMatches } from "@/features/catalog/server/section-code-match-query";
import {
  listSectionSummaries,
  listSections,
} from "@/features/catalog/server/section-summary-read-model";
import { getTeacherPage } from "@/features/catalog/server/teacher-page-data";
import { listSubscribedSectionPage } from "@/features/subscriptions/server/subscription-section-page";
import {
  batchUpdateUserSectionSubscriptions,
  setUserSectionSubscriptionByJwId,
  subscribeUserToSectionByJwId,
  unsubscribeUserFromSectionByJwId,
} from "@/features/subscriptions/server/subscription-write-model";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";
import type { TestPrismaClient } from "../shared/prisma";

async function createSections(db: TestPrismaClient) {
  return db.$transaction(async (tx) => {
    const marker = crypto.randomUUID();
    const jwId = 2_145_000_000 + Math.floor(Math.random() * 100_000);
    const semester = await tx.semester.create({
      data: { jwId, code: marker, nameCn: marker },
    });
    const course = await tx.course.create({
      data: { jwId, code: marker, nameCn: marker },
    });
    const teacher = await tx.teacher.create({
      data: { jwId, code: marker, nameCn: marker },
    });
    const user = await tx.user.create({
      data: { email: `${marker}@retired.test`, name: marker },
    });
    const base = {
      courseId: course.id,
      semesterId: semester.id,
      teachers: { connect: { id: teacher.id } },
      sectionSubscriptions: { create: { userId: user.id } },
    };
    const active = await tx.section.create({
      data: { ...base, jwId, code: `active-${marker}` },
    });
    const retired = await tx.section.create({
      data: {
        ...base,
        jwId: jwId + 1,
        code: `retired-${marker}`,
        retiredAt: new Date("2026-01-01"),
      },
    });
    return { semester, course, teacher, user, active, retired };
  });
}

it("section.retired-read-semantics", async ({
  isolatedDatabase: { owner: db },
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { semester, course, teacher, user, active, retired } =
      await createSections(db);
    for (const reader of [listSections, listSectionSummaries]) {
      for (const search of [undefined, course.nameCn]) {
        const page = await reader({
          filters: { semesterId: String(semester.id), search },
          pagination: { page: 1, pageSize: 20 },
        });
        expect(page.data.map((item) => item.jwId)).toEqual([active.jwId]);
        expect(page.pagination.total).toBe(1);
      }
    }
    const matches = await findSectionCodeMatches(
      [active.code, retired.code],
      "zh-cn",
      semester.id,
    );
    expect(matches?.matchedCodes).toEqual([active.code]);
    expect(matches?.unmatchedCodes).toEqual([retired.code]);
    expect(matches?.sections.map((item) => item.jwId)).toEqual([active.jwId]);
    expect((await findSectionByJwId(retired.jwId))?.id).toBe(retired.id);
    expect((await findSectionDetailByJwId(retired.jwId))?.id).toBe(retired.id);
    expect((await getSectionForCalendar(retired.jwId))?.id).toBe(retired.id);
    expect(
      (await getSectionsForCalendar([active.id, retired.id])).map(
        (item) => item.id,
      ),
    ).toEqual([active.id]);
    expect(
      (await getUserCalendarRecord(user.id))?.sectionSubscriptions.map(
        (item) => item.sectionId,
      ),
    ).toEqual([active.id]);
    expect(
      (await getCoursePage(course.jwId))?.sections
        .map((item) => item.jwId)
        .sort(),
    ).toEqual([active.jwId, retired.jwId].sort());
    expect(
      (await getTeacherPage(teacher.id))?.sections
        .map((item) => item.jwId)
        .sort(),
    ).toEqual([active.jwId, retired.jwId].sort());
    const subscriptions = await listSubscribedSectionPage(user.id, {
      pagination: { page: 1, pageSize: 20 },
    });
    expect(subscriptions.data.map((item) => item.id).sort()).toEqual(
      [active.id, retired.id].sort(),
    );
    expect(subscriptions.pagination.total).toBe(2);
  });
});

it("section.retired-subscription-mutations", async ({
  isolatedDatabase: { owner: db },
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { user, active, retired } = await createSections(db);
    expect(
      await subscribeUserToSectionByJwId(user.id, retired.jwId),
    ).toBeNull();
    expect(
      await setUserSectionSubscriptionByJwId({
        userId: user.id,
        sectionJwId: retired.jwId,
        subscribed: true,
      }),
    ).toBeNull();
    const added = await batchUpdateUserSectionSubscriptions({
      userId: user.id,
      action: "add",
      sectionIds: [retired.id],
    });
    expect(added).toMatchObject({
      addedCount: 0,
      unmatchedSectionIds: [retired.id],
      total: 0,
    });
    expect(
      await db.userSectionSubscription.count({
        where: { userId: user.id, sectionId: retired.id },
      }),
    ).toBe(1);
    expect(
      await unsubscribeUserFromSectionByJwId(user.id, retired.jwId),
    ).not.toBeNull();
    expect(
      await db.userSectionSubscription.count({
        where: { userId: user.id, sectionId: retired.id },
      }),
    ).toBe(0);
    await db.userSectionSubscription.create({
      data: { userId: user.id, sectionId: retired.id },
    });
    expect(
      await batchUpdateUserSectionSubscriptions({
        userId: user.id,
        action: "remove",
        sectionIds: [retired.id],
      }),
    ).toMatchObject({ removedCount: 1, matchedSectionIds: [retired.id] });
    await db.userSectionSubscription.create({
      data: { userId: user.id, sectionId: retired.id },
    });
    expect(
      await setUserSectionSubscriptionByJwId({
        userId: user.id,
        sectionJwId: retired.jwId,
        subscribed: false,
      }),
    ).toEqual({ sectionJwId: retired.jwId, subscribed: false });
    expect(
      await db.userSectionSubscription.findMany({
        where: { userId: user.id },
        select: { sectionId: true },
      }),
    ).toEqual([{ sectionId: active.id }]);
  });
});
