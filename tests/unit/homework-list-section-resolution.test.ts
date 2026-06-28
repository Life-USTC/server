import { describe, expect, it, vi } from "vitest";
import { resolveHomeworkSectionIds } from "@/features/homeworks/server/homework-list-read-model";

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(),
  prisma: {
    section: {
      findUnique: findUniqueMock,
    },
  },
}));

describe("作业列表 section 解析", () => {
  it("直接使用内部 section 引用而不查询数据库", async () => {
    await expect(
      resolveHomeworkSectionIds({ sectionId: 12, sectionIds: [34] }),
    ).resolves.toEqual({ ok: true, sectionIds: [34, 12] });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("将 sectionJwId 解析为内部 section id", async () => {
    findUniqueMock.mockResolvedValueOnce({ id: 56 });

    await expect(
      resolveHomeworkSectionIds({ sectionJwId: 9902001 }),
    ).resolves.toEqual({ ok: true, sectionIds: [56] });
  });

  it("报告缺失的 sectionJwId 目标", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(
      resolveHomeworkSectionIds({ sectionJwId: 9902001 }),
    ).resolves.toEqual({ ok: false, error: "not_found" });
  });

  it("报告缺失的 section 引用", async () => {
    await expect(resolveHomeworkSectionIds({})).resolves.toEqual({
      ok: false,
      error: "invalid",
    });
  });
});
