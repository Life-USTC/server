import { describe } from "vitest";
import type { TestPrismaClient } from "../../../shared/prisma";
import { isolatedMcpTest as toolTest } from "../_harness/isolated-context";

function seedUpload(db: TestPrismaClient, userId: string) {
  return db.upload.create({
    data: {
      userId,
      key: `integration-test/${userId}.txt`,
      filename: "original.txt",
      contentType: "text/plain",
      size: 321,
    },
  });
}

describe("MCP upload metadata mutations", () => {
  for (const operation of ["list", "rename", "storage failure"] as const) {
    toolTest(
      `上传元数据工具独立验证 ${operation}`,
      async ({
        mcpWorkflow,
        mcpActor: isolated,
        mcpOtherActor,
        expect,
        isolatedDatabase: { owner: db },
      }) =>
        mcpWorkflow.run(async () => {
          const upload = await seedUpload(db, isolated.userId);
          const foreign = await seedUpload(db, mcpOtherActor.userId);
          const before = await db.upload.findMany({ orderBy: { id: "asc" } });
          if (operation === "list") {
            const result = await isolated.client.call<{
              data?: Array<{ filename?: string; id?: string; size?: number }>;
              meta?: {
                maxFileSizeBytes?: number;
                quotaBytes?: number;
                usedBytes?: number;
              };
              pagination?: { page?: number; pageSize?: number; total?: number };
            }>("workspace_upload_list", { mode: "full" });
            expect(typeof result.meta?.maxFileSizeBytes).toBe("number");
            expect(typeof result.meta?.quotaBytes).toBe("number");
            expect(result.meta?.usedBytes).toBe(upload.size);
            expect(result.pagination).toMatchObject({
              page: 1,
              pageSize: 20,
              total: 1,
            });
            expect(result.data).toEqual([
              expect.objectContaining({
                id: upload.id,
                filename: upload.filename,
                size: upload.size,
              }),
            ]);
          } else if (operation === "rename") {
            const result = await isolated.client.call(
              "workspace_upload_rename",
              { id: upload.id, filename: "renamed.txt" },
            );
            expect(result).toMatchObject({
              success: true,
              upload: { id: upload.id, filename: "renamed.txt" },
            });
          } else {
            const result = await isolated.client.call(
              "workspace_upload_delete",
              { id: upload.id },
            );
            expect(result).toMatchObject({
              success: false,
              error: "storage_delete_failed",
              message: "Failed to delete upload object",
            });
          }
          expect(await db.upload.findMany({ orderBy: { id: "asc" } })).toEqual(
            before.map((row) =>
              row.id === upload.id && operation === "rename"
                ? {
                    ...row,
                    filename: "renamed.txt",
                    updatedAt: expect.any(Date),
                  }
                : row,
            ),
          );
          expect(
            await db.upload.findUniqueOrThrow({ where: { id: foreign.id } }),
          ).toEqual(foreign);
          expect(await db.auditLog.findMany()).toEqual([]);
        }),
    );
  }

  for (const [name, invalidFilename] of [
    ["embedded", "bad\u0000name.txt"],
    ["only", "\u0000"],
  ]) {
    toolTest(
      `上传重命名拒绝控制字符文件名且不做清洗 ${name}`,
      async ({
        mcpWorkflow,
        mcpActor: isolated,
        expect,
        isolatedDatabase: { owner: db },
      }) =>
        mcpWorkflow.run(async () => {
          const filename = `mcp-upload-invalid-rename-${Date.now()}.txt`;
          const upload = await db.upload.create({
            data: {
              userId: isolated.userId,
              key: `integration-test/${filename}`,
              filename,
              contentType: "text/plain",
              size: 321,
            },
            select: { id: true },
          });

          const before = await db.upload.findMany();
          await expect(
            isolated.client.call("workspace_upload_rename", {
              id: upload.id,
              filename: invalidFilename,
            }),
          ).rejects.toThrow();
          expect(await db.upload.findMany()).toEqual(before);

          const unchanged = await db.upload.findUnique({
            where: { id: upload.id },
            select: { filename: true },
          });
          expect(unchanged?.filename).toBe(filename);
        }),
    );
  }

  toolTest(
    "上传元数据工具拒绝非所有者及被禁用户写入",
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
      mcpSessions,
    }) =>
      mcpWorkflow.run(async () => {
        const otherUser = await db.user.create({
          data: {
            email: "mcp-upload-owner@example.test",
            name: "MCP Upload Owner",
          },
          select: { id: true },
        });
        const otherUpload = await db.upload.create({
          data: {
            userId: otherUser.id,
            key: `integration-test/mcp-upload-other-${Date.now()}.txt`,
            filename: "other-upload.txt",
            contentType: "text/plain",
            size: 123,
          },
          select: { id: true },
        });
        const suspendedUser = await db.user.create({
          data: {
            email: "mcp-upload-suspended@example.test",
            name: "MCP Upload Suspended",
          },
          select: { id: true },
        });
        const suspendedUpload = await db.upload.create({
          data: {
            userId: suspendedUser.id,
            key: `integration-test/mcp-upload-suspended-${Date.now()}.txt`,
            filename: "suspended-upload.txt",
            contentType: "text/plain",
            size: 124,
          },
          select: { id: true },
        });
        await db.userSuspension.create({
          data: {
            userId: suspendedUser.id,
            createdById: isolated.userId,
            reason: "integration suspended",
          },
          select: { id: true },
        });
        const suspendedSession = mcpSessions.own(suspendedUser.id);
        await suspendedSession.initialize();
        const suspendedMcp = suspendedSession.client;

        const storedBefore = await db.upload.findMany({
          orderBy: { id: "asc" },
        });
        const nonOwnerRename = await isolated.client.call<{
          error?: string;
          success?: boolean;
        }>("workspace_upload_rename", {
          id: otherUpload.id,
          filename: "stolen.txt",
        });
        expect(nonOwnerRename).toMatchObject({
          success: false,
          error: "not_found",
        });

        const nonOwnerDelete = await isolated.client.call<{
          error?: string;
          success?: boolean;
        }>("workspace_upload_delete", { id: otherUpload.id });
        expect(nonOwnerDelete).toMatchObject({
          success: false,
          error: "not_found",
        });

        const suspendedDelete = await suspendedMcp.call<{
          error?: string;
          reason?: string | null;
          success?: boolean;
        }>("workspace_upload_delete", { id: suspendedUpload.id });
        expect(suspendedDelete).toMatchObject({
          success: false,
          error: "suspended",
          reason: "integration suspended",
        });
        await expect(
          db.upload.findMany({ orderBy: { id: "asc" } }),
        ).resolves.toEqual(storedBefore);
      }),
  );
});
