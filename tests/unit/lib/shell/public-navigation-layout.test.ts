import { beforeEach, expect, test, vi } from "vitest";
import { load } from "@/routes/+layout.server";

const { listSections } = vi.hoisted(() => ({ listSections: vi.fn() }));
vi.mock("@/features/workspace/server/workspace-navigation-summary", () => ({
  listShellSubscribedSections: listSections,
}));

beforeEach(() => {
  listSections.mockReset().mockResolvedValue([{ id: 12 }]);
});

async function layout(path: string) {
  return load({
    url: new URL(path, "https://life.example"),
    locals: {
      locale: "zh-cn",
      publicSsr: false,
      authUser: {
        id: "private-viewer",
        name: "Private Viewer",
        username: "private",
        email: "private@example.test",
      },
    },
  } as unknown as Parameters<typeof load>[0]);
}

test.each([
  "/catalog/courses",
  "/news",
  "/news/story",
  "/news/sources",
  "/search",
  "/catalog/rooms",
  "/community/users/public-user",
  "/api/docs",
])("keeps root data public on eligible navigation route %s", async (path) => {
  const data = await layout(path);
  expect(data).toMatchObject({
    user: null,
    subscribedSections: null,
    resolveViewerOnClient: true,
  });
  expect(JSON.stringify(data)).not.toContain("private-viewer");
  expect(listSections).not.toHaveBeenCalled();
});

test("keeps viewer and subscription SSR for private workspace routes", async () => {
  const data = await layout("/workspace/overview");
  expect(data).toMatchObject({
    user: { id: "private-viewer" },
    subscribedSections: [{ id: 12 }],
    resolveViewerOnClient: false,
  });
  expect(listSections).toHaveBeenCalledWith("private-viewer", "zh-cn");
});
