import { describe } from "vitest";
import type { TestPrismaClient } from "../../../shared/prisma";
import { isolatedMcpTest } from "../_harness/isolated-context";

const toolTest = isolatedMcpTest.extend(
  "subscribedSection",
  async ({ mcpWorkflow, signal, mcpActor, mcpSection, isolatedDatabase }) => {
    const setupResult = await mcpWorkflow.run(async () => {
      await isolatedDatabase.owner.userSectionSubscription.create({
        data: { userId: mcpActor.userId, sectionId: mcpSection.id },
      });
      return mcpSection;
    });
    signal.throwIfAborted();
    return setupResult;
  },
);

function readHomeworkState(db: TestPrismaClient) {
  return db.homework.findMany({
    orderBy: { id: "asc" },
    include: {
      description: { include: { edits: { orderBy: { id: "asc" } } } },
      homeworkCompletions: { orderBy: { userId: "asc" } },
    },
  });
}

function seedHomework(
  db: TestPrismaClient,
  sectionId: number,
  createdById: string,
  title: string,
) {
  return db.homework.create({
    data: {
      sectionId,
      createdById,
      updatedById: createdById,
      title,
      description: { create: { content: "original description" } },
      publishedAt: new Date("2026-05-02T00:00:00.000Z"),
      submissionStartAt: new Date("2026-05-05T00:00:00.000Z"),
      submissionDueAt: new Date("2026-05-06T00:00:00.000Z"),
    },
  });
}

describe("班级作业写入工具 — community_section_homework_create", () => {
  toolTest(
    "community_section_homework_list 对 default/full 都使用 summary 契约",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const title = `[integration-test] mcp-list-homework-${Date.now()}`;

        const homework = await seedHomework(
          db,
          section.id,
          isolated.userId,
          title,
        );
        const homeworkId = homework.id;
        const before = await readHomeworkState(db);
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

        await expect(readHomeworkState(db)).resolves.toEqual(before);
        await expect(db.auditLog.findMany()).resolves.toEqual([]);
      }),
  );

  toolTest(
    "community_section_homework_create 创建作业并返回完整实体",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const marker = `[integration-test] mcp-create-homework-${Date.now()}`;
        const title = `${marker} title`;
        await seedHomework(
          db,
          section.id,
          mcpOtherActor.userId,
          "[integration-test] unchanged foreign homework",
        );
        const before = await readHomeworkState(db);

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
        expect(result.success).toBe(true);
        expect(result.id).toEqual(expect.any(String));
        expect(result.id).toBeTruthy();
        expect(result.homework).toMatchObject({
          id: result.id,
          title,
          isMajor: true,
          requiresTeam: true,
          description: { content: `${marker} description` },
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

        const after = await readHomeworkState(db);
        expect(after.filter(({ id }) => id !== homeworkId)).toEqual(before);
        expect(after.filter(({ id }) => id === homeworkId)).toMatchObject([
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
      }),
  );

  toolTest(
    "community_section_homework_create 对不存在的班级返回恢复提示",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      subscribedSection: _section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
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
        await expect(db.descriptionEdit.findMany()).resolves.toEqual([]);
        await expect(db.auditLog.findMany()).resolves.toEqual([]);
      }),
  );

  toolTest(
    "community_section_homework_create 拒绝非法日期输入",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
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
        await expect(db.descriptionEdit.findMany()).resolves.toEqual([]);
        await expect(db.auditLog.findMany()).resolves.toEqual([]);
      }),
  );

  toolTest(
    "community_section_homework_create 校验提交开始不晚于截止时间",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
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
        await expect(db.descriptionEdit.findMany()).resolves.toEqual([]);
        await expect(db.auditLog.findMany()).resolves.toEqual([]);
      }),
  );

  toolTest(
    "community_section_homework_create 拒绝被禁用户创建",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
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
        await expect(db.descriptionEdit.findMany()).resolves.toEqual([]);
        await expect(db.auditLog.findMany()).resolves.toEqual([]);
      }),
  );
});

