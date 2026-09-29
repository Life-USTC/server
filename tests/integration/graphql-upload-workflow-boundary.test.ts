import { describe, expect } from "vitest";
import {
  claimUploadPutLease,
  markUploadPutCompleted,
} from "@/features/uploads/server/upload-service";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { graphqlMutationTest as it } from "../shared/graphql-mutation-fixture";

describe("remaining GraphQL and MCP mutation parity", () => {
  it("graphql.upload-workflow-boundary", async ({
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
        run,
        mcp,
        marker,
      } = graphql;
      const token = await signToken([restWriteScope("workspace.upload")]);
      const beforePending = await fixturePrisma.uploadPending.count({
        where: { userId },
      });
      const beforeObjects = bucket.objects.size;
      for (const field of ["bytes", "file"]) {
        for (const operation of [
          {
            operationId: "workspace.upload.session.create.v1",
            query:
              "mutation($input: CreateUploadSessionInput!) { uploadSessionCreate(input: $input) { key } }",
            input: { filename: "raw.txt", size: 1, [field]: "x" },
          },
          {
            operationId: "workspace.upload.complete.v1",
            query:
              "mutation($input: CompleteUploadSessionInput!) { uploadSessionComplete(input: $input) { upload { id } } }",
            input: { key: "nonexistent", filename: "raw.txt", [field]: "x" },
          },
        ]) {
          const result = await execute(
            { query: operation.query, variables: { input: operation.input } },
            token,
          );
          expect(result.payload.data).toBeFalsy();
          expect(result.payload.errors?.length).toBeGreaterThan(0);
          const registered = await run(() =>
            mcp.callToolResult("graphql_operation_run", {
              operationId: operation.operationId,
              variables: { input: operation.input },
              confirmed: true,
              locale: "en-us",
            }),
          );
          expect(registered.isError).toBe(true);
        }
      }
      expect(
        await fixturePrisma.uploadPending.count({ where: { userId } }),
      ).toBe(beforePending);
      expect(bucket.objects.size).toBe(beforeObjects);
      const created = await run(() =>
        mcp.call<{
          success: boolean;
          data: {
            uploadSessionCreate: {
              key: string;
              url: string;
              maxFileSizeBytes: number;
            };
          };
        }>("graphql_operation_run", {
          operationId: "workspace.upload.session.create.v1",
          variables: {
            input: {
              filename: `${marker}.txt`,
              contentType: "text/plain",
              size: 12,
            },
          },
          confirmed: true,
          locale: "en-us",
        }),
      );
      expect(created).toMatchObject({ success: true });
      const session = created.data.uploadSessionCreate;
      expect(new URL(session.url).pathname).toBe(
        "/api/workspace/uploads/object",
      );
      expect(session.maxFileSizeBytes).toBeGreaterThan(12);

      // Simulate the separate authenticated HTTP PUT without sending bytes
      // through GraphQL or the MCP tool.
      bucket.objects.set(session.key, { contentType: "text/plain", size: 12 });
      const putLease = await run(() =>
        claimUploadPutLease({
          key: session.key,
          requestContentLength: 12,
          requestContentType: "text/plain",
          userId,
        }),
      );
      await run(() =>
        markUploadPutCompleted({
          attemptId: putLease.attemptId,
          key: session.key,
          userId,
        }),
      );

      const completed = await execute(
        {
          query: /* GraphQL */ `
            mutation CompleteUpload($input: CompleteUploadSessionInput!) {
              uploadSessionComplete(input: $input) {
                upload {
                  id
                  filename
                  size
                }
                usedBytes
              }
            }
          `,
          variables: {
            input: {
              key: session.key,
              filename: `${marker}.txt`,
              contentType: "text/plain",
            },
          },
        },
        token,
      );
      expect(completed.payload.errors).toBeUndefined();
      const completion = completed.payload.data?.uploadSessionComplete as {
        upload: { id: string; filename: string; size: number };
        usedBytes: number;
      };
      const completedUploadId = completion.upload.id;
      expect(completion).toMatchObject({
        upload: { filename: `${marker}.txt`, size: 12 },
        usedBytes: 12,
      });

      const renamed = await run(() =>
        mcp.call<{
          success: boolean;
          data: { uploadRename: { upload: { filename: string } } };
        }>("graphql_operation_run", {
          operationId: "workspace.upload.rename.v1",
          variables: {
            id: completedUploadId,
            filename: `${marker}-renamed.txt`,
          },
          confirmed: true,
          locale: "en-us",
        }),
      );
      expect(renamed).toMatchObject({
        success: true,
        data: {
          uploadRename: {
            upload: { filename: `${marker}-renamed.txt` },
          },
        },
      });

      const deleted = await run(() =>
        mcp.call<{
          success: boolean;
          data: {
            uploadDelete: {
              id: string;
              success: boolean;
              deletedSize: number;
            };
          };
        }>("graphql_operation_run", {
          operationId: "workspace.upload.delete.v1",
          variables: { id: completedUploadId },
          confirmed: true,
          locale: "en-us",
        }),
      );
      expect(deleted).toMatchObject({
        success: true,
        data: {
          uploadDelete: {
            id: completedUploadId,
            success: true,
            deletedSize: 12,
          },
        },
      });
      expect(bucket.deletedKeys).toContain(session.key);
      await expect(
        fixturePrisma.upload.findUnique({ where: { id: completedUploadId } }),
      ).resolves.toBeNull();
    });
  });
});
