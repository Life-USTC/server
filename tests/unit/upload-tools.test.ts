import { afterEach, describe, expect, it, vi } from "vitest";
import { registerUploadTools } from "@/lib/mcp/tools/upload-tools";

const { deleteOwnedUploadMock, listUploadsMock, renameOwnedUploadMock } =
  vi.hoisted(() => ({
    deleteOwnedUploadMock: vi.fn(),
    listUploadsMock: vi.fn(),
    renameOwnedUploadMock: vi.fn(),
  }));

vi.mock("@/features/uploads/server/upload-service", () => ({
  deleteOwnedUpload: deleteOwnedUploadMock,
  listUploads: listUploadsMock,
  renameOwnedUpload: renameOwnedUploadMock,
}));

type RegisteredTool = {
  handler: (
    args: Record<string, unknown>,
    extra: { authInfo: { extra: { userId: string } } },
  ) => Promise<{ content: Array<{ text: string; type: "text" }> }>;
};

function createToolRegistry() {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool(
      name: string,
      _config: unknown,
      handler: RegisteredTool["handler"],
    ) {
      tools.set(name, { handler });
    },
  };

  registerUploadTools(
    server as unknown as Parameters<typeof registerUploadTools>[0],
  );
  return tools;
}

function parseToolResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0]?.text ?? "{}");
}

describe("upload MCP tools", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("serializes storage cleanup failures without reporting delete success", async () => {
    deleteOwnedUploadMock.mockResolvedValue({
      ok: false,
      error: "storage_delete_failed",
    });
    const tools = createToolRegistry();
    const tool = tools.get("delete_my_upload");
    expect(tool).toBeDefined();
    if (!tool) return;

    const result = await tool.handler(
      { id: "upload-1" },
      { authInfo: { extra: { userId: "user-1" } } },
    );

    expect(parseToolResult(result)).toEqual({
      success: false,
      error: "storage_delete_failed",
      message: "Failed to delete upload object",
      hint: "The upload metadata was kept so the deletion can be retried.",
    });
    expect(deleteOwnedUploadMock).toHaveBeenCalledWith({
      audit: { source: "mcp" },
      id: "upload-1",
      userId: "user-1",
    });
  });
});
