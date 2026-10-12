import { describe, expect, vi } from "vitest";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { graphqlMutationTest as it } from "../shared/graphql-mutation-fixture";

describe("remaining GraphQL and MCP mutation parity", () => {
  it("graphql.upload-storage-delete-failure", {
    tags: ["@Upload/GraphQL"],
  }, async ({ graphql, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const { signToken, execute, fixturePrisma, userId, bucket } = graphql;
      const key = `uploads/${userId}/${crypto.randomUUID()}`;
      const upload = await fixturePrisma.upload.create({
        data: { key, userId, filename: "retain-on-error.txt", size: 12 },
      });
      bucket.objects.set(key, { size: 12 });
      const failure = vi
        .spyOn(bucket, "delete")
        .mockRejectedValue(new Error("private-storage-failure"));
      const token = await signToken([restWriteScope("workspace.upload")]);
      try {
        const result = await execute(
          {
            query: `mutation { uploadDelete(id: "${upload.id}") { success } }`,
          },
          token,
        );
        expect(result.response.status).toBe(503);
        expect(result.payload.errors?.[0]?.extensions).toMatchObject({
          code: "SERVICE_UNAVAILABLE",
        });
        expect(JSON.stringify(result.payload)).not.toContain(
          "private-storage-failure",
        );
        expect(
          await fixturePrisma.upload.findUnique({ where: { id: upload.id } }),
        ).toEqual(upload);
        expect(
          await fixturePrisma.auditLog.count({
            where: { targetId: upload.id, action: "upload_delete" },
          }),
        ).toBe(0);
        expect(bucket.objects.has(key)).toBe(true);
      } finally {
        failure.mockRestore();
      }
    });
  });
});
