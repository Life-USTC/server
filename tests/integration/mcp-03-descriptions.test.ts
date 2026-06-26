import { describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("description tools — MCP exposes the REST description payload", () => {
  it("get_description returns seeded section description by public JW id", async () => {
    const section = await fixtures.prisma.section.findUnique({
      where: { jwId: fixtures.DEV_SEED.section.jwId },
      select: { id: true },
    });
    expect(section?.id).toBeTruthy();

    const result = await context.client.call<{
      found?: boolean;
      description?: { content?: string; id?: string | null };
      history?: Array<{ id?: string; nextContent?: string }>;
      target?: { targetId?: number; type?: string };
      viewer?: { isAuthenticated?: boolean; userId?: string | null };
    }>("get_description", {
      targetType: "section",
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      mode: "full",
    });

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
  });

  it("get_description reports missing public section targets", async () => {
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

  it("upsert_description creates, idempotently rereads, audits, and cleans up", async () => {
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
      const created = await context.client.call<{
        success?: boolean;
        id?: string;
        updated?: boolean;
        description?: { content?: string; id?: string | null };
        target?: { targetId?: number; type?: string };
      }>("upsert_description", {
        targetType: "teacher",
        teacherId: teacher.id,
        content: ` ${marker} `,
        mode: "full",
      });
      descriptionId = created.id;

      expect(created.success).toBe(true);
      expect(created.updated).toBe(true);
      expect(created.target).toMatchObject({
        targetId: teacher.id,
        type: "teacher",
      });
      expect(created.description?.id).toBe(descriptionId);
      expect(created.description?.content).toBe(marker);

      const auditLog = descriptionId
        ? await fixtures.findDescriptionEditAuditLog(descriptionId)
        : null;
      expect(auditLog?.metadata).toMatchObject({
        source: "mcp",
        targetType: "teacher",
      });

      const idempotent = await context.client.call<{
        success?: boolean;
        id?: string;
        updated?: boolean;
        description?: { content?: string };
      }>("upsert_description", {
        targetType: "teacher",
        teacherId: teacher.id,
        content: marker,
        mode: "full",
      });

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
