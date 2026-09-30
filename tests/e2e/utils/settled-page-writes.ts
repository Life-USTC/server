import type { APIResponse, Page, Request } from "@playwright/test";

/** Keep owned fixture data alive until real UI writes settle, even after failure. */
export async function withSettledPageWrites(
  page: Page,
  match: Parameters<Page["route"]>[0],
  run: () => Promise<void>,
  afterResponse?: (response: APIResponse, request: Request) => Promise<void>,
  beforeRequest?: (request: Request) => Promise<void>,
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
      const admitted = !closing;
      const completion = Promise.resolve().then(async () => {
        try {
          if (!admitted)
            throw new Error("Page write started during fixture teardown");
          // The completion is already owned before a scenario delays its PUT.
          await beforeRequest?.(route.request());
          const response = await route.fetch({ maxRedirects: 0 });
          await afterResponse?.(response, route.request());
          if (page.isClosed())
            throw new Error("Page closed before its write settled");
          // APIResponse exposes decoded bytes. Replaying gzip/chunked framing
          // from the upstream response can leave the browser body unfinished.
          const body = await response.body();
          const headers = response.headers();
          // Match APIRequestContext's decoders; other encodings retain their
          // original bytes and representation header.
          if (
            ["gzip", "x-gzip", "br", "deflate"].includes(
              headers["content-encoding"]?.toLowerCase() ?? "",
            )
          )
            delete headers["content-encoding"];
          delete headers["transfer-encoding"];
          if ([204, 304].includes(response.status()))
            delete headers["content-length"];
          else headers["content-length"] = String(body.length);
          await route.fulfill({ response, body, headers });
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
      });
      pending.add(completion);
      try {
        await completion;
      } finally {
        pending.delete(completion);
      }
    });
    await run();
  } catch (runError) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError(
        [runError, cleanupError],
        "Page write fixture and cleanup failed",
      );
    }
    throw runError;
  }
  await cleanup();
}
