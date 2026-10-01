import { describe } from "vitest";
import { isolatedMcpTest as toolTest } from "../_harness/isolated-context";

describe("描述工具 — MCP 暴露 REST 描述载荷", () => {
  toolTest(
    "description.mcp-markdown-projection",
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpSection,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
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
      }),
  );

  toolTest(
    "community_description_get 报告缺失的公开班级目标",
    async ({ mcpWorkflow, mcpActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
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
      }),
  );

  for (const operation of ["create", "unchanged"] as const) {
    toolTest(
      `community_description_set ${operation} observes independently prepared state`,
      async ({
        mcpWorkflow,
        mcpActor: actor,
        isolatedDatabase: { owner: db },
        expect,
      }) =>
        mcpWorkflow.run(async () => {
          const content =
            "[integration-test] Independently prepared MCP description";
          const teacher = await db.teacher.create({
            data: {
              code: "MCP-DESCRIPTION",
              jwId: 1,
              nameCn: "Description teacher",
            },
          });
          const existing =
            operation === "unchanged"
              ? await db.description.create({
                  data: {
                    teacherId: teacher.id,
                    content,
                    lastEditedById: actor.userId,
                  },
                })
              : null;
          const mode = operation === "create" ? "default" : "full";
          const result = await actor.client.call<{
            success: boolean;
            id: string;
            updated: boolean;
            description: { id: string; content: string; renderedHtml?: string };
            target: { targetId: number; type: string };
          }>("community_description_set", {
            targetType: "teacher",
            teacherId: teacher.id,
            content: ` ${content} `,
            mode,
          });
          expect(result).toMatchObject({
            success: true,
            updated: operation === "create",
            target: { targetId: teacher.id, type: "teacher" },
            description: { id: result.id, content },
          });
          expect(result.id).toEqual(existing?.id ?? expect.any(String));
          expect(Object.hasOwn(result.description, "renderedHtml")).toBe(
            mode === "full",
          );
          if (existing) {
            expect(await db.description.findMany()).toEqual([existing]);
            expect(await db.descriptionEdit.findMany()).toEqual([]);
            expect(await db.auditLog.findMany()).toEqual([]);
          } else {
            expect(
              await db.description.findMany({
                select: {
                  id: true,
                  teacherId: true,
                  content: true,
                  lastEditedById: true,
                },
              }),
            ).toEqual([
              {
                id: result.id,
                teacherId: teacher.id,
                content,
                lastEditedById: actor.userId,
              },
            ]);
            expect(
              await db.descriptionEdit.findMany({
                select: {
                  descriptionId: true,
                  editorId: true,
                  previousContent: true,
                  nextContent: true,
                },
              }),
            ).toEqual([
              {
                descriptionId: result.id,
                editorId: actor.userId,
                previousContent: null,
                nextContent: content,
              },
            ]);
            expect(
              await db.auditLog.findMany({
                select: {
                  action: true,
                  targetId: true,
                  targetType: true,
                  userId: true,
                  metadata: true,
                },
              }),
            ).toEqual([
              {
                action: "description_edit",
                targetId: result.id,
                targetType: "description",
                userId: actor.userId,
                metadata: expect.objectContaining({
                  source: "mcp",
                  targetType: "teacher",
                }),
              },
            ]);
          }
        }),
    );
  }
});
