import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMcpHarness, type McpHarness } from "./utils/mcp-harness";
import * as fixtures from "./utils/mcp-tool-test-utils";

describe("subscribe_section_by_jw_id — returns action + compact subscription", () => {
  let subscriptionMcp: McpHarness | undefined;
  let subscriptionUserId: string | undefined;

  beforeAll(async () => {
    const user = await fixtures.prisma.user.create({
      data: {
        email: fixtures.integrationUserEmail("mcp-subscriptions"),
        name: "MCP Subscription Integration",
      },
      select: { id: true },
    });
    subscriptionUserId = user.id;
    subscriptionMcp = await createMcpHarness(user.id);
  });

  afterAll(async () => {
    await subscriptionMcp?.close();
    if (subscriptionUserId) {
      await fixtures.prisma.user.deleteMany({
        where: { id: subscriptionUserId },
      });
    }
    await fixtures.prisma.$disconnect();
  });

  function harness() {
    if (!subscriptionMcp) {
      throw new Error("Subscription MCP harness was not initialized");
    }
    return subscriptionMcp;
  }

  it("subscribing returns action=subscribed or action=already_subscribed", async () => {
    const result = await harness().call<{
      success?: boolean;
      action?: string;
      sectionJwId?: number;
      subscription?: {
        sectionCount?: number;
        currentSemesterSections?: unknown;
        sections?: unknown;
      } | null;
    }>("subscribe_section_by_jw_id", {
      jwId: fixtures.DEV_SEED.section.jwId,
      locale: "zh-cn",
    });

    expect(result.success).toBe(true);
    expect(["subscribed", "already_subscribed"]).toContain(result.action);
    expect(result.sectionJwId).toBe(fixtures.DEV_SEED.section.jwId);
    // Brief subscription — sections list not included in default mode
    expect(result.subscription?.sections).toBeUndefined();
    expect(result.subscription?.currentSemesterSections).toBeUndefined();
    expect(typeof result.subscription?.sectionCount).toBe("number");
  });

  it("returns not_found for missing subscribe and unsubscribe targets", async () => {
    const missingJwId = 2_147_483_647;
    const subscribeResult = await harness().call<{
      success?: boolean;
      action?: string;
      sectionJwId?: number;
      subscription?: unknown;
    }>("subscribe_section_by_jw_id", {
      jwId: missingJwId,
      locale: "zh-cn",
    });
    const unsubscribeResult = await harness().call<{
      success?: boolean;
      action?: string;
      sectionJwId?: number;
      subscription?: unknown;
    }>("unsubscribe_section_by_jw_id", {
      jwId: missingJwId,
      locale: "zh-cn",
    });

    expect(subscribeResult).toMatchObject({
      action: "not_found",
      sectionJwId: missingJwId,
      success: false,
      subscription: null,
    });
    expect(unsubscribeResult).toMatchObject({
      action: "not_found",
      sectionJwId: missingJwId,
      success: false,
      subscription: null,
    });
  });
});
