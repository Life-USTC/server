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

describe("homework create section resolution", () => {
  afterEach(() => {
    findUniqueMock.mockReset();
  });

  it("verifies sectionId when no sectionJwId is provided", async () => {
    findUniqueMock.mockResolvedValueOnce({ id: 12 });

    await expect(
      resolveSectionIdForHomeworkCreate({ sectionId: 12, sectionJwId: null }),
    ).resolves.toEqual({ ok: true, sectionId: 12 });
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 12 },
      select: { id: true },
    });
  });

  it("reports missing internal section ids", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(
      resolveSectionIdForHomeworkCreate({ sectionId: 12, sectionJwId: null }),
    ).resolves.toEqual({ ok: false, error: "not_found" });
  });

  it("reports missing section references when no id is provided", async () => {
    await expect(
      resolveSectionIdForHomeworkCreate({ sectionId: null, sectionJwId: null }),
    ).resolves.toEqual({ ok: false, error: "not_found" });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("resolves sectionJwId to the internal section id", async () => {
    findUniqueMock.mockResolvedValueOnce({ id: 34 });

    await expect(
      resolveSectionIdForHomeworkCreate({ sectionId: null, sectionJwId: 5678 }),
    ).resolves.toEqual({ ok: true, sectionId: 34 });
  });

  it("rejects conflicting sectionId and sectionJwId references", async () => {
    findUniqueMock.mockResolvedValueOnce({ id: 34 });

    await expect(
      resolveSectionIdForHomeworkCreate({ sectionId: 12, sectionJwId: 5678 }),
    ).resolves.toEqual({ ok: false, error: "mismatch" });
  });

  it("reports missing sectionJwId targets separately from conflicts", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(
      resolveSectionIdForHomeworkCreate({ sectionId: 12, sectionJwId: 5678 }),
    ).resolves.toEqual({ ok: false, error: "not_found" });
  });
});
