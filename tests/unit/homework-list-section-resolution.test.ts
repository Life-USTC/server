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

describe("homework list section resolution", () => {
  it("uses internal section references without a database lookup", async () => {
    await expect(
      resolveHomeworkSectionIds({ sectionId: 12, sectionIds: [34] }),
    ).resolves.toEqual({ ok: true, sectionIds: [34, 12] });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("resolves sectionJwId to the internal section id", async () => {
    findUniqueMock.mockResolvedValueOnce({ id: 56 });

    await expect(
      resolveHomeworkSectionIds({ sectionJwId: 9902001 }),
    ).resolves.toEqual({ ok: true, sectionIds: [56] });
  });

  it("reports missing sectionJwId targets", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(
      resolveHomeworkSectionIds({ sectionJwId: 9902001 }),
    ).resolves.toEqual({ ok: false, error: "not_found" });
  });

  it("reports missing section references", async () => {
    await expect(resolveHomeworkSectionIds({})).resolves.toEqual({
      ok: false,
      error: "invalid",
    });
  });
});
