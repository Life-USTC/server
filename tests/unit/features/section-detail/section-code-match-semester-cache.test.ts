import { describe, expect, it, vi } from "vitest";

const { getCachedCurrentSemesterMock, semesterFindUniqueMock } = vi.hoisted(
  () => ({
    getCachedCurrentSemesterMock: vi.fn(),
    semesterFindUniqueMock: vi.fn(),
  }),
);

vi.mock("@/features/catalog/server/academic-metadata-read-model", () => ({
  getCachedCurrentSemester: getCachedCurrentSemesterMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { semester: { findUnique: semesterFindUniqueMock } },
}));

describe("section code match semester resolution", () => {
  it("uses the shared current-semester cache when no semester is explicit", async () => {
    getCachedCurrentSemesterMock.mockResolvedValue({ id: 1 });
    const { resolveSectionCodeMatchSemester } = await import(
      "@/features/catalog/server/section-code-match-semester"
    );

    await expect(resolveSectionCodeMatchSemester()).resolves.toEqual({ id: 1 });
    expect(getCachedCurrentSemesterMock).toHaveBeenCalledOnce();
    expect(semesterFindUniqueMock).not.toHaveBeenCalled();
  });

  it("keeps an explicit semester as a direct unique lookup", async () => {
    semesterFindUniqueMock.mockResolvedValue({ id: 9 });
    const { resolveSectionCodeMatchSemester } = await import(
      "@/features/catalog/server/section-code-match-semester"
    );

    await expect(resolveSectionCodeMatchSemester(9)).resolves.toEqual({
      id: 9,
    });
    expect(semesterFindUniqueMock).toHaveBeenCalledWith({ where: { id: 9 } });
  });
});
