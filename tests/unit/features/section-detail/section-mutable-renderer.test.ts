import { expect, it, vi } from "vitest";
import { emptyDescriptionData } from "@/features/descriptions/lib/description-empty-payload";

const { queryRaw, loadRenderer } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  loadRenderer: vi.fn(),
}));
vi.mock("@/lib/db/prisma-adapter", () => ({
  withRuntimeDatabaseAdapter: (
    _role: string,
    run: (adapter: unknown) => unknown,
  ) => run({ queryRaw }),
}));
vi.mock(
  "@/features/descriptions/server/description-payload",
  async (original) => {
    loadRenderer();
    return original();
  },
);

import { loadSectionPageMutableData } from "@/features/section-detail/server/section-page-mutable-data";

it("loads the renderer only when a live description record exists", async () => {
  queryRaw.mockResolvedValueOnce({ rows: [["2026-01-01T00:00:00Z", null]] });
  expect(await loadSectionPageMutableData(42)).toEqual({
    description: emptyDescriptionData(),
    retiredAt: "2026-01-01T00:00:00.000Z",
  });
  expect(loadRenderer).not.toHaveBeenCalled();
  queryRaw.mockResolvedValueOnce({ rows: [[null, "description", "**text**"]] });
  const result = await loadSectionPageMutableData(42);
  expect(result.description.renderedHtml).toContain("<strong>text</strong>");
  expect(loadRenderer).toHaveBeenCalledOnce();
});
