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
    const event = routeEvent("https://example.test/?tab=bus");

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

  it("redirects signed visitors to the dashboard with supported state only", async () => {
    const homeRoute = await import("@/routes/+page.server");

    await expect(
      homeRoute.load(
        routeEvent(
          "https://example.test/?tab=calendar&calendarView=week&calendarSemester=42&utm_source=ignored",
          "user-1",
        ) as never,
      ),
    ).rejects.toMatchObject({
      location: "/dashboard?tab=calendar&calendarView=week&calendarSemester=42",
      status: 303,
    });
    expect(loadAnonymousHomePageMock).not.toHaveBeenCalled();
    expect(loadSignedDashboardPageMock).not.toHaveBeenCalled();
  });

  it("requires authentication before loading signed dashboard data", async () => {
    const dashboardRoute = await import("@/routes/dashboard/+page.server");

    await expect(
      dashboardRoute.load(
        routeEvent("https://example.test/dashboard?tab=overview") as never,
      ),
    ).rejects.toMatchObject({
      location: "/signin?callbackUrl=%2Fdashboard%3Ftab%3Doverview",
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
    const event = routeEvent(
      "https://example.test/dashboard?tab=overview",
      "user-1",
    );

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
