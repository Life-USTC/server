import type { Page } from "@playwright/test";

/** Keep owned fixture data alive until real UI POSTs settle, even after test failure. */
export async function withSettledPagePosts(
  page: Page,
  match: Parameters<Page["route"]>[0],
  run: () => Promise<void>,
) {
  const pending = new Set<Promise<void>>();
  const errors: unknown[] = [];
  let closing = false;
  const cleanup = async () => {
    closing = true;
    try {
      await page.close();
    } catch (error) {
      errors.push(error);
    }
    await Promise.all(pending);
    if (errors.length)
      throw new AggregateError(errors, "Page POST request cleanup failed");
  };
  try {
    await page.route(match, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const completion = (async () => {
        try {
          const response = await route.fetch({ maxRedirects: 0 });
          try {
            await route.fulfill({ response });
          } catch (error) {
            if (
              !(
                closing &&
                page.isClosed() &&
                error instanceof Error &&
                /^route\.fulfill: Target page, context or browser has been closed(?:\n|$)/.test(
                  error.message,
                )
              )
            )
              throw error;
          }
        } catch (error) {
          errors.push(error);
        }
      })();
      pending.add(completion);
      try {
        await completion;
      } finally {
        pending.delete(completion);
      }
    });
    await run();
  } finally {
    await cleanup();
  }
}
