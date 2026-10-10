import { describe, expect } from "vitest";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { graphqlHomeworkTest } from "../shared/graphql-homework-contract-fixture";

describe("GraphQL homework CRUD mutations", () => {
  graphqlHomeworkTest(
    "creator deletion is idempotent and emits one deletion audit",
    { tags: ["@Homework/GraphQL"] },
    async ({
      homework: {
        fixturePrisma,
        creatorId,
        ownSection,
        arrangeHomework,
        execute,
        signToken,
      },
      protocolRuntime,
    }) => {
      await protocolRuntime.run(async () => {
        const { id: homeworkId } = await arrangeHomework();
        const creatorToken = await signToken(creatorId, [
          restWriteScope("community.section-homework"),
        ]);
        const deleted = await execute(
          {
            query: /* GraphQL */ `
          mutation DeleteHomework($id: ID!) {
            homeworkDelete(id: $id) {
              id
              success
              alreadyDeleted
            }
          }
        `,
            variables: { id: homeworkId },
          },
          creatorToken,
        );
        expect(deleted.payload).toEqual({
          data: {
            homeworkDelete: {
              id: homeworkId,
              success: true,
              alreadyDeleted: false,
            },
          },
        });

        const repeatedDelete = await execute(
          {
            query: /* GraphQL */ `
          mutation DeleteHomeworkAgain($id: ID!) {
            homeworkDelete(id: $id) {
              id
              success
              alreadyDeleted
            }
          }
        `,
            variables: { id: homeworkId },
          },
          creatorToken,
        );
        expect(repeatedDelete.payload).toEqual({
          data: {
            homeworkDelete: {
              id: homeworkId,
              success: true,
              alreadyDeleted: true,
            },
          },
        });
        expect(
          await fixturePrisma.homework.findUniqueOrThrow({
            where: { id: homeworkId },
            select: { deletedAt: true, deletedById: true },
          }),
        ).toEqual({ deletedAt: expect.any(Date), deletedById: creatorId });
        expect(
          await fixturePrisma.auditLog.findMany({
            where: { targetId: homeworkId },
            select: { action: true, userId: true, metadata: true },
          }),
        ).toEqual([
          {
            action: "homework_delete",
            userId: creatorId,
            metadata: expect.objectContaining({ sectionId: ownSection().id }),
          },
        ]);
      });
    },
  );
});
