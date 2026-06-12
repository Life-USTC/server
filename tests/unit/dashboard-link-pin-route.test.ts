import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveApiUserIdMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/auth/api-auth", () => ({
  resolveApiUserId: resolveApiUserIdMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    dashboardLinkPin: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("POST /api/dashboard-links/pin", () => {
  beforeEach(() => {
    vi.resetModules();
    resolveApiUserIdMock.mockResolvedValue("user-1");
    transactionMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a 500 JSON error when persisting a pin fails", async () => {
    transactionMock.mockRejectedValue(new Error("db write failed"));
    const { postDashboardLinkPinRoute } = await import(
      "@/lib/api/routes/dashboard-links"
    );

    const form = new FormData();
    form.set("slug", "jw");
    form.set("action", "pin");
    form.set("returnTo", "/");

    const response = await postDashboardLinkPinRoute(
      new Request("http://localhost/api/dashboard-links/pin", {
        method: "POST",
        body: form,
        headers: {
          accept: "application/json",
        },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      pinnedSlugs: [],
      maxPinnedLinks: 4,
      error: "Failed to update dashboard link pin state",
    });
  });
});
