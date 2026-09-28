import { afterEach, beforeEach, expect, it } from "vitest";
import { getSchedulesRoute } from "@/lib/api/routes/academic-schedule-routes";
import { getSectionSchedulesRoute } from "@/lib/api/routes/academic-section-routes";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createGraphqlYoga } from "@/lib/graphql/server";
import { mapSchedule, mergeSchedule } from "@/static-loader/mappers";
import { writeSchedules } from "@/static-loader/schedule-writes";
import { createFixturePrisma } from "../../../shared/prisma";
import { cleanupMcpResources } from "../_harness/cleanup";
import { createAnonymousMcpHarness, type McpHarness } from "../_harness/client";

const db = createFixturePrisma();
const marker = 2_020_000_000 + Math.floor(Math.random() * 100_000_000);
let client: McpHarness;
let courseId: number;
let sectionId: number;
let groupId: number;
const teacherIds: number[] = [];
const ownerId = crypto.randomUUID();
const otherId = crypto.randomUUID();
const facts = [
  { periods: 2.5, exerciseClass: false },
  { periods: 4, exerciseClass: true },
  { periods: null, exerciseClass: null },
];
function source(index: number) {
  return {
    lessonId: marker,
    scheduleGroupId: marker,
    date: "2026-09-11",
    weekday: 5,
    weekIndex: 1,
    startTime: 750,
    endTime: 925,
    startUnit: 0,
    endUnit: 0,
    ...facts[index],
  };
}
async function importMeeting(order: number[]) {
  const first = order[0];
  const meeting = mapSchedule(source(first), marker + first);
  for (const index of order.slice(1))
    mergeSchedule(meeting, source(index), marker + index);
  await db.$transaction((tx) =>
    writeSchedules(
      tx,
      [meeting],
      new Map([[marker, sectionId]]),
      new Map([[marker, groupId]]),
      new Map(),
      new Map(teacherIds.map((id, index) => [marker + index, id])),
      [sectionId],
    ),
  );
}
beforeEach(async () => {
  teacherIds.length = 0;
  courseId = 0;
  sectionId = 0;
  courseId = (
    await db.course.create({
      data: {
        jwId: marker,
        code: String(marker),
        nameCn: "排课中文",
        nameEn: "Schedule English",
      },
    })
  ).id;
  sectionId = (
    await db.section.create({
      data: { jwId: marker, code: `SCHEDULE.${marker}`, courseId },
    })
  ).id;
  groupId = (
    await db.scheduleGroup.create({
      data: {
        jwId: marker,
        sectionId,
        no: 1,
        stdCount: 0,
        limitCount: 0,
        actualPeriods: 4,
        isDefault: true,
      },
    })
  ).id;
  for (let index = 0; index < 3; index++)
    teacherIds.push(
      (
        await db.teacher.create({
          data: {
            jwId: marker + index,
            code: `SCHEDULE-${marker}-${index}`,
            nameCn: "同名教师",
            nameEn: `Teacher ${index}`,
          },
        })
      ).id,
    );
  await importMeeting([0, 1, 2]);
  await db.user.createMany({
    data: [ownerId, otherId].map((id) => ({
      id,
      name: "Schedule reader",
      email: `${id}@test.invalid`,
    })),
  });
  await db.userSectionSubscription.create({
    data: { userId: ownerId, sectionId },
  });
  client = await createAnonymousMcpHarness();
});
afterEach(async () => {
  await cleanupMcpResources([
    async () => {
      await client?.close();
    },
    async () => {
      await db.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    },
    async () => {
      if (sectionId) {
        await db.schedule.deleteMany({ where: { sectionId } });
        await db.scheduleGroup.deleteMany({ where: { sectionId } });
        await db.section.delete({ where: { id: sectionId } });
      }
    },
    async () => {
      await db.teacher.deleteMany({ where: { id: { in: teacherIds } } });
    },
    async () => {
      if (courseId) await db.course.delete({ where: { id: courseId } });
    },
    async () => {
      await Promise.all([db.$disconnect(), runtimePrisma.$disconnect()]);
    },
  ]);
});

type Teacher = { id: number; jwId: number; code: string; nameCn: string };
type Entry = {
  id: number;
  teachers: Teacher[];
  teacherParticipations: {
    teacher: Teacher;
    periods: number | null;
    exerciseClass: boolean | null;
  }[];
  section?: { course: { namePrimary: string } };
};
async function listRest(locale = "", headers?: HeadersInit) {
  const response = await getSchedulesRoute(
    new Request(
      `https://example.test/api/catalog/schedules?sectionId=${sectionId}${locale}`,
      { headers },
    ),
  );
  expect(response.status).toBe(200);
  return { response, body: (await response.json()) as { data: Entry[] } };
}

