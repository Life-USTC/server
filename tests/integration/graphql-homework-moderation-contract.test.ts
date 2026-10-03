import { describe, expect } from "vitest";
import { deleteHomeworkForModeration } from "@/features/homeworks/server/homework-mutations";
import { graphqlHomeworkTest } from "../shared/graphql-homework-contract-fixture";

describe("GraphQL homework CRUD mutations", () => {
  graphqlHomeworkTest.for([
    { name: "non-admin creator", administrator: false, allowed: false },
    { name: "administrator", administrator: true, allowed: true },
  ])(
    "explicit moderation by $name",
    async (
      { administrator, allowed },
      {
        homework: { fixturePrisma, creatorId, collaboratorId, arrangeHomework },
        protocolRuntime,
      },
    ) => {
      await protocolRuntime.run(async () => {
        const homework = await arrangeHomework();
        const userId = administrator ? collaboratorId : creatorId;
        if (administrator)
          await fixturePrisma.user.update({
            where: { id: userId },
            data: { isAdmin: true },
          });
        const result = await deleteHomeworkForModeration({
          userId,
          homeworkId: homework.id,
          audit: { channel: "web" },
        });
        expect(result).toMatchObject(
          allowed
            ? { ok: true, alreadyDeleted: false }
            : { ok: false, error: "forbidden" },
        );
        expect(
          await fixturePrisma.homework.findUniqueOrThrow({
            where: { id: homework.id },
            select: { deletedAt: true, deletedById: true },
          }),
        ).toEqual(
          allowed
            ? { deletedAt: expect.any(Date), deletedById: userId }
            : { deletedAt: null, deletedById: null },
        );
        const audits = await fixturePrisma.auditLog.findMany({
          where: { targetId: homework.id },
          select: { action: true, userId: true },
        });
        expect(audits).toEqual(
          allowed ? [{ action: "homework_delete", userId }] : [],
        );
      });
    },
  );
});
