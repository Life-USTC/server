import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { sanitizeFilename } from "@/features/uploads/lib/upload-utils";
import {
  deleteOwnedUpload,
  listUploads,
  renameOwnedUpload,
} from "@/features/uploads/server/upload-service";
import { buildPaginatedResponse } from "@/lib/api/helpers";
import {
  getUserId,
  jsonToolResult,
  mcpModeInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import { hasAsciiControlCharacters } from "@/lib/text/ascii-control-characters";

const uploadIdInputSchema = z.string().trim().min(1);
const filenameControlCharacterMessage =
  "Filename contains unsupported control characters";
const uploadFilenameInputSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((filename) => !hasAsciiControlCharacters(filename), {
    message: filenameControlCharacterMessage,
  })
  .refine((filename) => sanitizeFilename(filename).length > 0, {
    message: "Filename required",
  });

type UploadMutationError = {
  error: "forbidden" | "not_found" | "storage_delete_failed" | "suspended";
  reason?: string | null;
};

function uploadMutationErrorResult(
  result: UploadMutationError,
  mode: ReturnType<typeof resolveMcpMode>,
) {
  if (result.error === "suspended") {
    return jsonToolResult(
      {
        success: false,
        error: "suspended",
        message: "Suspended",
        reason: result.reason ?? null,
      },
      { mode },
    );
  }

  if (result.error === "not_found") {
    return jsonToolResult(
      {
        success: false,
        error: "not_found",
        message: "Upload not found",
        hint: "Use workspace_upload_list to confirm the upload id before changing it.",
      },
      { mode },
    );
  }

  if (result.error === "storage_delete_failed") {
    return jsonToolResult(
      {
        success: false,
        error: "storage_delete_failed",
        message: "Failed to delete upload object",
        hint: "The upload metadata was kept so the deletion can be retried.",
      },
      { mode },
    );
  }

  return jsonToolResult(
    {
      success: false,
      error: "forbidden",
      message: "Forbidden",
    },
    { mode },
  );
}

export function registerUploadTools(server: McpServer) {
  server.registerTool(
    "workspace_upload_list",
    {
      description:
        "List the current user's comment attachment uploads with page/limit pagination, quota, and upload limits. Does not stream file contents.",
      inputSchema: {
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        mode: mcpModeInputSchema,
      },
    },
    async ({ limit, mode, page }, extra) => {
      const resolvedMode = resolveMcpMode(mode);
      const userId = getUserId(extra.authInfo);
      const result = await listUploads(userId, {
        pageSize: limit,
        skip: (page - 1) * limit,
      });
      return jsonToolResult(
        {
          ...buildPaginatedResponse(result.uploads, page, limit, result.total),
          meta: {
            maxFileSizeBytes: result.maxFileSizeBytes,
            quotaBytes: result.quotaBytes,
            usedBytes: result.usedBytes,
          },
        },
        { mode: resolvedMode },
      );
    },
  );

  server.registerTool(
    "workspace_upload_rename",
    {
      description:
        "Rename one upload owned by the current user. Requires an unsuspended signed-in user.",
      inputSchema: {
        id: uploadIdInputSchema,
        filename: uploadFilenameInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    async ({ id, filename, mode }, extra) => {
      const resolvedMode = resolveMcpMode(mode);
      const userId = getUserId(extra.authInfo);
      const sanitizedFilename = sanitizeFilename(filename);
      const result = await renameOwnedUpload({
        filename: sanitizedFilename,
        id,
        userId,
      });

      if (!result.ok) {
        return uploadMutationErrorResult(result, resolvedMode);
      }

      return jsonToolResult(
        { success: true, upload: result.upload },
        { mode: resolvedMode },
      );
    },
  );

  server.registerTool(
    "workspace_upload_delete",
    {
      description:
        "Delete one upload owned by the current user after removing its backing object. Requires an unsuspended signed-in user.",
      inputSchema: {
        id: uploadIdInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    async ({ id, mode }, extra) => {
      const resolvedMode = resolveMcpMode(mode);
      const userId = getUserId(extra.authInfo);
      const result = await deleteOwnedUpload({
        audit: { source: "mcp" },
        id,
        userId,
      });

      if (!result.ok) {
        return uploadMutationErrorResult(result, resolvedMode);
      }

      return jsonToolResult(
        {
          success: true,
          deletedId: result.deletedId,
          deletedSize: result.deletedSize,
        },
        { mode: resolvedMode },
      );
    },
  );
}
