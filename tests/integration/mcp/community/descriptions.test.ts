import { describe } from "vitest";
import { isolatedMcpTest as toolTest } from "../_harness/isolated-context";

describe("描述工具 — MCP 暴露 REST 描述载荷", () => {
  toolTest(
    "description.mcp-markdown-projection",
    async ({
      mcpActor: isolated,
      mcpSection,
      isolatedDatabase: { owner: db },
      expect,
    }) => {
      const section = await db.section.findUnique({
        where: { jwId: mcpSection.jwId },
        select: { id: true },
      });
      await db.description.create({
        data: {
          sectionId: mcpSection.id,
          content: "## 课程建议\n先复习，再完成练习。",
          lastEditedById: isolated.userId,
          lastEditedAt: new Date("2026-04-29T00:00:00.000Z"),
          edits: {
            create: {
              editorId: isolated.userId,
              previousContent: "",
              nextContent: "## 课程建议\n先复习，再完成练习。",
            },
          },
        },
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
        (["default", "full"] as const).map(async (mode) => ({
          mode,
          result: await isolated.client.call<Result>(
            "community_description_get",
            {
              targetType: "section",
              sectionJwId: mcpSection.jwId,
              mode,
            },
          ),
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
        userId: isolated.userId,
      });
      expect(result.description?.renderedHtml).toContain("课程建议");
      for (const { mode, result: modeResult } of results) {
        expect(modeResult.description?.content).toBe(
          result.description?.content,
        );
        expect(
          Object.hasOwn(modeResult.description ?? {}, "renderedHtml"),
        ).toBe(mode === "full");
      }
    },
  );

  toolTest(
    "community_description_get 报告缺失的公开班级目标",
    async ({ mcpActor: isolated, expect }) => {
      const result = await isolated.client.call<{
        success?: boolean;
        found?: boolean;
        error?: string;
        hint?: string;
      }>("community_description_get", {
        targetType: "section",
        sectionJwId: 2_147_483_647,
      });

      expect(result.success).toBe(false);
      expect(result.found).toBe(false);
      expect(result.error).toBe("target_not_found");
      expect(result.hint).toContain("catalog_section_search");
    },
  );

  toolTest(
    "community_description_set 创建、幂等重读、审计并清理",
    async ({ mcpActor: isolated, isolatedDatabase: { owner: db }, expect }) => {
      const marker = `[integration-test] mcp-description-${Date.now()}`;
      const teacher = await db.teacher.create({
        data: {
          code: marker,
          jwId: 1,
          nameCn: marker,
        },
        select: { id: true },
      });

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
        mode: "default" | "full";
        result: Result;
      }> = [];
      for (const mode of ["default", "full"] as const) {
        results.push({
          mode,
          result: await isolated.client.call<Result>(
            "community_description_set",
            {
              targetType: "teacher",
              teacherId: teacher.id,
              content: ` ${marker} `,
              mode,
            },
          ),
        });
      }
      const created = results[0]?.result ?? {};
      const descriptionId = created.id;
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
        ? await db.auditLog.findFirst({
            where: {
              action: "description_edit",
              targetId: descriptionId,
              targetType: "description",
              userId: isolated.userId,
            },
            select: { id: true, metadata: true },
          })
        : null;
      expect(auditLog).not.toBeNull();
      expect(auditLog?.metadata).toMatchObject({
        source: "mcp",
        targetType: "teacher",
      });
      const idempotent = results[1]?.result ?? {};
      expect(idempotent.success).toBe(true);
      expect(idempotent.id).toBe(descriptionId);
      expect(idempotent.updated).toBe(false);
      expect(idempotent.description?.content).toBe(marker);
      await expect(
        db.description.findMany({
          select: {
            id: true,
            teacherId: true,
            content: true,
            lastEditedById: true,
          },
        }),
      ).resolves.toEqual([
        {
          id: descriptionId,
          teacherId: teacher.id,
          content: marker,
          lastEditedById: isolated.userId,
        },
      ]);
      await expect(
        db.descriptionEdit.findMany({
          select: {
            descriptionId: true,
            editorId: true,
            previousContent: true,
            nextContent: true,
          },
        }),
      ).resolves.toEqual([
        {
          descriptionId,
          editorId: isolated.userId,
          previousContent: null,
          nextContent: marker,
        },
      ]);
    },
  );
});
