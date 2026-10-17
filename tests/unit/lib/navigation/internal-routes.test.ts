import { access } from "node:fs/promises";
import { expect, test } from "vitest";
import {
  CATALOG_LINKS_VIEWER_PATH,
  INTERNAL_ROUTE_PREFIX,
  INTERNAL_VIEWER_ROUTES,
  SHELL_BOOTSTRAP_PATH,
  sectionViewerPath,
} from "@/lib/navigation/internal-routes";

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test("internal route paths keep their wire values", () => {
  expect(INTERNAL_ROUTE_PREFIX).toBe("/_internal");
  expect(SHELL_BOOTSTRAP_PATH).toBe("/_internal/shell-bootstrap");
  expect(CATALOG_LINKS_VIEWER_PATH).toBe("/_internal/catalog/links/viewer");
  expect(sectionViewerPath(123)).toBe("/_internal/catalog/sections/123/viewer");
});

test("every internal path resolves to a route file", async () => {
  const paths = [
    SHELL_BOOTSTRAP_PATH,
    ...INTERNAL_VIEWER_ROUTES.map((route) => route.internal),
  ];
  for (const path of paths) {
    expect(await exists(`src/routes${path}/+server.ts`), path).toBe(true);
  }
});

test("every viewer endpoint has the public page it supplements", async () => {
  for (const route of INTERNAL_VIEWER_ROUTES) {
    expect(
      await exists(`src/routes${route.publicPage}/+page.svelte`),
      route.publicPage,
    ).toBe(true);
  }
});
