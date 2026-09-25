import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../utils/auth";
import { DEV_SEED } from "../../../utils/dev-seed";
import { getCurrentSessionUser } from "../../../utils/e2e-db";

test("signed-in catalog documents remain public while the private shell resolves the viewer", async ({
  page,
}) => {
  // Warm the public representation before introducing any viewer credentials.
  const anonymous = await page.request.get("/catalog/courses");
  expect(anonymous.status()).toBe(200);
  await signInAsDebugUser(page, "/workspace/overview");
  const viewer = await getCurrentSessionUser(page);

  const shellResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/_internal/shell-bootstrap",
  );
  const document = await page.goto("/catalog/courses");
  expect(document?.status()).toBe(200);
  if (!document) throw new Error("Missing document response");
  const html = await document.text();
  expect(html).toContain(DEV_SEED.course.code);
  expect(html).not.toContain(viewer.id);
  expect(html).not.toContain(DEV_SEED.debugName);

  const shell = await shellResponse;
  expect(shell.headers()["cache-control"]).toBe("private, no-store");
  expect((await shell.json()).viewer.id).toBe(viewer.id);
  await expect(page.locator("#app-user-menu")).toContainText(
    DEV_SEED.debugName,
  );
});
