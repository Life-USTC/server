import type { TestPrismaClient } from "../../../shared/prisma";
import { catalogMcpTest as toolTest } from "../_harness/catalog-fixture";

type Preview = {
  success: boolean;
  semester: { id: number; nameCn: string; code: string };
  sections: Array<{ jwId: number; code: string }>;
  total: number;
  matchedCodes: string[];
  unmatchedCodes: string[];
  note: string;
};

async function userState(
  prisma: TestPrismaClient,
  context: { userId: string },
) {
  const userId = context.userId;
  return {
    user: await prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    memberships: await prisma.userSectionSubscription.findMany({
      where: { userId },
      orderBy: { sectionId: "asc" },
    }),
    todos: await prisma.todo.findMany({
      where: { userId },
      orderBy: { id: "asc" },
    }),
    audits: await prisma.auditLog.findMany({
      where: { OR: [{ userId }, { subjectUserId: userId }] },
      orderBy: { id: "asc" },
    }),
  };
}

toolTest(
  "cases.mcp-assistant-workflows.preview-before-write-1",
  { tags: ["@Subscription/MCP"] },
  async ({
    mcpWorkflow,
    mcpActor: context,
    mcpCatalog,
    isolatedDatabase,
    expect,
  }) =>
    mcpWorkflow.run(async () => {
      const prisma = isolatedDatabase.owner;
      const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
      const baseJwId = 1_400_000_000 + Math.floor(Math.random() * 100_000_000);
      const code = `PREVIEW${nonce}.01`;
      const { semesterIds, sections } = await prisma.$transaction(
        async (prisma) => {
          const semesterIds: number[] = [];
          const course = await prisma.course.create({
            data: { jwId: baseJwId, code, nameCn: `Preview ${nonce}` },
          });
          for (const offset of [0, 1]) {
            const semester = await prisma.semester.create({
              data: {
                jwId: baseJwId + offset,
                code: `preview-${nonce}-${offset}`,
                nameCn: `Preview semester ${nonce} ${offset}`,
              },
            });
            semesterIds.push(semester.id);
          }
          const sections = [];
          for (const offset of [0, 1, 2]) {
            sections.push(
              await prisma.section.create({
                data: {
                  jwId: baseJwId + offset,
                  code,
                  courseId: course.id,
                  semesterId: semesterIds[offset === 2 ? 1 : 0],
                },
              }),
            );
          }
          return { semesterIds, sections };
        },
      );
      const before = await userState(prisma, context);
      expect(before.memberships).toEqual([]);
      for (const mode of ["default", "full"]) {
        for (const [index, expectedSections] of [
          [0, sections.slice(0, 2)],
          [1, sections.slice(2)],
        ] as const) {
          const preview = await context.client.call<Preview>(
            "catalog_section_match_preview",
            {
              codes: [code],
              semesterId: semesterIds[index],
              mode,
            },
          );
          expect(preview.success).toBe(true);
          expect(preview.semester).toEqual({
            id: semesterIds[index],
            code: `preview-${nonce}-${index}`,
            nameCn: `Preview semester ${nonce} ${index}`,
          });
          expect(preview.sections.map((section) => section.jwId)).toEqual(
            expectedSections.map((section) => section.jwId),
          );
          expect(
            preview.sections.every((section) => section.code === code),
          ).toBe(true);
          expect(preview.total).toBe(expectedSections.length);
          expect(preview.matchedCodes).toEqual(
            expectedSections.map(() => code),
          );
          expect(preview.unmatchedCodes).toEqual([]);
          expect(preview.note).toContain(
            "only affect your workspace and calendar here",
          );
          expect(preview.note).toContain("not official USTC course enrollment");
          expect(await userState(prisma, context)).toEqual(before);
        }
      }
      const current = await context.client.call<Preview>(
        "catalog_section_match_preview",
        {
          codes: [mcpCatalog.section.code],
        },
      );
      expect(current.success).toBe(true);
      expect(current.semester.nameCn).toBe(mcpCatalog.semester.nameCn);
      expect(current.sections.map((section) => section.jwId)).toContain(
        mcpCatalog.section.jwId,
      );
      expect(await userState(prisma, context)).toEqual(before);

      const imported = await context.client.call(
        "workspace_subscription_import",
        {
          codes: [code],
          semesterId: semesterIds[0],
        },
      );
      expect(imported).toMatchObject({
        success: true,
        addedCount: 2,
        alreadySubscribedCount: 0,
        semester: { id: semesterIds[0] },
      });
      const memberships = await prisma.userSectionSubscription.findMany({
        where: { userId: context.userId },
        orderBy: { sectionId: "asc" },
      });
      expect(memberships.map((membership) => membership.sectionId)).toEqual(
        sections.slice(0, 2).map((section) => section.id),
      );
    }),
);
