import { describe, expect } from "vitest";
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import {
  claimUploadPutLease,
  markUploadPutCompleted,
} from "@/features/uploads/server/upload-service";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { graphqlMutationTest as it } from "../shared/graphql-mutation-fixture";

describe("remaining GraphQL and MCP mutation parity", () => {
  it("graphql.upload-quota", { tags: ["@Upload/GraphQL"] }, async ({
    graphql,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const { signToken, execute, fixturePrisma, userId, bucket, run } =
        graphql;
      const nonce = crypto.randomUUID();
      const data: {
        key: string;
        userId: string;
        filename: string;
        size: number;
      }[] = [];
      for (let remaining = uploadConfig.totalQuotaBytes; remaining > 0; ) {
        const size = Math.min(remaining, uploadConfig.maxFileSizeBytes);
        data.push({
          key: `uploads/${userId}/quota-${nonce}-${data.length}`,
          userId,
          filename: "quota-fixture.bin",
          size,
        });
        remaining -= size;
      }
      await fixturePrisma.upload.createMany({ data });
      const token = await signToken([restWriteScope("workspace.upload")]);
      const create = () =>
        execute(
          {
            query:
              'mutation { uploadSessionCreate(input: { filename: "one-byte.txt", size: 1, contentType: "text/plain" }) { key } }',
          },
          token,
        );
      let key: string | undefined;
      const rejected = await create();
      expect(rejected.payload.errors?.[0]?.extensions).toMatchObject({
        code: "BAD_USER_INPUT",
      });
      expect(rejected.payload.errors?.[0]?.message).toContain("Quota exceeded");
      const last = data.at(-1);
      if (!last) throw new Error("Quota fixture must contain uploaded files");
      await fixturePrisma.upload.update({
        where: { key: last.key },
        data: { size: { decrement: 1 } },
      });
      const accepted = await create();
      expect(accepted.payload.errors).toBeUndefined();
      const session = accepted.payload.data?.uploadSessionCreate as
        | { key: string }
        | undefined;
      if (!session) throw new Error("Upload session creation returned no data");
      key = session.key;
      expect(
        await fixturePrisma.uploadPending.findUnique({
          where: { key },
          select: { userId: true, size: true },
        }),
      ).toEqual({ userId, size: 1 });
      const lease = await run(() =>
        claimUploadPutLease({
          key: key as string,
          userId,
          requestContentLength: 1,
          requestContentType: "text/plain",
        }),
      );
      await run(() =>
        markUploadPutCompleted({
          key: key as string,
          userId,
          attemptId: lease.attemptId,
        }),
      );
      // Finalization must count the authoritative object size even when storage
      // contains more bytes than the earlier reservation expected.
      bucket.objects.set(key, { size: 2, contentType: "text/plain" });
      const completed = await execute(
        {
          query:
            "mutation($input: CompleteUploadSessionInput!) { uploadSessionComplete(input: $input) { upload { id } } }",
          variables: {
            input: { key, filename: "one-byte.txt", contentType: "text/plain" },
          },
        },
        token,
      );
      expect(completed.payload.errors?.[0]?.extensions).toMatchObject({
        code: "BAD_USER_INPUT",
      });
      expect(completed.payload.errors?.[0]?.message).toContain(
        "Quota exceeded",
      );
      expect(
        await fixturePrisma.upload.findUnique({ where: { key } }),
      ).toBeNull();
      expect(
        (
          await fixturePrisma.upload.aggregate({
            where: { userId },
            _sum: { size: true },
          })
        )._sum.size,
      ).toBe(uploadConfig.totalQuotaBytes - 1);
    });
  });
});
