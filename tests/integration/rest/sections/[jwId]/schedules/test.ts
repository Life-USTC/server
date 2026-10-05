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
