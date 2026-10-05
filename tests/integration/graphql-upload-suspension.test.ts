import { describe, expect } from "vitest";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { graphqlMutationTest as it } from "../shared/graphql-mutation-fixture";

describe("remaining GraphQL and MCP mutation parity", () => {
  it("graphql.upload-suspension", { tags: ["@Upload/GraphQL"] }, async ({
    graphql,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const { signToken, execute, fixturePrisma, userId, run, mcp } = graphql;
      const key = `uploads/${userId}/${crypto.randomUUID()}`;
      const upload = await fixturePrisma.upload.create({
        data: { key, userId, filename: "suspended.txt", size: 12 },
      });
      const pending = await fixturePrisma.uploadPending.create({
        data: {
          key: `${key}-pending`,
          userId,
          filename: "suspended-pending.txt",
          size: 12,
          attemptId: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 300_000),
          phase: "uploaded",
        },
      });
      await fixturePrisma.userSuspension.create({
        data: { userId, reason: "[integration-test] GraphQL upload suspended" },
      });
      const token = await signToken([restWriteScope("workspace.upload")]);
      const cases = [
        {
          operationId: "workspace.upload.session.create.v1",
          query:
            "mutation($input: CreateUploadSessionInput!) { uploadSessionCreate(input: $input) { key } }",
          variables: { input: { filename: "new.txt", size: 1 } },
        },
        {
          operationId: "workspace.upload.complete.v1",
          query:
            "mutation($input: CompleteUploadSessionInput!) { uploadSessionComplete(input: $input) { upload { id } } }",
          variables: { input: { key: pending.key, filename: "finished.txt" } },
        },
        {
          operationId: "workspace.upload.rename.v1",
          query:
            "mutation($id: ID!, $filename: String!) { uploadRename(id: $id, filename: $filename) { upload { id } } }",
          variables: { id: upload.id, filename: "changed.txt" },
        },
        {
          operationId: "workspace.upload.delete.v1",
          query: "mutation($id: ID!) { uploadDelete(id: $id) { success } }",
          variables: { id: upload.id },
        },
      ];
      for (const item of cases) {
        const http = await execute(
          { query: item.query, variables: item.variables },
          token,
        );
        expect(http.payload.errors?.[0]?.extensions).toMatchObject({
          code: "FORBIDDEN",
        });
        const result = await run(() =>
          mcp.callToolResult("graphql_operation_run", {
            operationId: item.operationId,
            variables: item.variables,
            confirmed: true,
            locale: "en-us",
          }),
        );
        expect(result.isError).toBe(true);
        expect(result.structuredContent).toMatchObject({
          errors: [{ extensions: { code: "FORBIDDEN" } }],
        });
      }
      expect(
        await fixturePrisma.upload.findUnique({ where: { id: upload.id } }),
      ).toEqual(upload);
      expect(
        await fixturePrisma.uploadPending.findUnique({
          where: { id: pending.id },
        }),
      ).toEqual(pending);
    });
  });
});
