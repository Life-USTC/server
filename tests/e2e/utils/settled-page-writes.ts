import type { Page } from "@playwright/test";

/** Keep owned fixture data alive until real UI writes settle, even after failure. */
export async function withSettledPageWrites(
  page: Page,
  match: Parameters<Page["route"]>[0],
  run: () => Promise<void>,
) {
  const pending = new Set<Promise<void>>();
  const errors: unknown[] = [];
  let closing = false;
  const cleanup = async () => {
    closing = true;
    // Fulfill each proxy response before closing the page, so its original
    // intercepted browser request cannot also reach the server.
    while (pending.size) await Promise.all(pending);
    try {
      await page.close();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length)
      throw new AggregateError(errors, "Page write request cleanup failed");
  };
  try {
    await page.route(match, async (route) => {
      if (
        !["POST", "PUT", "PATCH", "DELETE"].includes(route.request().method())
      )
        return route.continue();
      const completion = (async () => {
        try {
          if (closing)
            throw new Error("Page write started during fixture teardown");
          const response = await route.fetch({ maxRedirects: 0 });
          if (page.isClosed())
            throw new Error("Page closed before its write settled");
          await route.fulfill({ response });
        } catch (error) {
          errors.push(error);
          // A failed proxy must not leave the original browser write paused:
          // closing Chromium can release it and send the same write again.
          if (!page.isClosed()) {
            try {
              await route.abort("aborted");
            } catch (abortError) {
              errors.push(abortError);
            }
          }
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
