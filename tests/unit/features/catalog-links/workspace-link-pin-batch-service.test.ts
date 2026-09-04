import { afterEach, describe, expect, it, vi } from "vitest";

const { resolveCatalogLinkBySlugMock, updateWorkspaceLinkPinStateMock } =
  vi.hoisted(() => ({
    resolveCatalogLinkBySlugMock: vi.fn(),
    updateWorkspaceLinkPinStateMock: vi.fn(),
  }));

vi.mock("@/features/catalog-links/server/catalog-link-service", () => ({
  resolveCatalogLinkBySlug: resolveCatalogLinkBySlugMock,
  updateWorkspaceLinkPinState: updateWorkspaceLinkPinStateMock,
}));

import { setWorkspaceLinkPinStatesBatch } from "@/features/catalog-links/server/workspace-link-pin-batch";

describe("setWorkspaceLinkPinStatesBatch", () => {
  afterEach(() => {
    resolveCatalogLinkBySlugMock.mockReset();
    updateWorkspaceLinkPinStateMock.mockReset();
  });

  it("validates every slug before applying ordered non-atomic writes", async () => {
    resolveCatalogLinkBySlugMock
      .mockReturnValueOnce({ slug: "mail" })
      .mockReturnValueOnce(null);

    await expect(
      setWorkspaceLinkPinStatesBatch({
        items: [
          { action: "pin", slug: " mail " },
          { action: "unpin", slug: "missing" },
        ],
        userId: "user-1",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "invalid_slug",
      slug: "missing",
    });
    expect(updateWorkspaceLinkPinStateMock).not.toHaveBeenCalled();
  });

  it("preserves request order and returns only the final pin state", async () => {
    resolveCatalogLinkBySlugMock.mockImplementation((slug: string) => ({
      slug: slug.trim(),
    }));
    updateWorkspaceLinkPinStateMock
      .mockResolvedValueOnce(["mail"])
      .mockResolvedValueOnce([]);

    await expect(
      setWorkspaceLinkPinStatesBatch({
        items: [
          { action: "pin", slug: " mail " },
          { action: "unpin", slug: "mail" },
        ],
        userId: "user-1",
      }),
    ).resolves.toEqual({ ok: true, pinnedSlugs: [] });
    expect(updateWorkspaceLinkPinStateMock).toHaveBeenNthCalledWith(1, {
      action: "pin",
      slug: "mail",
      userId: "user-1",
    });
    expect(updateWorkspaceLinkPinStateMock).toHaveBeenNthCalledWith(2, {
      action: "unpin",
      slug: "mail",
      userId: "user-1",
    });
  });
});
