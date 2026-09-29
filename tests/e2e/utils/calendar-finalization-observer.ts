import { type APIResponse, expect, type Page } from "@playwright/test";
import { createDeferred } from "../../shared/deferred";
import type { CalendarLifecycleBarrier } from "./calendar-lifecycle-barrier";

/** Delegate real IO; the observer must never supply missing lifecycle waits. */
export function observeCalendarFinalization(
  page: Page,
  barrier: CalendarLifecycleBarrier,
) {
  const entered = createDeferred<void>();
  const originalGet = page.request.get;
  const originalClose = page.close;
  let path: string | undefined;
  let armed = false;
  let response: APIResponse | undefined;
  let closeEntered = false;
  const errors: unknown[] = [];

  page.request.get = async (url, options) => {
    const observed = armed && url === path;
    const pending = originalGet.call(page.request, url, options);
    if (observed) entered.resolve();
    const result = await pending;
    if (observed) {
      response = result;
      if (!barrier.releaseRequested) {
        const error = new Error(
          "Producer drain returned while real SQL was blocked",
        );
        errors.push(error);
        throw error;
      }
    }
    return result;
  };
  page.close = async (options) => {
    closeEntered = true;
    try {
      expect(armed).toBe(true);
      expect(
        barrier.releaseRequested,
        "Page closed before native SQL release",
      ).toBe(true);
      await barrier.assertBackendDisconnected();
    } catch (error) {
      errors.push(error);
    }
    // Even a failed guard delegates closure; it never repairs the implementation.
    await originalClose.call(page, options);
  };
  return {
    entered: entered.promise,
    arm(producerPath: string) {
      path = producerPath;
      armed = true;
    },
    async assertPending() {
      await entered.promise;
      const blocked = await barrier.assertStillBlocked();
      // A real Worker round trip gives the delegated drain an opportunity to
      // finish incorrectly. The SQL lock, not elapsed time, is the barrier.
      const health = await originalGet.call(page.request, "/api/health");
      expect(health.status()).toBe(200);
      expect(await health.text()).toBe("ok\n");
      expect(response).toBeUndefined();
      expect(closeEntered).toBe(false);
      expect(page.isClosed()).toBe(false);
      expect(errors).toEqual([]);
      await barrier.assertStillBlocked();
      return blocked;
    },
    async result() {
      expect(errors).toEqual([]);
      expect(closeEntered).toBe(true);
      expect(page.isClosed()).toBe(true);
      if (!response) throw new Error("Missing actual producer drain response");
      expect(response.status()).toBe(200);
      return response.json() as Promise<{
        backgroundErrors: string[];
        requests: Array<{
          outcome: string;
          value: { method: string; path: string; requestId?: string };
          result: number;
        }>;
      }>;
    },
    restore() {
      page.request.get = originalGet;
      page.close = originalClose;
    },
  };
}
