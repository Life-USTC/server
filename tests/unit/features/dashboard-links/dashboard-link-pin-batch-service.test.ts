import { afterEach, describe, expect, it, vi } from "vitest";

const { resolveDashboardLinkBySlugMock, updateDashboardLinkPinStateMock } =
  vi.hoisted(() => ({
    resolveDashboardLinkBySlugMock: vi.fn(),
    updateDashboardLinkPinStateMock: vi.fn(),
  }));

vi.mock("@/features/dashboard-links/server/dashboard-link-service", () => ({
  resolveDashboardLinkBySlug: resolveDashboardLinkBySlugMock,
  updateDashboardLinkPinState: updateDashboardLinkPinStateMock,
}));

import { setDashboardLinkPinStatesBatch } from "@/features/dashboard-links/server/dashboard-link-pin-batch";

describe("setDashboardLinkPinStatesBatch", () => {
  afterEach(() => {
    resolveDashboardLinkBySlugMock.mockReset();
    updateDashboardLinkPinStateMock.mockReset();
  });

  it("validates every slug before applying ordered non-atomic writes", async () => {
    resolveDashboardLinkBySlugMock
      .mockReturnValueOnce({ slug: "mail" })
      .mockReturnValueOnce(null);

    await expect(
      setDashboardLinkPinStatesBatch({
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
    expect(updateDashboardLinkPinStateMock).not.toHaveBeenCalled();
  });

  it("preserves request order and returns only the final pin state", async () => {
    resolveDashboardLinkBySlugMock.mockImplementation((slug: string) => ({
      slug: slug.trim(),
    }));
    updateDashboardLinkPinStateMock
      .mockResolvedValueOnce(["mail"])
      .mockResolvedValueOnce([]);

    await expect(
      setDashboardLinkPinStatesBatch({
        items: [
          { action: "pin", slug: " mail " },
          { action: "unpin", slug: "mail" },
        ],
        userId: "user-1",
      }),
    ).resolves.toEqual({ ok: true, pinnedSlugs: [] });
    expect(updateDashboardLinkPinStateMock).toHaveBeenNthCalledWith(1, {
      action: "pin",
      slug: "mail",
      userId: "user-1",
    });
    expect(updateDashboardLinkPinStateMock).toHaveBeenNthCalledWith(2, {
      action: "unpin",
      slug: "mail",
      userId: "user-1",
    });
  });
});
