import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBusTabDataMock, getPublicDashboardLinksDataMock } = vi.hoisted(
  () => ({
    getBusTabDataMock: vi.fn(),
    getPublicDashboardLinksDataMock: vi.fn(),
  }),
);

vi.mock("@/features/dashboard/server/dashboard-tab-data", () => ({
  getBusTabData: getBusTabDataMock,
}));

vi.mock("@/features/dashboard-links/server/dashboard-link-data", () => ({
  getPublicDashboardLinksData: getPublicDashboardLinksDataMock,
}));

import { loadPublicBusPage } from "@/features/dashboard/server/public-bus-page-load";
import { loadPublicLinksPage } from "@/features/dashboard/server/public-links-page-load";

const url = new URL("https://example.test/");
const event = {
  locals: {
    locale: "en-us" as const,
    requestId: "request-1",
  },
  request: new Request(url),
  url,
};

describe("public page loaders", () => {
  beforeEach(() => {
    getBusTabDataMock.mockReset();
    getPublicDashboardLinksDataMock.mockReset();
  });

  it("loads only bus data for the public bus page", async () => {
    getBusTabDataMock.mockResolvedValue({ data: { routes: [] } });

    const result = await loadPublicBusPage(event);

    expect(result.bus).toEqual({ routes: [] });
    expect(getBusTabDataMock).toHaveBeenCalledWith(null, "en-us");
    expect(getPublicDashboardLinksDataMock).not.toHaveBeenCalled();
  });

  it("loads only public links for the public links page", async () => {
    getPublicDashboardLinksDataMock.mockResolvedValue({
      dashboardLinks: [{ slug: "jw" }],
    });

    const result = await loadPublicLinksPage(event);

    expect(result.publicLinks).toEqual([{ slug: "jw" }]);
    expect(getPublicDashboardLinksDataMock).toHaveBeenCalledWith("en-us");
    expect(getBusTabDataMock).not.toHaveBeenCalled();
  });
});
