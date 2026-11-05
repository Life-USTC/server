import { expect } from "@playwright/test";
import type { CalendarBrowserWriteVerifier } from "./calendar-protocol-lifecycle";

export type AccountWrite = readonly [
  path: string,
  status: number,
  action?: string,
  redirect?: string,
  observeState?: () => Promise<void>,
];

/** Consume scenario expectations once; state never comes from response data. */
export function createAccountWriteObserver(
  writes: readonly AccountWrite[],
  verifyWrite?: CalendarBrowserWriteVerifier,
) {
  const pending = [...writes];
  const observe: CalendarBrowserWriteVerifier = async (response, incoming) => {
    const url = new URL(incoming.url());
    const index = pending.findIndex(
      ([path, , action]) =>
        path === url.pathname && url.search === (action ? `?/${action}` : ""),
    );
    if (index < 0)
      throw new Error(`Unplanned account write: ${url.pathname}${url.search}`);
    const [[, status, action, redirect, observeState]] = pending.splice(
      index,
      1,
    );
    // Both observations finish before the native proxy releases this response.
    // A malformed response must not suppress the persisted-state observation.
    const observations = await Promise.allSettled([
      (async () => {
        expect(incoming.method()).toBe("POST");
        expect(response.status()).toBe(status);
        await response.body();
        if (action) expect(url.search).toBe(`?/${action}`);
        if (redirect && status === 303)
          expect(response.headers().location).toBe(redirect);
        else if (redirect)
          expect(await response.json()).toMatchObject({
            type: "redirect",
            status: 303,
            location: redirect,
          });
        if (verifyWrite) await verifyWrite(response, incoming);
      })(),
      Promise.resolve().then(() => observeState?.()),
    ]);
    const errors = observations.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (errors.length === 1) throw errors[0];
    if (errors.length)
      throw new AggregateError(errors, "Account write observations failed");
  };
  return {
    observe,
    assertStateObserved() {
      // page.request writes are verified by the independent Worker transport
      // ledger; a state callback explicitly requires a real browser write.
      expect(
        pending
          .filter((write) => write[4])
          .map(([path, , action]) => ({
            path,
            action,
          })),
      ).toEqual([]);
    },
  };
}