describe("班级作业更新工具 — community_section_homework_update", () => {
  toolTest(
    "community_section_homework_update 更新标题、描述、标志与日期并返回完整实体",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        await seedHomework(
          db,
          section.id,
          mcpOtherActor.userId,
          "[integration-test] unchanged foreign homework",
        );
        const homework = await seedHomework(
          db,
          section.id,
          isolated.userId,
          "[integration-test] update full",
        );
        const homeworkId = homework.id;
        const marker = `[integration-test] mcp-update-homework-${Date.now()}`;
        await db.homeworkCompletion.create({
          data: { userId: mcpOtherActor.userId, homeworkId },
        });
        const before = await readHomeworkState(db);
        const original = before.find(({ id }) => id === homeworkId);
        if (!original?.description)
          throw new Error("Expected seeded homework description");

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

        expect(await readHomeworkState(db)).toEqual(
          before.map((row) =>
            row.id !== homeworkId
              ? row
              : {
                  ...original,
                  title: `${marker} updated`,
                  updatedById: isolated.userId,
                  updatedAt: expect.any(Date),
                  isMajor: true,
                  requiresTeam: true,
                  publishedAt: new Date("2026-05-05T00:00:00.000Z"),
                  submissionStartAt: new Date("2026-05-06T00:00:00.000Z"),
                  submissionDueAt: new Date("2026-05-10T00:00:00.000Z"),
                  description: {
                    ...original.description,
                    content: `${marker} updated description`,
                    updatedAt: expect.any(Date),
                    lastEditedAt: expect.any(Date),
                    lastEditedById: isolated.userId,
                    edits: [
                      {
                        id: expect.any(String),
                        descriptionId: original.description?.id,
                        editorId: isolated.userId,
                        previousContent: "original description",
                        nextContent: `${marker} updated description`,
                        createdAt: expect.any(Date),
                      },
                    ],
                  },
                },
          ),
        );
        expect(
          await db.auditLog.findMany({
            where: { action: "homework_update" },
            select: { userId: true, targetId: true, channel: true },
          }),
        ).toEqual([
          { userId: isolated.userId, targetId: homeworkId, channel: "mcp" },
        ]);
      }),
  );

  toolTest(
    "community_section_homework_update 对不存在作业返回恢复提示",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        await seedHomework(
          db,
          section.id,
          mcpOtherActor.userId,
          "[integration-test] unchanged foreign homework",
        );
        const before = await readHomeworkState(db);
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

        await expect(readHomeworkState(db)).resolves.toEqual(before);
        expect(await db.auditLog.findMany()).toEqual([]);
      }),
  );

  toolTest(
    "community_section_homework_update 无变更时返回无变化",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        await seedHomework(
          db,
          section.id,
          mcpOtherActor.userId,
          "[integration-test] unchanged foreign homework",
        );
        const homework = await seedHomework(
          db,
          section.id,
          isolated.userId,
          "[integration-test] no changes",
        );
        const homeworkId = homework.id;

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
        expect(await db.auditLog.findMany()).toEqual([]);
      }),
  );

  toolTest(
    "community_section_homework_update 拒绝更新已删除作业",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        await seedHomework(
          db,
          section.id,
          mcpOtherActor.userId,
          "[integration-test] unchanged foreign homework",
        );
        const homework = await db.homework.create({
          data: {
            sectionId: section.id,
            createdById: isolated.userId,
            title: "[integration-test] deleted homework",
            deletedAt: new Date("2026-05-01T00:00:00.000Z"),
            deletedById: isolated.userId,
          },
        });
        const homeworkId = homework.id;
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
        expect(await db.auditLog.findMany()).toEqual([]);
      }),
  );

  toolTest(
    "community_section_homework_update 校验提交开始不晚于截止时间",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        await seedHomework(
          db,
          section.id,
          mcpOtherActor.userId,
          "[integration-test] unchanged foreign homework",
        );
        const homework = await seedHomework(
          db,
          section.id,
          isolated.userId,
          "[integration-test] inverted dates",
        );
        const homeworkId = homework.id;

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
        expect(await db.auditLog.findMany()).toEqual([]);
      }),
  );
});

