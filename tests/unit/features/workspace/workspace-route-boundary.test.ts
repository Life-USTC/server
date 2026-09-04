import { afterEach, describe, expect, it, vi } from "vitest";

const { loadAnonymousHomePageMock, loadSignedWorkspacePageMock } = vi.hoisted(
  () => ({
    loadAnonymousHomePageMock: vi.fn(),
    loadSignedWorkspacePageMock: vi.fn(),
  }),
);

vi.mock("@/features/workspace/server/anonymous-home-page-load", () => ({
  loadAnonymousHomePage: loadAnonymousHomePageMock,
}));

vi.mock("@/features/workspace/server/workspace-page-load", () => ({
  loadSignedWorkspacePage: loadSignedWorkspacePageMock,
}));

vi.mock("@/features/workspace/server/workspace-page-actions", () => ({
  workspacePageActions: {},
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

describe("anonymous home and signed workspace route boundary", () => {
  afterEach(() => {
    loadAnonymousHomePageMock.mockReset();
    loadSignedWorkspacePageMock.mockReset();
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
    expect(loadSignedWorkspacePageMock).not.toHaveBeenCalled();
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
      location: "/catalog/bus?utm_source=bookmark",
      status: 308,
    });
    expect(loadAnonymousHomePageMock).not.toHaveBeenCalled();
    expect(loadSignedWorkspacePageMock).not.toHaveBeenCalled();
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
        "/workspace/calendar?calendarView=week&calendarSemester=42&utm_source=bookmark",
      status: 308,
    });
    expect(loadAnonymousHomePageMock).not.toHaveBeenCalled();
    expect(loadSignedWorkspacePageMock).not.toHaveBeenCalled();
  });

  it("redirects a signed visitor without a legacy tab to the workspace", async () => {
    const homeRoute = await import("@/routes/+page.server");

    await expect(
      homeRoute.load(
        routeEvent(
          "https://example.test/?overviewWeek=next",
          "user-1",
        ) as never,
      ),
    ).rejects.toMatchObject({
      location: "/workspace/overview?overviewWeek=next",
      status: 303,
    });
  });

  it("permanently redirects workspace query tabs before auth handling", async () => {
    const workspaceRoute = await import("@/routes/workspace/+page.server");

    await expect(
      workspaceRoute.load(
        routeEvent("https://example.test/workspace?tab=overview") as never,
      ),
    ).rejects.toMatchObject({
      location: "/workspace/overview",
      status: 308,
    });
    expect(loadSignedWorkspacePageMock).not.toHaveBeenCalled();
  });

  it("permanently redirects the workspace root to overview", async () => {
    const workspaceRoute = await import("@/routes/workspace/+page.server");

    await expect(
      workspaceRoute.load(
        routeEvent("https://example.test/workspace") as never,
      ),
    ).rejects.toMatchObject({
      location: "/workspace/overview",
      status: 308,
    });
    expect(loadSignedWorkspacePageMock).not.toHaveBeenCalled();
  });

  it("requires authentication before loading a semantic workspace section", async () => {
    const workspaceRoute = await import(
      "@/routes/workspace/[tab]/+page.server"
    );

    await expect(
      workspaceRoute.load(
        routeEvent("https://example.test/workspace/overview", undefined, {
          tab: "overview",
        }) as never,
      ),
    ).rejects.toMatchObject({
      location: "/account/sign-in?callbackUrl=%2Fworkspace%2Foverview",
      status: 303,
    });
    expect(loadSignedWorkspacePageMock).not.toHaveBeenCalled();
  });

  it("loads a semantic section without translating it into a tab query", async () => {
    loadSignedWorkspacePageMock.mockResolvedValue({
      marker: "signed",
      signedIn: true,
    });
    const workspaceRoute = await import(
      "@/routes/workspace/[tab]/+page.server"
    );
    const event = routeEvent(
      "https://example.test/workspace/homeworks?tab=calendar&homeworkView=list",
      "user-1",
      { tab: "homeworks" },
    );

    await expect(workspaceRoute.load(event as never)).resolves.toMatchObject({
      marker: "signed",
      signedIn: true,
    });
    expect(loadSignedWorkspacePageMock).toHaveBeenCalledWith({
      locals: event.locals,
      request: event.request,
      tab: "homeworks",
      url: event.url,
      userId: "user-1",
    });
    expect(event.url.href).toBe(
      "https://example.test/workspace/homeworks?tab=calendar&homeworkView=list",
    );
  });

  it("keeps workspace actions loadable for non-safe requests", async () => {
    loadSignedWorkspacePageMock.mockResolvedValue({
      marker: "signed",
      signedIn: true,
    });
    const workspaceRoute = await import("@/routes/workspace/+page.server");
    const event = routeEvent(
      "https://example.test/workspace?tab=todos",
      "user-1",
      {
        method: "POST",
      },
    );

    await expect(workspaceRoute.load(event as never)).resolves.toMatchObject({
      marker: "signed",
      signedIn: true,
    });
    expect(loadSignedWorkspacePageMock).toHaveBeenCalledWith({
      locals: event.locals,
      request: event.request,
      tab: "overview",
      url: event.url,
      userId: "user-1",
    });
  });
});
