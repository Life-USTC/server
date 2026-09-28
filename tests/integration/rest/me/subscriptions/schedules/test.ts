import { expect } from "@playwright/test";
import { subscribedSchedulesResponseSchema } from "@/lib/api/schemas/schedule-response-schema-core";
import { DEV_SEED } from "../../../../../fixtures/dev-seed";
import { test } from "../../../calendar-subscriptions/_fixture";

const base = "/api/workspace/schedules";

test("anonymous schedule read returns JSON 401", async ({ request }) => {
  const response = await request.get(base);
  expect(response.status()).toBe(401);
  expect((await response.json()).error).toEqual(expect.any(String));
});

test("known subscriptions return only their schedules with localized teacher details", async ({
  calendarState,
}) => {
  const { db, owner, other, section, scheduleGroupId, teacherId } =
    calendarState;
  await db.userSectionSubscription.create({
    data: { userId: owner.id, sectionId: section.id },
  });
  const first = await db.schedule.create({
    data: {
      sectionId: section.id,
      scheduleGroupId,
      date: new Date("2026-04-29T00:00:00Z"),
      weekday: 3,
      startTime: 900,
      endTime: 1000,
      periods: 2,
      weekIndex: 1,
      startUnit: 1,
      endUnit: 2,
      teacherParticipations: { create: { teacherId } },
    },
  });
  await db.schedule.create({
    data: {
      sectionId: section.id,
      scheduleGroupId,
      date: new Date("2026-04-30T00:00:00Z"),
      weekday: 4,
      startTime: 900,
      endTime: 1000,
      periods: 2,
      weekIndex: 1,
      startUnit: 1,
      endUnit: 2,
    },
  });
  const response = await owner.request.get(
    `${base}?dateFrom=2026-04-29&dateTo=2026-04-29&limit=5`,
  );
  expect(response.status()).toBe(200);
  const body = subscribedSchedulesResponseSchema.parse(await response.json());
  expect(body.schedules).toHaveLength(1);
  expect(body.schedules[0]).toMatchObject({
    id: first.id,
    date: expect.stringMatching(/^2026-04-29/),
    startTime: "09:00",
    endTime: "10:00",
    section: { code: section.code, course: { nameCn: DEV_SEED.course.nameCn } },
    teachers: [
      expect.objectContaining({
        jwId: DEV_SEED.teacher.jwId,
        namePrimary: DEV_SEED.teacher.nameCn,
        nameSecondary: DEV_SEED.teacher.nameEn,
        department: expect.objectContaining({
          namePrimary: DEV_SEED.teacher.departmentNameCn,
        }),
        teacherTitle: expect.objectContaining({
          namePrimary: DEV_SEED.teacher.titleNameCn,
        }),
      }),
    ],
  });
  expect(body.schedules[0].teachers[0]._count.sections).toBeGreaterThan(0);
  const unrelated = await other.request.get(base);
  expect(unrelated.status()).toBe(200);
  expect((await unrelated.json()).schedules).toEqual([]);
});

test("invalid schedule date returns 400", async ({ createActor }) => {
  const owner = await createActor();
  const response = await owner.request.get(`${base}?dateFrom=not-a-date`);
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toEqual(expect.any(String));
});
