import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBusTabDataMock, getPublicCatalogLinksDataMock, logAppEventMock } =
  vi.hoisted(() => ({
    getBusTabDataMock: vi.fn(),
    getPublicCatalogLinksDataMock: vi.fn(),
    logAppEventMock: vi.fn(),
  }));

vi.mock("@/features/workspace/server/workspace-tab-data", () => ({
  getBusTabData: getBusTabDataMock,
}));

vi.mock("@/features/catalog-links/server/catalog-link-data", () => ({
  getPublicCatalogLinksData: getPublicCatalogLinksDataMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

import { loadAnonymousHomePage } from "@/features/workspace/server/anonymous-home-page-load";
import { loadPublicBusPage } from "@/features/workspace/server/public-bus-page-load";
import { loadPublicLinksPage } from "@/features/workspace/server/public-links-page-load";

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
    getPublicCatalogLinksDataMock.mockReset();
    logAppEventMock.mockReset();
  });

  it("keeps the anonymous home loader query-free", async () => {
    const result = await loadAnonymousHomePage(event);

    expect(result).toMatchObject({
      locale: "en-us",
      signedIn: false,
    });
    expect(result).not.toHaveProperty("bus");
    expect(result).not.toHaveProperty("publicLinks");
    expect(getBusTabDataMock).not.toHaveBeenCalled();
    expect(getPublicCatalogLinksDataMock).not.toHaveBeenCalled();
  });

  it("loads only bus data for the public bus page", async () => {
    getBusTabDataMock.mockResolvedValue({ data: { routes: [] } });

    const result = await loadPublicBusPage(event);

    expect(result.bus).toEqual({ routes: [] });
    expect(getBusTabDataMock).toHaveBeenCalledWith(null, "en-us");
    expect(getPublicCatalogLinksDataMock).not.toHaveBeenCalled();
  });

  it("loads only public links for the public links page", async () => {
    getPublicCatalogLinksDataMock.mockResolvedValue({
      catalogLinks: [{ slug: "jw" }],
    });

    const result = await loadPublicLinksPage(event);

    expect(result.links).toEqual([{ slug: "jw" }]);
    expect(getPublicCatalogLinksDataMock).toHaveBeenCalledWith("en-us");
    expect(getBusTabDataMock).not.toHaveBeenCalled();
  });
});
