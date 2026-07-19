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

function routeEvent(url: string, userId?: string) {
  return {
    locals: {
      authUser: userId ? { id: userId } : null,
      locale: "en-us",
    },
    request: new Request(url),
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
      location: "/dashboard?overviewWeek=next",
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

  it("requires authentication before loading signed dashboard data", async () => {
    const dashboardRoute = await import("@/routes/dashboard/+page.server");

    await expect(
      dashboardRoute.load(
        routeEvent("https://example.test/dashboard") as never,
      ),
    ).rejects.toMatchObject({
      location: "/signin?callbackUrl=%2Fdashboard",
      status: 303,
    });
    expect(loadSignedDashboardPageMock).not.toHaveBeenCalled();
  });

  it("loads the signed dashboard with an explicit user id", async () => {
    loadSignedDashboardPageMock.mockResolvedValue({
      marker: "signed",
      signedIn: true,
    });
    const dashboardRoute = await import("@/routes/dashboard/+page.server");
    const event = routeEvent("https://example.test/dashboard", "user-1");

    await expect(dashboardRoute.load(event as never)).resolves.toMatchObject({
      marker: "signed",
      signedIn: true,
    });
    expect(loadSignedDashboardPageMock).toHaveBeenCalledWith({
      locals: event.locals,
      request: event.request,
      url: event.url,
      userId: "user-1",
    });
  });
});
