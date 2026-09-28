import { describe, expect } from "vitest";
import type { TestPrismaClient } from "../../../shared/prisma";
import { assertHomeworkCreateEcho } from "../../../shared/scenarios/homework-create";
import {
  isolatedMcpTest,
  type PrivateMcpActor,
} from "../_harness/isolated-context";

const toolTest = isolatedMcpTest.extend(
  "subscribedSection",
  async ({ mcpActor, mcpSection, isolatedDatabase }) => {
    await isolatedDatabase.owner.userSectionSubscription.create({
      data: { userId: mcpActor.userId, sectionId: mcpSection.id },
    });
    return mcpSection;
  },
);

function readHomeworkState(db: TestPrismaClient) {
  return db.homework.findMany({
    orderBy: { id: "asc" },
    include: {
      description: { include: { edits: true } },
      homeworkCompletions: true,
    },
  });
}

describe("班级作业写入工具 — community_section_homework_create", () => {
  toolTest(
    "community_section_homework_list 对 default/full 都使用 summary 契约",
    async ({
      mcpActor: isolated,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const title = `[integration-test] mcp-list-homework-${Date.now()}`;

      const created = await isolated.client.call<{
        id?: string;
      }>("community_section_homework_create", {
        sectionJwId: section.jwId,
        title,
        publishedAt: "2026-05-02",
        submissionStartAt: "2026-05-05",
        submissionDueAt: "2026-05-06",
        locale: "zh-cn",
        mode: "full",
      });
      const homeworkId = created.id;
      const compact = await isolated.client.call<{
        success?: boolean;
        found?: boolean;
        section?: { jwId?: number };
        homeworks?: Array<Record<string, unknown>>;
      }>("community_section_homework_list", {
        sectionJwId: section.jwId,
        includeDeleted: false,
        locale: "zh-cn",
        mode: "default",
      });
      const full = await isolated.client.call<{
        success?: boolean;
        found?: boolean;
        section?: { jwId?: number };
        homeworks?: Array<Record<string, unknown>>;
      }>("community_section_homework_list", {
        sectionJwId: section.jwId,
        includeDeleted: false,
        locale: "zh-cn",
        mode: "full",
      });
      expect(compact).toMatchObject({
        success: true,
        found: true,
        section: { jwId: section.jwId },
      });
      expect(full).toMatchObject({
        success: true,
        found: true,
        section: { jwId: section.jwId },
      });
      const compactHomework = compact.homeworks?.find(
        (homework) => homework.id === homeworkId,
      );
      const fullHomework = full.homeworks?.find(
        (homework) => homework.id === homeworkId,
      );
      expect(compactHomework).toBeDefined();
      expect(compactHomework).not.toHaveProperty("description");
      expect(compactHomework).not.toHaveProperty("section");
      expect(compactHomework).not.toHaveProperty("createdBy");
      expect(fullHomework).not.toHaveProperty("description");
      expect(fullHomework).not.toHaveProperty("section");
      expect(fullHomework).not.toHaveProperty("createdBy");

      await expect(
        db.homework.findMany({
          select: { id: true, title: true, sectionId: true },
        }),
      ).resolves.toEqual([{ id: homeworkId, title, sectionId: section.id }]);
    },
  );

  toolTest(
    "community_section_homework_create 创建作业并返回完整实体",
    async ({
      mcpActor: isolated,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const marker = `[integration-test] mcp-create-homework-${Date.now()}`;
      const title = `${marker} title`;

      const result = await isolated.client.call<{
        success?: boolean;
        id?: string;
        homework?: {
          id?: string;
          title?: string;
          sectionId?: number;
          isMajor?: boolean;
          requiresTeam?: boolean;
          publishedAt?: string;
          submissionStartAt?: string;
          submissionDueAt?: string;
          description?: { content?: string | null } | null;
          completion?: { completed?: boolean } | null;
        };
      }>("community_section_homework_create", {
        sectionJwId: section.jwId,
        title,
        description: `${marker} description`,
        isMajor: true,
        requiresTeam: true,
        publishedAt: "2026-05-02",
        submissionStartAt: "2026-05-05",
        submissionDueAt: "2026-05-06",
        locale: "zh-cn",
        mode: "full",
      });
      assertHomeworkCreateEcho(result, {
        title,
        isMajor: true,
        requiresTeam: true,
        description: `${marker} description`,
      });
      const homeworkId = result.id;
      expect(result.homework?.completion).toBeNull();
      expect(result.homework?.sectionId).toBeGreaterThan(0);
      expect(result.homework?.publishedAt).toMatch(/\+08:00$/);
      expect(result.homework?.submissionStartAt).toMatch(/\+08:00$/);
      expect(result.homework?.submissionDueAt).toMatch(/\+08:00$/);
      const audit = await db.auditLog.findFirst({
        where: {
          targetId: homeworkId,
          action: "homework_create",
          userId: isolated.userId,
          channel: "mcp",
        },
      });
      expect(audit).toBeTruthy();

      await expect(readHomeworkState(db)).resolves.toMatchObject([
        {
          id: homeworkId,
          title,
          sectionId: section.id,
          createdById: isolated.userId,
          isMajor: true,
          requiresTeam: true,
          publishedAt: new Date("2026-05-02T00:00:00.000Z"),
          submissionStartAt: new Date("2026-05-05T00:00:00.000Z"),
          submissionDueAt: new Date("2026-05-06T00:00:00.000Z"),
          description: { content: `${marker} description` },
          homeworkCompletions: [],
        },
      ]);
    },
  );

  toolTest(
    "community_section_homework_create 对不存在的班级返回恢复提示",
    async ({
      mcpActor: isolated,
      subscribedSection: _section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const result = await isolated.client.call<{
        success?: boolean;
        found?: boolean;
        message?: string;
        hint?: string;
      }>("community_section_homework_create", {
        sectionJwId: 2_147_483_647,
        title: "[integration-test] missing section",
        publishedAt: "2026-05-02",
        submissionStartAt: "2026-05-05",
        submissionDueAt: "2026-05-06",
        locale: "zh-cn",
      });

      expect(result.success).toBe(false);
      expect(result.found).toBe(false);
      expect(result.message).toContain("2147483647");
      expect(result.hint).toContain("catalog_section_search");

      await expect(db.homework.findMany()).resolves.toEqual([]);
      await expect(db.description.findMany()).resolves.toEqual([]);
    },
  );

  toolTest(
    "community_section_homework_create 拒绝非法日期输入",
    async ({
      mcpActor: isolated,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const result = await isolated.client.call<{
        success?: boolean;
        message?: string;
      }>("community_section_homework_create", {
        sectionJwId: section.jwId,
        title: "[integration-test] bad date",
        publishedAt: "not-a-date",
        submissionStartAt: "2026-05-05",
        submissionDueAt: "2026-05-06",
        locale: "zh-cn",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid publishedAt");

      await expect(db.homework.findMany()).resolves.toEqual([]);
      await expect(db.description.findMany()).resolves.toEqual([]);
    },
  );

  toolTest(
    "community_section_homework_create 校验提交开始不晚于截止时间",
    async ({
      mcpActor: isolated,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const result = await isolated.client.call<{
        success?: boolean;
        message?: string;
      }>("community_section_homework_create", {
        sectionJwId: section.jwId,
        title: "[integration-test] inverted dates",
        publishedAt: "2026-05-02",
        submissionStartAt: "2026-05-06",
        submissionDueAt: "2026-05-05",
        locale: "zh-cn",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Submission start must be before due");

      await expect(db.homework.findMany()).resolves.toEqual([]);
      await expect(db.description.findMany()).resolves.toEqual([]);
    },
  );

  toolTest(
    "community_section_homework_create 拒绝被禁用户创建",
    async ({
      mcpActor: isolated,
      mcpOtherActor,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const suspendedUser = mcpOtherActor;
      await db.userSuspension.create({
        data: {
          userId: suspendedUser.userId,
          createdById: isolated.userId,
          reason: "integration suspended",
        },
      });

      const result = await suspendedUser.client.call<{
        success?: boolean;
        message?: string;
        reason?: string | null;
      }>("community_section_homework_create", {
        sectionJwId: section.jwId,
        title: "[integration-test] suspended create",
        publishedAt: "2026-05-02",
        submissionStartAt: "2026-05-05",
        submissionDueAt: "2026-05-06",
        locale: "zh-cn",
      });
      expect(result).toMatchObject({
        success: false,
        message: "Suspended",
        reason: "integration suspended",
      });

      await expect(db.homework.findMany()).resolves.toEqual([]);
      await expect(db.description.findMany()).resolves.toEqual([]);
    },
  );
});

describe("班级作业更新工具 — community_section_homework_update", () => {
  async function createHomeworkForUpdate(
    isolated: PrivateMcpActor,
    section: { jwId: number },
    testName: string,
  ) {
    const result = await isolated.client.call<{
      success?: boolean;
      id?: string;
    }>("community_section_homework_create", {
      sectionJwId: section.jwId,
      title: `[integration-test] ${testName} ${Date.now()}`,
      description: "original description",
      publishedAt: "2026-05-02",
      submissionStartAt: "2026-05-05",
      submissionDueAt: "2026-05-06",
      locale: "zh-cn",
      mode: "full",
    });
    expect(result.success).toBe(true);
    return result.id as string;
  }

  toolTest(
    "community_section_homework_update 更新标题、描述、标志与日期并返回完整实体",
    async ({
      mcpActor: isolated,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const homeworkId = await createHomeworkForUpdate(
        isolated,
        section,
        "update full",
      );
      const marker = `[integration-test] mcp-update-homework-${Date.now()}`;

      const result = await isolated.client.call<{
        success?: boolean;
        homework?: {
          id?: string;
          title?: string;
          isMajor?: boolean;
          requiresTeam?: boolean;
          publishedAt?: string;
          submissionStartAt?: string;
          submissionDueAt?: string;
          description?: { content?: string | null } | null;
        };
      }>("community_section_homework_update", {
        homeworkId,
        title: `${marker} updated`,
        description: `${marker} updated description`,
        isMajor: true,
        requiresTeam: true,
        publishedAt: "2026-05-05",
        submissionStartAt: "2026-05-06",
        submissionDueAt: "2026-05-10",
        locale: "zh-cn",
        mode: "full",
      });
      expect(result.success).toBe(true);
      expect(result.homework).toMatchObject({
        id: homeworkId,
        title: `${marker} updated`,
        isMajor: true,
        requiresTeam: true,
        description: { content: `${marker} updated description` },
      });
      expect(result.homework?.publishedAt).toContain("2026-05-05");
      expect(result.homework?.submissionStartAt).toContain("2026-05-06");
      expect(result.homework?.submissionDueAt).toContain("2026-05-10");

      await expect(readHomeworkState(db)).resolves.toMatchObject([
        {
          id: homeworkId,
          title: `${marker} updated`,
          sectionId: section.id,
          updatedById: isolated.userId,
          isMajor: true,
          requiresTeam: true,
          publishedAt: new Date("2026-05-05T00:00:00.000Z"),
          submissionStartAt: new Date("2026-05-06T00:00:00.000Z"),
          submissionDueAt: new Date("2026-05-10T00:00:00.000Z"),
          description: { content: `${marker} updated description` },
        },
      ]);
    },
  );

  toolTest(
    "community_section_homework_update 对不存在作业返回恢复提示",
    async ({
      mcpActor: isolated,
      subscribedSection: _section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const result = await isolated.client.call<{
        success?: boolean;
        message?: string;
        hint?: string;
      }>("community_section_homework_update", {
        homeworkId: "missing-homework-id",
        title: "updated",
        locale: "zh-cn",
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Homework not found");
      expect(result.hint).toContain("community_section_homework_list");

      await expect(readHomeworkState(db)).resolves.toEqual([]);
    },
  );

  toolTest(
    "community_section_homework_update 无变更时返回无变化",
    async ({
      mcpActor: isolated,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const homeworkId = await createHomeworkForUpdate(
        isolated,
        section,
        "no changes",
      );

      const before = await readHomeworkState(db);
      const result = await isolated.client.call<{
        success?: boolean;
        message?: string;
      }>("community_section_homework_update", {
        homeworkId,
        locale: "zh-cn",
        mode: "full",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("No changes");

      await expect(readHomeworkState(db)).resolves.toEqual(before);
    },
  );

  toolTest(
    "community_section_homework_update 拒绝更新已删除作业",
    async ({
      mcpActor: isolated,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const homeworkId = await createHomeworkForUpdate(
        isolated,
        section,
        "deleted",
      );

      await isolated.client.call("community_section_homework_delete", {
        homeworkId,
      });
      const before = await readHomeworkState(db);
      const result = await isolated.client.call<{
        success?: boolean;
        message?: string;
      }>("community_section_homework_update", {
        homeworkId,
        title: "should fail",
        locale: "zh-cn",
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Homework deleted");

      await expect(readHomeworkState(db)).resolves.toEqual(before);
    },
  );

  toolTest(
    "community_section_homework_update 校验提交开始不晚于截止时间",
    async ({
      mcpActor: isolated,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const homeworkId = await createHomeworkForUpdate(
        isolated,
        section,
        "inverted dates",
      );

      const before = await readHomeworkState(db);
      const result = await isolated.client.call<{
        success?: boolean;
        message?: string;
      }>("community_section_homework_update", {
        homeworkId,
        submissionStartAt: "2026-05-06",
        submissionDueAt: "2026-05-05",
        locale: "zh-cn",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Submission start must be before due");

      await expect(readHomeworkState(db)).resolves.toEqual(before);
    },
  );
});

describe("作业完成状态工具 — workspace_homework_completion_set", () => {
  async function createHomeworkForCompletion(
    isolated: PrivateMcpActor,
    section: { jwId: number },
    testName: string,
  ) {
    const result = await isolated.client.call<{
      success?: boolean;
      id?: string;
    }>("community_section_homework_create", {
      sectionJwId: section.jwId,
      title: `[integration-test] ${testName} ${Date.now()}`,
      publishedAt: "2026-05-02",
      submissionStartAt: "2026-05-05",
      submissionDueAt: "2026-05-06",
      locale: "zh-cn",
      mode: "full",
    });
    expect(result.success).toBe(true);
    return result.id as string;
  }

  toolTest(
    "workspace_homework_completion_set 标记完成并返回完成时间",
    async ({
      mcpActor: isolated,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const homeworkId = await createHomeworkForCompletion(
        isolated,
        section,
        "complete",
      );

      const result = await isolated.client.call<{
        success?: boolean;
        completion?: {
          homeworkId?: string;
          completed?: boolean;
          completedAt?: string | null;
        };
      }>("workspace_homework_completion_set", {
        homeworkId,
        completed: true,
        mode: "full",
      });
      expect(result.success).toBe(true);
      expect(result.completion).toMatchObject({
        homeworkId,
        completed: true,
      });
      expect(result.completion?.completedAt).toMatch(/\+08:00$/);
      const record = await db.homeworkCompletion.findUnique({
        where: {
          userId_homeworkId: {
            userId: isolated.userId,
            homeworkId,
          },
        },
      });
      expect(record).toBeTruthy();

      expect(record?.userId).toBe(isolated.userId);
      expect(record?.homeworkId).toBe(homeworkId);
      expect(record?.completedAt).toBeInstanceOf(Date);
    },
  );

  toolTest(
    "workspace_homework_completion_set 取消完成状态",
    async ({
      mcpActor: isolated,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const homeworkId = await createHomeworkForCompletion(
        isolated,
        section,
        "revert",
      );

      await isolated.client.call("workspace_homework_completion_set", {
        homeworkId,
        completed: true,
      });
      const result = await isolated.client.call<{
        success?: boolean;
        completion?: {
          homeworkId?: string;
          completed?: boolean;
          completedAt?: string | null;
        };
      }>("workspace_homework_completion_set", {
        homeworkId,
        completed: false,
        mode: "full",
      });
      expect(result.success).toBe(true);
      expect(result.completion).toMatchObject({
        homeworkId,
        completed: false,
        completedAt: null,
      });
      const record = await db.homeworkCompletion.findUnique({
        where: {
          userId_homeworkId: {
            userId: isolated.userId,
            homeworkId,
          },
        },
      });
      expect(record).toBeNull();
    },
  );

  toolTest(
    "workspace_homework_completion_set 对不存在作业返回恢复提示",
    async ({
      mcpActor: isolated,
      subscribedSection: _section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const result = await isolated.client.call<{
        success?: boolean;
        message?: string;
        hint?: string;
      }>("workspace_homework_completion_set", {
        homeworkId: "missing-homework-id",
        completed: true,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Homework not found");
      expect(result.hint).toContain("workspace_homework_list");

      await expect(db.homeworkCompletion.findMany()).resolves.toEqual([]);
    },
  );

  toolTest(
    "workspace_homework_completion_set 对已删除作业报告未找到",
    async ({
      mcpActor: isolated,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const homeworkId = await createHomeworkForCompletion(
        isolated,
        section,
        "deleted",
      );

      await isolated.client.call("community_section_homework_delete", {
        homeworkId,
      });
      const result = await isolated.client.call<{
        success?: boolean;
        message?: string;
      }>("workspace_homework_completion_set", {
        homeworkId,
        completed: true,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Homework not found");

      await expect(db.homeworkCompletion.findMany()).resolves.toEqual([]);
    },
  );
});
