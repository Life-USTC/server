import { describe } from "vitest";
import {
  assertSubscriptionAction,
  assertSubscriptionBrief,
} from "../../../shared/scenarios/subscriptions";
import { isolatedMcpTest } from "../_harness/isolated-context";

const toolTest = isolatedMcpTest
  .extend(
    "section",
    async ({ mcpWorkflow, signal, mcpSection, isolatedDatabase }) => {
      const setupResult = await mcpWorkflow.run(async () => {
        const section = await isolatedDatabase.owner.section.findUniqueOrThrow({
          where: { id: mcpSection.id },
          select: {
            id: true,
            jwId: true,
            code: true,
            courseId: true,
            semesterId: true,
          },
        });
        if (section.semesterId === null)
          throw new Error("Subscription section needs a semester");
        // Default imports resolve the real current date. Prepare its semester;
        // do not bypass that path with a supplied semesterId or a mocked clock.
        const today = new Date();
        await isolatedDatabase.owner.semester.update({
          where: { id: section.semesterId },
          data: {
            startDate: new Date(
              Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
            ),
            endDate: new Date(
              Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 5, 0),
            ),
          },
        });
        return section;
      });
      signal.throwIfAborted();
      return setupResult;
    },
  )
  .extend("context", ({ mcpActor, section }) => ({
    ...mcpActor,
    sectionId: section.id,
    sectionJwId: section.jwId,
    sectionCode: section.code,
    semesterId: section.semesterId,
  }));

