import { describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("描述工具 — MCP 暴露 REST 描述载荷", () => {
  it("get_description 通过公开 JW id 返回种子班级描述", async () => {
    const section = await fixtures.prisma.section.findUnique({
      where: { jwId: fixtures.DEV_SEED.section.jwId },
      select: { id: true },
    });
    expect(section?.id).toBeTruthy();

    type Result = {
      found?: boolean;
      description?: {
        content?: string;
        id?: string | null;
        renderedHtml?: string;
      };
      history?: Array<{ id?: string; nextContent?: string }>;
      target?: { targetId?: number; type?: string };
      viewer?: { isAuthenticated?: boolean; userId?: string | null };
    };
    const results = await Promise.all(
      (["default", "summary", "full"] as const).map(async (mode) => ({
        mode,
        result: await context.client.call<Result>("get_description", {
          targetType: "section",
          sectionJwId: fixtures.DEV_SEED.section.jwId,
          mode,
        }),
      })),
    );
    const result = results.find(({ mode }) => mode === "full")?.result;
    if (!result) throw new Error("Missing full-mode description result");

    expect(result.found).toBe(true);
    expect(result.target).toMatchObject({
      targetId: section?.id,
      type: "section",
    });
    expect(result.description?.id).toBeTruthy();
    expect(result.description?.content).toContain("课程建议");
    expect(result.history?.length).toBeGreaterThan(0);
    expect(result.viewer).toMatchObject({
      isAuthenticated: true,
      userId: context.devUserId,
    });
    for (const { mode, result: modeResult } of results) {
      expect(Object.hasOwn(modeResult.description ?? {}, "renderedHtml")).toBe(
        mode === "full",
      );
    }
  });

  it("get_description 报告缺失的公开班级目标", async () => {
    const result = await context.client.call<{
      success?: boolean;
      found?: boolean;
      error?: string;
      hint?: string;
    }>("get_description", {
      targetType: "section",
      sectionJwId: 2_147_483_647,
    });

    expect(result.success).toBe(false);
    expect(result.found).toBe(false);
    expect(result.error).toBe("target_not_found");
    expect(result.hint).toContain("search_sections");
  });

  it("upsert_description 创建、幂等重读、审计并清理", async () => {
    const marker = `[integration-test] mcp-description-${Date.now()}`;
    const teacher = await fixtures.prisma.teacher.create({
      data: {
        code: marker,
        nameCn: marker,
      },
      select: { id: true },
    });
    let descriptionId: string | undefined;

    try {
      type Result = {
        success?: boolean;
        id?: string;
        updated?: boolean;
        description?: {
          content?: string;
          id?: string | null;
          renderedHtml?: string;
        };
        target?: { targetId?: number; type?: string };
      };
      const results: Array<{
        mode: "default" | "summary" | "full";
        result: Result;
      }> = [];
      for (const mode of ["default", "summary", "full"] as const) {
        results.push({
          mode,
          result: await context.client.call<Result>("upsert_description", {
            targetType: "teacher",
            teacherId: teacher.id,
            content: ` ${marker} `,
            mode,
          }),
        });
      }
      const created = results[0]?.result ?? {};
      descriptionId = created.id;

      expect(created.success).toBe(true);
      expect(created.updated).toBe(true);
      expect(created.target).toMatchObject({
        targetId: teacher.id,
        type: "teacher",
      });
      expect(created.description?.id).toBe(descriptionId);
      expect(created.description?.content).toBe(marker);
      for (const { mode, result } of results) {
        expect(result.id).toBe(descriptionId);
        expect(Object.hasOwn(result.description ?? {}, "renderedHtml")).toBe(
          mode === "full",
        );
      }

      const auditLog = descriptionId
        ? await fixtures.findDescriptionEditAuditLog(descriptionId)
        : null;
      expect(auditLog?.metadata).toMatchObject({
        source: "mcp",
        targetType: "teacher",
      });

      const idempotent = results[2]?.result ?? {};

      expect(idempotent.success).toBe(true);
      expect(idempotent.id).toBe(descriptionId);
      expect(idempotent.updated).toBe(false);
      expect(idempotent.description?.content).toBe(marker);
    } finally {
      if (descriptionId) {
        await fixtures.findDescriptionEditAuditLog(descriptionId);
        await fixtures.prisma.auditLog.deleteMany({
          where: {
            action: "description_edit",
            targetId: descriptionId,
            targetType: "description",
            userId: context.devUserId,
          },
        });
      }
      await fixtures.prisma.descriptionEdit.deleteMany({
        where: { description: { teacherId: teacher.id } },
      });
      await fixtures.prisma.description.deleteMany({
        where: { teacherId: teacher.id },
      });
      await fixtures.prisma.teacher.deleteMany({ where: { id: teacher.id } });
    }
  });
});

// ---------------------------------------------------------------------------
// Todos
// ---------------------------------------------------------------------------
