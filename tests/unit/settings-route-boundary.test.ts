import { afterEach, describe, expect, it, vi } from "vitest";

const { loadSettingsPageMock } = vi.hoisted(() => ({
  loadSettingsPageMock: vi.fn(),
}));

vi.mock("@/features/settings/server/settings-page-load", () => ({
  loadSettingsPage: loadSettingsPageMock,
}));

vi.mock("@/features/settings/server/settings-page-actions", () => ({
  settingsPageActions: {},
}));

function routeEvent(
  url: string,
  options: { method?: string; tab?: string } = {},
) {
  return {
    locals: { locale: "en-us" },
    params: options.tab ? { tab: options.tab } : {},
    request: new Request(url, { method: options.method }),
    url: new URL(url),
  };
}

describe("settings route boundary", () => {
  afterEach(() => {
    loadSettingsPageMock.mockReset();
  });

  it("permanently redirects a legacy query tab and preserves filters", async () => {
    const settingsRoute = await import("@/routes/settings/+page.server");

    await expect(
      settingsRoute.load(
        routeEvent(
          "https://example.test/settings?tab=accounts&message=Success",
        ) as never,
      ),
    ).rejects.toMatchObject({
      location: "/settings/accounts?message=Success",
      status: 308,
    });
    expect(loadSettingsPageMock).not.toHaveBeenCalled();
  });

  it("loads a semantic section directly from its route parameter", async () => {
    loadSettingsPageMock.mockResolvedValue({ marker: "accounts" });
    const settingsRoute = await import("@/routes/settings/[tab]/+page.server");
    const event = routeEvent(
      "https://example.test/settings/accounts?tab=danger&message=Success",
      { tab: "accounts" },
    );

    await expect(settingsRoute.load(event as never)).resolves.toEqual({
      marker: "accounts",
    });
    expect(loadSettingsPageMock).toHaveBeenCalledWith({
      locals: event.locals,
      request: event.request,
      tab: "accounts",
      url: event.url,
    });
    expect(event.url.href).toBe(
      "https://example.test/settings/accounts?tab=danger&message=Success",
    );
  });

  it("keeps root actions loadable for non-safe requests", async () => {
    loadSettingsPageMock.mockResolvedValue({ marker: "profile" });
    const settingsRoute = await import("@/routes/settings/+page.server");
    const event = routeEvent("https://example.test/settings?tab=accounts", {
      method: "POST",
    });

    await expect(settingsRoute.load(event as never)).resolves.toEqual({
      marker: "profile",
    });
    expect(loadSettingsPageMock).toHaveBeenCalledWith({
      ...event,
      tab: "profile",
    });
  });
});
