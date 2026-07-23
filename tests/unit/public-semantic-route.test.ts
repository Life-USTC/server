import { afterEach, describe, expect, it, vi } from "vitest";

const { loadPublicBusPageMock, loadPublicLinksPageMock } = vi.hoisted(() => ({
  loadPublicBusPageMock: vi.fn(),
  loadPublicLinksPageMock: vi.fn(),
}));

vi.mock("@/features/dashboard/server/public-bus-page-load", () => ({
  loadPublicBusPage: loadPublicBusPageMock,
}));

vi.mock("@/features/dashboard/server/public-links-page-load", () => ({
  loadPublicLinksPage: loadPublicLinksPageMock,
}));

function routeEvent(pathname: string) {
  const url = new URL(pathname, "https://life.example");
  return {
    locals: { locale: "en-us" },
    parent: vi.fn().mockResolvedValue({
      socialMetadata: {
        canonicalUrl: `https://life.example${pathname}`,
        description: "Life@USTC",
        title: "Life@USTC",
      },
    }),
    request: new Request(url),
    url,
  };
}

describe("public semantic page routes", () => {
  afterEach(() => {
    loadPublicBusPageMock.mockReset();
    loadPublicLinksPageMock.mockReset();
  });

  it("loads only the public bus page and exposes route-specific metadata", async () => {
    loadPublicBusPageMock.mockResolvedValue({
      bus: { routes: [] },
      copy: {
        dashboard: {
          nav: {
            bus: {
              description: "Find the next shuttle",
              title: "Shuttle Bus",
            },
          },
        },
      },
    });
    const route = await import("@/routes/catalog/bus/+page.server");
    const event = routeEvent("/catalog/bus");

    await expect(route.load(event as never)).resolves.toMatchObject({
      bus: { routes: [] },
      socialMetadata: {
        canonicalUrl: "https://life.example/catalog/bus",
        description: "Find the next shuttle",
        title: "Shuttle Bus - Life@USTC",
      },
    });
    expect(loadPublicBusPageMock).toHaveBeenCalledWith({
      locals: event.locals,
      request: event.request,
      url: event.url,
    });
    expect(loadPublicLinksPageMock).not.toHaveBeenCalled();
  });

  it("loads only the public links page and exposes route-specific metadata", async () => {
    loadPublicLinksPageMock.mockResolvedValue({
      copy: {
        dashboard: {
          nav: {
            links: {
              description: "Search campus links",
              title: "Websites",
            },
          },
        },
      },
      publicLinks: [],
    });
    const route = await import("@/routes/catalog/links/+page.server");
    const event = routeEvent("/catalog/links");

    await expect(route.load(event as never)).resolves.toMatchObject({
      publicLinks: [],
      socialMetadata: {
        canonicalUrl: "https://life.example/catalog/links",
        description: "Search campus links",
        title: "Websites - Life@USTC",
      },
    });
    expect(loadPublicLinksPageMock).toHaveBeenCalledWith({
      locals: event.locals,
      request: event.request,
      url: event.url,
    });
    expect(loadPublicBusPageMock).not.toHaveBeenCalled();
  });
});