describe("作业完成状态工具 — workspace_homework_completion_set", () => {
  toolTest(
    "workspace_homework_completion_set 标记完成并返回完成时间",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const homework = await seedHomework(
          db,
          section.id,
          isolated.userId,
          "[integration-test] complete homework",
        );
        const foreign = await db.homeworkCompletion.create({
          data: {
            userId: mcpOtherActor.userId,
            homeworkId: homework.id,
            completedAt: new Date("2026-05-03T12:00:00.000Z"),
          },
        });
        const before = await readHomeworkState(db);
        const result = await isolated.client.call<{
          success?: boolean;
          completion?: {
            homeworkId?: string;
            completed?: boolean;
            completedAt?: string | null;
          };
        }>("workspace_homework_completion_set", {
          homeworkId: homework.id,
          completed: true,
          mode: "full",
        });
        expect(result).toMatchObject({
          success: true,
          completion: { homeworkId: homework.id, completed: true },
        });
        expect(result.completion?.completedAt).toMatch(/\+08:00$/);
        const after = await readHomeworkState(db);
        expect(after).toEqual([
          {
            ...before[0],
            homeworkCompletions: [
              foreign,
              {
                userId: isolated.userId,
                homeworkId: homework.id,
                completedAt: expect.any(Date),
              },
            ].sort((a, b) => a.userId.localeCompare(b.userId)),
          },
        ]);
        const completion = after[0].homeworkCompletions.find(
          ({ userId }) => userId === isolated.userId,
        );
        expect(new Date(result.completion?.completedAt ?? "").getTime()).toBe(
          completion?.completedAt.getTime(),
        );
        expect(await db.auditLog.findMany()).toEqual([]);
      }),
  );

  toolTest(
    "workspace_homework_completion_set 取消完成状态",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const homework = await seedHomework(
          db,
          section.id,
          isolated.userId,
          "[integration-test] completed homework",
        );
        const foreign = await db.homeworkCompletion.create({
          data: {
            userId: mcpOtherActor.userId,
            homeworkId: homework.id,
            completedAt: new Date("2026-05-03T12:00:00.000Z"),
          },
        });
        await db.homeworkCompletion.create({
          data: {
            userId: isolated.userId,
            homeworkId: homework.id,
            completedAt: new Date("2026-05-04T12:00:00.000Z"),
          },
        });
        const before = await readHomeworkState(db);
        const result = await isolated.client.call<{
          success?: boolean;
          completion?: {
            homeworkId?: string;
            completed?: boolean;
            completedAt?: string | null;
          };
        }>("workspace_homework_completion_set", {
          homeworkId: homework.id,
          completed: false,
          mode: "full",
        });
        expect(result).toMatchObject({
          success: true,
          completion: {
            homeworkId: homework.id,
            completed: false,
            completedAt: null,
          },
        });
        expect(await readHomeworkState(db)).toEqual([
          { ...before[0], homeworkCompletions: [foreign] },
        ]);
        expect(await db.auditLog.findMany()).toEqual([]);
      }),
  );

  toolTest(
    "workspace_homework_completion_set 对不存在作业返回恢复提示",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const homework = await seedHomework(
          db,
          section.id,
          mcpOtherActor.userId,
          "[integration-test] unrelated homework",
        );
        await db.homeworkCompletion.create({
          data: { userId: mcpOtherActor.userId, homeworkId: homework.id },
        });
        const before = await readHomeworkState(db);
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
        expect(await readHomeworkState(db)).toEqual(before);
        expect(await db.auditLog.findMany()).toEqual([]);
      }),
  );

  toolTest(
    "workspace_homework_completion_set 对已删除作业报告未找到",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      subscribedSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const homework = await db.homework.create({
          data: {
            sectionId: section.id,
            createdById: isolated.userId,
            title: "[integration-test] deleted homework",
            deletedAt: new Date("2026-05-01T00:00:00.000Z"),
            deletedById: isolated.userId,
            homeworkCompletions: {
              create: {
                userId: mcpOtherActor.userId,
                completedAt: new Date("2026-05-03T12:00:00.000Z"),
              },
            },
          },
        });
        const before = await readHomeworkState(db);
        const result = await isolated.client.call<{
          success?: boolean;
          message?: string;
        }>("workspace_homework_completion_set", {
          homeworkId: homework.id,
          completed: true,
        });
        expect(result.success).toBe(false);
        expect(result.message).toBe("Homework not found");
        expect(await readHomeworkState(db)).toEqual(before);
        expect(await db.auditLog.findMany()).toEqual([]);
      }),
  );
});

