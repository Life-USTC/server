import { expect } from "@playwright/test";
import { test } from "../../../_shared/public-academic-fixture";

test("/api/catalog/sections/[jwId]/schedule-groups 契约", {
  tag: "@Schedule/REST",
}, async ({ run, request, academic }) => {
  await run(async () => {
    const response = await request.get(
      `/api/catalog/sections/${academic.section.jwId}/schedule-groups`,
    );
    expect(response.status()).toBe(200);
    expect(
      ((await response.json()) as Array<{ schedules?: unknown[] }>).length,
    ).toBeGreaterThan(0);
  });
});

test("/api/catalog/sections/[jwId]/schedule-groups 返回默认组及课表", {
  tag: "@Schedule/REST",
}, async ({ run, request, academic }) => {
  await run(async () => {
    const response = await request.get(
      `/api/catalog/sections/${academic.section.jwId}/schedule-groups`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Array<{
      id?: number;
      schedules?: Array<{ id?: number }>;
    }>;
    expect(body.length).toBeGreaterThan(0);
    expect(body.some((item) => (item.schedules?.length ?? 0) > 0)).toBe(true);
    expect(body.map((item) => item.id)).toEqual([
      academic.defaultGroup.id,
      academic.otherGroup.id,
    ]);
    expect(body[0]).toMatchObject({
      id: academic.defaultGroup.id,
      isDefault: true,
    });
    expect(body[0].schedules?.map((item) => item.id).sort()).toEqual(
      [
        academic.schedules[0].id,
        academic.schedules[2].id,
        academic.schedules[3].id,
      ].sort(),
    );
    expect(body[1]).toMatchObject({
      id: academic.otherGroup.id,
      isDefault: false,
      schedules: [{ id: academic.schedules[1].id }],
    });
  });
});

test("schedule groups retain the first 200 meetings in each group", {
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

    const response = await request.get(
      `/api/catalog/sections/${academic.section.jwId}/schedule-groups`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Array<{
      id: number;
      schedules: Array<{ id: number }>;
    }>;
    expect(body.map((group) => group.id)).toEqual([
      academic.defaultGroup.id,
      academic.otherGroup.id,
    ]);
    expect(body[0].schedules.map((meeting) => meeting.id)).toEqual([
      academic.schedules[3].id,
      academic.schedules[2].id,
      ...ids.slice(0, 198),
    ]);
    expect(body[1].schedules.map((meeting) => meeting.id)).toEqual([
      academic.schedules[1].id,
    ]);
  });
});
