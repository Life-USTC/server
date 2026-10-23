import { expect } from "@playwright/test";
import { test } from "../../../_shared/public-academic-fixture";

test("/api/catalog/sections/[jwId]/schedules 契约", {
  tag: "@Schedule/REST",
}, async ({ run, request, academic }) => {
  await run(async () => {
    const response = await request.get(
      `/api/catalog/sections/${academic.section.jwId}/schedules`,
    );
    expect(response.status()).toBe(200);
    expect(
      ((await response.json()) as Array<{ id?: number }>).length,
    ).toBeGreaterThan(0);
  });
});

test("/api/catalog/sections/[jwId]/schedules 返回排课明细", {
  tag: "@Schedule/REST",
}, async ({ run, request, academic }) => {
  await run(async () => {
    const response = await request.get(
      `/api/catalog/sections/${academic.section.jwId}/schedules`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Array<{
      id: number;
      scheduleGroup?: { id?: number };
      teachers?: Array<{ nameCn?: string }>;
    }>;
    expect(body.length).toBeGreaterThan(0);
    expect(body.some((item) => Boolean(item.scheduleGroup?.id))).toBe(true);
    expect(
      body.some((item) =>
        item.teachers?.some(
          (teacher) => teacher.nameCn === academic.teacher.nameCn,
        ),
      ),
    ).toBe(true);
    expect(body.map((item) => item.id)).toEqual([
      academic.schedules[3].id,
      academic.schedules[2].id,
      academic.schedules[1].id,
      academic.schedules[0].id,
    ]);
    expect(body[0]).toMatchObject({
      scheduleGroup: { id: academic.defaultGroup.id },
      teachers: [
        {
          id: academic.teacher.id,
          jwId: academic.teacher.jwId,
          personId: academic.teacher.personId,
          code: academic.teacher.code,
          nameCn: academic.teacher.nameCn,
        },
      ],
      teacherParticipations: [
        {
          teacher: { id: academic.teacher.id },
          periods: 2,
          exerciseClass: false,
        },
      ],
    });
  });
});

test("/api/catalog/sections/[jwId]/schedules 支持日期窗口", {
  tag: "@Schedule/REST",
}, async ({ run, request, academic }) => {
  await run(async () => {
    const seedDate = academic.date;
    const response = await request.get(
      `/api/catalog/sections/${academic.section.jwId}/schedules?dateFrom=${seedDate}&dateTo=${seedDate}&limit=5`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Array<{
      id?: number;
      date?: string;
    }>;
    expect(body.length).toBeGreaterThan(0);
    expect(body.length).toBeLessThanOrEqual(5);
    expect(body.every((item) => item.date?.startsWith(seedDate))).toBe(true);
    expect(body.map((item) => item.id)).toEqual([
      academic.schedules[2].id,
      academic.schedules[1].id,
    ]);
  });
});

test("/api/catalog/sections/[jwId]/schedules 支持 limit", {
  tag: "@Schedule/REST",
}, async ({ run, request, academic }) => {
  await run(async () => {
    const response = await request.get(
      `/api/catalog/sections/${academic.section.jwId}/schedules?limit=1`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Array<{ id?: number }>;
    expect(body.length).toBeLessThanOrEqual(1);
    expect(body.map((item) => item.id)).toEqual([academic.schedules[3].id]);
  });
});

test("/api/catalog/sections/[jwId]/schedules 无效日期返回 400", {
  tag: "@Schedule/REST",
}, async ({ run, request, academic }) => {
  await run(async () => {
    const response = await request.get(
      `/api/catalog/sections/${academic.section.jwId}/schedules?dateFrom=not-a-date`,
    );
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
});

test("section schedules without limit return the first 200 meetings", {
  tag: "@Schedule/REST",
}, async ({ run, request, academic, isolatedWorker }) => {
  await run(async () => {
    const ids = Array.from(
      { length: 201 },
      (_, index) => 1_850_000_000 + index,
    );
    await isolatedWorker.database.owner.schedule.createMany({
      data: ids.toReversed().map((id) => ({
        id,
        sectionId: academic.section.id,
        scheduleGroupId: academic.defaultGroup.id,
        date: new Date(`${academic.date}T00:00:00Z`),
        weekday: 3,
        startTime: 900,
        endTime: 1000,
        periods: 2,
        weekIndex: 1,
        startUnit: 1,
        endUnit: 2,
      })),
    });

    for (const query of ["", "?limit=200"]) {
      const response = await request.get(
        `/api/catalog/sections/${academic.section.jwId}/schedules${query}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as Array<{ id: number }>;
      expect(body.map((meeting) => meeting.id)).toEqual([
        academic.schedules[3].id,
        academic.schedules[2].id,
        ...ids.slice(0, 198),
      ]);
    }
  });
});

test("/api/catalog/sections/[jwId]/schedules 无效 limit 返回 400", {
  tag: "@Schedule/REST",
}, async ({ run, request, academic }) => {
  await run(async () => {
    for (const limit of [0, 201]) {
      const response = await request.get(
        `/api/catalog/sections/${academic.section.jwId}/schedules?limit=${limit}`,
      );
      expect(response.status()).toBe(400);
      expect((await response.json()).error).toEqual(expect.any(String));
    }
  });
});

for (const retired of [false, true]) {
  test(`section schedule pagination retains complete ${retired ? "retired" : "active"} meeting context`, {
    tag: "@Schedule/REST",
  }, async ({ run, request, academic, isolatedWorker }) => {
    await run(async () => {
      const ids = Array.from(
        { length: 201 },
        (_, index) => 1_850_100_000 + index,
      );
      const room = await isolatedWorker.database.owner.room.create({
        data: {
          jwId: 1_850_100_000,
          code: "PAGE-ROOM",
          nameCn: "分页教室",
          nameEn: "After-cap room",
          virtual: false,
          seatsForSection: 30,
          seats: 30,
        },
      });
      await isolatedWorker.database.owner.schedule.createMany({
        data: ids.toReversed().map((id) => ({
          id,
          sectionId: academic.section.id,
          scheduleGroupId: academic.defaultGroup.id,
          roomId: room.id,
          date: new Date(`${academic.date}T00:00:00Z`),
          weekday: 3,
          startTime: 900,
          endTime: 1000,
          periods: 1.5,
          weekIndex: 1,
          startUnit: 1,
          endUnit: 2,
        })),
      });
      await isolatedWorker.database.owner.scheduleTeacher.create({
        data: {
          scheduleId: ids[200],
          teacherId: academic.teacher.id,
          periods: 1.5,
          exerciseClass: true,
        },
      });
      if (retired) {
        await isolatedWorker.database.owner.section.update({
          where: { id: academic.section.id },
          data: { retiredAt: new Date() },
        });
      }

      const meetings: Array<{ id: number; [key: string]: unknown }> = [];
      for (let page = 1; page <= 4; page += 1) {
        const response = await request.get(
          `/api/catalog/sections/${academic.section.jwId}/schedules?page=${page}&pageSize=100&dateFrom=${academic.date}&dateTo=${academic.date}&locale=en-us`,
        );
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.pagination).toEqual({
          page,
          pageSize: 100,
          total: 203,
          totalPages: 3,
        });
        expect(body.data).toHaveLength([100, 100, 3, 0][page - 1]);
        meetings.push(...body.data);
      }
      expect(meetings.map(({ id }) => id)).toEqual([
        academic.schedules[2].id,
        ...ids,
        academic.schedules[1].id,
      ]);
      expect(meetings.find(({ id }) => id === ids[200])).toMatchObject({
        startTime: "09:00",
        endTime: "10:00",
        room: { id: room.id, namePrimary: "After-cap room" },
        teachers: [{ id: academic.teacher.id }],
        teacherParticipations: [
          {
            teacher: { id: academic.teacher.id },
            periods: 1.5,
            exerciseClass: true,
          },
        ],
        scheduleGroup: { id: academic.defaultGroup.id },
      });
    });
  });
}

test("section schedule pagination validates modes and missing sections", {
  tag: "@Schedule/REST",
}, async ({ run, request, academic }) => {
  await run(async () => {
    for (const query of [
      "page=0",
      "page=100001",
      "page=1.5",
      "pageSize=0",
      "pageSize=101",
      "page=1&limit=10",
      "pageSize=20&limit=10",
    ]) {
      const response = await request.get(
        `/api/catalog/sections/${academic.section.jwId}/schedules?${query}`,
      );
      expect(response.status(), query).toBe(400);
    }
    const missing = await request.get(
      "/api/catalog/sections/2147483647/schedules?page=1&pageSize=100",
    );
    expect(missing.status()).toBe(404);
    const defaultSize = await request.get(
      `/api/catalog/sections/${academic.section.jwId}/schedules?page=1`,
    );
    expect((await defaultSize.json()).pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 4,
      totalPages: 1,
    });
    const defaultPage = await request.get(
      `/api/catalog/sections/${academic.section.jwId}/schedules?pageSize=1`,
    );
    expect((await defaultPage.json()).pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 4,
      totalPages: 4,
    });
    const exhausted = await request.get(
      `/api/catalog/sections/${academic.section.jwId}/schedules?page=101&pageSize=1`,
    );
    expect(exhausted.status()).toBe(200);
    expect(await exhausted.json()).toMatchObject({
      data: [],
      pagination: { page: 101, pageSize: 1, total: 4, totalPages: 4 },
    });
  });
});
