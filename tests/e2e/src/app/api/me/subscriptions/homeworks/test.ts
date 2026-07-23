/**
 * E2E tests for GET /api/workspace/homeworks
 *
 * Authenticated endpoint that lists homeworks across the current user's
 * subscribed sections, together with recent audit logs and the resolved
 * section id list.
 *
 * - GET returns { viewer, homeworks[], auditLogs[], sectionIds[] }
 * - Requires authentication (401 otherwise)
 * - No query parameters
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../../utils/auth";
import { DEV_SEED } from "../../../../../../utils/dev-seed";
import { ensureSeedSectionSubscription } from "../../../../../../utils/subscriptions";

const BASE = "/api/workspace/homeworks";

test.describe("GET /api/workspace/homeworks - 订阅作业", () => {
  test("契约探测返回 401", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("未认证时返回 401", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("认证并关注种子班级后返回订阅作业、审计日志与班级 ID 列表", async ({
    page,
  }) => {
    await signInAsDebugUser(page, "/");
    await ensureSeedSectionSubscription(page);

    const response = await page.request.get(BASE);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      viewer?: {
        userId?: string | null;
        isAuthenticated?: boolean;
        isAdmin?: boolean;
      };
      homeworks?: Array<{
        id?: string;
        title?: string;
        sectionId?: number;
        section?: { code?: string; course?: { nameCn?: string } };
        completion?: unknown;
      }>;
      auditLogs?: Array<{ action?: string; titleSnapshot?: string }>;
      sectionIds?: number[];
    };

    expect(body.viewer?.isAuthenticated).toBe(true);
    expect(typeof body.viewer?.userId).toBe("string");
    expect(body.viewer?.isAdmin).toBe(false);

    expect(Array.isArray(body.homeworks)).toBe(true);
    expect(
      body.homeworks?.some((item) => item.title === DEV_SEED.homeworks.title),
    ).toBe(true);

    const seedHomework = body.homeworks?.find(
      (item) => item.title === DEV_SEED.homeworks.title,
    );
    expect(seedHomework).toBeDefined();
    if (seedHomework) {
      expect(typeof seedHomework.id).toBe("string");
      expect(typeof seedHomework.sectionId).toBe("number");
      expect(seedHomework.section?.code).toBe(DEV_SEED.section.code);
      expect(seedHomework.section?.course?.nameCn).toBe(DEV_SEED.course.nameCn);
      expect(Object.hasOwn(seedHomework, "completion")).toBe(true);
    }

    expect(Array.isArray(body.auditLogs)).toBe(true);
    expect(
      body.auditLogs?.some(
        (item) =>
          item.action === "created" &&
          typeof item.titleSnapshot === "string" &&
          item.titleSnapshot.length > 0,
      ),
    ).toBe(true);

    expect(Array.isArray(body.sectionIds)).toBe(true);
    expect(body.sectionIds?.some((id) => id === seedHomework?.sectionId)).toBe(
      true,
    );
  });
});
