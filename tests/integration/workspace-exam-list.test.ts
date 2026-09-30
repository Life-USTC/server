import { describe } from "vitest";
import { workspaceExamTest as it } from "../shared/workspace-exam-fixture";

describe("complete subscribed exam pages", () => {
  it("exam.retired-exam-exclusion", async ({ exams, protocolRuntime, expect }) => {
    await protocolRuntime.run(async () => {
      const { db, users, sectionIds, examIds, read } = exams;
      expect(
        await db.userSectionSubscription.findUnique({
          where: {
            userId_sectionId: { userId: users[0], sectionId: sectionIds[3] },
          },
        }),
      ).not.toBeNull();
      const result = await read(users[0]);
      expect(result.pagination.total).toBe(4);
      expect(result.data.map((exam) => exam.id)).not.toContain(examIds[5]);
    });
  });
});
