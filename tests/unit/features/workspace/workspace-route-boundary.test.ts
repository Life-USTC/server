import { afterEach, describe, expect, it, vi } from "vitest";

const { loadHomePageMock, loadSignedWorkspacePageMock } = vi.hoisted(() => ({
  loadHomePageMock: vi.fn(),
  loadSignedWorkspacePageMock: vi.fn(),
}));

vi.mock("@/features/workspace/server/anonymous-home-page-load", () => ({
  loadHomePage: loadHomePageMock,
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
    parent: async () => ({}),
    request: new Request(url, { method: options.method }),
    url: new URL(url),
  };
}

describe("home and signed workspace route boundary", () => {
  afterEach(() => {
    loadHomePageMock.mockReset();
    loadSignedWorkspacePageMock.mockReset();
  });

  it("loads the public home data for anonymous visitors", async () => {
    loadHomePageMock.mockResolvedValue({ marker: "public" });
    const homeRoute = await import("@/routes/+page.server");
    const event = routeEvent("https://example.test/");

    await expect(homeRoute.load(event as never)).resolves.toMatchObject({
      marker: "public",
    });
    expect(loadHomePageMock).toHaveBeenCalledWith({
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
    expect(loadHomePageMock).not.toHaveBeenCalled();
    expect(loadSignedWorkspacePageMock).not.toHaveBeenCalled();
  });

  it("permanently redirects legacy workspace tabs to semantic paths", async () => {
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
    expect(loadHomePageMock).not.toHaveBeenCalled();
    expect(loadSignedWorkspacePageMock).not.toHaveBeenCalled();
  });

  it("serves a signed visitor the identical viewer-independent home payload", async () => {
    loadHomePageMock.mockResolvedValue({ marker: "public" });
    const homeRoute = await import("@/routes/+page.server");
    const signed = routeEvent("https://example.test/", "user-1");
    const anonymous = routeEvent("https://example.test/");

    // `/` is the one home. A signed visitor is no longer redirected into the
    // workspace, and the load is handed nothing it could branch on, which is
    // what keeps `/` admissible to the shared public HTML cache.
    await expect(homeRoute.load(signed as never)).resolves.toMatchObject({
      marker: "public",
    });
    await expect(homeRoute.load(anonymous as never)).resolves.toMatchObject({
      marker: "public",
    });
    expect(loadSignedWorkspacePageMock).not.toHaveBeenCalled();
    expect(loadHomePageMock).toHaveBeenCalledTimes(2);
    // The loader is handed the request context and nothing viewer-shaped on
    // top of it; `tests/e2e/src/app/cache-policy/shell-projection.test.ts`
    // proves the rendered HTML is identical for both visitors.
    for (const [args] of loadHomePageMock.mock.calls) {
      expect(Object.keys(args).toSorted()).toEqual([
        "locals",
        "request",
        "url",
      ]);
    }
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
