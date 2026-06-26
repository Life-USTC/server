import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("get_my_dashboard — default mode compactness", () => {
  let originalSubscriptionSectionIds: number[] = [];

  beforeAll(async () => {
    originalSubscriptionSectionIds = await fixtures.getUserSubscribedSectionIds(
      context.devUserId,
    );
    await fixtures.ensureDevUserSubscribedToSeedSection(context.devUserId);
  });

  afterAll(async () => {
    await fixtures.replaceUserSubscribedSections(
      context.devUserId,
      originalSubscriptionSectionIds,
    );
  });

  it("atTime anchors nextClass, deadlines, and events", async () => {
    const dashboard = await context.client.call<{
      nextClass?: { type?: string; at?: string | null };
      upcomingDeadlines?: {
        total?: number;
        items?: Array<{ type?: string; at?: string | null }>;
      };
      upcomingEvents?: { total?: number };
    }>("get_my_dashboard", {
      locale: "zh-cn",
      mode: "summary",
      atTime: fixtures.SEED_AT_TIME,
    });

    expect(dashboard.nextClass?.type).toBe("schedule");
    expect(dashboard.nextClass?.at?.slice(0, 10)).toBe(fixtures.SEED_DATE);
    expect(dashboard.upcomingDeadlines?.total).toBeGreaterThan(0);
    expect(dashboard.upcomingEvents?.total).toBeGreaterThan(0);
  });

  it("scheduleGroup and roomType are stripped from nextClass payload", async () => {
    const dashboard = await context.client.call<{
      nextClass?: {
        payload?: {
          scheduleGroup?: unknown;
          roomType?: unknown;
          date?: string;
          weekday?: number;
        };
      };
      subscriptions?: { currentSemesterSectionsTotal?: number };
      todos?: { incompleteCount?: number };
    }>("get_my_dashboard", { locale: "zh-cn", atTime: fixtures.SEED_AT_TIME });

    if (dashboard.nextClass?.payload) {
      expect(dashboard.nextClass.payload).not.toHaveProperty("scheduleGroup");
      expect(dashboard.nextClass.payload).not.toHaveProperty("roomType");
    }
    expect(typeof dashboard.subscriptions?.currentSemesterSectionsTotal).toBe(
      "number",
    );
    expect(typeof dashboard.todos?.incompleteCount).toBe("number");
  });

  it("summary mode is materially smaller than default mode", async () => {
    const def = JSON.stringify(
      await context.client.callTool("get_my_dashboard", {
        locale: "zh-cn",
        mode: "default",
        atTime: fixtures.SEED_AT_TIME,
      }),
    );
    const sum = JSON.stringify(
      await context.client.callTool("get_my_dashboard", {
        locale: "zh-cn",
        mode: "summary",
        atTime: fixtures.SEED_AT_TIME,
      }),
    );
    expect(sum.length).toBeLessThan(def.length);
  });
});

// ---------------------------------------------------------------------------
// Dashboard link tools — list/search and pin state
// ---------------------------------------------------------------------------
