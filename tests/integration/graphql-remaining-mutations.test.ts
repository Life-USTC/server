import { describe, expect, vi } from "vitest";
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import {
  claimUploadPutLease,
  markUploadPutCompleted,
} from "@/features/uploads/server/upload-service";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { graphqlMutationTest as it } from "../shared/graphql-mutation-fixture";

describe("remaining GraphQL and MCP mutation parity", () => {
  it("graphql.pin-batch-order", async ({ graphql }) => {
    const { signToken, execute } = graphql;
    const token = await signToken([
      restWriteScope("workspace.link-pin"),
      restWriteScope("community.comment"),
    ]);
    const workspaceResult = await execute(
      {
        query: /* GraphQL */ `
          mutation WorkspaceBatch(
            $items: [WorkspaceLinkPinBatchItemInput!]!
          ) {
            linkPinsSet(items: $items) {
              pinnedSlugs
              maxPinnedLinks
            }
          }
        `,
        variables: {
          items: [
            { slug: "mail", pinned: true },
            { slug: "mail", pinned: false },
          ],
        },
      },
      token,
    );
    expect(workspaceResult.payload.errors).toBeUndefined();
    expect(workspaceResult.payload.data?.linkPinsSet).toEqual({
      pinnedSlugs: [],
      maxPinnedLinks: 4,
    });
  });

  it("graphql.comment-batch-results", async ({ graphql }) => {
    const { signToken, execute, ownedCommentId, otherCommentId } = graphql;
    const token = await signToken([restWriteScope("community.comment")]);
    const comments = await execute(
      {
        query: /* GraphQL */ `
          mutation DeleteComments($ids: [ID!]!) {
            commentsDelete(ids: $ids) {
              results {
                success
                id
                error {
                  code
                  message
                }
              }
            }
          }
        `,
        variables: { ids: [ownedCommentId, otherCommentId] },
      },
      token,
    );
    expect(comments.payload.errors).toBeUndefined();
    expect(comments.payload.data?.commentsDelete).toEqual({
      results: [
        { success: true, id: ownedCommentId, error: null },
        {
          success: false,
          id: otherCommentId,
          error: { code: "FORBIDDEN", message: "Forbidden" },
        },
      ],
    });
  });

  it("runs the registered workspace and comment batch operations", async ({
    graphql,
  }) => {
    const { mcp, run, mcpCommentId } = graphql;
    const workspaceResult = await run(() =>
      mcp.call<{
        success: boolean;
        data: {
          linkPinsSet: {
            pinnedSlugs: string[];
            maxPinnedLinks: number;
          };
        };
      }>("graphql_operation_run", {
        operationId: "workspace.link_pin.batch_set.v1",
        variables: { items: [{ slug: "mail", pinned: true }] },
        confirmed: true,
        locale: "en-us",
      }),
    );
    expect(workspaceResult).toMatchObject({
      success: true,
      data: {
        linkPinsSet: {
          pinnedSlugs: ["mail"],
          maxPinnedLinks: 4,
        },
      },
    });

    const comments = await run(() =>
      mcp.call<{
        success: boolean;
        data: {
          commentsDelete: {
            results: Array<{ success: boolean; id: string }>;
          };
        };
      }>("graphql_operation_run", {
        operationId: "community.comments.delete.v1",
        variables: { ids: [mcpCommentId] },
        confirmed: true,
        locale: "en-us",
      }),
    );
    expect(comments).toMatchObject({
      success: true,
      data: {
        commentsDelete: {
          results: [{ success: true, id: mcpCommentId }],
        },
      },
    });
  });

  it("graphql.upload-workflow-boundary", async ({ graphql }) => {
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
    expect(await fixturePrisma.uploadPending.count({ where: { userId } })).toBe(
      beforePending,
    );
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
    expect(new URL(session.url).pathname).toBe("/api/workspace/uploads/object");
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

  it("graphql.upload-ownership", async ({ graphql }) => {
    const { signToken, execute, fixturePrisma, otherUserId, bucket } = graphql;
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
    try {
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
    } finally {
      await fixturePrisma.uploadPending.deleteMany({
        where: { id: pending.id },
      });
      await fixturePrisma.upload.deleteMany({ where: { id: upload.id } });
      bucket.objects.delete(key);
    }
  });

  it("graphql.upload-suspension", async ({ graphql }) => {
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
    const suspension = await fixturePrisma.userSuspension.create({
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
    try {
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
    } finally {
      await fixturePrisma.userSuspension.delete({
        where: { id: suspension.id },
      });
      await fixturePrisma.uploadPending.deleteMany({
        where: { id: pending.id },
      });
      await fixturePrisma.upload.deleteMany({ where: { id: upload.id } });
    }
  });

  it("graphql.upload-storage-delete-failure", async ({ graphql }) => {
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
        { query: `mutation { uploadDelete(id: "${upload.id}") { success } }` },
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
      await fixturePrisma.upload.deleteMany({ where: { id: upload.id } });
      bucket.objects.delete(key);
    }
  });

  it("graphql.upload-quota", async ({ graphql }) => {
    const { signToken, execute, fixturePrisma, userId, bucket, run } = graphql;
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
    try {
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
    } finally {
      if (key) {
        await fixturePrisma.uploadPending.deleteMany({ where: { key } });
        bucket.objects.delete(key);
      }
      await fixturePrisma.upload.deleteMany({
        where: { key: { in: data.map((row) => row.key) } },
      });
    }
  });

  it("graphql.upload-audit", async ({ graphql }) => {
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
    try {
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
    } finally {
      await fixturePrisma.auditLog.deleteMany({
        where: { targetId: upload.id },
      });
      await fixturePrisma.upload.deleteMany({ where: { id: upload.id } });
      bucket.objects.delete(key);
    }
  });
});
