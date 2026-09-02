import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fixtures from "../_harness";

const context = fixtures.createMcpToolTestContext();

const ACTIVE_ID = "[integration-test]-young-active";
const ENDED_ID = "[integration-test]-young-ended";

beforeAll(async () => {
  await fixtures.prisma.youngEvent.createMany({
    data: [
      {
        youngId: ACTIVE_ID,
        name: "[integration-test] 进行中的活动",
        category: "单次项目",
        department: "校团委",
        organizer: "学生会",
        status: "进行中",
        registrationStatus: "报名中",
        location: "东区图书馆",
        imageUrl: "group1/M00/31/B5/wKgUEWpR3ciAJX_MAABnEoFLBaI860.jpg",
        hours: 2,
        capacity: 30,
        appliedCount: 5,
        startAt: new Date("2026-09-10T06:00:00.000Z"),
        endAt: new Date("2026-09-10T08:00:00.000Z"),
        applyStartAt: new Date("2026-09-01T00:00:00.000Z"),
        applyEndAt: new Date("2026-09-09T15:59:59.000Z"),
        isActive: true,
        rawJson: { id: ACTIVE_ID, itemName: "[integration-test] 进行中的活动" },
      },
      {
        youngId: ENDED_ID,
        name: "[integration-test] 已结束的活动",
        isActive: false,
        rawJson: { id: ENDED_ID },
      },
    ],
  });
});

afterAll(async () => {
  await fixtures.prisma.youngEvent.deleteMany({
    where: { youngId: { in: [ACTIVE_ID, ENDED_ID] } },
  });
});

describe("第二课堂活动", () => {
  it("catalog_young_event_list 返回分页结构并可按报名状态筛选", async () => {
    const result = await context.client.call<{
      data?: Array<{ youngId?: string; isActive?: boolean; name?: string }>;
      pagination?: { page?: number; pageSize?: number; total?: number };
    }>("catalog_young_event_list", {
      active: true,
      search: "integration-test",
      limit: 10,
      page: 1,
    });

    expect(result.pagination?.page).toBe(1);
    expect(result.pagination?.total).toBeGreaterThanOrEqual(1);
    const event = result.data?.find((item) => item.youngId === ACTIVE_ID);
    expect(event?.isActive).toBe(true);
    expect(event?.name).toBe("[integration-test] 进行中的活动");
    expect(result.data?.every((item) => item.youngId !== ENDED_ID)).toBe(true);
  });

  it("catalog_young_event_list 默认模式省略详情字段，full 模式保留", async () => {
    const compact = await context.client.call<{
      data?: Array<{
        youngId?: string;
        imageUrl?: unknown;
        department?: unknown;
      }>;
    }>("catalog_young_event_list", {
      search: "[integration-test]",
      limit: 5,
      page: 1,
    });
    const compactEvent = compact.data?.find(
      (item) => item.youngId === ACTIVE_ID,
    );
    expect(compactEvent).toBeDefined();
    expect(compactEvent?.imageUrl).toBeUndefined();
    expect(compactEvent?.department).toBeUndefined();

    const full = await context.client.call<{
      data?: Array<{
        youngId?: string;
        imageUrl?: string | null;
        department?: string | null;
      }>;
    }>("catalog_young_event_list", {
      mode: "full",
      search: "[integration-test]",
      limit: 5,
      page: 1,
    });
    const fullEvent = full.data?.find((item) => item.youngId === ACTIVE_ID);
    expect(fullEvent?.imageUrl).toBe(
      `/api/catalog/young-events/${ACTIVE_ID}/image`,
    );
    expect(fullEvent?.department).toBe("校团委");
  });

  it("catalog_young_event_get 返回详情，full 模式包含 rawJson", async () => {
    const result = await context.client.call<{
      found?: boolean;
      event?: { youngId?: string; rawJson?: unknown } | null;
    }>("catalog_young_event_get", { mode: "full", youngId: ACTIVE_ID });

    expect(result.found).toBe(true);
    expect(result.event?.youngId).toBe(ACTIVE_ID);
    expect(result.event?.rawJson).toMatchObject({ id: ACTIVE_ID });
  });

  it("catalog_young_event_get 对未知 id 返回 found: false", async () => {
    const result = await context.client.call<{
      found?: boolean;
      youngId?: string;
      event?: unknown;
    }>("catalog_young_event_get", { youngId: "[integration-test]-missing" });

    expect(result.found).toBe(false);
    expect(result.youngId).toBe("[integration-test]-missing");
    expect(result.event).toBeNull();
  });
});
