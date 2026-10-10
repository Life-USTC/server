import { describe, expect } from "vitest";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { graphqlMutationTest as it } from "../shared/graphql-mutation-fixture";

describe("remaining GraphQL and MCP mutation parity", () => {
  it("graphql.upload-audit", { tags: ["@Upload/GraphQL"] }, async ({
    graphql,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const {
        signToken,
        execute,
        fixturePrisma,
        userId,
        bucket,
        oauthClientId,
        grantId,
      } = graphql;
      const key = `uploads/${userId}/${crypto.randomUUID()}`;
      const upload = await fixturePrisma.upload.create({
        data: { key, userId, filename: "audited-delete.txt", size: 12 },
      });
      bucket.objects.set(key, { size: 12 });
      const token = await signToken([restWriteScope("workspace.upload")]);
      const result = await execute(
        { query: `mutation { uploadDelete(id: "${upload.id}") { success } }` },
        token,
      );
      expect(result.payload.errors).toBeUndefined();
      expect(result.payload.data).toEqual({ uploadDelete: { success: true } });
      expect(
        await fixturePrisma.upload.findUnique({ where: { id: upload.id } }),
      ).toBeNull();
      const logs = await fixturePrisma.auditLog.findMany({
        where: { targetId: upload.id, action: "upload_delete" },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        userId,
        subjectUserId: userId,
        targetType: "upload",
        oauthClientId,
        oauthGrantId: grantId,
        channel: "graphql",
        metadata: { size: 12, source: "graphql" },
      });
    });
  });
});
