import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPrismaMock, loadSignedDashboardPageDataMock } = vi.hoisted(() => ({
  getPrismaMock: vi.fn(),
  loadSignedDashboardPageDataMock: vi.fn(),
}));

vi.mock("@/features/dashboard/server/dashboard-page-copy", () => ({
  getDashboardPageCopy: () => ({
    dashboard: {
      nav: {
        homeworks: {
          title: "Homework",
        },
      },
    },
  }),
}));

vi.mock("@/features/dashboard/server/dashboard-page-load-signed", () => ({
  loadSignedDashboardPageData: loadSignedDashboardPageDataMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: getPrismaMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: vi.fn(),
}));

import { loadSignedDashboardPage } from "@/features/dashboard/server/dashboard-page-load";

describe("signed dashboard page load", () => {
  beforeEach(() => {
    getPrismaMock.mockReset();
    loadSignedDashboardPageDataMock.mockReset();
  });

  it("loads only signed tab data and its accessible content label", async () => {
    loadSignedDashboardPageDataMock.mockResolvedValue({
      marker: "signed-homeworks",
      signedIn: true,
      tab: "homeworks",
    });
    const url = new URL(
      "https://example.test/dashboard/homeworks?tab=calendar&homeworkView=list",
    );

    const result = await loadSignedDashboardPage({
      locals: {
        locale: "en-us",
        requestId: "request-1",
      },
      request: new Request(url),
      tab: "homeworks",
      url,
      userId: "user-1",
    });

    expect(getPrismaMock).not.toHaveBeenCalled();
    expect(loadSignedDashboardPageDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pageCopy: expect.any(Object),
        requestId: "request-1",
        tab: "homeworks",
        userId: "user-1",
      }),
    );
    expect(url.href).toBe(
      "https://example.test/dashboard/homeworks?tab=calendar&homeworkView=list",
    );
    expect(result).toEqual({
      mainContentLabel: "Homework",
      marker: "signed-homeworks",
      signedIn: true,
      tab: "homeworks",
    });
  });
});
