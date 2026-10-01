import { describe } from "vitest";
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
    "首次订阅返回 action=subscribed 与精简计数",
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
            currentSemesterSectionCount?: number;
          } | null;
        }>("workspace_subscription_add", {
          jwId: section.jwId,
          locale: "zh-cn",
        });

        expect(result).toMatchObject({
          success: true,
          action: "subscribed",
          sectionJwId: section.jwId,
          subscription: {
            sectionCount: 1,
            currentSemesterSectionCount: 1,
          },
        });
        expect(result.subscription).not.toHaveProperty("sections");
        expect(result.subscription).not.toHaveProperty(
          "currentSemesterSections",
        );
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: subscriber.userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([{ sectionId: section.id, kind: "regular" }]);
      }),
  );

  toolTest(
    "已有订阅返回 action=already_subscribed 且保留原始记录",
    async ({
      mcpWorkflow,
      mcpActor: subscriber,
      section,
      isolatedDatabase,
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const existing = await db.userSectionSubscription.create({
          data: {
            userId: subscriber.userId,
            sectionId: section.id,
            kind: "regular",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        });
        const result = await subscriber.client.call<{
          success?: boolean;
          action?: string;
          sectionJwId?: number;
          subscription?: {
            sectionCount?: number;
            currentSemesterSectionCount?: number;
          } | null;
        }>("workspace_subscription_add", {
          jwId: section.jwId,
          locale: "zh-cn",
        });

        expect(result).toMatchObject({
          success: true,
          action: "already_subscribed",
          sectionJwId: section.jwId,
          subscription: {
            sectionCount: 1,
            currentSemesterSectionCount: 1,
          },
        });
        expect(result.subscription).not.toHaveProperty("sections");
        expect(result.subscription).not.toHaveProperty(
          "currentSemesterSections",
        );
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: subscriber.userId },
          }),
        ).toEqual([existing]);
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
    "adds an active membership under RLS and preserves the other owner",
    async ({ mcpWorkflow, state, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const foreignBefore = await db.userSectionSubscription.findMany({
          where: { userId: state.otherUserId },
        });
        const result = await state.client.call<{
          success?: boolean;
          action?: string;
          sectionJwId?: number;
          subscription?: { sections?: Array<{ jwId: number; kind: string }> };
        }>("workspace_subscription_add", {
          jwId: state.activeSectionJwId,
          locale: "zh-cn",
          mode: "full",
        });

        expect(result).toMatchObject({
          success: true,
          action: "subscribed",
          sectionJwId: state.activeSectionJwId,
          subscription: {
            sections: [
              expect.objectContaining({
                jwId: state.activeSectionJwId,
                kind: "regular",
              }),
            ],
          },
        });
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: state.userId },
            select: { sectionId: true, kind: true },
          }),
        ).toEqual([{ sectionId: state.activeSectionId, kind: "regular" }]);
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: state.otherUserId },
          }),
        ).toEqual(foreignBefore);
      }),
  );

  rlsTest(
    "removes an active membership under RLS and preserves retired and foreign rows",
    async ({ mcpWorkflow, state, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        await db.userSectionSubscription.createMany({
          data: [
            {
              userId: state.userId,
              sectionId: state.activeSectionId,
              kind: "regular",
            },
            {
              userId: state.userId,
              sectionId: state.retiredSectionId,
              kind: "teaching_assistant",
            },
          ],
        });
        const before = await db.userSectionSubscription.findMany({
          orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
        });

        const result = await state.client.call<{
          success?: boolean;
          action?: string;
          sectionJwId?: number;
          subscription?: { sections?: Array<{ jwId: number; kind: string }> };
        }>("workspace_subscription_remove", {
          jwId: state.activeSectionJwId,
          locale: "zh-cn",
          mode: "full",
        });
        expect(result).toMatchObject({
          success: true,
          action: "unsubscribed",
          sectionJwId: state.activeSectionJwId,
          subscription: {
            sections: [
              expect.objectContaining({
                jwId: state.retiredSectionJwId,
                kind: "teaching_assistant",
              }),
            ],
          },
        });
        expect(
          await db.userSectionSubscription.findMany({
            orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
          }),
        ).toEqual(
          before.filter(
            (row) =>
              row.userId !== state.userId ||
              row.sectionId !== state.activeSectionId,
          ),
        );
      }),
  );

  rlsTest(
    "removes a retired membership under RLS and preserves the other owner",
    async ({ mcpWorkflow, state, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        await db.userSectionSubscription.create({
          data: {
            userId: state.userId,
            sectionId: state.retiredSectionId,
            kind: "teaching_assistant",
          },
        });
        const before = await db.userSectionSubscription.findMany({
          orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
        });

        const result = await state.client.call<{
          success?: boolean;
          action?: string;
          sectionJwId?: number;
          subscription?: { sections?: Array<{ jwId: number; kind: string }> };
        }>("workspace_subscription_remove", {
          jwId: state.retiredSectionJwId,
          locale: "zh-cn",
          mode: "full",
        });
        expect(result).toMatchObject({
          success: true,
          action: "unsubscribed",
          sectionJwId: state.retiredSectionJwId,
          subscription: {
            sections: [],
          },
        });
        expect(
          await db.userSectionSubscription.findMany({
            orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
          }),
        ).toEqual(
          before.filter(
            (row) =>
              row.userId !== state.userId ||
              row.sectionId !== state.retiredSectionId,
          ),
        );
      }),
  );

  rlsTest(
    "returns not_subscribed for an absent active membership and preserves every row",
    async ({ mcpWorkflow, state, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        await db.userSectionSubscription.create({
          data: {
            userId: state.userId,
            sectionId: state.retiredSectionId,
            kind: "teaching_assistant",
          },
        });
        const before = await db.userSectionSubscription.findMany({
          orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
        });

        const result = await state.client.call<{
          success?: boolean;
          action?: string;
          sectionJwId?: number;
          subscription?: { sections?: Array<{ jwId: number; kind: string }> };
        }>("workspace_subscription_remove", {
          jwId: state.activeSectionJwId,
          locale: "zh-cn",
          mode: "full",
        });
        expect(result).toMatchObject({
          success: true,
          action: "not_subscribed",
          sectionJwId: state.activeSectionJwId,
          subscription: {
            sections: [
              expect.objectContaining({
                jwId: state.retiredSectionJwId,
                kind: "teaching_assistant",
              }),
            ],
          },
        });
        expect(
          await db.userSectionSubscription.findMany({
            orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
          }),
        ).toEqual(before);
      }),
  );

  rlsTest(
    "lists known active and retired memberships without exposing the other owner",
    async ({ mcpWorkflow, state, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        await db.userSectionSubscription.createMany({
          data: [
            {
              userId: state.userId,
              sectionId: state.activeSectionId,
              kind: "regular",
            },
            {
              userId: state.userId,
              sectionId: state.retiredSectionId,
              kind: "teaching_assistant",
            },
          ],
        });
        const before = await db.userSectionSubscription.findMany({
          orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
        });

        const result = await state.client.call<{
          success?: boolean;
          sections?: Array<{ jwId: number; kind: string }>;
        }>("workspace_subscription_list", { locale: "zh-cn", mode: "full" });
        expect(result.success).toBe(true);
        expect(
          result.sections
            ?.map(({ jwId, kind }) => ({ jwId, kind }))
            .sort((left, right) => left.jwId - right.jwId),
        ).toEqual([
          { jwId: state.activeSectionJwId, kind: "regular" },
          { jwId: state.retiredSectionJwId, kind: "teaching_assistant" },
        ]);
        expect(
          await db.userSectionSubscription.findMany({
            orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
          }),
        ).toEqual(before);
      }),
  );

  rlsTest(
    "lists no memberships when only the other owner is subscribed",
    async ({ mcpWorkflow, state, isolatedDatabase, expect }) =>
      mcpWorkflow.run(async () => {
        const db = isolatedDatabase.owner;
        const before = await db.userSectionSubscription.findMany({
          orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
        });

        const result = await state.client.call<{
          success?: boolean;
          sections?: Array<{ jwId: number; kind: string }>;
        }>("workspace_subscription_list", { locale: "zh-cn", mode: "full" });
        expect(result.success).toBe(true);
        expect(result.sections).toEqual([]);
        expect(
          await db.userSectionSubscription.findMany({
            orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
          }),
        ).toEqual(before);
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
            currentSemesterSections?: Array<{ jwId: number }>;
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
        expect(
          result.subscription?.currentSemesterSections?.map((row) => row.jwId),
        ).toEqual([context.sectionJwId]);
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
    "workspace_calendar_feed_get default 返回当前学期订阅摘要",
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
            currentSemesterSections?: Array<{ jwId: number }>;
          };
        }>("workspace_calendar_feed_get", {
          locale: "zh-cn",
          mode: "default",
        });

        expect(result.success).toBe(true);
        expect(result.subscription?.calendarPath).toBeUndefined();
        expect(result.subscription?.calendarUrl).toBeUndefined();
        expect(
          result.subscription?.currentSemesterSections?.map((row) => row.jwId),
        ).toEqual([context.sectionJwId]);

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
        expect(result.unmatchedCodes).toEqual([]);
        expect(result.alreadySubscribedCount).toBe(0);
        expect(result.subscription?.sections).toHaveLength(1);
        expect(result.subscription?.sectionCount).toBe(1);

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
        expect(result.matchedCodes).toEqual([context.sectionCode]);
        expect(result.addedCount).toBe(0);
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