describe("班级作业删除工具 — community_section_homework_delete", () => {
  toolTest(
    "community_section_homework_delete 删除创建者拥有的作业并记录审计",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      mcpSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const homework = await seedHomework(
          db,
          section.id,
          isolated.userId,
          "[integration-test] delete homework",
        );
        await seedHomework(
          db,
          section.id,
          mcpOtherActor.userId,
          "[integration-test] retained foreign homework",
        );
        await db.homeworkCompletion.create({
          data: { userId: mcpOtherActor.userId, homeworkId: homework.id },
        });
        const before = await readHomeworkState(db);
        const result = await isolated.client.call<{
          alreadyDeleted?: boolean;
          deletedId?: string;
          success?: boolean;
        }>("community_section_homework_delete", { homeworkId: homework.id });
        expect(result).toEqual({
          success: true,
          deletedId: homework.id,
          alreadyDeleted: false,
        });
        expect(await readHomeworkState(db)).toEqual(
          before.map((row) =>
            row.id !== homework.id
              ? row
              : {
                  ...row,
                  deletedAt: expect.any(Date),
                  deletedById: isolated.userId,
                  updatedById: isolated.userId,
                  updatedAt: expect.any(Date),
                },
          ),
        );
        expect(
          await db.auditLog.findMany({
            select: {
              targetId: true,
              action: true,
              userId: true,
              channel: true,
            },
          }),
        ).toEqual([
          {
            targetId: homework.id,
            action: "homework_delete",
            userId: isolated.userId,
            channel: "mcp",
          },
        ]);
      }),
  );

  toolTest(
    "community_section_homework_delete 对不存在作业返回 not_found",
    { tags: ["@Homework/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      mcpSection: section,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        await seedHomework(
          db,
          section.id,
          mcpOtherActor.userId,
          "[integration-test] retained foreign homework",
        );
        const before = await readHomeworkState(db);
        const result = await isolated.client.call<{
          error?: string;
          success?: boolean;
        }>("community_section_homework_delete", {
          homeworkId: "missing-homework-id",
        });
        expect(result).toMatchObject({ success: false, error: "not_found" });
        expect(await readHomeworkState(db)).toEqual(before);
        expect(await db.auditLog.findMany()).toEqual([]);
      }),
  );

  for (const isAdmin of [false, true]) {
    toolTest(
      `community_section_homework_delete 非所有者${isAdmin ? "管理员" : "普通用户"}被拒绝`,
      { tags: ["@Homework/MCP"] },
      async ({
        mcpWorkflow,
        mcpOtherActor,
        mcpSection: section,
        mcpSessions,
        isolatedDatabase: { owner: db },
        expect,
      }) =>
        mcpWorkflow.run(async () => {
          const actor = await db.user.create({
            data: {
              email: "homework-deleter@example.test",
              name: "Foreign homework deleter",
              isAdmin,
            },
          });
          const session = mcpSessions.own(actor.id, [
            "community.section-homework:write",
          ]);
          await session.initialize();
          const homework = await seedHomework(
            db,
            section.id,
            mcpOtherActor.userId,
            "[integration-test] retained foreign homework",
          );
          const before = await readHomeworkState(db);
          const result = await session.client.call<{
            error?: string;
            success?: boolean;
          }>("community_section_homework_delete", { homeworkId: homework.id });
          expect(result).toMatchObject({ success: false, error: "forbidden" });
          expect(await readHomeworkState(db)).toEqual(before);
          expect(await db.auditLog.findMany()).toEqual([]);
        }),
    );
  }
});
