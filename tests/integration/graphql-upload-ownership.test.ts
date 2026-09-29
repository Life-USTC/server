import { describe, expect } from "vitest";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { graphqlMutationTest as it } from "../shared/graphql-mutation-fixture";

describe("remaining GraphQL and MCP mutation parity", () => {
  it("graphql.upload-ownership", async ({ graphql, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const { signToken, execute, fixturePrisma, otherUserId, bucket } =
        graphql;
      const key = `uploads/${otherUserId}/${crypto.randomUUID()}`;
      const upload = await fixturePrisma.upload.create({
        data: {
          key,
          userId: otherUserId,
          filename: "private-file.txt",
          size: 12,
        },
      });
      const pending = await fixturePrisma.uploadPending.create({
        data: {
          key: `${key}-pending`,
          userId: otherUserId,
          filename: "private-pending.txt",
          size: 12,
          attemptId: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 300_000),
          phase: "uploaded",
        },
      });
      bucket.objects.set(key, { size: 12 });
      const token = await signToken([restWriteScope("workspace.upload")]);
      for (const query of [
        `mutation { uploadRename(id: "${upload.id}", filename: "stolen.txt") { upload { id } } }`,
        `mutation { uploadDelete(id: "${upload.id}") { success } }`,
        `mutation { uploadSessionComplete(input: { key: "${pending.key}", filename: "stolen.txt" }) { upload { id } } }`,
      ]) {
        const result = await execute({ query }, token);
        expect(result.payload.errors?.length).toBeGreaterThan(0);
        expect(JSON.stringify(result.payload)).not.toContain(
          "private-file.txt",
        );
        expect(JSON.stringify(result.payload)).not.toContain(
          "private-pending.txt",
        );
      }
      expect(
        await fixturePrisma.upload.findUnique({ where: { id: upload.id } }),
      ).toEqual(upload);
      expect(
        await fixturePrisma.uploadPending.findUnique({
          where: { id: pending.id },
        }),
      ).toEqual(pending);
      expect(bucket.objects.has(key)).toBe(true);
    });
  });
});