it("schedule.teacher-participation-facts", async () => {
  let scheduleId: number | undefined;
  for (const order of [
    [0, 1, 2],
    [2, 1, 0],
    [1, 0, 2],
  ]) {
    await importMeeting(order);
    const schedules = await db.schedule.findMany({
      where: { sectionId },
      include: { teacherParticipations: { orderBy: { teacherId: "asc" } } },
    });
    expect(schedules).toHaveLength(1);
    if (scheduleId) expect(schedules[0].id).toBe(scheduleId);
    scheduleId = schedules[0].id;
    expect(
      schedules[0].teacherParticipations.map(
        ({ teacherId, periods, exerciseClass }) => ({
          teacherId,
          periods,
          exerciseClass,
        }),
      ),
    ).toEqual(
      facts.map((fact, index) => ({ teacherId: teacherIds[index], ...fact })),
    );
    expect(schedules[0].exerciseClass).toBeNull();
    const { body } = await listRest();
    expect(
      body.data[0].teacherParticipations.map(({ periods, exerciseClass }) => ({
        periods,
        exerciseClass,
      })),
    ).toEqual(facts);
  }
});

it("schedule.teacher-participation-output", async () => {
  const { body } = await listRest();
  const detail = await getSectionSchedulesRoute(
    new Request(
      `https://example.test/api/catalog/sections/${marker}/schedules`,
    ),
    { jwId: String(marker) },
  );
  expect(detail.status).toBe(200);
  const mcpList = await client.call<{ data: Entry[] }>(
    "catalog_schedule_list",
    { sectionId, mode: "full" },
  );
  const mcpSection = await client.call<{ schedules: Entry[] }>(
    "catalog_section_schedule_list",
    { sectionJwId: marker, mode: "full" },
  );
  for (const rows of [
    body.data,
    (await detail.json()) as Entry[],
    mcpList.data,
    mcpSection.schedules,
  ]) {
    expect(rows).toHaveLength(1);
    const entry = rows[0];
    expect(
      entry.teachers.map(({ id, jwId, code, nameCn }) => ({
        id,
        jwId,
        code,
        nameCn,
      })),
    ).toEqual(
      teacherIds.map((id, index) => ({
        id,
        jwId: marker + index,
        code: `SCHEDULE-${marker}-${index}`,
        nameCn: "同名教师",
      })),
    );
    expect(entry.teachers).toEqual(
      entry.teacherParticipations.map(({ teacher }) => teacher),
    );
    expect(
      entry.teacherParticipations.map(({ periods, exerciseClass }) => ({
        periods,
        exerciseClass,
      })),
    ).toEqual(facts);
  }
});

it("schedule.public-rest-locale-cache", async () => {
  for (const locale of ["", "&locale=zh-cn", "&locale=en-us"]) {
    const { response: baseline, body } = await listRest(locale);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].section?.course.namePrimary).toBe(
      locale === "&locale=en-us" ? "Schedule English" : "排课中文",
    );
    expect(baseline.headers.get("cache-control")).toContain("public");
    for (const headers of [
      { cookie: "locale=en-us", "accept-language": "en-US" },
      { cookie: "locale=zh-cn", "accept-language": "zh-CN" },
    ]) {
      const variant = await listRest(locale, headers);
      expect(variant.body).toEqual(body);
      expect(variant.response.headers.get("cache-control")).toBe(
        baseline.headers.get("cache-control"),
      );
      expect(variant.response.headers.get("vary") ?? "").not.toMatch(
        /cookie|accept-language/i,
      );
    }
  }
});

it("schedule.graphql-teacher-participation-output", async () => {
  const query = `query($page: Int!) { workspace { schedules { items { id teachers(page: {page: $page, pageSize: 2}) { items { id jwId code nameCn } pageInfo { total } } teacherParticipations(page: {page: $page, pageSize: 2}) { items { teacher { id jwId code nameCn } periods exerciseClass } pageInfo { total } } } pageInfo { total } } } }`;
  const yoga = createGraphqlYoga(false);
  for (const userId of [ownerId, otherId]) {
    const actualTeachers: Teacher[] = [];
    const actualFacts: {
      teacher: Teacher;
      periods: number | null;
      exerciseClass: boolean | null;
    }[] = [];
    for (const page of [1, 2]) {
      const response = await yoga.fetch(
        "https://example.test/api/graphql",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query, variables: { page } }),
        },
        { locals: { locale: "zh-cn" }, principal: { kind: "session", userId } },
      );
      const body = await response.json();
      expect(body.errors).toBeUndefined();
      const schedules = body.data.workspace.schedules;
      expect(schedules.pageInfo.total).toBe(userId === ownerId ? 1 : 0);
      if (userId !== ownerId) {
        expect(schedules.items).toEqual([]);
        continue;
      }
      expect(schedules.items).toHaveLength(1);
      const meeting = schedules.items[0];
      expect(meeting.teachers.pageInfo.total).toBe(3);
      expect(meeting.teacherParticipations.pageInfo.total).toBe(3);
      expect(meeting.teachers.items).toHaveLength(page === 1 ? 2 : 1);
      expect(meeting.teacherParticipations.items).toHaveLength(
        page === 1 ? 2 : 1,
      );
      actualTeachers.push(...meeting.teachers.items);
      actualFacts.push(...meeting.teacherParticipations.items);
    }
    if (userId === ownerId) {
      expect(actualTeachers).toEqual(
        teacherIds.map((id, index) => ({
          id,
          jwId: marker + index,
          code: `SCHEDULE-${marker}-${index}`,
          nameCn: "同名教师",
        })),
      );
      expect(actualFacts.map(({ teacher }) => teacher)).toEqual(actualTeachers);
      expect(
        actualFacts.map(({ periods, exerciseClass }) => ({
          periods,
          exerciseClass,
        })),
      ).toEqual(facts);
    }
  }
});
