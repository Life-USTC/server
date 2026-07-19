import { afterEach, describe, expect, it, vi } from "vitest";

const { loadAnonymousHomePageMock, loadSignedDashboardPageMock } = vi.hoisted(
  () => ({
    loadAnonymousHomePageMock: vi.fn(),
    loadSignedDashboardPageMock: vi.fn(),
  }),
);

vi.mock("@/features/dashboard/server/anonymous-home-page-load", () => ({
  loadAnonymousHomePage: loadAnonymousHomePageMock,
}));

vi.mock("@/features/dashboard/server/dashboard-page-load", () => ({
  loadSignedDashboardPage: loadSignedDashboardPageMock,
}));

vi.mock("@/features/dashboard/server/dashboard-page-actions", () => ({
  dashboardPageActions: {},
}));

function routeEvent(
  url: string,
  userId?: string,
  options: { method?: string; tab?: string } = {},
) {
  return {
    locals: {
      authUser: userId ? { id: userId } : null,
      locale: "en-us",
    },
    params: options.tab ? { tab: options.tab } : {},
    request: new Request(url, { method: options.method }),
    url: new URL(url),
  };
}

describe("anonymous home and signed dashboard route boundary", () => {
  afterEach(() => {
    loadAnonymousHomePageMock.mockReset();
    loadSignedDashboardPageMock.mockReset();
  });

  it("loads only the public home data for anonymous visitors", async () => {
    loadAnonymousHomePageMock.mockResolvedValue({
      marker: "anonymous",
      signedIn: false,
    });
    const homeRoute = await import("@/routes/+page.server");
    const event = routeEvent("https://example.test/");

    await expect(homeRoute.load(event as never)).resolves.toMatchObject({
      marker: "anonymous",
      signedIn: false,
    });
    expect(loadAnonymousHomePageMock).toHaveBeenCalledWith({
      locals: event.locals,
      request: event.request,
      url: event.url,
    });
    expect(loadSignedDashboardPageMock).not.toHaveBeenCalled();
    expect("actions" in homeRoute).toBe(false);
  });

  it("permanently redirects anonymous public tab bookmarks", async () => {
    const homeRoute = await import("@/routes/+page.server");

    await expect(
      homeRoute.load(
        routeEvent(
          "https://example.test/?tab=bus&utm_source=bookmark",
        ) as never,
      ),
    ).rejects.toMatchObject({
      location: "/bus?utm_source=bookmark",
      status: 308,
    });
    expect(loadAnonymousHomePageMock).not.toHaveBeenCalled();
    expect(loadSignedDashboardPageMock).not.toHaveBeenCalled();
  });

  it("permanently redirects signed legacy tabs to semantic workspace paths", async () => {
    const homeRoute = await import("@/routes/+page.server");

    await expect(
      homeRoute.load(
        routeEvent(
          "https://example.test/?tab=calendar&calendarView=week&calendarSemester=42&utm_source=bookmark",
          "user-1",
        ) as never,
      ),
    ).rejects.toMatchObject({
      location:
        "/dashboard/calendar?calendarView=week&calendarSemester=42&utm_source=bookmark",
      status: 308,
    });
    expect(loadAnonymousHomePageMock).not.toHaveBeenCalled();
    expect(loadSignedDashboardPageMock).not.toHaveBeenCalled();
  });

  it("redirects a signed visitor without a legacy tab to the dashboard", async () => {
    const homeRoute = await import("@/routes/+page.server");

    await expect(
      homeRoute.load(
        routeEvent(
          "https://example.test/?overviewWeek=next",
          "user-1",
        ) as never,
      ),
    ).rejects.toMatchObject({
      location: "/dashboard/overview?overviewWeek=next",
      status: 303,
    });
  });

  it("permanently redirects dashboard query tabs before auth handling", async () => {
    const dashboardRoute = await import("@/routes/dashboard/+page.server");

    await expect(
      dashboardRoute.load(
        routeEvent("https://example.test/dashboard?tab=overview") as never,
      ),
    ).rejects.toMatchObject({
      location: "/dashboard/overview",
      status: 308,
    });
    expect(loadSignedDashboardPageMock).not.toHaveBeenCalled();
  });

  it("permanently redirects the dashboard root to overview", async () => {
    const dashboardRoute = await import("@/routes/dashboard/+page.server");

    await expect(
      dashboardRoute.load(
        routeEvent("https://example.test/dashboard") as never,
      ),
    ).rejects.toMatchObject({
      location: "/dashboard/overview",
      status: 308,
    });
    expect(loadSignedDashboardPageMock).not.toHaveBeenCalled();
  });

  it("requires authentication before loading a semantic dashboard section", async () => {
    const dashboardRoute = await import(
      "@/routes/dashboard/[tab]/+page.server"
    );

    await expect(
      dashboardRoute.load(
        routeEvent("https://example.test/dashboard/overview", undefined, {
          tab: "overview",
        }) as never,
      ),
    ).rejects.toMatchObject({
      location: "/signin?callbackUrl=%2Fdashboard%2Foverview",
      status: 303,
    });
    expect(loadSignedDashboardPageMock).not.toHaveBeenCalled();
  });

  it("loads a semantic section without translating it into a tab query", async () => {
    loadSignedDashboardPageMock.mockResolvedValue({
      marker: "signed",
      signedIn: true,
    });
    const dashboardRoute = await import(
      "@/routes/dashboard/[tab]/+page.server"
    );
    const event = routeEvent(
      "https://example.test/dashboard/homeworks?tab=calendar&homeworkView=list",
      "user-1",
      { tab: "homeworks" },
    );

    await expect(dashboardRoute.load(event as never)).resolves.toMatchObject({
      marker: "signed",
      signedIn: true,
    });
    expect(loadSignedDashboardPageMock).toHaveBeenCalledWith({
      locals: event.locals,
      request: event.request,
      tab: "homeworks",
      url: event.url,
      userId: "user-1",
    });
    expect(event.url.href).toBe(
      "https://example.test/dashboard/homeworks?tab=calendar&homeworkView=list",
    );
  });

  it("keeps dashboard actions loadable for non-safe requests", async () => {
    loadSignedDashboardPageMock.mockResolvedValue({
      marker: "signed",
      signedIn: true,
    });
    const dashboardRoute = await import("@/routes/dashboard/+page.server");
    const event = routeEvent(
      "https://example.test/dashboard?tab=todos",
      "user-1",
      {
        method: "POST",
      },
    );

    await expect(dashboardRoute.load(event as never)).resolves.toMatchObject({
      marker: "signed",
      signedIn: true,
    });
    expect(loadSignedDashboardPageMock).toHaveBeenCalledWith({
      locals: event.locals,
      request: event.request,
      tab: "overview",
      url: event.url,
      userId: "user-1",
    });
  });
});
