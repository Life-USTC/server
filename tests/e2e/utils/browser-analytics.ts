import type { BrowserContext, Route } from "@playwright/test";

/** Isolate only the application's third-party script in one owned context. */
export async function isolateBrowserAnalytics(context: BrowserContext) {
  const pending = new Set<Promise<void>>();
  const errors: unknown[] = [];
  const remember = (error: unknown) => {
    if (!errors.includes(error)) errors.push(error);
  };
  const match = (url: URL) =>
    url.href === "https://www.googletagmanager.com/gtag/js?id=G-JNK35J2Q3R";
  const handler = async (route: Route) => {
    const task = Promise.resolve()
      .then(() =>
        route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "",
        }),
      )
      .catch(async (error) => {
        remember(error);
        try {
          await route.abort("aborted");
        } catch (abortError) {
          remember(abortError);
        }
      });
    pending.add(task);
    try {
      await task;
    } finally {
      pending.delete(task);
    }
  };
  let disposal: Promise<void> | undefined;
  const dispose = () => {
    disposal ??= (async () => {
      if (!context.isClosed())
        try {
          await context.unroute(match, handler);
        } catch (error) {
          remember(error);
        }
      while (pending.size) await Promise.allSettled([...pending]);
      if (errors.length === 1) throw errors[0];
      if (errors.length)
        throw new AggregateError(errors, "Browser analytics isolation failed");
    })();
    return disposal;
  };
  try {
    await context.route(match, handler);
  } catch (error) {
    remember(error);
    await dispose();
  }
  return dispose;
}
