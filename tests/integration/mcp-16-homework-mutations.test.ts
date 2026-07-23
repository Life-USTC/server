import { describe, expect, it } from "vitest";
import { createMcpHarness } from "./utils/mcp-harness";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("班级作业写入工具 — community_section_homework_create", () => {
  async function deleteIntegrationHomework(homeworkId: string | undefined) {
    if (!homeworkId) return;
    await fixtures.prisma.homeworkCompletion.deleteMany({
      where: { homeworkId },
    });
    await fixtures.prisma.homeworkAuditLog.deleteMany({
      where: { homeworkId },
    });
    await fixtures.prisma.descriptionEdit.deleteMany({
      where: { description: { homeworkId } },
    });
    await fixtures.prisma.description.deleteMany({
      where: { homeworkId },
    });
    await fixtures.prisma.homework.deleteMany({ where: { id: homeworkId } });
  }

  it("community_section_homework_create 创建作业并返回完整实体", async () => {
    const marker = `[integration-test] mcp-create-homework-${Date.now()}`;
    const title = `${marker} title`;
    let homeworkId: string | undefined;

    try {
      const result = await context.client.call<{
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
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        title,
        description: `${marker} description`,
        isMajor: true,
        requiresTeam: true,
        publishedAt: fixtures.SEED_PLUS_THREE_DAYS,
        submissionStartAt: fixtures.SEED_PLUS_SIX_DAYS,
        submissionDueAt: fixtures.SEED_PLUS_SEVEN_DAYS,
        locale: "zh-cn",
        mode: "full",
      });

      expect(result.success).toBe(true);
      expect(typeof result.id).toBe("string");
      homeworkId = result.id;

      expect(result.homework).toMatchObject({
        id: homeworkId,
        title,
        isMajor: true,
        requiresTeam: true,
        description: { content: `${marker} description` },
        completion: null,
      });
      expect(result.homework?.sectionId).toBeGreaterThan(0);
      expect(result.homework?.publishedAt).toMatch(/\+08:00$/);
      expect(result.homework?.submissionStartAt).toMatch(/\+08:00$/);
      expect(result.homework?.submissionDueAt).toMatch(/\+08:00$/);

      const audit = await fixtures.prisma.homeworkAuditLog.findFirst({
        where: {
          homeworkId,
          action: "created",
          actorId: context.devUserId,
        },
      });
      expect(audit).toBeTruthy();
    } finally {
      await deleteIntegrationHomework(homeworkId);
    }
  });

  it("community_section_homework_create 对不存在的班级返回恢复提示", async () => {
    const result = await context.client.call<{
      success?: boolean;
      found?: boolean;
      message?: string;
      hint?: string;
    }>("community_section_homework_create", {
      sectionJwId: 2_147_483_647,
      title: "[integration-test] missing section",
      publishedAt: fixtures.SEED_PLUS_THREE_DAYS,
      submissionStartAt: fixtures.SEED_PLUS_SIX_DAYS,
      submissionDueAt: fixtures.SEED_PLUS_SEVEN_DAYS,
      locale: "zh-cn",
    });

    expect(result.success).toBe(false);
    expect(result.found).toBe(false);
    expect(result.message).toContain("2147483647");
    expect(result.hint).toContain("catalog_section_search");
  });

  it("community_section_homework_create 拒绝非法日期输入", async () => {
    const result = await context.client.call<{
      success?: boolean;
      message?: string;
    }>("community_section_homework_create", {
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      title: "[integration-test] bad date",
      publishedAt: "not-a-date",
      submissionStartAt: fixtures.SEED_PLUS_SIX_DAYS,
      submissionDueAt: fixtures.SEED_PLUS_SEVEN_DAYS,
      locale: "zh-cn",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid publishedAt");
  });

  it("community_section_homework_create 校验提交开始不晚于截止时间", async () => {
    const result = await context.client.call<{
      success?: boolean;
      message?: string;
    }>("community_section_homework_create", {
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      title: "[integration-test] inverted dates",
      publishedAt: fixtures.SEED_PLUS_THREE_DAYS,
      submissionStartAt: fixtures.SEED_PLUS_SEVEN_DAYS,
      submissionDueAt: fixtures.SEED_PLUS_SIX_DAYS,
      locale: "zh-cn",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Submission start must be before due");
  });

  it("community_section_homework_create 拒绝被禁用户创建", async () => {
    const suspendedUser = await fixtures.prisma.user.create({
      data: {
        email: fixtures.integrationUserEmail("mcp-create-homework-suspended"),
        name: "MCP Create Homework Suspended",
      },
      select: { id: true },
    });
    const suspension = await fixtures.prisma.userSuspension.create({
      data: {
        userId: suspendedUser.id,
        createdById: context.devUserId,
        reason: "integration suspended",
      },
    });
    const suspendedMcp = await createMcpHarness(suspendedUser.id);

    try {
      const result = await suspendedMcp.call<{
        success?: boolean;
        message?: string;
        reason?: string | null;
      }>("community_section_homework_create", {
        sectionJwId: fixtures.DEV_SEED.section.jwId,
        title: "[integration-test] suspended create",
        publishedAt: fixtures.SEED_PLUS_THREE_DAYS,
        submissionStartAt: fixtures.SEED_PLUS_SIX_DAYS,
        submissionDueAt: fixtures.SEED_PLUS_SEVEN_DAYS,
        locale: "zh-cn",
      });

      expect(result).toMatchObject({
        success: false,
        message: "Suspended",
        reason: "integration suspended",
      });
    } finally {
      await suspendedMcp.close();
      await fixtures.prisma.userSuspension.deleteMany({
        where: { id: suspension.id },
      });
      await fixtures.prisma.user.deleteMany({
        where: { id: suspendedUser.id },
      });
    }
  });
});

describe("班级作业更新工具 — community_section_homework_update", () => {
  async function deleteIntegrationHomework(homeworkId: string | undefined) {
    if (!homeworkId) return;
    await fixtures.prisma.homeworkCompletion.deleteMany({
      where: { homeworkId },
    });
    await fixtures.prisma.homeworkAuditLog.deleteMany({
      where: { homeworkId },
    });
    await fixtures.prisma.descriptionEdit.deleteMany({
      where: { description: { homeworkId } },
    });
    await fixtures.prisma.description.deleteMany({
      where: { homeworkId },
    });
    await fixtures.prisma.homework.deleteMany({ where: { id: homeworkId } });
  }

  async function createHomeworkForUpdate(testName: string) {
    const result = await context.client.call<{
      success?: boolean;
      id?: string;
    }>("community_section_homework_create", {
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      title: `[integration-test] ${testName} ${Date.now()}`,
      description: "original description",
      publishedAt: fixtures.SEED_PLUS_THREE_DAYS,
      submissionStartAt: fixtures.SEED_PLUS_SIX_DAYS,
      submissionDueAt: fixtures.SEED_PLUS_SEVEN_DAYS,
      locale: "zh-cn",
      mode: "full",
    });
    expect(result.success).toBe(true);
    return result.id as string;
  }

  it("community_section_homework_update 更新标题、描述、标志与日期并返回完整实体", async () => {
    const homeworkId = await createHomeworkForUpdate("update full");
    const marker = `[integration-test] mcp-update-homework-${Date.now()}`;

    try {
      const result = await context.client.call<{
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
        publishedAt: fixtures.SEED_PLUS_SIX_DAYS,
        submissionStartAt: fixtures.SEED_PLUS_SEVEN_DAYS,
        submissionDueAt: fixtures.SEED_PLUS_ELEVEN_DAYS,
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
      expect(result.homework?.publishedAt).toContain(
        fixtures.SEED_PLUS_SIX_DAYS,
      );
      expect(result.homework?.submissionStartAt).toContain(
        fixtures.SEED_PLUS_SEVEN_DAYS,
      );
      expect(result.homework?.submissionDueAt).toContain(
        fixtures.SEED_PLUS_ELEVEN_DAYS,
      );
    } finally {
      await deleteIntegrationHomework(homeworkId);
    }
  });

  it("community_section_homework_update 对不存在作业返回恢复提示", async () => {
    const result = await context.client.call<{
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
  });

  it("community_section_homework_update 无变更时返回无变化", async () => {
    const homeworkId = await createHomeworkForUpdate("no changes");

    try {
      const result = await context.client.call<{
        success?: boolean;
        message?: string;
      }>("community_section_homework_update", {
        homeworkId,
        locale: "zh-cn",
        mode: "full",
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("No changes");
    } finally {
      await deleteIntegrationHomework(homeworkId);
    }
  });

  it("community_section_homework_update 拒绝更新已删除作业", async () => {
    const homeworkId = await createHomeworkForUpdate("deleted");

    try {
      await context.client.call("community_section_homework_delete", {
        homeworkId,
      });

      const result = await context.client.call<{
        success?: boolean;
        message?: string;
      }>("community_section_homework_update", {
        homeworkId,
        title: "should fail",
        locale: "zh-cn",
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Homework deleted");
    } finally {
      await deleteIntegrationHomework(homeworkId);
    }
  });

  it("community_section_homework_update 校验提交开始不晚于截止时间", async () => {
    const homeworkId = await createHomeworkForUpdate("inverted dates");

    try {
      const result = await context.client.call<{
        success?: boolean;
        message?: string;
      }>("community_section_homework_update", {
        homeworkId,
        submissionStartAt: fixtures.SEED_PLUS_SEVEN_DAYS,
        submissionDueAt: fixtures.SEED_PLUS_SIX_DAYS,
        locale: "zh-cn",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Submission start must be before due");
    } finally {
      await deleteIntegrationHomework(homeworkId);
    }
  });
});

describe("作业完成状态工具 — workspace_homework_completion_set", () => {
  async function deleteIntegrationHomework(homeworkId: string | undefined) {
    if (!homeworkId) return;
    await fixtures.prisma.homeworkCompletion.deleteMany({
      where: { homeworkId },
    });
    await fixtures.prisma.homeworkAuditLog.deleteMany({
      where: { homeworkId },
    });
    await fixtures.prisma.descriptionEdit.deleteMany({
      where: { description: { homeworkId } },
    });
    await fixtures.prisma.description.deleteMany({
      where: { homeworkId },
    });
    await fixtures.prisma.homework.deleteMany({ where: { id: homeworkId } });
  }

  async function createHomeworkForCompletion(testName: string) {
    const result = await context.client.call<{
      success?: boolean;
      id?: string;
    }>("community_section_homework_create", {
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      title: `[integration-test] ${testName} ${Date.now()}`,
      publishedAt: fixtures.SEED_PLUS_THREE_DAYS,
      submissionStartAt: fixtures.SEED_PLUS_SIX_DAYS,
      submissionDueAt: fixtures.SEED_PLUS_SEVEN_DAYS,
      locale: "zh-cn",
      mode: "full",
    });
    expect(result.success).toBe(true);
    return result.id as string;
  }

  it("workspace_homework_completion_set 标记完成并返回完成时间", async () => {
    const homeworkId = await createHomeworkForCompletion("complete");

    try {
      const result = await context.client.call<{
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

      const record = await fixtures.prisma.homeworkCompletion.findUnique({
        where: {
          userId_homeworkId: {
            userId: context.devUserId,
            homeworkId,
          },
        },
      });
      expect(record).toBeTruthy();
    } finally {
      await deleteIntegrationHomework(homeworkId);
    }
  });

  it("workspace_homework_completion_set 取消完成状态", async () => {
    const homeworkId = await createHomeworkForCompletion("revert");

    try {
      await context.client.call("workspace_homework_completion_set", {
        homeworkId,
        completed: true,
      });

      const result = await context.client.call<{
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

      const record = await fixtures.prisma.homeworkCompletion.findUnique({
        where: {
          userId_homeworkId: {
            userId: context.devUserId,
            homeworkId,
          },
        },
      });
      expect(record).toBeNull();
    } finally {
      await deleteIntegrationHomework(homeworkId);
    }
  });

  it("workspace_homework_completion_set 对不存在作业返回恢复提示", async () => {
    const result = await context.client.call<{
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
  });

  it("workspace_homework_completion_set 对已删除作业报告未找到", async () => {
    const homeworkId = await createHomeworkForCompletion("deleted");

    try {
      await context.client.call("community_section_homework_delete", {
        homeworkId,
      });

      const result = await context.client.call<{
        success?: boolean;
        message?: string;
      }>("workspace_homework_completion_set", {
        homeworkId,
        completed: true,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Homework not found");
    } finally {
      await deleteIntegrationHomework(homeworkId);
    }
  });
});
