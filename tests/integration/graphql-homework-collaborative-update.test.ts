import { describe, expect } from "vitest";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { graphqlHomeworkTest } from "../shared/graphql-homework-contract-fixture";

describe("GraphQL homework CRUD mutations", () => {
  graphqlHomeworkTest(
    "collaboratively updates known homework and records description audit",
    { tags: ["@Homework/GraphQL"] },
    async ({
      homework: {
        fixturePrisma,
        marker,
        collaboratorId,
        arrangeHomework,
        execute,
        signToken,
      },
      protocolRuntime,
    }) => {
      await protocolRuntime.run(async () => {
        const { id: homeworkId } = await arrangeHomework();
        const collaboratorToken = await signToken(collaboratorId, [
          restWriteScope("community.section-homework"),
        ]);
        const updated = await execute(
          {
            query: /* GraphQL */ `
          mutation UpdateHomework($id: ID!, $due: DateTime!) {
            homeworkUpdate(
              id: $id
              input: {
                title: "  ${marker} updated  "
                description: null
                isMajor: false
                requiresTeam: false
                publishedAt: null
                submissionStartAt: null
                submissionDueAt: $due
              }
            ) {
              id
              homework {
                id
                title
                isMajor
                requiresTeam
                publishedAt
                submissionStartAt
                submissionDueAt
              }
            }
          }
        `,
            variables: {
              id: homeworkId,
              due: "2026-07-23T18:00:00+08:00",
            },
          },
          collaboratorToken,
        );
        expect(updated.payload).toEqual({
          data: {
            homeworkUpdate: {
              id: homeworkId,
              homework: {
                id: homeworkId,
                title: `${marker} updated`,
                isMajor: false,
                requiresTeam: false,
                publishedAt: null,
                submissionStartAt: null,
                submissionDueAt: "2026-07-23T10:00:00.000Z",
              },
            },
          },
        });
        const updatedRecord = await fixturePrisma.homework.findUniqueOrThrow({
          where: { id: homeworkId },
          select: {
            description: { select: { content: true, id: true } },
            updatedById: true,
          },
        });
        expect(updatedRecord).toMatchObject({
          description: { content: "" },
          updatedById: collaboratorId,
        });
        await expect(
          fixturePrisma.auditLog.findFirstOrThrow({
            where: {
              action: "description_edit",
              targetId: updatedRecord.description?.id,
              userId: collaboratorId,
            },
            select: { metadata: true },
          }),
        ).resolves.toMatchObject({
          metadata: { targetType: "homework" },
        });
      });
    },
  );
});
