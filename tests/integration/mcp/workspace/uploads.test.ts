import { describe } from "vitest";
import * as fixtures from "../_harness";
import { createMcpHarness } from "../_harness";
import { mcpTest } from "../_harness/context";

const toolTest = mcpTest.extend(
  "isolated",
  fixtures.actorFixture({
    emailPrefix: "mcp-upload-metadata",
    name: "MCP upload metadata owner",
  }),
);

describe("MCP upload metadata mutations", () => {
  toolTest(
    "上传元数据工具列出、重命名并在存储删除失败时保留重试状态",
    async ({ isolated, expect }) => {
      const filename = `mcp-upload-${Date.now()}.txt`;
      const upload = await fixtures.prisma.upload.create({
        data: {
          userId: isolated.userId,
          key: `integration-test/${filename}`,
          filename,
          contentType: "text/plain",
          size: 321,
        },
        select: { id: true, key: true, size: true },
      });
      const renamedFilename = `renamed-${filename}`;

      try {
        const listBefore = await isolated.client.call<{
          data?: Array<{ filename?: string; id?: string; size?: number }>;
          meta?: {
            maxFileSizeBytes?: number;
            quotaBytes?: number;
            usedBytes?: number;
          };
          pagination?: { page?: number; pageSize?: number; total?: number };
        }>("workspace_upload_list", { mode: "full" });
        expect(typeof listBefore.meta?.maxFileSizeBytes).toBe("number");
        expect(typeof listBefore.meta?.quotaBytes).toBe("number");
        expect(typeof listBefore.meta?.usedBytes).toBe("number");
        expect(listBefore.pagination).toMatchObject({ page: 1, pageSize: 20 });
        expect(
          listBefore.data?.some(
            (item) =>
              item.id === upload.id &&
              item.filename === filename &&
              item.size === upload.size,
          ),
        ).toBe(true);

        const renamed = await isolated.client.call<{
          success?: boolean;
          upload?: { filename?: string; id?: string };
        }>("workspace_upload_rename", {
          id: upload.id,
          filename: renamedFilename,
        });
        expect(renamed).toMatchObject({
          success: true,
          upload: { id: upload.id, filename: renamedFilename },
        });

        const deleted = await isolated.client.call<{
          error?: string;
          hint?: string;
          message?: string;
          success?: boolean;
        }>("workspace_upload_delete", { id: upload.id });
        expect(deleted).toMatchObject({
          success: false,
          error: "storage_delete_failed",
          message: "Failed to delete upload object",
        });

        const retainedUpload = await fixtures.prisma.upload.findUnique({
          where: { id: upload.id },
          select: { filename: true },
        });
        expect(retainedUpload?.filename).toBe(renamedFilename);
      } finally {
        await fixtures.prisma.auditLog.deleteMany({
          where: { targetId: upload.id, targetType: "upload" },
        });
        await fixtures.prisma.upload.deleteMany({ where: { id: upload.id } });
      }
    },
  );

  toolTest(
    "上传重命名拒绝控制字符文件名且不做清洗",
    async ({ isolated, expect }) => {
      const filename = `mcp-upload-invalid-rename-${Date.now()}.txt`;
      const upload = await fixtures.prisma.upload.create({
        data: {
          userId: isolated.userId,
          key: `integration-test/${filename}`,
          filename,
          contentType: "text/plain",
          size: 321,
        },
        select: { id: true },
      });

      try {
        for (const invalidFilename of ["bad\u0000name.txt", "\u0000"]) {
          await expect(
            isolated.client.call("workspace_upload_rename", {
              id: upload.id,
              filename: invalidFilename,
            }),
          ).rejects.toThrow();
        }

        const unchanged = await fixtures.prisma.upload.findUnique({
          where: { id: upload.id },
          select: { filename: true },
        });
        expect(unchanged?.filename).toBe(filename);
      } finally {
        await fixtures.prisma.upload.deleteMany({ where: { id: upload.id } });
      }
    },
  );

  toolTest(
    "上传元数据工具拒绝非所有者及被禁用户写入",
    async ({ isolated, expect }) => {
      const otherUser = await fixtures.prisma.user.create({
        data: {
          email: fixtures.integrationUserEmail("mcp-upload-owner"),
          name: "MCP Upload Owner",
        },
        select: { id: true },
      });
      const otherUpload = await fixtures.prisma.upload.create({
        data: {
          userId: otherUser.id,
          key: `integration-test/mcp-upload-other-${Date.now()}.txt`,
          filename: "other-upload.txt",
          contentType: "text/plain",
          size: 123,
        },
        select: { id: true },
      });
      const suspendedUser = await fixtures.prisma.user.create({
        data: {
          email: fixtures.integrationUserEmail("mcp-upload-suspended"),
          name: "MCP Upload Suspended",
        },
        select: { id: true },
      });
      const suspendedUpload = await fixtures.prisma.upload.create({
        data: {
          userId: suspendedUser.id,
          key: `integration-test/mcp-upload-suspended-${Date.now()}.txt`,
          filename: "suspended-upload.txt",
          contentType: "text/plain",
          size: 124,
        },
        select: { id: true },
      });
      const suspension = await fixtures.prisma.userSuspension.create({
        data: {
          userId: suspendedUser.id,
          createdById: isolated.userId,
          reason: "integration suspended",
        },
        select: { id: true },
      });
      const suspendedMcp = await createMcpHarness(suspendedUser.id);

      try {
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
      } finally {
        await suspendedMcp.close();
        await fixtures.prisma.userSuspension.deleteMany({
          where: { id: suspension.id },
        });
        await fixtures.prisma.upload.deleteMany({
          where: { id: { in: [otherUpload.id, suspendedUpload.id] } },
        });
        await fixtures.prisma.featureOperationEvent.deleteMany({
          where: { userId: { in: [otherUser.id, suspendedUser.id] } },
        });
        await fixtures.prisma.user.deleteMany({
          where: { id: { in: [otherUser.id, suspendedUser.id] } },
        });
      }
    },
  );
});
