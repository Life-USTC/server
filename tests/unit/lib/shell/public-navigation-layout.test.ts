import { expect, test } from "vitest";
import { load } from "@/routes/+layout.server";

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
    resolveViewerOnClient: true,
  });
  expect(JSON.stringify(data)).not.toContain("private-viewer");
});

test("keeps the viewer in SSR for private workspace routes", async () => {
  const data = await layout("/workspace/overview");
  expect(data).toMatchObject({
    user: { id: "private-viewer" },
    resolveViewerOnClient: false,
  });
});
