import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { sanitizeFilename } from "@/features/uploads/lib/upload-utils";
import {
  deleteOwnedUpload,
  listUploads,
  renameOwnedUpload,
} from "@/features/uploads/server/upload-service";
import {
  getUserId,
  jsonToolResult,
  mcpModeInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

const uploadIdInputSchema = z.string().trim().min(1);
const uploadFilenameInputSchema = z.string().trim().min(1).max(255);

type UploadMutationError = {
  error: "forbidden" | "not_found" | "suspended";
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
        hint: "Use list_my_uploads to confirm the upload id before changing it.",
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
    "list_my_uploads",
    {
      description:
        "List the current user's comment attachment uploads, quota, and upload limits. Does not stream file contents.",
      inputSchema: {
        mode: mcpModeInputSchema,
      },
    },
    async ({ mode }, extra) => {
      const resolvedMode = resolveMcpMode(mode);
      const userId = getUserId(extra.authInfo);
      const result = await listUploads(userId);
      return jsonToolResult(result, { mode: resolvedMode });
    },
  );

  server.registerTool(
    "rename_my_upload",
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
    "delete_my_upload",
    {
      description:
        "Delete one upload owned by the current user and remove its backing object best-effort. Requires an unsuspended signed-in user.",
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