describe("workspace_subscription_add — 返回 action 与精简订阅", () => {
  toolTest(
    "订阅返回 action=subscribed 或 action=already_subscribed",
    async ({
      mcpWorkflow,
      mcpActor: subscriber,
      section,
      isolatedDatabase,
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const result = await subscriber.client.call<{
          success?: boolean;
          action?: string;
          sectionJwId?: number;
          subscription?: {
            sectionCount?: number;
            currentSemesterSections?: unknown;
            sections?: unknown;
          } | null;
        }>("workspace_subscription_add", {
          jwId: section.jwId,
          locale: "zh-cn",
        });

        assertSubscriptionAction(result, section.jwId, [
          "subscribed",
          "already_subscribed",
        ]);
        assertSubscriptionBrief(result.subscription);

        expect(result.action).toBe("subscribed");
        expect(result.subscription?.sectionCount).toBe(1);
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: subscriber.userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([{ sectionId: section.id, kind: "regular" }]);
        const repeated = await subscriber.client.call<{
          success?: boolean;
          action?: string;
          sectionJwId?: number;
        }>("workspace_subscription_add", {
          jwId: section.jwId,
          locale: "zh-cn",
        });
        expect(repeated).toMatchObject({
          success: true,
          action: "already_subscribed",
          sectionJwId: section.jwId,
        });
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: subscriber.userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([{ sectionId: section.id, kind: "regular" }]);
      }),
  );

  toolTest(
    "对缺失的订阅与取消订阅目标返回 not_found",
    async ({ mcpWorkflow, mcpActor: subscriber, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const missingJwId = 2_147_483_647;
        const subscribeResult = await subscriber.client.call<{
          success?: boolean;
          action?: string;
          sectionJwId?: number;
          subscription?: unknown;
        }>("workspace_subscription_add", {
          jwId: missingJwId,
          locale: "zh-cn",
        });
        const unsubscribeResult = await subscriber.client.call<{
          success?: boolean;
          action?: string;
          sectionJwId?: number;
          subscription?: unknown;
        }>("workspace_subscription_remove", {
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

        expect(await db.userSectionSubscription.count()).toBe(0);
        expect(await db.section.count()).toBe(0);
      }),
  );
});

describe("workspace subscriptions through the restricted MCP runtime", () => {
  const rlsTest = toolTest.extend(
    "state",
    async ({
      mcpWorkflow,
      signal,
      mcpActor,
      mcpOtherActor,
      section,
      isolatedDatabase,
    }) => {
      const setupResult = await mcpWorkflow.run(async () => {
        const retiredSection = await isolatedDatabase.owner.$transaction(
          async (db) => {
            const retired = await db.section.create({
              data: {
                jwId: 2,
                code: "MCP.RETIRED",
                courseId: section.courseId,
                semesterId: section.semesterId,
                retiredAt: new Date("2026-09-01T00:00:00.000Z"),
              },
            });
            await db.userSectionSubscription.create({
              data: {
                userId: mcpOtherActor.userId,
                sectionId: section.id,
                kind: "teaching_assistant",
              },
            });
            return retired;
          },
        );
        return {
          client: mcpActor.client,
          userId: mcpActor.userId,
          otherUserId: mcpOtherActor.userId,
          activeSectionId: section.id,
          activeSectionJwId: section.jwId,
          retiredSectionId: retiredSection.id,
          retiredSectionJwId: retiredSection.jwId,
        };
      });
      signal.throwIfAborted();
      return setupResult;
    },
  );

  rlsTest(
    "runs subscribe/list/remove/list under RLS and preserves other owners",
    async ({ mcpWorkflow, state, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const {
          client,
          userId,
          otherUserId,
          activeSectionId,
          activeSectionJwId,
          retiredSectionId,
          retiredSectionJwId,
        } = state;
        if (!client) throw new Error("MCP fixture is not ready");

        const add = await client.call<{
          action?: string;
          sectionJwId?: number;
          success?: boolean;
          subscription?: {
            sections?: Array<{ jwId?: number; kind?: string }>;
          } | null;
        }>("workspace_subscription_add", {
          jwId: activeSectionJwId,
          locale: "zh-cn",
          mode: "full",
        });
        expect(add).toMatchObject({
          action: "subscribed",
          sectionJwId: activeSectionJwId,
          success: true,
          subscription: {
            sections: [
              expect.objectContaining({
                jwId: activeSectionJwId,
                kind: "regular",
              }),
            ],
          },
        });

        expect(
          await db.userSectionSubscription.findMany({
            where: { userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([{ sectionId: activeSectionId, kind: "regular" }]);
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: otherUserId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([{ sectionId: activeSectionId, kind: "teaching_assistant" }]);

        await db.userSectionSubscription.create({
          data: {
            userId,
            sectionId: retiredSectionId,
            kind: "teaching_assistant",
          },
        });

        const listBeforeRemove = await client.call<{
          sections?: Array<{ jwId?: number; kind?: string }>;
          success?: boolean;
        }>("workspace_subscription_list", { locale: "zh-cn", mode: "full" });
        expect(listBeforeRemove.success).toBe(true);
        expect(
          listBeforeRemove.sections
            ?.map(({ jwId, kind }) => ({ jwId, kind }))
            .sort((left, right) => (left.jwId ?? 0) - (right.jwId ?? 0)),
        ).toEqual([
          { jwId: activeSectionJwId, kind: "regular" },
          { jwId: retiredSectionJwId, kind: "teaching_assistant" },
        ]);

        const removeActive = await client.call<{
          action?: string;
          sectionJwId?: number;
          success?: boolean;
          subscription?: {
            sections?: Array<{ jwId?: number; kind?: string }>;
          } | null;
        }>("workspace_subscription_remove", {
          jwId: activeSectionJwId,
          locale: "zh-cn",
          mode: "full",
        });
        expect(removeActive).toMatchObject({
          action: "unsubscribed",
          sectionJwId: activeSectionJwId,
          success: true,
          subscription: {
            sections: [
              expect.objectContaining({
                jwId: retiredSectionJwId,
                kind: "teaching_assistant",
              }),
            ],
          },
        });

        expect(
          await db.userSectionSubscription.findMany({
            where: { userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([
          { sectionId: retiredSectionId, kind: "teaching_assistant" },
        ]);

        const repeatedRemove = await client.call<{
          action?: string;
          sectionJwId?: number;
          success?: boolean;
        }>("workspace_subscription_remove", {
          jwId: activeSectionJwId,
          locale: "zh-cn",
          mode: "full",
        });
        expect(repeatedRemove).toMatchObject({
          action: "not_subscribed",
          sectionJwId: activeSectionJwId,
          success: true,
        });

        const listAfterActiveRemove = await client.call<{
          sections?: Array<{ jwId?: number; kind?: string }>;
        }>("workspace_subscription_list", { locale: "zh-cn", mode: "full" });
        expect(
          listAfterActiveRemove.sections?.map(({ jwId, kind }) => ({
            jwId,
            kind,
          })),
        ).toEqual([{ jwId: retiredSectionJwId, kind: "teaching_assistant" }]);

        const removeRetired = await client.call<{
          action?: string;
          sectionJwId?: number;
          success?: boolean;
        }>("workspace_subscription_remove", {
          jwId: retiredSectionJwId,
          locale: "zh-cn",
          mode: "full",
        });
        expect(removeRetired).toMatchObject({
          action: "unsubscribed",
          sectionJwId: retiredSectionJwId,
          success: true,
        });

        const listAfterAllRemoves = await client.call<{
          sections?: unknown[];
        }>("workspace_subscription_list", { locale: "zh-cn", mode: "full" });
        expect(listAfterAllRemoves.sections).toEqual([]);

        await expect(
          db.userSectionSubscription.findMany({
            where: { userId },
          }),
        ).resolves.toEqual([]);
        await expect(
          db.userSectionSubscription.findMany({
            where: { userId: otherUserId },
            select: { sectionId: true, kind: true },
          }),
        ).resolves.toEqual([
          { sectionId: activeSectionId, kind: "teaching_assistant" },
        ]);
      }),
  );
});

describe("个人日历订阅 — 读取与批量订阅", () => {
  toolTest(
    "workspace_calendar_feed_get 返回订阅班级但不泄露个人 iCal 凭据",
    async ({ mcpWorkflow, context, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        await db.userSectionSubscription.create({
          data: { userId: context.userId, sectionId: context.sectionId },
        });

        const result = await context.client.call<{
          success?: boolean;
          subscription?: {
            userId?: string;
            sectionCount?: number;
            currentSemesterSectionCount?: number;
            currentSemesterSections?: unknown[];
            sections?: Array<{
              jwId?: number | null;
              code?: string | null;
            }>;
            calendarPath?: never;
            calendarUrl?: never;
            note?: string;
          };
        }>("workspace_calendar_feed_get", {
          locale: "zh-cn",
          mode: "full",
        });

        expect(result.success).toBe(true);
        expect(result.subscription?.userId).toBe(context.userId);
        expect(typeof result.subscription?.sectionCount).toBe("number");
        expect(typeof result.subscription?.currentSemesterSectionCount).toBe(
          "number",
        );
        expect(
          Array.isArray(result.subscription?.currentSemesterSections),
        ).toBe(true);
        expect(
          result.subscription?.sections?.some(
            (section) => section.jwId === context.sectionJwId,
          ),
        ).toBe(true);
        expect(result.subscription?.calendarPath).toBeUndefined();
        expect(result.subscription?.calendarUrl).toBeUndefined();
        expect(result.subscription?.note).toContain("not official");

        expect(result.subscription?.sectionCount).toBe(1);
        expect(result.subscription?.currentSemesterSectionCount).toBe(1);
        expect(result.subscription?.sections?.map((row) => row.jwId)).toEqual([
          context.sectionJwId,
        ]);
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: context.userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([{ sectionId: context.sectionId, kind: "regular" }]);
      }),
  );

  toolTest(
    "workspace_calendar_feed_get summary 兼容输入返回 default 结构",
    async ({ mcpWorkflow, context, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        await db.userSectionSubscription.create({
          data: { userId: context.userId, sectionId: context.sectionId },
        });

        const result = await context.client.call<{
          success?: boolean;
          subscription?: {
            userId?: string;
            sectionCount?: number;
            currentSemesterSectionCount?: number;
            calendarPath?: never;
            calendarUrl?: never;
            currentSemesterSections?: unknown[];
          };
        }>("workspace_calendar_feed_get", {
          locale: "zh-cn",
          mode: "default",
        });

        expect(result.success).toBe(true);
        expect(typeof result.subscription?.sectionCount).toBe("number");
        expect(typeof result.subscription?.currentSemesterSectionCount).toBe(
          "number",
        );
        expect(result.subscription?.calendarPath).toBeUndefined();
        expect(result.subscription?.calendarUrl).toBeUndefined();
        expect(
          Array.isArray(result.subscription?.currentSemesterSections),
        ).toBe(true);

        expect(result.subscription?.sectionCount).toBe(1);
        expect(result.subscription?.currentSemesterSectionCount).toBe(1);
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: context.userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([{ sectionId: context.sectionId, kind: "regular" }]);
      }),
  );

  toolTest(
    "workspace_subscription_list 列出当前订阅班级",
    async ({ mcpWorkflow, context, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        await db.userSectionSubscription.create({
          data: { userId: context.userId, sectionId: context.sectionId },
        });

        const result = await context.client.call<{
          success?: boolean;
          sections?: Array<{
            jwId?: number | null;
            code?: string | null;
            course?: { namePrimary?: string | null } | null;
          }>;
          note?: string;
        }>("workspace_subscription_list", {
          locale: "zh-cn",
          mode: "full",
        });

        expect(result.success).toBe(true);
        expect(
          result.sections?.some(
            (section) => section.jwId === context.sectionJwId,
          ),
        ).toBe(true);
        expect(result.note).toContain("not official");

        expect(
          result.sections?.map((row) => ({ jwId: row.jwId, code: row.code })),
        ).toEqual([{ jwId: context.sectionJwId, code: context.sectionCode }]);
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: context.userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([{ sectionId: context.sectionId, kind: "regular" }]);
      }),
  );

  toolTest(
    "catalog_section_calendar_feed_get 按 jwId 返回单班 iCal 信息",
    async ({ mcpWorkflow, context, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const result = await context.client.call<{
          found?: boolean;
          section?: {
            jwId?: number | null;
            code?: string | null;
          } | null;
          calendarPath?: string;
          calendarUrl?: string;
        }>("catalog_section_calendar_feed_get", {
          jwId: context.sectionJwId,
          locale: "zh-cn",
        });

        expect(result.found).toBe(true);
        expect(result.section?.jwId).toBe(context.sectionJwId);
        expect(result.section?.code).toBe(context.sectionCode);
        expect(result.calendarPath).toBe(
          `/api/catalog/sections/${context.sectionJwId}/calendar.ics`,
        );
        expect(result.calendarUrl).toContain(result.calendarPath ?? "");

        expect(result.calendarUrl).toBe(
          `https://life.example/api/catalog/sections/${context.sectionJwId}/calendar.ics`,
        );
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: context.userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([]);
      }),
  );

  toolTest(
    "catalog_section_calendar_feed_get 对缺失 jwId 返回 found=false",
    async ({ mcpWorkflow, context, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const missingJwId = 2_147_483_647;
        const result = await context.client.call<{
          found?: boolean;
          section?: unknown;
          calendarPath?: string;
          calendarUrl?: string;
        }>("catalog_section_calendar_feed_get", {
          jwId: missingJwId,
          locale: "zh-cn",
        });

        expect(result.found).toBe(false);
        expect(result.section).toBeNull();
        expect(result.calendarPath).toBe(
          `/api/catalog/sections/${missingJwId}/calendar.ics`,
        );

        expect(
          await db.section.findUnique({ where: { jwId: missingJwId } }),
        ).toBeNull();
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: context.userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([]);
      }),
  );

  toolTest(
    "workspace_subscription_import 批量匹配并订阅班级",
    async ({ mcpWorkflow, context, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;

        const result = await context.client.call<{
          success?: boolean;
          semester?: {
            id?: number;
            nameCn?: string | null;
            code?: string | null;
          } | null;
          matchedCodes?: string[];
          unmatchedCodes?: string[];
          addedCount?: number;
          alreadySubscribedCount?: number;
          subscription?: {
            sections?: unknown[];
            sectionCount?: number;
          } | null;
        }>("workspace_subscription_import", {
          codes: [context.sectionCode],
          locale: "zh-cn",
          mode: "full",
        });

        expect(result.success).toBe(true);
        expect(result.matchedCodes).toContain(context.sectionCode);
        expect(result.unmatchedCodes).toEqual([]);
        expect(result.addedCount).toBeGreaterThanOrEqual(1);
        expect(result.alreadySubscribedCount).toBe(0);
        expect(
          (result.subscription?.sections?.length ??
            result.subscription?.sectionCount ??
            0) > 0,
        ).toBe(true);

        expect(result.semester?.id).toBe(context.semesterId);
        expect(result.matchedCodes).toEqual([context.sectionCode]);
        expect(result.addedCount).toBe(1);
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: context.userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([{ sectionId: context.sectionId, kind: "regular" }]);
      }),
  );

  toolTest(
    "workspace_subscription_import 跳过已订阅班级",
    async ({ mcpWorkflow, context, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        await db.userSectionSubscription.create({
          data: { userId: context.userId, sectionId: context.sectionId },
        });

        const result = await context.client.call<{
          success?: boolean;
          matchedCodes?: string[];
          unmatchedCodes?: string[];
          addedCount?: number;
          alreadySubscribedCount?: number;
        }>("workspace_subscription_import", {
          codes: [context.sectionCode],
          locale: "zh-cn",
        });

        expect(result.success).toBe(true);
        expect(result.matchedCodes).toContain(context.sectionCode);
        expect(result.addedCount).toBe(0);
        expect(result.alreadySubscribedCount).toBeGreaterThanOrEqual(1);

        expect(result.alreadySubscribedCount).toBe(1);
        expect(result.unmatchedCodes).toEqual([]);
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: context.userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([{ sectionId: context.sectionId, kind: "regular" }]);
      }),
  );

  toolTest(
    "workspace_subscription_import 报告未匹配代码",
    async ({ mcpWorkflow, context, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        await db.userSectionSubscription.create({
          data: { userId: context.userId, sectionId: context.sectionId },
        });
        const marker = `MISSING${Date.now()}.01`;

        const result = await context.client.call<{
          success?: boolean;
          matchedCodes?: string[];
          unmatchedCodes?: string[];
          addedCount?: number;
          alreadySubscribedCount?: number;
        }>("workspace_subscription_import", {
          codes: [marker],
          locale: "zh-cn",
        });

        expect(result.success).toBe(true);
        expect(result.matchedCodes).toEqual([]);
        expect(result.unmatchedCodes).toContain(marker);
        expect(result.addedCount).toBe(0);
        expect(result.alreadySubscribedCount).toBe(0);

        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: context.userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([{ sectionId: context.sectionId, kind: "regular" }]);
      }),
  );

  toolTest(
    "workspace_subscription_import 对不存在的学期返回失败",
    async ({ mcpWorkflow, context, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        await db.userSectionSubscription.create({
          data: { userId: context.userId, sectionId: context.sectionId },
        });
        const result = await context.client.call<{
          success?: boolean;
          message?: string;
        }>("workspace_subscription_import", {
          codes: [context.sectionCode],
          semesterId: 2_147_483_647,
          locale: "zh-cn",
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain("No semester found");

        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: context.userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([{ sectionId: context.sectionId, kind: "regular" }]);
        expect(
          await db.semester.findUnique({ where: { id: 2_147_483_647 } }),
        ).toBeNull();
      }),
  );

  toolTest(
    "workspace_subscription_import 拒绝空代码列表",
    async ({ mcpWorkflow, context, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        await db.userSectionSubscription.create({
          data: { userId: context.userId, sectionId: context.sectionId },
        });
        await expect(
          context.client.call("workspace_subscription_import", {
            codes: [],
            locale: "zh-cn",
          }),
        ).rejects.toThrow();

        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: context.userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([{ sectionId: context.sectionId, kind: "regular" }]);
      }),
  );

  toolTest(
    "workspace_calendar_feed_get 对不存在用户返回失败",
    async ({ mcpWorkflow, mcpSessions, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const missingSession = mcpSessions.own("missing-user-id");
        await missingSession.initialize();
        const missingUserMcp = missingSession.client;

        const result = await missingUserMcp.call<{
          success?: boolean;
          message?: string;
        }>("workspace_calendar_feed_get", {
          locale: "zh-cn",
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain("User not found");

        expect(await db.user.count()).toBe(0);
        expect(await db.userSectionSubscription.count()).toBe(0);
      }),
  );
});
