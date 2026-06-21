import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  findActiveSuspensionMock,
  requireHomeworkItemByIdMock,
  updateHomeworkMock,
} = vi.hoisted(() => ({
  findActiveSuspensionMock: vi.fn(),
  requireHomeworkItemByIdMock: vi.fn(),
  updateHomeworkMock: vi.fn(),
}));

vi.mock("@/features/homeworks/server/homework-mutations", () => ({
  updateHomework: updateHomeworkMock,
}));

vi.mock("@/features/homeworks/server/homework-read-model", () => ({
  requireHomeworkItemById: requireHomeworkItemByIdMock,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  findActiveSuspension: findActiveSuspensionMock,
}));

describe("updateHomeworkOnSectionTool", () => {
  afterEach(() => {
    findActiveSuspensionMock.mockReset();
    requireHomeworkItemByIdMock.mockReset();
    updateHomeworkMock.mockReset();
    vi.resetModules();
  });

  it("passes the requested locale to the homework read model", async () => {
    findActiveSuspensionMock.mockResolvedValue(null);
    updateHomeworkMock.mockResolvedValue({ ok: true });
    requireHomeworkItemByIdMock.mockResolvedValue({
      id: "homework-1",
      section: { course: { name: "Algorithms" } },
    });
    const { updateHomeworkOnSectionTool } = await import(
      "@/lib/mcp/tools/section-data/homework-update-tool-handler"
    );

    await updateHomeworkOnSectionTool(
      {
        homeworkId: "homework-1",
        title: "Project update",
        locale: "en-us",
        mode: "default",
      },
      {
        authInfo: { extra: { userId: "user-1" } } as unknown as AuthInfo,
      },
    );

    expect(requireHomeworkItemByIdMock).toHaveBeenCalledWith({
      homeworkId: "homework-1",
      locale: "en-us",
      userId: "user-1",
    });
  });
});
