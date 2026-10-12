import { describe, expect } from "vitest";
import { restReadScope } from "@/lib/oauth/scope-registry";
import {
  expectErrorCode,
  graphqlHomeworkTest,
} from "../shared/graphql-homework-contract-fixture";

describe("GraphQL homework CRUD mutations", () => {
  graphqlHomeworkTest(
    "requires the exact homework write scope before resolving a section",
    { tags: ["@Homework/GraphQL"] },
    async ({
      homework: {
        fixturePrisma,
        marker,
        creatorId,
        ownSection,
        execute,
        signToken,
      },
      protocolRuntime,
    }) => {
      await protocolRuntime.run(async () => {
        const readToken = await signToken(creatorId, [
          restReadScope("community.section-homework"),
        ]);
        const result = await execute(
          {
            query: /* GraphQL */ `
          mutation CreateWithoutWriteScope($sectionJwId: Int!) {
            homeworkCreate(
              input: {
                sectionJwId: $sectionJwId
                title: "${marker} missing scope"
              }
            ) {
              id
            }
          }
        `,
            variables: { sectionJwId: ownSection().jwId },
          },
          readToken,
        );

        expectErrorCode(result.payload, "FORBIDDEN");
        expect(result.payload.errors?.[0]?.extensions?.requiredScopes).toEqual([
          "community.section-homework:write",
        ]);
        await expect(
          fixturePrisma.homework.count({
            where: { title: `${marker} missing scope` },
          }),
        ).resolves.toBe(0);
      });
    },
  );
});
