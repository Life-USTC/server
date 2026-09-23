import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSectionIdForHomeworkCreate } from "@/features/homeworks/server/homework-create";

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    section: {
      findUnique: findUniqueMock,
    },
  },
}));

describe("作业创建 section 解析", () => {
  afterEach(() => {
    findUniqueMock.mockReset();
  });

  it("未提供 sectionJwId 时验证 sectionId", async () => {
    findUniqueMock.mockResolvedValueOnce({ id: 12 });

    await expect(
      resolveSectionIdForHomeworkCreate({ sectionId: 12, sectionJwId: null }),
    ).resolves.toEqual({ ok: true, sectionId: 12 });
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 12 },
      select: { id: true },
    });
  });

  it("报告缺失的内部 section id", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(
      resolveSectionIdForHomeworkCreate({ sectionId: 12, sectionJwId: null }),
    ).resolves.toEqual({ ok: false, error: "not_found" });
  });

  it("未提供 id 时报告缺失的 section 引用", async () => {
    await expect(
      resolveSectionIdForHomeworkCreate({ sectionId: null, sectionJwId: null }),
    ).resolves.toEqual({ ok: false, error: "not_found" });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("将 sectionJwId 解析为内部 section id", async () => {
    findUniqueMock.mockResolvedValueOnce({ id: 34 });

    await expect(
      resolveSectionIdForHomeworkCreate({ sectionId: null, sectionJwId: 5678 }),
    ).resolves.toEqual({ ok: true, sectionId: 34 });
  });

  it("拒绝冲突的 sectionId 与 sectionJwId 引用", async () => {
    findUniqueMock.mockResolvedValueOnce({ id: 34 });

    await expect(
      resolveSectionIdForHomeworkCreate({ sectionId: 12, sectionJwId: 5678 }),
    ).resolves.toEqual({ ok: false, error: "mismatch" });
  });

  it("将缺失的 sectionJwId 目标与冲突分开报告", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(
      resolveSectionIdForHomeworkCreate({ sectionId: 12, sectionJwId: 5678 }),
    ).resolves.toEqual({ ok: false, error: "not_found" });
  });
});
