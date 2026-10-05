import { describe, expect } from "vitest";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import {
  expectErrorCode,
  graphqlHomeworkTest,
} from "../shared/graphql-homework-contract-fixture";

describe("GraphQL homework CRUD mutations", () => {
  graphqlHomeworkTest.for([false, true])(
    "rejects deletion by another owner even when isAdmin=%s",
    { tags: ["@Homework/GraphQL"] },
    async (
      isAdmin,
      {
        homework: {
          fixturePrisma,
          collaboratorId,
          arrangeHomework,
          execute,
          signToken,
        },
        protocolRuntime,
      },
    ) => {
      await protocolRuntime.run(async () => {
        const { id: homeworkId } = await arrangeHomework();
        await fixturePrisma.user.update({
          where: { id: collaboratorId },
          data: { isAdmin },
        });
        const token = await signToken(collaboratorId, [
          restWriteScope("community.section-homework"),
        ]);
        const before = await fixturePrisma.homework.findUniqueOrThrow({
          where: { id: homeworkId },
        });
        const { payload } = await execute(
          {
            query:
              "mutation DeleteOtherHomework($id: ID!) { homeworkDelete(id: $id) { success } }",
            variables: { id: homeworkId },
          },
          token,
        );
        expectErrorCode(payload, "FORBIDDEN");
        expect(
          await fixturePrisma.homework.findUniqueOrThrow({
            where: { id: homeworkId },
          }),
        ).toEqual(before);
        expect(
          await fixturePrisma.auditLog.findMany({
            where: { userId: collaboratorId },
          }),
        ).toEqual([]);
      });
    },
  );
});
